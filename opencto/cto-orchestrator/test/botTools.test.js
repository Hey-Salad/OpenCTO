import test from "node:test";
import assert from "node:assert/strict";
import { denyApproval, executeApprovedAction, executeToolCall } from "../src/botTools.js";

test("request_service_restart queues approval when approvals are required", async () => {
  const state = {};
  const cfg = { requireApprovals: true };

  const result = await executeToolCall({
    cfg,
    state,
    name: "request_service_restart",
    args: {
      service: "opencto-cto-orchestrator.service",
      reason: "validation test",
    },
  });

  assert.equal(result.queued, true);
  assert.equal(typeof result.approval_id, "string");
  assert.match(result.approval_id, /^apr_/);
  assert.equal(state.approvals[result.approval_id].status, "pending");
});

test("denyApproval marks queued action as denied", async () => {
  const state = {};
  const cfg = { requireApprovals: true };
  const queued = await executeToolCall({
    cfg,
    state,
    name: "request_service_restart",
    args: {
      service: "opencto-system-monitor.service",
      reason: "manual deny test",
    },
  });

  const denied = denyApproval(state, queued.approval_id);
  assert.equal(denied.ok, true);
  assert.equal(state.approvals[queued.approval_id].status, "denied");
});

test("executeApprovedAction returns not found for unknown ids", async () => {
  const state = {};
  const result = await executeApprovedAction(state, "apr_missing");
  assert.equal(result.ok, false);
  assert.match(result.message, /not found/i);
});

test("executeApprovedAction fails unsupported actions safely", async () => {
  const state = {
    approvals: {
      apr_x: {
        id: "apr_x",
        status: "pending",
        action: "unsupported_action",
      },
    },
  };

  const result = await executeApprovedAction(state, "apr_x");
  assert.equal(result.ok, false);
  assert.equal(state.approvals.apr_x.status, "failed");
  assert.match(result.message, /Unsupported approval action/i);
});

test("request_service_restart rejects non-opencto service names", async () => {
  const state = {};
  const cfg = { requireApprovals: true };

  await assert.rejects(
    executeToolCall({
      cfg,
      state,
      name: "request_service_restart",
      args: {
        service: "sshd.service",
        reason: "should fail",
      },
    }),
    /Service not allowed/i
  );
});

test("request_service_restart executes immediately when approvals are disabled", async () => {
  const state = {};
  const calls = [];
  const cfg = {
    requireApprovals: false,
    runCommand: async (file, args) => {
      calls.push({ file, args });
      return { stdout: "", stderr: "" };
    },
  };

  const result = await executeToolCall({
    cfg,
    state,
    name: "request_service_restart",
    args: {
      service: "opencto-cto-orchestrator.service",
      reason: "autonomous mode test",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.queued, false);
  assert.equal(result.executed, true);
  assert.match(result.message, /Restarted opencto-cto-orchestrator\.service/i);
  assert.equal(state.approvals, undefined);
  assert.deepEqual(calls, [
    {
      file: "systemctl",
      args: ["--user", "restart", "opencto-cto-orchestrator.service"],
    },
  ]);
});
