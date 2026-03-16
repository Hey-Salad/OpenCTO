import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { kickoffReleaseTrain } from "./githubPlanner.js";

const execFileAsync = promisify(execFile);

function safeInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function serviceAllowed(service) {
  return /^opencto-[a-z0-9-]+\.service$/i.test(service || "");
}

async function runCommand(file, args, timeoutMs = 10000) {
  const { stdout, stderr } = await execFileAsync(file, args, {
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
  });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

function commandRunner(cfg) {
  return typeof cfg?.runCommand === "function" ? cfg.runCommand : runCommand;
}

function ensureApprovalState(state) {
  if (!state.approvals || typeof state.approvals !== "object") {
    state.approvals = {};
  }
  return state.approvals;
}

function approvalId() {
  const rand = Math.random().toString(36).slice(2, 7);
  return `apr_${Date.now().toString(36)}_${rand}`;
}

export function toolDefinitions() {
  return [
    {
      type: "function",
      name: "get_machine_metrics",
      description: "Get current machine metrics (CPU, memory, disk, uptime).",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: "function",
      name: "get_service_status",
      description: "Get systemd user service status for an OpenCTO service.",
      parameters: {
        type: "object",
        properties: {
          service: { type: "string", description: "Service name, e.g., opencto-cto-orchestrator.service" },
        },
        required: ["service"],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: "function",
      name: "get_service_logs",
      description: "Get recent systemd user service logs for an OpenCTO service.",
      parameters: {
        type: "object",
        properties: {
          service: { type: "string" },
          lines: { type: "integer", minimum: 5, maximum: 120 },
        },
        required: ["service", "lines"],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: "function",
      name: "list_pending_approvals",
      description: "List all pending risky actions waiting for user approval.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: "function",
      name: "request_service_restart",
      description: "Queue a restart request for an OpenCTO service. This does not execute until user approves.",
      parameters: {
        type: "object",
        properties: {
          service: { type: "string" },
          reason: { type: "string" },
        },
        required: ["service", "reason"],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: "function",
      name: "start_release_kickoff",
      description:
        "Create or update an agent-driven release train in GitHub (milestone + starter issues).",
      parameters: {
        type: "object",
        properties: {
          version: { type: "string" },
          goal: { type: "string" },
          due_days: { type: "integer", minimum: 3, maximum: 30 },
        },
        required: ["version", "goal", "due_days"],
        additionalProperties: false,
      },
      strict: true,
    },
  ];
}

export async function executeToolCall({ cfg, state, name, args }) {
  const run = commandRunner(cfg);

  if (name === "get_machine_metrics") {
    const response = await fetch(cfg.monitorUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(cfg.httpTimeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Metrics fetch failed (${response.status})`);
    }
    const metrics = await response.json();
    return {
      timestamp: metrics.timestamp,
      cpu: metrics.cpu,
      memory: metrics.memory,
      disk: metrics.disk,
      uptime_seconds: metrics.uptime_seconds,
    };
  }

  if (name === "get_service_status") {
    const service = args?.service;
    if (!serviceAllowed(service)) {
      throw new Error("Service not allowed. Use opencto-*.service only.");
    }
    const res = await run("systemctl", ["--user", "status", service, "--no-pager", "-n", "25"]);
    return { service, status: res.stdout || res.stderr };
  }

  if (name === "get_service_logs") {
    const service = args?.service;
    if (!serviceAllowed(service)) {
      throw new Error("Service not allowed. Use opencto-*.service only.");
    }
    const lines = safeInt(args?.lines, 40, 5, 120);
    const res = await run("journalctl", ["--user", "-u", service, "--no-pager", "-n", String(lines)]);
    return { service, lines, logs: res.stdout || res.stderr };
  }

  if (name === "list_pending_approvals") {
    const approvals = ensureApprovalState(state);
    const pending = Object.values(approvals)
      .filter((item) => item.status === "pending")
      .slice(0, 20);
    return { count: pending.length, items: pending };
  }

  if (name === "request_service_restart") {
    const service = args?.service;
    const reason = String(args?.reason || "No reason provided").slice(0, 300);
    if (!serviceAllowed(service)) {
      throw new Error("Service not allowed. Use opencto-*.service only.");
    }
    if (cfg?.requireApprovals === false) {
      await run("systemctl", ["--user", "restart", service]);
      return {
        ok: true,
        queued: false,
        executed: true,
        service,
        message: `Restarted ${service}.`,
      };
    }
    const approvals = ensureApprovalState(state);
    const id = approvalId();
    approvals[id] = {
      id,
      status: "pending",
      createdAt: new Date().toISOString(),
      action: "restart_service",
      service,
      reason,
    };
    return {
      queued: true,
      approval_id: id,
      instruction: `Ask user to approve with /approve ${id} or deny with /deny ${id}`,
    };
  }

  if (name === "start_release_kickoff") {
    const version = String(args?.version || "").trim().slice(0, 80);
    const goal = String(args?.goal || "").trim().slice(0, 500);
    const dueDays = safeInt(args?.due_days, 7, 3, 30);
    if (!version) {
      throw new Error("version is required");
    }
    if (!goal) {
      throw new Error("goal is required");
    }
    if (!cfg.githubToken || !cfg.githubOwner || !cfg.githubRepo) {
      throw new Error("GitHub token/owner/repo is not configured");
    }
    const result = await kickoffReleaseTrain(cfg, {
      version,
      goal,
      dueDays,
    });
    state.release = {
      ...(state.release || {}),
      lastKickoffAt: new Date().toISOString(),
      lastKickoff: result,
    };
    return result;
  }

  throw new Error(`Unknown tool: ${name}`);
}

export async function executeApprovedAction(state, id) {
  const approvals = ensureApprovalState(state);
  const approval = approvals[id];
  if (!approval) {
    return { ok: false, message: `Approval ${id} not found.` };
  }
  if (approval.status !== "pending") {
    return { ok: false, message: `Approval ${id} is ${approval.status}.` };
  }

  try {
    if (approval.action === "restart_service") {
      await runCommand("systemctl", ["--user", "restart", approval.service]);
      approval.status = "approved_executed";
      approval.completedAt = new Date().toISOString();
      return {
        ok: true,
        message: `Restarted ${approval.service} (approval ${id}).`,
      };
    }
    approval.status = "failed";
    approval.completedAt = new Date().toISOString();
    return { ok: false, message: `Unsupported approval action: ${approval.action}` };
  } catch (error) {
    approval.status = "failed";
    approval.completedAt = new Date().toISOString();
    approval.error = error?.message || String(error);
    return {
      ok: false,
      message: `Execution failed for ${id}: ${approval.error}`,
    };
  }
}

export function denyApproval(state, id) {
  const approvals = ensureApprovalState(state);
  const approval = approvals[id];
  if (!approval) {
    return { ok: false, message: `Approval ${id} not found.` };
  }
  if (approval.status !== "pending") {
    return { ok: false, message: `Approval ${id} is ${approval.status}.` };
  }
  approval.status = "denied";
  approval.completedAt = new Date().toISOString();
  return { ok: true, message: `Denied ${id}.` };
}
