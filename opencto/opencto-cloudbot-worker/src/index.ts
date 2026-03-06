import OpenAI from "openai";

interface Env {
  OPENAI_API_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  OPENCTO_TELEGRAM_CONSUMER_BOT_TOKEN?: string;
  OPENCTO_SLACK_BOT_TOKEN?: string;
  OPENCTO_SLACK_SIGNING_SECRET?: string;
  OPENCTO_SLACK_ALLOWED_CHANNELS?: string;
  OPENCTO_DISCORD_PUBLIC_KEY?: string;
  OPENCTO_DISCORD_ALLOWED_CHANNELS?: string;
  OPENCTO_DISCORD_ALLOWED_GUILDS?: string;
  OPENCTO_INFOBIP_BASE_URL?: string;
  OPENCTO_INFOBIP_API_KEY?: string;
  OPENCTO_INFOBIP_WHATSAPP_FROM?: string;
  OPENCTO_INFOBIP_WHATSAPP_TEMPLATE_NAME?: string;
  OPENCTO_INFOBIP_WHATSAPP_TEMPLATE_LANGUAGE?: string;
  OPENCTO_INFOBIP_SMS_FROM?: string;
  OPENCTO_INFOBIP_WEBHOOK_TOKEN?: string;
  OPENCTO_VECTOR_RAG_ENABLED?: string;
  OPENCTO_EMBED_MODEL?: string;
  OPENCTO_AGENT_MODEL?: string;
  OPENCTO_AGENT_MODEL_PLANNER?: string;
  OPENCTO_AGENT_MODEL_EXECUTOR?: string;
  OPENCTO_AGENT_MODEL_REVIEWER?: string;
  OPENCTO_APPROVAL_REQUIRED?: string;
  OPENCTO_ADMIN_TOKEN?: string;
  OPENCTO_ANYWAY_ENABLED?: string;
  OPENCTO_ANYWAY_API_KEY?: string;
  OPENCTO_ANYWAY_ENDPOINT?: string;
  OPENCTO_ANYWAY_APP_NAME?: string;
  OPENCTO_SIDECAR_ENABLED?: string;
  OPENCTO_SIDECAR_URL?: string;
  OPENCTO_SIDECAR_TOKEN?: string;
  OPENCTO_API_BASE_URL?: string;
  OPENCTO_INTERNAL_API_TOKEN?: string;
  OPENCTO_CODE_AGENT_ENABLED?: string;
  OPENCTO_ANDROID_AUTODEV_ENABLED?: string;
  OPENCTO_ANDROID_AUTODEV_BASE_URL?: string;
  OPENCTO_ANDROID_AUTODEV_PUBLIC_BASE_URL?: string;
  OPENCTO_ANDROID_AUTODEV_TOKEN?: string;
  OPENCTO_ANDROID_AUTODEV_CF_ACCESS_CLIENT_ID?: string;
  OPENCTO_ANDROID_AUTODEV_CF_ACCESS_CLIENT_SECRET?: string;
  OPENCTO_KV: KVNamespace;
  OPENCTO_VECTOR_INDEX?: VectorizeIndex;
}

type TelegramUpdate = {
  update_id: number;
  message?: {
    chat?: { id: number };
    text?: string;
  };
};

type ChatScope = string | number;

type SlackEventEnvelope = {
  type?: string;
  challenge?: string;
  team_id?: string;
  event?: {
    type?: string;
    user?: string;
    text?: string;
    channel?: string;
    channel_type?: string;
    ts?: string;
    thread_ts?: string;
    bot_id?: string;
    subtype?: string;
  };
};

type InfobipInboundMessage = {
  from: string;
  to?: string;
  text: string;
  messageId?: string;
};

type InfobipStatusEvent = {
  from?: string;
  to?: string;
  messageId?: string;
  status: string;
  description?: string;
};

type DiscordInteractionOption = {
  type?: number;
  name?: string;
  value?: string | number | boolean;
  options?: DiscordInteractionOption[];
};

type DiscordInteraction = {
  type?: number;
  id?: string;
  token?: string;
  application_id?: string;
  guild_id?: string;
  channel_id?: string;
  member?: {
    user?: {
      id?: string;
    };
  };
  user?: {
    id?: string;
  };
  data?: {
    name?: string;
    options?: DiscordInteractionOption[];
  };
};

const SYSTEM_PROMPT = [
  "You are OpenCTO CloudBot.",
  "Behave like a coding/ops assistant with safe autonomous defaults.",
  "For risky operations, ask for explicit approval unless override is enabled.",
  "Respond clearly with short execution updates and final outcomes.",
].join(" ");

const SESSION_LIMIT = 12;
const MEMORY_LIMIT = 300;
const TASK_LIMIT = 300;
const DAY_ACTIVITY_LIMIT = 500;
const VECTOR_TOP_K = 6;
const ANYWAY_INGEST_DEFAULT = "https://trace-dev-collector.anyway.sh/v1/ingest";
const WHATSAPP_FREEFORM_WINDOW_MS = 24 * 60 * 60 * 1000;

type AnywaySpanStatus = {
  code: "OK" | "ERROR";
  message?: string;
};

type AnywaySpan = {
  span_id: string;
  parent_span_id?: string;
  name: string;
  start_time: string;
  end_time: string;
  attributes?: Record<string, unknown>;
  status?: AnywaySpanStatus;
};

type SidecarTraceEvent = {
  channel: "telegram" | "slack" | "whatsapp" | "sms" | "discord";
  scope: string;
  text: string;
  direction: "user" | "assistant";
  model?: string;
  trace_id?: string;
  attributes?: Record<string, unknown>;
};

type SidecarEnqueue = (event: SidecarTraceEvent) => void;

type AndroidRelayHealth = {
  ok: boolean;
  device?: {
    serial?: string;
    boot_completed?: boolean;
    devices?: Array<{ serial?: string; state?: string; extra?: string }>;
  };
  error?: string;
};

type AndroidRelayTaskResponse = {
  ok: boolean;
  queued_task?: string;
  task?: {
    task_id?: string;
    goal?: string;
  };
  error?: string;
};

type AndroidRelayCaptureResponse = {
  ok: boolean;
  capture?: {
    type?: string;
    serial?: string;
    artifact?: string;
    seconds?: number;
  };
  artifact_url?: string;
  error?: string;
};

type AndroidRelayRunsResponse = {
  ok: boolean;
  runs?: Array<Record<string, unknown>>;
  error?: string;
};

type AndroidControlPlaneStatus = {
  ok: boolean;
  device?: {
    serial?: string;
    boot_completed?: boolean;
    devices?: Array<{ serial?: string; state?: string; extra?: string }>;
  };
  recent_runs?: Array<Record<string, unknown>>;
  latest_successful_run?: Record<string, unknown> | null;
  latest_failed_run?: Record<string, unknown> | null;
  error?: string;
};

type AndroidChatMeta = {
  chat_id?: string;
  channel?: string;
  thread_ts?: string;
  user_id?: string;
};

type CodeRunApproval = {
  required?: boolean;
  state?: string;
  reason?: string | null;
};

type CodeRunRecord = {
  id: string;
  repoUrl: string;
  repoFullName?: string | null;
  baseBranch: string;
  targetBranch: string;
  status: string;
  requestedCommands: string[];
  errorMessage?: string | null;
  approval?: CodeRunApproval;
};

type CodeRunCreateResponse = {
  run: CodeRunRecord;
  allowlist?: string[];
};

type CodeRunStatusResponse = {
  run: CodeRunRecord;
  metrics?: {
    eventCount?: number;
    artifactCount?: number;
  };
};

type CodeRunEventsResponse = {
  events: Array<{
    seq: number;
    level: string;
    eventType: string;
    message: string;
    createdAt: string;
  }>;
};

function randomHex(length: number) {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, length);
}

function anywayEnabled(env: Env) {
  const flag = (env.OPENCTO_ANYWAY_ENABLED || "").toLowerCase();
  return flag === "true" && Boolean(env.OPENCTO_ANYWAY_API_KEY);
}

function sidecarEnabled(env: Env) {
  const flag = (env.OPENCTO_SIDECAR_ENABLED || "").toLowerCase();
  return (
    flag === "true" &&
    Boolean(env.OPENCTO_SIDECAR_URL) &&
    Boolean(env.OPENCTO_SIDECAR_TOKEN)
  );
}

function androidAutodevEnabled(env: Env) {
  const enabled = (env.OPENCTO_ANDROID_AUTODEV_ENABLED || "").toLowerCase() === "true";
  return enabled && Boolean((env.OPENCTO_ANDROID_AUTODEV_BASE_URL || "").trim());
}

function codeAgentEnabled(env: Env) {
  return (
    (env.OPENCTO_CODE_AGENT_ENABLED || "").toLowerCase() === "true" &&
    Boolean((env.OPENCTO_API_BASE_URL || "").trim()) &&
    Boolean((env.OPENCTO_INTERNAL_API_TOKEN || "").trim())
  );
}

function resolveAnywayIngestEndpoint(raw: string | undefined): string {
  const candidate = (raw || "").trim();
  if (!candidate) return ANYWAY_INGEST_DEFAULT;
  try {
    const url = new URL(candidate);
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = "/v1/ingest";
    }
    return url.toString();
  } catch {
    return candidate;
  }
}

async function sendSidecarEvent(env: Env, event: SidecarTraceEvent) {
  if (!sidecarEnabled(env) || !env.OPENCTO_SIDECAR_URL || !env.OPENCTO_SIDECAR_TOKEN) return;
  try {
    const response = await fetch(env.OPENCTO_SIDECAR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-opencto-sidecar-token": env.OPENCTO_SIDECAR_TOKEN,
      },
      body: JSON.stringify(event),
    });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 300);
      console.error(`sidecar trace failed: ${response.status} ${body}`);
    }
  } catch {
    console.error("sidecar trace failed: network error");
  }
}

async function callAndroidAutodev<T>(
  env: Env,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const baseUrl = (env.OPENCTO_ANDROID_AUTODEV_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error("Android relay base URL is not configured");
  }
  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");
  if (env.OPENCTO_ANDROID_AUTODEV_TOKEN) {
    headers.set("x-android-autodev-token", env.OPENCTO_ANDROID_AUTODEV_TOKEN);
  }
  if (env.OPENCTO_ANDROID_AUTODEV_CF_ACCESS_CLIENT_ID) {
    headers.set(
      "CF-Access-Client-Id",
      env.OPENCTO_ANDROID_AUTODEV_CF_ACCESS_CLIENT_ID,
    );
  }
  if (env.OPENCTO_ANDROID_AUTODEV_CF_ACCESS_CLIENT_SECRET) {
    headers.set(
      "CF-Access-Client-Secret",
      env.OPENCTO_ANDROID_AUTODEV_CF_ACCESS_CLIENT_SECRET,
    );
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(15000),
  });
  const raw = await response.text();
  let payload: unknown = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = { ok: false, error: raw.slice(0, 300) };
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: string }).error || `relay ${response.status}`)
        : `relay ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

async function callOpenctoApi<T>(
  env: Env,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const baseUrl = (env.OPENCTO_API_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error("OpenCTO API base URL is not configured");
  }
  const token = (env.OPENCTO_INTERNAL_API_TOKEN || "").trim();
  if (!token) {
    throw new Error("OpenCTO internal API token is not configured");
  }
  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("x-opencto-internal-token", token);
  headers.set("x-opencto-service-user-email", "slack-bot@opencto.works");
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(20000),
  });
  const raw = await response.text();
  let payload: unknown = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = { error: raw.slice(0, 300) };
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: string }).error || `api ${response.status}`)
        : `api ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

function parseDurationSeconds(text: string, fallback = 15) {
  const match = text.match(/\b(\d{1,3})\s*(seconds?|secs?|minutes?|mins?)\b/i);
  if (!match) return fallback;
  let seconds = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit.startsWith("min")) seconds *= 60;
  return Math.max(1, Math.min(180, seconds));
}

function looksLikeRepoCodingTask(text: string) {
  return /\b(repo|repository|github|git|branch|pull request|pr\b|commit|push|merge|deploy|codebase|opencto\/|src\/|package\.json|wrangler\.toml|fix\b|implement\b|edit\b|refactor\b|build\b|test\b|lint\b)\b/i.test(
    text,
  );
}

function androidExecutorScopeMessage() {
  return [
    "This request is a repo or coding workflow, not a device-execution task.",
    "The Android executor currently handles device QA actions like status, screenshots, videos, app launch, taps, and app-flow checks.",
    "It should not be used for branch, PR, code-edit, or repo delivery work.",
    "Use the coding-agent flow for repo tasks, or send a device-specific Android request.",
  ].join(" ");
}

type CodingPreset = {
  scope: string;
  repoUrl: string;
  repoFullName: string;
  baseBranch: string;
  commandPlan: string[];
};

function codeRunKey(scope: ChatScope) {
  return `code_run_latest:${scopeToString(scope)}`;
}

async function saveLatestCodeRun(env: Env, scope: ChatScope, run: CodeRunRecord) {
  await putJson(env, codeRunKey(scope), {
    id: run.id,
    repoFullName: run.repoFullName || "",
    targetBranch: run.targetBranch,
    updatedAt: nowIso(),
  });
}

async function getLatestCodeRun(env: Env, scope: ChatScope) {
  return getJson<{ id?: string; repoFullName?: string; targetBranch?: string; updatedAt?: string } | null>(
    env,
    codeRunKey(scope),
    null,
  );
}

function slugifyBranch(input: string) {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || `task-${Date.now().toString(36)}`;
}

function findCodingPreset(text: string): CodingPreset | null {
  const normalized = text.toLowerCase();
  if (/\bopencto\/opencto-api-worker\b|\bapi worker\b/.test(normalized)) {
    return {
      scope: "opencto/opencto-api-worker",
      repoUrl: "https://github.com/Hey-Salad/OpenCTO.git",
      repoFullName: "Hey-Salad/OpenCTO",
      baseBranch: "main",
      commandPlan: [
        "git clone https://github.com/Hey-Salad/OpenCTO.git",
        "npm --prefix opencto/opencto-api-worker install",
        "npm --prefix opencto/opencto-api-worker run lint",
        "npm --prefix opencto/opencto-api-worker run build",
        "npm --prefix opencto/opencto-api-worker test",
      ],
    };
  }
  if (/\bopencto\/opencto-dashboard\b|\bdashboard\b/.test(normalized)) {
    return {
      scope: "opencto/opencto-dashboard",
      repoUrl: "https://github.com/Hey-Salad/OpenCTO.git",
      repoFullName: "Hey-Salad/OpenCTO",
      baseBranch: "main",
      commandPlan: [
        "git clone https://github.com/Hey-Salad/OpenCTO.git",
        "npm --prefix opencto/opencto-dashboard install",
        "npm --prefix opencto/opencto-dashboard run lint",
        "npm --prefix opencto/opencto-dashboard run build",
        "npm --prefix opencto/opencto-dashboard test",
      ],
    };
  }
  if (/\bopencto\/mobile-app\b|\bmobile app\b/.test(normalized)) {
    return {
      scope: "opencto/mobile-app",
      repoUrl: "https://github.com/Hey-Salad/OpenCTO.git",
      repoFullName: "Hey-Salad/OpenCTO",
      baseBranch: "main",
      commandPlan: [
        "git clone https://github.com/Hey-Salad/OpenCTO.git",
        "npm --prefix opencto/mobile-app install",
        "npm --prefix opencto/mobile-app run lint",
        "npm --prefix opencto/mobile-app run typecheck",
        "npm --prefix opencto/mobile-app test",
      ],
    };
  }
  if (/\bopencto\/opencto-cloudbot-worker\b|\bcloudbot worker\b/.test(normalized)) {
    return {
      scope: "opencto/opencto-cloudbot-worker",
      repoUrl: "https://github.com/Hey-Salad/OpenCTO.git",
      repoFullName: "Hey-Salad/OpenCTO",
      baseBranch: "main",
      commandPlan: [
        "git clone https://github.com/Hey-Salad/OpenCTO.git",
        "npm --prefix opencto/opencto-cloudbot-worker install",
        "npx --prefix opencto/opencto-cloudbot-worker tsc -p opencto/opencto-cloudbot-worker/tsconfig.json --noEmit --skipLibCheck",
      ],
    };
  }
  return null;
}

function codingAgentHelp() {
  return [
    "Coding agent commands:",
    "/code help - show coding agent commands",
    "/code run <repo scope> | <goal> - start a repo validation run",
    "/code status [run_id] - show latest coding run status",
    "",
    "Supported repo scopes:",
    "- opencto/opencto-api-worker",
    "- opencto/opencto-dashboard",
    "- opencto/mobile-app",
    "- opencto/opencto-cloudbot-worker",
  ].join("\n");
}

async function codingRunReply(env: Env, scope: ChatScope, text: string) {
  if (!codeAgentEnabled(env)) {
    return "Coding agent is not configured yet.";
  }
  const preset = findCodingPreset(text);
  if (!preset) {
    return [
      "I need a supported repo scope before I can start a coding run.",
      "Use one of:",
      "- opencto/opencto-api-worker",
      "- opencto/opencto-dashboard",
      "- opencto/mobile-app",
      "- opencto/opencto-cloudbot-worker",
    ].join("\n");
  }

  const branch = `opencto/${slugifyBranch(text)}`;
  const commands = [...preset.commandPlan];
  commands.splice(1, 0, `git checkout -b ${branch}`);
  const response = await callOpenctoApi<CodeRunCreateResponse>(
    env,
    "/api/v1/internal/codebase/runs?dispatch=async",
    {
      method: "POST",
      body: JSON.stringify({
        repoUrl: preset.repoUrl,
        repoFullName: preset.repoFullName,
        baseBranch: preset.baseBranch,
        targetBranch: branch,
        commands,
        timeoutSeconds: 900,
      }),
    },
  );
  await saveLatestCodeRun(env, scope, response.run);
  return [
    `Accepted coding run for ${preset.scope}.`,
    `Run: ${response.run.id}`,
    `Branch: ${response.run.targetBranch}`,
    `Plan: ${commands.slice(2).join(" -> ")}`,
    "Status: queued for asynchronous execution.",
    "Use /code status to check progress.",
  ].join("\n");
}

async function codingStatusReply(env: Env, scope: ChatScope, explicitRunId?: string) {
  if (!codeAgentEnabled(env)) {
    return "Coding agent is not configured yet.";
  }
  const latest = explicitRunId ? null : await getLatestCodeRun(env, scope);
  const runId = explicitRunId || latest?.id;
  if (!runId) {
    return "No coding run found for this chat yet. Use /code run <repo scope> | <goal> first.";
  }
  const [status, events] = await Promise.all([
    callOpenctoApi<CodeRunStatusResponse>(env, `/api/v1/internal/codebase/runs/${encodeURIComponent(runId)}`),
    callOpenctoApi<CodeRunEventsResponse>(env, `/api/v1/internal/codebase/runs/${encodeURIComponent(runId)}/events?limit=6`),
  ]);
  const run = status.run;
  const lines = [
    `Coding run ${run.id}`,
    `Repo: ${run.repoFullName || run.repoUrl}`,
    `Branch: ${run.targetBranch}`,
    `Status: ${run.status}`,
  ];
  if (run.errorMessage) {
    lines.push(`Error: ${run.errorMessage}`);
  }
  const recent = Array.isArray(events.events) ? events.events.slice(-4) : [];
  if (recent.length) {
    lines.push("Recent events:");
    for (const event of recent) {
      lines.push(`- [${event.level}] ${event.eventType}: ${event.message}`);
    }
  }
  return lines.join("\n");
}

async function androidStatusReply(env: Env) {
  const result = await callAndroidAutodev<AndroidControlPlaneStatus>(env, "/v1/worker/status?limit=5");
  if (!result.ok) {
    return `Android control plane unhealthy: ${result.error || "unknown error"}`;
  }
  const serial = result.device?.serial || "unknown";
  const boot = result.device?.boot_completed ? "yes" : "no";
  const devices = Array.isArray(result.device?.devices) ? result.device?.devices.length : 0;
  const recentRuns = Array.isArray(result.recent_runs) ? result.recent_runs.length : 0;
  return `Android device ready. serial=${serial} boot_completed=${boot} devices=${devices} recent_runs=${recentRuns}`;
}

async function androidTaskReply(
  env: Env,
  scope: ChatScope,
  channel: "telegram" | "slack" | "whatsapp" | "sms" | "discord",
  goal: string,
  chatMeta?: AndroidChatMeta,
) {
  if (looksLikeRepoCodingTask(goal)) {
    return androidExecutorScopeMessage();
  }
  const result = await callAndroidAutodev<AndroidRelayTaskResponse>(env, "/v1/worker/tasks", {
    method: "POST",
    body: JSON.stringify({
      goal,
      platform: channel,
      session_id: scopeToString(scope),
      chat: chatMeta || {},
      metadata: {
        source: "opencto-cloudbot-worker",
        channel,
        chat_scope: scopeToString(scope),
      },
    }),
  });
  const taskId = result.task?.task_id || "unknown-task";
  return `Queued Android task ${taskId}: ${goal}`;
}

async function androidScreenshotReply(env: Env) {
  const result = await callAndroidAutodev<AndroidRelayCaptureResponse>(env, "/v1/worker/capture/screenshot", {
    method: "POST",
    body: JSON.stringify({}),
  });
  const serial = result.capture?.serial || "unknown";
  const url = result.artifact_url ? ` ${result.artifact_url}` : "";
  return `Captured Android screenshot from ${serial}.${url}`;
}

async function androidVideoReply(env: Env, seconds: number) {
  const result = await callAndroidAutodev<AndroidRelayCaptureResponse>(env, "/v1/worker/capture/video", {
    method: "POST",
    body: JSON.stringify({ seconds }),
  });
  const serial = result.capture?.serial || "unknown";
  const url = result.artifact_url ? ` ${result.artifact_url}` : "";
  return `Recorded Android screen video (${seconds}s) from ${serial}.${url}`;
}

async function androidRunsReply(env: Env) {
  const result = await callAndroidAutodev<AndroidControlPlaneStatus>(env, "/v1/worker/status?limit=5");
  const runs = Array.isArray(result.recent_runs) ? result.recent_runs : [];
  if (!runs.length) return "No Android runs found yet.";
  return runs
    .slice(0, 5)
    .map((run) => {
      const taskId = typeof run.task_id === "string" ? run.task_id : "unknown";
      const ok = run.ok === true ? "ok" : "fail";
      const runId = typeof run.run_id === "string" ? run.run_id : "n/a";
      return `- ${taskId} (${ok}) ${runId}`;
    })
    .join("\n");
}

async function maybeHandleAndroidIntent(
  env: Env,
  scope: ChatScope,
  text: string,
  channel: "telegram" | "slack" | "whatsapp" | "sms" | "discord",
  chatMeta?: AndroidChatMeta,
) {
  if (!androidAutodevEnabled(env)) return null;
  const lowered = text.toLowerCase();
  const mentionsDevice = /\b(android|device|phone)\b/.test(lowered);
  const wantsScreenshot =
    /(?:take|capture).*(?:screenshot|screen shot)|(?:screenshot|screen shot).*(?:android|device|phone)/i.test(
      text,
    );
  const wantsVideo =
    /(?:record|capture).*(?:video|screen record|screenrecord)|(?:video|screen record|screenrecord).*(?:android|device|phone)/i.test(
      text,
    );
  const wantsStatus =
    mentionsDevice && /\b(status|health|connected|online|ready)\b/.test(lowered);
  const wantsTask =
    mentionsDevice &&
    /\b(run|open|launch|tap|type|test|check|queue|do|perform|automate)\b/.test(lowered);
  const looksCoding = looksLikeRepoCodingTask(text);

  if (wantsScreenshot) {
    return androidScreenshotReply(env);
  }
  if (wantsVideo) {
    return androidVideoReply(env, parseDurationSeconds(text, 15));
  }
  if (wantsStatus) {
    return androidStatusReply(env);
  }
  if (mentionsDevice && looksCoding) {
    return androidExecutorScopeMessage();
  }
  if (wantsTask) {
    return androidTaskReply(env, scope, channel, text.trim(), chatMeta);
  }
  return null;
}

async function maybeHandleCodingIntent(env: Env, scope: ChatScope, text: string) {
  if (!codeAgentEnabled(env)) return null;
  if (!looksLikeRepoCodingTask(text)) return null;
  return codingRunReply(env, scope, text);
}

class AnywayTraceBuffer {
  private traceId: string;
  private spans: AnywaySpan[] = [];
  private enabled: boolean;
  private appName: string;

  constructor(private env: Env) {
    this.traceId = randomHex(32);
    this.enabled = anywayEnabled(env);
    this.appName = env.OPENCTO_ANYWAY_APP_NAME || "opencto-cloudbot-worker";
  }

  getTraceId() {
    return this.traceId;
  }

  start(name: string, attributes?: Record<string, unknown>) {
    const spanId = randomHex(16);
    const start = nowIso();
    return {
      spanId,
      end: (result?: {
        status?: AnywaySpanStatus;
        attributes?: Record<string, unknown>;
        parentSpanId?: string;
      }) => {
        this.spans.push({
          span_id: spanId,
          parent_span_id: result?.parentSpanId,
          name,
          start_time: start,
          end_time: nowIso(),
          attributes: {
            "service.name": this.appName,
            "app.name": this.appName,
            ...(attributes || {}),
            ...(result?.attributes || {}),
          },
          status: result?.status || { code: "OK" },
        });
      },
    };
  }

  async flush() {
    if (!this.enabled || !this.spans.length || !this.env.OPENCTO_ANYWAY_API_KEY) return;
    const endpoint = resolveAnywayIngestEndpoint(this.env.OPENCTO_ANYWAY_ENDPOINT);
    const traces = [{ trace_id: this.traceId, spans: this.spans }];
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.env.OPENCTO_ANYWAY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ traces, metrics: [] }),
      });
      if (!res.ok) {
        const body = (await res.text()).slice(0, 300);
        console.error(`anyway ingest failed: ${res.status} ${body}`);
      }
    } catch {
      // Fail open: telemetry must not affect bot behavior.
      console.error("anyway ingest failed: network error");
    }
  }
}

function openAITraceHeaders(trace?: AnywayTraceBuffer) {
  if (!trace) return undefined;
  const traceId = trace.getTraceId();
  return {
    "x-opencto-trace-id": traceId,
    traceparent: `00-${traceId}-${randomHex(16)}-01`,
  };
}

function tgSendUrl(token: string) {
  return `https://api.telegram.org/bot${token}/sendMessage`;
}

async function sendTelegram(chatId: number, text: string, token: string) {
  const response = await fetch(tgSendUrl(token), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000) }),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Telegram send failed (${response.status}): ${raw.slice(0, 300)}`);
  }
}

function sessionKey(chatId: ChatScope) {
  return `session:${chatId}`;
}

type SessionItem = { role: "user" | "assistant"; content: string };
type MemoryItem = {
  id: string;
  text: string;
  tags: string[];
  source: string;
  createdAt: string;
};
type MemoryRetrievalItem = MemoryItem & { score?: number; retrieval: "lexical" | "semantic" };
type MemoryIndexItem = {
  id: string;
  preview: string;
  tags: string[];
  source: string;
  updatedAt: string;
};
type TaskItem = {
  id: string;
  title: string;
  status: "open" | "done";
  priority: "low" | "medium" | "high";
  createdAt: string;
  updatedAt: string;
  doneAt?: string;
};
type TaskIndexItem = {
  id: string;
  title: string;
  status: "open" | "done";
  priority: "low" | "medium" | "high";
  updatedAt: string;
};
type ActivityItem = {
  ts: string;
  type: string;
  text: string;
};

type ApiLogBody = {
  chatId?: number | string;
  type?: string;
  text?: string;
};

type ApiTaskBody = {
  chatId?: number | string;
  title?: string;
  priority?: "low" | "medium" | "high";
};

type ScopeStatus = {
  scope: string;
  focus: "general" | "android";
  models: {
    primary: string;
    planner: string;
    executor: string;
    reviewer: string;
  };
  tracing: {
    anyway_enabled: boolean;
    sidecar_enabled: boolean;
  };
  tasks: TaskIndexItem[];
  activities: ActivityItem[];
  android?: {
    enabled: boolean;
    health?: AndroidRelayHealth | null;
    runs?: Array<Record<string, unknown>>;
    error?: string | null;
  };
};

async function loadSession(env: Env, chatId: ChatScope): Promise<SessionItem[]> {
  const raw = await env.OPENCTO_KV.get(sessionKey(chatId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-SESSION_LIMIT) : [];
  } catch {
    return [];
  }
}

async function saveSession(env: Env, chatId: ChatScope, items: SessionItem[]) {
  await env.OPENCTO_KV.put(
    sessionKey(chatId),
    JSON.stringify(items.slice(-SESSION_LIMIT)),
  );
}

function nowIso() {
  return new Date().toISOString();
}

function dayKey(ts = nowIso()) {
  return ts.slice(0, 10);
}

function sanitizeText(text: string, maxLen = 4000) {
  return text.trim().replace(/\s+/g, " ").slice(0, maxLen);
}

function parseChatScopeParam(raw: string | null) {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  return /^\d+$/.test(value) ? Number(value) : value;
}

function memoryIndexKey(chatId: ChatScope) {
  return `memory_index:${chatId}`;
}

function memoryItemKey(chatId: ChatScope, id: string) {
  return `memory:${chatId}:${id}`;
}

function slackThreadKey(teamId: string, channelId: string, threadTs: string) {
  return `slack_thread:${teamId}:${channelId}:${threadTs}`;
}

function taskIndexKey(chatId: ChatScope) {
  return `task_index:${chatId}`;
}

function taskItemKey(chatId: ChatScope, id: string) {
  return `task:${chatId}:${id}`;
}

function activityKey(chatId: ChatScope, yyyyMmDd: string) {
  return `activity:${chatId}:${yyyyMmDd}`;
}

function infobipLastInboundKey(channel: "whatsapp" | "sms", contact: string) {
  return `infobip_last_inbound:${channel}:${contact}`;
}

function makeId(prefix: string) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

function scopeToString(chatId: ChatScope) {
  return String(chatId);
}

function scopeNamespace(chatId: ChatScope) {
  const raw = scopeToString(chatId).replace(/[^a-zA-Z0-9_-]/g, "_");
  return `scope_${raw.slice(0, 48)}`;
}

function modelRoster(env: Env) {
  const primary = env.OPENCTO_AGENT_MODEL || "gpt-4.1-mini";
  return {
    primary,
    planner: env.OPENCTO_AGENT_MODEL_PLANNER || primary,
    executor: env.OPENCTO_AGENT_MODEL_EXECUTOR || primary,
    reviewer: env.OPENCTO_AGENT_MODEL_REVIEWER || primary,
  };
}

function vectorEnabled(env: Env) {
  const flag = (env.OPENCTO_VECTOR_RAG_ENABLED || "true").toLowerCase();
  return flag !== "false" && Boolean(env.OPENCTO_VECTOR_INDEX);
}

async function embedText(env: Env, text: string, trace?: AnywayTraceBuffer) {
  const model = env.OPENCTO_EMBED_MODEL || "text-embedding-3-small";
  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    defaultHeaders: openAITraceHeaders(trace),
  });
  const res = await openai.embeddings.create({
    model,
    input: sanitizeText(text, 3000),
  });
  return res.data?.[0]?.embedding || [];
}

async function getJson<T>(env: Env, key: string, fallback: T): Promise<T> {
  const raw = await env.OPENCTO_KV.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function putJson(env: Env, key: string, value: unknown) {
  await env.OPENCTO_KV.put(key, JSON.stringify(value));
}

async function upsertMemoryVector(
  env: Env,
  chatId: ChatScope,
  item: MemoryItem,
) {
  if (!vectorEnabled(env)) return;
  try {
    const embedding = await embedText(env, item.text);
    if (!embedding.length) return;
    await env.OPENCTO_VECTOR_INDEX?.upsert([
      {
        id: `mem:${scopeToString(chatId)}:${item.id}`,
        namespace: scopeNamespace(chatId),
        values: embedding,
        metadata: {
          scope: scopeToString(chatId),
          memoryId: item.id,
          source: item.source,
          tags: item.tags,
          text: item.text.slice(0, 1500),
          createdAt: item.createdAt,
        },
      },
    ]);
  } catch {
    // Non-blocking: memory stays in KV even if vector indexing fails.
  }
}

async function markSlackThreadActive(
  env: Env,
  teamId: string,
  channelId: string,
  threadTs: string,
) {
  const key = slackThreadKey(teamId, channelId, threadTs);
  await putJson(env, key, { active: true, updatedAt: nowIso() });
}

async function isSlackThreadActive(
  env: Env,
  teamId: string,
  channelId: string,
  threadTs: string,
) {
  const key = slackThreadKey(teamId, channelId, threadTs);
  const marker = await getJson<{ active?: boolean } | null>(env, key, null);
  return Boolean(marker?.active);
}

async function addMemory(
  env: Env,
  chatId: ChatScope,
  text: string,
  tags: string[],
  source = "telegram",
) {
  const clean = sanitizeText(text, 1500);
  if (!clean) return null;
  const id = makeId("mem");
  const createdAt = nowIso();
  const item: MemoryItem = { id, text: clean, tags, source, createdAt };
  await putJson(env, memoryItemKey(chatId, id), item);
  const index = await getJson<MemoryIndexItem[]>(env, memoryIndexKey(chatId), []);
  index.push({
    id,
    preview: clean.slice(0, 160),
    tags: tags.slice(0, 8),
    source,
    updatedAt: createdAt,
  });
  await putJson(env, memoryIndexKey(chatId), index.slice(-MEMORY_LIMIT));
  await upsertMemoryVector(env, chatId, item);
  return item;
}

async function addTask(
  env: Env,
  chatId: ChatScope,
  title: string,
  priority: "low" | "medium" | "high" = "medium",
) {
  const clean = sanitizeText(title, 240);
  if (!clean) return null;
  const id = makeId("task");
  const createdAt = nowIso();
  const item: TaskItem = {
    id,
    title: clean,
    status: "open",
    priority,
    createdAt,
    updatedAt: createdAt,
  };
  await putJson(env, taskItemKey(chatId, id), item);
  const index = await getJson<TaskIndexItem[]>(env, taskIndexKey(chatId), []);
  index.push({
    id,
    title: clean,
    status: "open",
    priority,
    updatedAt: createdAt,
  });
  await putJson(env, taskIndexKey(chatId), index.slice(-TASK_LIMIT));
  return item;
}

async function setTaskStatus(
  env: Env,
  chatId: ChatScope,
  id: string,
  status: "open" | "done",
) {
  const task = await getJson<TaskItem | null>(env, taskItemKey(chatId, id), null);
  if (!task) return null;
  const updatedAt = nowIso();
  const next: TaskItem = {
    ...task,
    status,
    updatedAt,
    doneAt: status === "done" ? updatedAt : undefined,
  };
  await putJson(env, taskItemKey(chatId, id), next);
  const index = await getJson<TaskIndexItem[]>(env, taskIndexKey(chatId), []);
  const updated = index.map((t) =>
    t.id === id ? { ...t, status, updatedAt } : t,
  );
  await putJson(env, taskIndexKey(chatId), updated.slice(-TASK_LIMIT));
  return next;
}

async function listTasks(env: Env, chatId: ChatScope, status?: "open" | "done") {
  const index = await getJson<TaskIndexItem[]>(env, taskIndexKey(chatId), []);
  const filtered = status ? index.filter((t) => t.status === status) : index;
  return filtered.slice(-20).reverse();
}

async function addActivity(
  env: Env,
  chatId: ChatScope,
  type: string,
  text: string,
  ts = nowIso(),
) {
  const key = activityKey(chatId, dayKey(ts));
  const items = await getJson<ActivityItem[]>(env, key, []);
  items.push({ ts, type: sanitizeText(type, 40), text: sanitizeText(text, 400) });
  await putJson(env, key, items.slice(-DAY_ACTIVITY_LIMIT));
}

async function getDailyActivity(
  env: Env,
  chatId: ChatScope,
  yyyyMmDd = dayKey(),
  limit = 40,
) {
  const items = await getJson<ActivityItem[]>(
    env,
    activityKey(chatId, yyyyMmDd),
    [],
  );
  return items.slice(-limit);
}

function focusFromText(text: string): "general" | "android" {
  return /\b(android|device|phone|mobile|expo|eas)\b/i.test(text) ? "android" : "general";
}

function looksLikeStatusQuestion(text: string) {
  return /\b(status|progress|update|summary|roadmap)\b/i.test(text) || /where are we/i.test(text);
}

function statusActivityFilter(focus: "general" | "android", item: ActivityItem) {
  if (focus !== "android") return true;
  return /\bandroid\b|device|screenshot|video|expo|eas/i.test(`${item.type} ${item.text}`);
}

async function gatherScopeStatus(
  env: Env,
  chatId: ChatScope,
  focus: "general" | "android",
): Promise<ScopeStatus> {
  const status: ScopeStatus = {
    scope: scopeToString(chatId),
    focus,
    models: modelRoster(env),
    tracing: {
      anyway_enabled: anywayEnabled(env),
      sidecar_enabled: sidecarEnabled(env),
    },
    tasks: (await listTasks(env, chatId, "open")).slice(0, 6),
    activities: (await getDailyActivity(env, chatId, dayKey(), 50))
      .filter((item) => statusActivityFilter(focus, item))
      .slice(-8),
  };

  if (focus === "android") {
    status.android = { enabled: androidAutodevEnabled(env), health: null, runs: [] };
    if (androidAutodevEnabled(env)) {
      try {
        const payload = await callAndroidAutodev<AndroidControlPlaneStatus>(env, "/v1/worker/status?limit=5");
        status.android.health = { ok: payload.ok, device: payload.device, error: payload.error };
        status.android.runs = Array.isArray(payload.recent_runs) ? payload.recent_runs.slice(0, 5) : [];
      } catch (error) {
        status.android.error = error instanceof Error ? error.message : String(error);
      }
    }
  }

  return status;
}

function formatRunSummary(run: Record<string, unknown>) {
  const taskId = typeof run.task_id === "string" ? run.task_id : "unknown";
  const ok = run.ok === true ? "ok" : "fail";
  const runId = typeof run.run_id === "string" ? run.run_id : "n/a";
  return `- ${taskId} (${ok}) ${runId}`;
}

function renderScopeStatus(status: ScopeStatus) {
  const lines = [
    `Work status (${status.focus})`,
    `Scope: ${status.scope}`,
    `Models: planner=${status.models.planner}, executor=${status.models.executor}, reviewer=${status.models.reviewer}, live=${status.models.primary}`,
    `Tracing: anyway=${status.tracing.anyway_enabled ? "on" : "off"} sidecar=${status.tracing.sidecar_enabled ? "on" : "off"}`,
    `Open tasks: ${status.tasks.length}`,
  ];

  if (status.tasks.length) {
    lines.push("Open tasks:");
    for (const task of status.tasks) {
      lines.push(`- [${task.id}] (${task.priority}) ${task.title}`);
    }
  }

  if (status.activities.length) {
    lines.push("Recent activity:");
    for (const item of status.activities) {
      lines.push(`- ${item.ts.slice(11, 19)} ${item.type}: ${item.text.slice(0, 120)}`);
    }
  }

  if (status.android) {
    lines.push(`Android relay: ${status.android.enabled ? "enabled" : "disabled"}`);
    if (status.android.error) {
      lines.push(`Android error: ${status.android.error}`);
    } else if (status.android.health?.ok) {
      const serial = status.android.health.device?.serial || "unknown";
      const boot = status.android.health.device?.boot_completed ? "yes" : "no";
      lines.push(`Android health: serial=${serial} boot_completed=${boot}`);
    }
    if (status.android.runs?.length) {
      lines.push("Recent Android runs:");
      for (const run of status.android.runs.slice(0, 5)) {
        lines.push(formatRunSummary(run));
      }
    }
  }

  return lines.join("\n");
}

async function scopeStatusReply(
  env: Env,
  chatId: ChatScope,
  focus: "general" | "android",
) {
  const status = await gatherScopeStatus(env, chatId, focus);
  return renderScopeStatus(status);
}

function tokenSet(text: string) {
  const words = text.toLowerCase().match(/[a-z0-9_]+/g) || [];
  return new Set(words.filter((w) => w.length > 2));
}

function overlapScore(a: Set<string>, b: Set<string>) {
  let count = 0;
  for (const w of a) if (b.has(w)) count += 1;
  return count;
}

async function retrieveMemories(
  env: Env,
  chatId: ChatScope,
  query: string,
  trace?: AnywayTraceBuffer,
) {
  const span = trace?.start("rag.retrieve.lexical", {
    "chat.scope": scopeToString(chatId),
  });
  const index = await getJson<MemoryIndexItem[]>(env, memoryIndexKey(chatId), []);
  if (!index.length) {
    span?.end({ attributes: { "rag.lexical.count": 0 } });
    return [];
  }
  const q = tokenSet(query);
  const ranked = index
    .map((m) => ({ ...m, score: overlapScore(q, tokenSet(`${m.preview} ${m.tags.join(" ")}`)) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);
  const out: MemoryItem[] = [];
  for (const m of ranked) {
    const item = await getJson<MemoryItem | null>(env, memoryItemKey(chatId, m.id), null);
    if (item) out.push(item);
  }
  span?.end({ attributes: { "rag.lexical.count": out.length } });
  return out;
}

async function retrieveSemanticMemories(
  env: Env,
  chatId: ChatScope,
  query: string,
  trace?: AnywayTraceBuffer,
): Promise<MemoryRetrievalItem[]> {
  const span = trace?.start("rag.retrieve.semantic", {
    "chat.scope": scopeToString(chatId),
    "rag.vector.enabled": vectorEnabled(env),
  });
  if (!vectorEnabled(env)) {
    span?.end({ attributes: { "rag.semantic.count": 0 } });
    return [];
  }
  try {
    const embedding = await embedText(env, query, trace);
    if (!embedding.length) {
      span?.end({ attributes: { "rag.semantic.count": 0 } });
      return [];
    }
    const matches = await env.OPENCTO_VECTOR_INDEX?.query(embedding, {
      namespace: scopeNamespace(chatId),
      topK: VECTOR_TOP_K,
      returnMetadata: "all",
    });
    const rows = matches?.matches || [];
    const result: MemoryRetrievalItem[] = rows
      .map((m) => {
        const md = (m.metadata || {}) as Record<string, string | number | boolean | string[]>;
        const text = typeof md.text === "string" ? md.text : "";
        const memoryId = typeof md.memoryId === "string" ? md.memoryId : m.id;
        const source = typeof md.source === "string" ? md.source : "semantic";
        const createdAt = typeof md.createdAt === "string" ? md.createdAt : nowIso();
        const tags = Array.isArray(md.tags)
          ? md.tags.filter((x): x is string => typeof x === "string")
          : [];
        if (!text) return null;
        return {
          id: memoryId,
          text,
          tags,
          source,
          createdAt,
          score: m.score,
          retrieval: "semantic" as const,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    span?.end({ attributes: { "rag.semantic.count": result.length } });
    return result;
  } catch {
    span?.end({ status: { code: "ERROR", message: "semantic retrieval failed" } });
    return [];
  }
}

function mergeMemories(
  lexical: MemoryItem[],
  semantic: MemoryRetrievalItem[],
): MemoryRetrievalItem[] {
  const map = new Map<string, MemoryRetrievalItem>();
  for (const m of semantic) {
    map.set(m.id, m);
  }
  for (const m of lexical) {
    if (!map.has(m.id)) {
      map.set(m.id, { ...m, retrieval: "lexical" });
    }
  }
  return Array.from(map.values()).slice(0, 6);
}

async function buildContext(
  env: Env,
  chatId: ChatScope,
  text: string,
  trace?: AnywayTraceBuffer,
) {
  const lexicalMemories = await retrieveMemories(env, chatId, text, trace);
  const semanticMemories = await retrieveSemanticMemories(env, chatId, text, trace);
  const memories = mergeMemories(lexicalMemories, semanticMemories);
  const openTasks = await listTasks(env, chatId, "open");
  const today = await getDailyActivity(env, chatId, dayKey(), 12);
  const lines: string[] = [];
  if (memories.length) {
    lines.push("Relevant persistent memory:");
    for (const m of memories.slice(0, 4)) {
      lines.push(`- [${m.id}] (${m.retrieval}) ${m.text.slice(0, 260)}`);
    }
  }
  if (openTasks.length) {
    lines.push("Open tasks:");
    for (const t of openTasks.slice(0, 6)) {
      lines.push(`- [${t.id}] (${t.priority}) ${t.title}`);
    }
  }
  if (today.length) {
    lines.push("Today activity log (latest):");
    for (const a of today.slice(-6)) {
      lines.push(`- ${a.ts.slice(11, 19)} ${a.type}: ${a.text.slice(0, 120)}`);
    }
  }
  return lines.join("\n");
}

function isCommand(text: string) {
  return text.startsWith("/");
}

async function handleCommand(
  env: Env,
  chatId: ChatScope,
  text: string,
  channel: "telegram" | "slack" | "whatsapp" | "sms" | "discord",
) {
  const trimmed = text.trim();
  const [cmd, ...rest] = trimmed.split(" ");
  const arg = rest.join(" ").trim();

  if (cmd === "/help") {
    return [
      "OpenCTO commands:",
      "/remember <text> - save persistent memory",
      "/task add <title> - create task",
      "/task done <task_id> - mark task complete",
      "/tasks - list open tasks",
      "/status - show grounded work status",
      "/daily - show today activity log",
      "/android help - show Android relay commands",
      "/code help - show coding agent commands",
    ].join("\n");
  }

  if (cmd === "/android") {
    if (!androidAutodevEnabled(env)) {
      return "Android relay is not configured.";
    }
    const [action, ...tail] = arg.split(" ");
    const payload = tail.join(" ").trim();

    if (!action || action === "help") {
      return [
        "Android relay commands:",
        "/android status - check connected device",
        "/android screenshot - capture a device screenshot",
        "/android video [seconds] - record a screen video",
        "/android task <goal> - queue an Android agent task",
        "/android runs - list recent Android runs",
      ].join("\n");
    }

    if (action === "status") {
      const reply = await androidStatusReply(env);
      await addActivity(env, chatId, "android.status", reply);
      return reply;
    }
    if (action === "screenshot") {
      const reply = await androidScreenshotReply(env);
      await addActivity(env, chatId, "android.screenshot", reply);
      return reply;
    }
    if (action === "video") {
      const seconds = parseDurationSeconds(payload, 15);
      const reply = await androidVideoReply(env, seconds);
      await addActivity(env, chatId, "android.video", reply);
      return reply;
    }
    if (action === "task") {
      if (!payload) return "Usage: /android task <goal>";
      const reply = await androidTaskReply(env, chatId, channel, payload);
      await addActivity(env, chatId, "android.task", reply);
      return reply;
    }
    if (action === "runs") {
      const reply = await androidRunsReply(env);
      await addActivity(env, chatId, "android.runs", reply);
      return reply;
    }
    return "Usage: /android help|status|screenshot|video [seconds]|task <goal>|runs";
  }

  if (cmd === "/code") {
    const [action, ...tail] = arg.split(" ");
    const payload = tail.join(" ").trim();
    if (!action || action === "help") {
      return codingAgentHelp();
    }
    if (action === "run") {
      if (!payload) return "Usage: /code run <repo scope> | <goal>";
      return codingRunReply(env, chatId, payload);
    }
    if (action === "status") {
      return codingStatusReply(env, chatId, payload || undefined);
    }
    return codingAgentHelp();
  }

  if (cmd === "/remember") {
    if (!arg) return "Usage: /remember <text>";
    const mem = await addMemory(env, chatId, arg, ["user"], "telegram");
    if (!mem) return "Unable to store memory.";
    await addActivity(env, chatId, "memory.added", mem.text);
    return `Stored memory ${mem.id}`;
  }

  if (cmd === "/tasks") {
    const tasks = await listTasks(env, chatId, "open");
    if (!tasks.length) return "No open tasks.";
    return tasks
      .slice(0, 12)
      .map((t) => `- [${t.id}] (${t.priority}) ${t.title}`)
      .join("\n");
  }

  if (cmd === "/status") {
    return scopeStatusReply(env, chatId, focusFromText(arg || ""));
  }

  if (cmd === "/task") {
    const [action, ...tail] = arg.split(" ");
    const payload = tail.join(" ").trim();
    if (action === "add") {
      if (!payload) return "Usage: /task add <title>";
      const task = await addTask(env, chatId, payload, "medium");
      if (!task) return "Unable to create task.";
      await addActivity(env, chatId, "task.added", `${task.id} ${task.title}`);
      return `Created task ${task.id}`;
    }
    if (action === "done") {
      if (!payload) return "Usage: /task done <task_id>";
      const updated = await setTaskStatus(env, chatId, payload, "done");
      if (!updated) return "Task not found.";
      await addActivity(env, chatId, "task.done", `${updated.id} ${updated.title}`);
      return `Completed ${updated.id}`;
    }
    return "Usage: /task add <title> or /task done <task_id>";
  }

  if (cmd === "/daily") {
    const items = await getDailyActivity(env, chatId, dayKey(), 20);
    if (!items.length) return "No activity logged today.";
    return items
      .slice(-15)
      .map((a) => `- ${a.ts.slice(11, 19)} ${a.type}: ${a.text}`)
      .join("\n");
  }

  return null;
}

async function runChatTurn(
  env: Env,
  scope: ChatScope,
  text: string,
  channel: "telegram" | "slack" | "whatsapp" | "sms" | "discord",
  trace?: AnywayTraceBuffer,
  chatMeta?: AndroidChatMeta,
) {
  const commandReply = isCommand(text) ? await handleCommand(env, scope, text, channel) : null;
  const androidReply = commandReply ? null : await maybeHandleAndroidIntent(env, scope, text, channel, chatMeta);
  const codingReply = commandReply || androidReply ? null : await maybeHandleCodingIntent(env, scope, text);
  const statusReply =
    commandReply || androidReply || codingReply || !looksLikeStatusQuestion(text)
      ? null
      : await scopeStatusReply(env, scope, focusFromText(text));
  if (androidReply) {
    await addActivity(env, scope, `${channel}.android`, androidReply.slice(0, 300));
  }
  if (codingReply) {
    await addActivity(env, scope, `${channel}.coding`, codingReply.slice(0, 300));
  }
  if (statusReply) {
    await addActivity(env, scope, `${channel}.status`, statusReply.slice(0, 300));
  }
  const answer =
    commandReply ||
    androidReply ||
    codingReply ||
    statusReply ||
    (await generateAssistantReply(env, scope, text, trace));
  return {
    answer,
    command: Boolean(commandReply || androidReply || codingReply || statusReply),
    userType: `${channel}.user`,
    botType: `${channel}.bot`,
  };
}

function badRequest(message: string) {
  return Response.json({ ok: false, error: message }, { status: 400 });
}

function unauthorized() {
  return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

function forbidden(message: string) {
  return Response.json({ ok: false, error: message }, { status: 403 });
}

function adminAuthorized(request: Request, env: Env) {
  if (!env.OPENCTO_ADMIN_TOKEN) return true;
  const got = request.headers.get("x-opencto-admin-token") || "";
  return got === env.OPENCTO_ADMIN_TOKEN;
}

async function handleApi(request: Request, env: Env, url: URL) {
  if (!adminAuthorized(request, env)) return unauthorized();

  if (request.method === "POST" && url.pathname === "/api/log-activity") {
    const body = (await request.json()) as ApiLogBody;
    if (!body.chatId || !body.type || !body.text) {
      return badRequest("chatId, type, text required");
    }
    await addActivity(env, body.chatId, body.type, body.text);
    return Response.json({ ok: true });
  }

  if (request.method === "POST" && url.pathname === "/api/tasks") {
    const body = (await request.json()) as ApiTaskBody;
    if (!body.chatId || !body.title) {
      return badRequest("chatId and title required");
    }
    const task = await addTask(
      env,
      body.chatId,
      body.title,
      body.priority || "medium",
    );
    return Response.json({ ok: true, task });
  }

  if (request.method === "GET" && url.pathname === "/api/tasks") {
    const chatId = parseChatScopeParam(url.searchParams.get("chatId"));
    const status = url.searchParams.get("status");
    if (!chatId) return badRequest("chatId required");
    const tasks = await listTasks(
      env,
      chatId,
      status === "open" || status === "done" ? status : undefined,
    );
    return Response.json({ ok: true, tasks });
  }

  if (request.method === "GET" && url.pathname === "/api/activity/daily") {
    const chatId = parseChatScopeParam(url.searchParams.get("chatId"));
    const date = url.searchParams.get("date") || dayKey();
    if (!chatId) return badRequest("chatId required");
    const activities = await getDailyActivity(env, chatId, date, 100);
    return Response.json({ ok: true, date, activities });
  }

  if (request.method === "GET" && url.pathname === "/api/status") {
    const chatId = parseChatScopeParam(url.searchParams.get("chatId"));
    const focusRaw = (url.searchParams.get("focus") || "general").toLowerCase();
    if (!chatId) return badRequest("chatId required");
    const focus = focusRaw === "android" ? "android" : "general";
    const status = await gatherScopeStatus(env, chatId, focus);
    return Response.json({ ok: true, status, summary: renderScopeStatus(status) });
  }

  return new Response("Not Found", { status: 404 });
}

async function handleTelegramUpdate(
  env: Env,
  update: TelegramUpdate,
  botToken: string,
  botKind: "admin" | "consumer",
  trace?: AnywayTraceBuffer,
  enqueueSidecar?: SidecarEnqueue,
): Promise<Response> {
  const root = trace?.start("telegram.webhook.handle", { "telegram.bot_kind": botKind });
  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim();
  const userActivityType = botKind === "consumer" ? "telegram.consumer.user" : "telegram.user";
  const botActivityType = botKind === "consumer" ? "telegram.consumer.bot" : "telegram.bot";
  const errorActivityType = botKind === "consumer" ? "telegram.consumer.error" : "telegram.error";
  if (!chatId || !text) {
    root?.end({ attributes: { "telegram.empty": true } });
    return new Response("ok", { status: 200 });
  }

  enqueueSidecar?.({
    channel: "telegram",
    scope: scopeToString(chatId),
    text,
    direction: "user",
    trace_id: trace?.getTraceId(),
    attributes: {
      bot_kind: botKind,
      service_name: "opencto-cloudbot-worker",
      agent_role: "channel_orchestrator",
    },
  });
  await addActivity(env, chatId, userActivityType, text.slice(0, 300));
  try {
    const turn = await runChatTurn(
      env,
      chatId,
      text,
      "telegram",
      trace,
      { chat_id: String(chatId) },
    );
    const answer = turn.answer;
    await sendTelegram(chatId, answer, botToken);
    enqueueSidecar?.({
      channel: "telegram",
      scope: scopeToString(chatId),
      text: answer,
      direction: "assistant",
      model: env.OPENCTO_AGENT_MODEL || "gpt-4.1-mini",
      trace_id: trace?.getTraceId(),
      attributes: {
        bot_kind: botKind,
        command: turn.command,
        service_name: "opencto-cloudbot-worker",
        agent_role: "channel_orchestrator",
      },
    });
    await addActivity(env, chatId, botActivityType, answer.slice(0, 300));
    root?.end({
      attributes: {
        "chat.scope": scopeToString(chatId),
        "telegram.command": turn.command,
        "telegram.bot_kind": botKind,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await addActivity(env, chatId, errorActivityType, message.slice(0, 350));
    root?.end({
      status: { code: "ERROR", message: "telegram reply failed" },
      attributes: {
        "chat.scope": scopeToString(chatId),
        "telegram.bot_kind": botKind,
      },
    });
  }

  return new Response("ok", { status: 200 });
}

function infobipConfigured(env: Env, channel: "whatsapp" | "sms") {
  if (!env.OPENCTO_INFOBIP_BASE_URL || !env.OPENCTO_INFOBIP_API_KEY) return false;
  if (channel === "whatsapp") return Boolean(env.OPENCTO_INFOBIP_WHATSAPP_FROM);
  return Boolean(env.OPENCTO_INFOBIP_SMS_FROM);
}

function normalizeInfobipBaseUrl(env: Env) {
  return (env.OPENCTO_INFOBIP_BASE_URL || "").replace(/\/+$/, "");
}

function normalizeInfobipAddress(value: string) {
  return value.replace(/[^\d]/g, "");
}

function parseInfobipText(result: Record<string, unknown>) {
  if (typeof result.text === "string" && result.text.trim()) return result.text.trim();
  const content = result.content as Record<string, unknown> | undefined;
  if (content && typeof content.text === "string" && content.text.trim()) {
    return content.text.trim();
  }
  const message = result.message as Record<string, unknown> | undefined;
  if (message && typeof message.text === "string" && message.text.trim()) {
    return message.text.trim();
  }
  return "";
}

function extractInfobipMessages(body: unknown): InfobipInboundMessage[] {
  if (!body || typeof body !== "object") return [];
  const payload = body as Record<string, unknown>;
  const candidates = [
    ...(Array.isArray(payload.results) ? payload.results : []),
    ...(Array.isArray(payload.messages) ? payload.messages : []),
  ];

  const events: InfobipInboundMessage[] = [];
  for (const raw of candidates) {
    if (!raw || typeof raw !== "object") continue;
    const result = raw as Record<string, unknown>;
    const from = typeof result.from === "string" ? result.from : "";
    const to = typeof result.to === "string" ? result.to : undefined;
    const text = parseInfobipText(result);
    const messageId = typeof result.messageId === "string" ? result.messageId : undefined;
    if (!from || !text) continue;
    events.push({ from, to, text, messageId });
  }
  return events;
}

function normalizeStatusToken(value: string) {
  const lowered = value.toLowerCase();
  let token = "";
  let lastWasUnderscore = false;
  for (let i = 0; i < lowered.length; i += 1) {
    const ch = lowered.charCodeAt(i);
    const isAlphaNum = (ch >= 97 && ch <= 122) || (ch >= 48 && ch <= 57);
    if (isAlphaNum) {
      token += lowered[i];
      lastWasUnderscore = false;
      continue;
    }
    if (!lastWasUnderscore && token.length > 0) {
      token += "_";
      lastWasUnderscore = true;
    }
  }
  if (token.endsWith("_")) {
    token = token.slice(0, -1);
  }
  return token || "unknown";
}

function parseInfobipStatus(result: Record<string, unknown>) {
  const nestedStatus = result.status as Record<string, unknown> | undefined;
  const nestedMessage = result.message as Record<string, unknown> | undefined;
  const messageStatus = nestedMessage?.status as Record<string, unknown> | undefined;
  const groupName =
    (typeof nestedStatus?.groupName === "string" && nestedStatus.groupName) ||
    (typeof messageStatus?.groupName === "string" && messageStatus.groupName) ||
    "";
  const name =
    (typeof nestedStatus?.name === "string" && nestedStatus.name) ||
    (typeof messageStatus?.name === "string" && messageStatus.name) ||
    "";
  const fallback =
    (typeof result.type === "string" && result.type) ||
    (typeof result.eventType === "string" && result.eventType) ||
    "";
  return groupName || name || fallback;
}

function parseInfobipStatusDescription(result: Record<string, unknown>) {
  const nestedStatus = result.status as Record<string, unknown> | undefined;
  const nestedMessage = result.message as Record<string, unknown> | undefined;
  const messageStatus = nestedMessage?.status as Record<string, unknown> | undefined;
  const direct =
    (typeof nestedStatus?.description === "string" && nestedStatus.description) ||
    (typeof messageStatus?.description === "string" && messageStatus.description) ||
    "";
  if (direct) return direct;
  const nestedError = result.error as Record<string, unknown> | undefined;
  return typeof nestedError?.description === "string" ? nestedError.description : "";
}

function extractInfobipStatusEvents(body: unknown): InfobipStatusEvent[] {
  if (!body || typeof body !== "object") return [];
  const payload = body as Record<string, unknown>;
  const candidates = [
    ...(Array.isArray(payload.results) ? payload.results : []),
    ...(Array.isArray(payload.messages) ? payload.messages : []),
  ];

  const events: InfobipStatusEvent[] = [];
  for (const raw of candidates) {
    if (!raw || typeof raw !== "object") continue;
    const result = raw as Record<string, unknown>;
    const statusRaw = parseInfobipStatus(result);
    if (!statusRaw) continue;
    const status = normalizeStatusToken(statusRaw);
    const from = typeof result.from === "string" ? result.from : undefined;
    const to = typeof result.to === "string" ? result.to : undefined;
    const messageId = typeof result.messageId === "string" ? result.messageId : undefined;
    const description = parseInfobipStatusDescription(result);
    events.push({ from, to, messageId, status, description });
  }
  return events;
}

function resolveInfobipContactScope(
  env: Env,
  channel: "whatsapp" | "sms",
  from?: string,
  to?: string,
) {
  const configuredSender = normalizeInfobipAddress(
    channel === "whatsapp"
      ? env.OPENCTO_INFOBIP_WHATSAPP_FROM || ""
      : env.OPENCTO_INFOBIP_SMS_FROM || "",
  );
  const fromNorm = normalizeInfobipAddress(from || "");
  const toNorm = normalizeInfobipAddress(to || "");
  if (fromNorm && configuredSender && fromNorm === configuredSender && toNorm) return toNorm;
  return fromNorm || toNorm || "unknown";
}

function infobipWebhookAuthorized(request: Request, env: Env) {
  const expected = (env.OPENCTO_INFOBIP_WEBHOOK_TOKEN || "").trim();
  if (!expected) return true;
  const gotHeader = (request.headers.get("x-opencto-infobip-token") || "").trim();
  if (gotHeader && gotHeader === expected) return true;
  const token = new URL(request.url).searchParams.get("token") || "";
  return token.trim() === expected;
}

async function setInfobipLastInbound(
  env: Env,
  channel: "whatsapp" | "sms",
  contact: string,
  ts = nowIso(),
) {
  const key = infobipLastInboundKey(channel, contact);
  await putJson(env, key, { ts });
}

async function getInfobipLastInboundAgeMs(
  env: Env,
  channel: "whatsapp" | "sms",
  contact: string,
) {
  const key = infobipLastInboundKey(channel, contact);
  const value = await getJson<{ ts?: string } | null>(env, key, null);
  const rawTs = value?.ts || "";
  if (!rawTs) return null;
  const then = Date.parse(rawTs);
  if (!Number.isFinite(then)) return null;
  return Date.now() - then;
}

async function sendInfobipWhatsappTemplate(
  env: Env,
  destination: string,
  text: string,
  headers: Record<string, string>,
  baseUrl: string,
) {
  const from = normalizeInfobipAddress(env.OPENCTO_INFOBIP_WHATSAPP_FROM || "");
  const templateName = (env.OPENCTO_INFOBIP_WHATSAPP_TEMPLATE_NAME || "").trim();
  if (!templateName) {
    throw new Error(
      "Infobip WhatsApp free-form window exceeded and OPENCTO_INFOBIP_WHATSAPP_TEMPLATE_NAME is not configured",
    );
  }
  const language = (env.OPENCTO_INFOBIP_WHATSAPP_TEMPLATE_LANGUAGE || "en").trim();
  const response = await fetch(`${baseUrl}/whatsapp/1/message/template`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      from,
      to: destination,
      content: {
        templateName,
        templateData: {
          body: {
            placeholders: [text.slice(0, 1024)],
          },
        },
        language,
      },
    }),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Infobip WhatsApp template send failed (${response.status}): ${raw.slice(0, 300)}`);
  }
}

async function sendInfobipMessage(
  env: Env,
  channel: "whatsapp" | "sms",
  to: string,
  text: string,
  scopeContact?: string,
) {
  const destination = normalizeInfobipAddress(to);
  const baseUrl = normalizeInfobipBaseUrl(env);
  const headers = {
    Authorization: `App ${env.OPENCTO_INFOBIP_API_KEY || ""}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (channel === "whatsapp") {
    const from = normalizeInfobipAddress(env.OPENCTO_INFOBIP_WHATSAPP_FROM || "");
    const contact = normalizeInfobipAddress(scopeContact || to);
    const ageMs = await getInfobipLastInboundAgeMs(env, channel, contact);
    const withinWindow = ageMs !== null && ageMs <= WHATSAPP_FREEFORM_WINDOW_MS;
    if (!withinWindow) {
      await sendInfobipWhatsappTemplate(env, destination, text, headers, baseUrl);
      return;
    }
    const response = await fetch(`${baseUrl}/whatsapp/1/message/text`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        from,
        to: destination,
        content: { text: text.slice(0, 4096) },
      }),
    });
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(
        `Infobip WhatsApp send failed (${response.status}): ${raw.slice(0, 300)}`,
      );
    }
    return;
  }

  const response = await fetch(`${baseUrl}/sms/2/text/advanced`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      messages: [
        {
          from: normalizeInfobipAddress(env.OPENCTO_INFOBIP_SMS_FROM || ""),
          destinations: [{ to: destination }],
          text: text.slice(0, 1530),
        },
      ],
    }),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Infobip SMS send failed (${response.status}): ${raw.slice(0, 300)}`);
  }
}

async function handleInfobipWebhook(
  request: Request,
  env: Env,
  channel: "whatsapp" | "sms",
  trace?: AnywayTraceBuffer,
  enqueueSidecar?: SidecarEnqueue,
): Promise<Response> {
  const root = trace?.start("infobip.webhook.handle", { "infobip.channel": channel });
  if (!infobipConfigured(env, channel)) {
    root?.end({
      status: { code: "ERROR", message: "infobip not configured" },
      attributes: { "infobip.configured": false },
    });
    return Response.json(
      { ok: false, error: `infobip ${channel} not configured` },
      { status: 503 },
    );
  }
  if (!infobipWebhookAuthorized(request, env)) {
    root?.end({
      status: { code: "ERROR", message: "invalid webhook token" },
    });
    return forbidden("invalid infobip webhook token");
  }

  const payload = (await request.json()) as unknown;
  const messages = extractInfobipMessages(payload);
  const statusEvents = extractInfobipStatusEvents(payload);
  if (!messages.length && !statusEvents.length) {
    root?.end({ attributes: { "infobip.messages": 0 } });
    return new Response("ok", { status: 200 });
  }

  for (const event of statusEvents) {
    const contact = resolveInfobipContactScope(env, channel, event.from, event.to);
    const scope = `infobip:${channel}:${contact}`;
    const parts = [`status=${event.status}`];
    if (event.messageId) parts.push(`messageId=${event.messageId}`);
    if (event.description) parts.push(`detail=${event.description}`);
    await addActivity(
      env,
      scope,
      `infobip.${channel}.status.${event.status}`,
      parts.join(" ").slice(0, 300),
    );
  }

  for (const msg of messages) {
    const contact = normalizeInfobipAddress(msg.from);
    const scope = `infobip:${channel}:${contact}`;
    enqueueSidecar?.({
      channel,
      scope: scopeToString(scope),
      text: msg.text,
      direction: "user",
      trace_id: trace?.getTraceId(),
      attributes: {
        contact,
        service_name: "opencto-cloudbot-worker",
        agent_role: "channel_orchestrator",
      },
    });
    await setInfobipLastInbound(env, channel, contact);
    await addActivity(env, scope, `infobip.${channel}.user`, msg.text.slice(0, 300));
    try {
      const chatChannel = channel === "whatsapp" ? "whatsapp" : "sms";
      const turn = await runChatTurn(env, scope, msg.text, chatChannel, trace);
      const answer = turn.answer;
      await sendInfobipMessage(env, channel, msg.from, answer, contact);
      enqueueSidecar?.({
        channel,
        scope: scopeToString(scope),
        text: answer,
        direction: "assistant",
        model: env.OPENCTO_AGENT_MODEL || "gpt-4.1-mini",
        trace_id: trace?.getTraceId(),
        attributes: {
          contact,
          command: turn.command,
          service_name: "opencto-cloudbot-worker",
          agent_role: "channel_orchestrator",
        },
      });
      await addActivity(env, scope, turn.botType, answer.slice(0, 300));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await addActivity(env, scope, `infobip.${channel}.error`, message.slice(0, 350));
    }
  }

  root?.end({
    attributes: {
      "infobip.messages": messages.length,
      "infobip.status_events": statusEvents.length,
    },
  });
  return new Response("ok", { status: 200 });
}

async function generateAssistantReply(
  env: Env,
  chatId: ChatScope,
  text: string,
  trace?: AnywayTraceBuffer,
) {
  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    defaultHeaders: openAITraceHeaders(trace),
  });
  const session = await loadSession(env, chatId);
  session.push({ role: "user", content: text });
  const ragContext = await buildContext(env, chatId, text, trace);
  const input = [
    { role: "system", content: SYSTEM_PROMPT },
    ragContext ? { role: "system", content: `Context:\n${ragContext}` } : null,
    ...session.map((m) => ({ role: m.role, content: m.content })),
  ].filter(Boolean);

  const model = env.OPENCTO_AGENT_MODEL || "gpt-4.1-mini";
  const llmSpan = trace?.start("openai.responses.create", {
    "chat.scope": scopeToString(chatId),
    "llm.vendor": "openai",
    "llm.model": model,
  });
  let answer = "No response generated.";
  try {
    const res = await openai.responses.create({
      model,
      input: input as Array<{ role: "system" | "user" | "assistant"; content: string }>,
      max_output_tokens: 700,
    });
    answer = (res.output_text || "No response generated.").trim();
    llmSpan?.end({
      attributes: {
        "llm.tokens.input": res.usage?.input_tokens || 0,
        "llm.tokens.output": res.usage?.output_tokens || 0,
      },
    });
  } catch (err) {
    llmSpan?.end({
      status: { code: "ERROR", message: "openai responses.create failed" },
      attributes: {
        "error.type": err instanceof Error ? err.name : "unknown",
      },
    });
    throw err;
  }
  session.push({ role: "assistant", content: answer });
  await saveSession(env, chatId, session);
  return answer;
}

function slackAllowedChannel(env: Env, channelId: string) {
  const raw = (env.OPENCTO_SLACK_ALLOWED_CHANNELS || "").trim();
  if (!raw) return true;
  const allowed = new Set(raw.split(",").map((x) => x.trim()).filter(Boolean));
  return allowed.has(channelId);
}

function utf8(str: string) {
  return new TextEncoder().encode(str);
}

async function hmacHex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    utf8(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, utf8(payload));
  const bytes = new Uint8Array(sig);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifySlackRequest(request: Request, env: Env, rawBody: string) {
  if (!env.OPENCTO_SLACK_SIGNING_SECRET) return false;
  const signature = request.headers.get("x-slack-signature") || "";
  const timestampRaw = request.headers.get("x-slack-request-timestamp") || "";
  const timestamp = Number(timestampRaw);
  if (!signature || !Number.isFinite(timestamp)) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > 60 * 5) return false;

  const base = `v0:${timestampRaw}:${rawBody}`;
  const expected = `v0=${await hmacHex(env.OPENCTO_SLACK_SIGNING_SECRET, base)}`;
  return timingSafeEqual(signature, expected);
}

async function sendSlackMessage(
  env: Env,
  channel: string,
  text: string,
  threadTs?: string,
) {
  if (!env.OPENCTO_SLACK_BOT_TOKEN) return;
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENCTO_SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel,
      text: text.slice(0, 3900),
      thread_ts: threadTs || undefined,
      unfurl_links: false,
      unfurl_media: false,
    }),
  });
}

function normalizeSlackText(text: string) {
  return text.replace(/<@[^>]+>\s*/g, "").trim();
}

function parseHex(input: string) {
  const value = input.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(value) || value.length % 2 !== 0) return null;
  const out = new Uint8Array(value.length / 2);
  for (let i = 0; i < value.length; i += 2) {
    out[i / 2] = parseInt(value.slice(i, i + 2), 16);
  }
  return out;
}

async function verifyDiscordRequest(request: Request, env: Env, rawBody: string) {
  const publicKeyHex = (env.OPENCTO_DISCORD_PUBLIC_KEY || "").trim();
  if (!publicKeyHex) return false;
  const signatureHex = (request.headers.get("x-signature-ed25519") || "").trim();
  const timestamp = (request.headers.get("x-signature-timestamp") || "").trim();
  if (!signatureHex || !timestamp) return false;

  const publicKey = parseHex(publicKeyHex);
  const signature = parseHex(signatureHex);
  if (!publicKey || !signature) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    publicKey,
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("Ed25519", key, signature, utf8(`${timestamp}${rawBody}`));
}

function csvAllowed(raw: string | undefined, value: string | undefined) {
  const v = (value || "").trim();
  if (!v) return true;
  const cfg = (raw || "").trim();
  if (!cfg) return true;
  const allowed = new Set(cfg.split(",").map((x) => x.trim()).filter(Boolean));
  return allowed.has(v);
}

function discordUserId(interaction: DiscordInteraction) {
  return interaction.member?.user?.id || interaction.user?.id || "unknown";
}

function firstStringOption(options: DiscordInteractionOption[] | undefined): string | null {
  if (!options?.length) return null;
  for (const option of options) {
    if (typeof option.value === "string" && option.value.trim()) {
      return option.value.trim();
    }
    const nested = firstStringOption(option.options);
    if (nested) return nested;
  }
  return null;
}

function mapDiscordCommandToText(interaction: DiscordInteraction) {
  const name = (interaction.data?.name || "").trim().toLowerCase();
  const arg = firstStringOption(interaction.data?.options);
  if (!name) return null;
  if (name === "help") return "/help";
  if (name === "tasks") return "/tasks";
  if (name === "daily") return "/daily";
  if (name === "remember") return arg ? `/remember ${arg}` : "/remember";
  if (name === "task") {
    const action = (interaction.data?.options?.[0]?.name || "").trim().toLowerCase();
    if (action === "add" && arg) return `/task add ${arg}`;
    if (action === "done" && arg) return `/task done ${arg}`;
    return arg || "/task";
  }
  return arg || null;
}

function discordJson(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function updateDiscordInteractionMessage(
  applicationId: string,
  interactionToken: string,
  content: string,
) {
  const response = await fetch(
    `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.slice(0, 1800) }),
    },
  );
  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`discord message update failed (${response.status}): ${raw.slice(0, 300)}`);
  }
}

async function handleDiscordWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  trace?: AnywayTraceBuffer,
  enqueueSidecar?: SidecarEnqueue,
): Promise<Response> {
  const root = trace?.start("discord.webhook.handle");
  const raw = await request.text();
  const ok = await verifyDiscordRequest(request, env, raw);
  if (!ok) {
    root?.end({
      status: { code: "ERROR", message: "invalid signature" },
      attributes: { "discord.signature.valid": false },
    });
    return new Response("invalid signature", { status: 401 });
  }

  const interaction = JSON.parse(raw) as DiscordInteraction;
  const interactionType = interaction.type || 0;
  if (interactionType === 1) {
    root?.end({ attributes: { "discord.ping": true } });
    return discordJson({ type: 1 });
  }
  if (interactionType !== 2) {
    root?.end({ attributes: { "discord.unsupported": interactionType } });
    return discordJson({
      type: 4,
      data: {
        content: "Unsupported Discord interaction type.",
        flags: 64,
      },
    });
  }

  if (!csvAllowed(env.OPENCTO_DISCORD_ALLOWED_GUILDS, interaction.guild_id)) {
    root?.end({ attributes: { "discord.allowed_guild": false } });
    return discordJson({
      type: 4,
      data: {
        content: "This Discord server is not allowed for this bot.",
        flags: 64,
      },
    });
  }
  if (!csvAllowed(env.OPENCTO_DISCORD_ALLOWED_CHANNELS, interaction.channel_id)) {
    root?.end({ attributes: { "discord.allowed_channel": false } });
    return discordJson({
      type: 4,
      data: {
        content: "This Discord channel is not allowed for this bot.",
        flags: 64,
      },
    });
  }

  const text = mapDiscordCommandToText(interaction);
  if (!text) {
    root?.end({ attributes: { "discord.empty_text": true } });
    return discordJson({
      type: 4,
      data: {
        content:
          "No prompt found. Use a command with text input, e.g. `/chat prompt:<your message>`.",
        flags: 64,
      },
    });
  }

  const guildId = interaction.guild_id || "dm";
  const channelId = interaction.channel_id || "unknown";
  const userId = discordUserId(interaction);
  const scope = `discord:${guildId}:${channelId}:${userId}`;
  const applicationId = interaction.application_id || "";
  const interactionToken = interaction.token || "";
  const model = env.OPENCTO_AGENT_MODEL || "gpt-4.1-mini";

  enqueueSidecar?.({
    channel: "discord",
    scope: scopeToString(scope),
    text,
    direction: "user",
    trace_id: trace?.getTraceId(),
    attributes: {
      guild_id: guildId,
      channel_id: channelId,
      user_id: userId,
      service_name: "opencto-cloudbot-worker",
      agent_role: "channel_orchestrator",
    },
  });
  await addActivity(env, scope, "discord.user", text.slice(0, 300), nowIso());
  root?.end({ attributes: { "chat.scope": scopeToString(scope) } });

  ctx.waitUntil(
    (async () => {
      try {
        const turn = await runChatTurn(env, scope, text, "discord", trace);
        await updateDiscordInteractionMessage(applicationId, interactionToken, turn.answer);
        enqueueSidecar?.({
          channel: "discord",
          scope: scopeToString(scope),
          text: turn.answer,
          direction: "assistant",
          model,
          trace_id: trace?.getTraceId(),
          attributes: {
            guild_id: guildId,
            channel_id: channelId,
            user_id: userId,
            command: turn.command,
            service_name: "opencto-cloudbot-worker",
            agent_role: "channel_orchestrator",
          },
        });
        await addActivity(env, scope, turn.botType, turn.answer.slice(0, 300), nowIso());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await addActivity(env, scope, "discord.error", message.slice(0, 350), nowIso());
        if (applicationId && interactionToken) {
          try {
            await updateDiscordInteractionMessage(
              applicationId,
              interactionToken,
              "I hit an error while processing that request.",
            );
          } catch {
            // no-op
          }
        }
      } finally {
        await trace?.flush();
      }
    })(),
  );

  return discordJson({ type: 5 });
}

async function handleSlackWebhook(
  request: Request,
  env: Env,
  trace?: AnywayTraceBuffer,
  enqueueSidecar?: SidecarEnqueue,
): Promise<Response> {
  const root = trace?.start("slack.webhook.handle");
  const raw = await request.text();
  const ok = await verifySlackRequest(request, env, raw);
  if (!ok) {
    root?.end({
      status: { code: "ERROR", message: "invalid signature" },
      attributes: { "slack.signature.valid": false },
    });
    return new Response("invalid signature", { status: 401 });
  }

  const payload = JSON.parse(raw) as SlackEventEnvelope;
  if (payload.type === "url_verification") {
    root?.end({ attributes: { "slack.url_verification": true } });
    return Response.json({ challenge: payload.challenge || "" });
  }
  if (payload.type !== "event_callback" || !payload.event) {
    root?.end({ attributes: { "slack.ignored": true } });
    return new Response("ok", { status: 200 });
  }

  const event = payload.event;
  if (!event.channel || !event.type || !event.ts) {
    root?.end({ attributes: { "slack.empty": true } });
    return new Response("ok", { status: 200 });
  }
  if (!slackAllowedChannel(env, event.channel)) {
    root?.end({ attributes: { "slack.allowed_channel": false } });
    return new Response("ok", { status: 200 });
  }
  if (event.bot_id || event.subtype) {
    root?.end({ attributes: { "slack.bot_event": true } });
    return new Response("ok", { status: 200 });
  }

  const isMention = event.type === "app_mention";
  const isDirectMessage = event.type === "message" && event.channel_type === "im";
  const isThreadReply =
    event.type === "message" &&
    event.channel_type !== "im" &&
    Boolean(event.thread_ts);
  if (!isMention && !isDirectMessage && !isThreadReply) {
    root?.end({ attributes: { "slack.ignored_event": true } });
    return new Response("ok", { status: 200 });
  }

  const team = payload.team_id || "team";
  const threadTs = event.thread_ts || event.ts;
  if (isThreadReply && !isMention) {
    const active = await isSlackThreadActive(env, team, event.channel, threadTs);
    if (!active) {
      root?.end({ attributes: { "slack.thread_active": false } });
      return new Response("ok", { status: 200 });
    }
  }

  const text = normalizeSlackText(event.text || "");
  if (!text) {
    root?.end({ attributes: { "slack.empty_text": true } });
    return new Response("ok", { status: 200 });
  }

  const scope = `slack:${team}:${event.channel}:${threadTs}`;
  enqueueSidecar?.({
    channel: "slack",
    scope: scopeToString(scope),
    text,
    direction: "user",
    trace_id: trace?.getTraceId(),
    attributes: {
      channel_id: event.channel,
      thread_ts: threadTs,
      service_name: "opencto-cloudbot-worker",
      agent_role: "channel_orchestrator",
    },
  });

  await addActivity(env, scope, "slack.user", text.slice(0, 300), nowIso());
  const turn = await runChatTurn(
    env,
    scope,
    text,
    "slack",
    trace,
    {
      channel: event.channel,
      thread_ts: threadTs,
      user_id: event.user || "",
    },
  );
  const answer = turn.answer;
  await sendSlackMessage(env, event.channel, answer, threadTs);
  enqueueSidecar?.({
    channel: "slack",
    scope: scopeToString(scope),
    text: answer,
    direction: "assistant",
    model: env.OPENCTO_AGENT_MODEL || "gpt-4.1-mini",
    trace_id: trace?.getTraceId(),
    attributes: {
      channel_id: event.channel,
      thread_ts: threadTs,
      command: turn.command,
      service_name: "opencto-cloudbot-worker",
      agent_role: "channel_orchestrator",
    },
  });
  await markSlackThreadActive(env, team, event.channel, threadTs);
  await addActivity(env, scope, turn.botType, answer.slice(0, 300), nowIso());
  root?.end({
    attributes: {
      "chat.scope": scopeToString(scope),
      "slack.command": turn.command,
    },
  });
  return new Response("ok", { status: 200 });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const enqueueSidecar: SidecarEnqueue = (event) => {
      ctx.waitUntil(sendSidecarEvent(env, event));
    };

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "opencto-cloudbot-worker",
        telegram_admin_configured: Boolean(env.TELEGRAM_BOT_TOKEN),
        telegram_consumer_configured: Boolean(env.OPENCTO_TELEGRAM_CONSUMER_BOT_TOKEN),
        slack_configured: Boolean(
          env.OPENCTO_SLACK_BOT_TOKEN && env.OPENCTO_SLACK_SIGNING_SECRET,
        ),
        discord_configured: Boolean(env.OPENCTO_DISCORD_PUBLIC_KEY),
        vector_rag_enabled: vectorEnabled(env),
        vector_bound: Boolean(env.OPENCTO_VECTOR_INDEX),
        embed_model: env.OPENCTO_EMBED_MODEL || "text-embedding-3-small",
        models: modelRoster(env),
        anyway_enabled: anywayEnabled(env),
        anyway_endpoint: resolveAnywayIngestEndpoint(env.OPENCTO_ANYWAY_ENDPOINT),
        anyway_app_name: env.OPENCTO_ANYWAY_APP_NAME || "opencto-cloudbot-worker",
        traceloop_via_sidecar: sidecarEnabled(env),
        sidecar_enabled: sidecarEnabled(env),
        sidecar_url: env.OPENCTO_SIDECAR_URL || null,
        code_agent_enabled: codeAgentEnabled(env),
        opencto_api_base_url: env.OPENCTO_API_BASE_URL || null,
        android_autodev_cf_access_configured: Boolean(
          env.OPENCTO_ANDROID_AUTODEV_CF_ACCESS_CLIENT_ID &&
            env.OPENCTO_ANDROID_AUTODEV_CF_ACCESS_CLIENT_SECRET,
        ),
        infobip_whatsapp_configured: infobipConfigured(env, "whatsapp"),
        infobip_sms_configured: infobipConfigured(env, "sms"),
      });
    }

    if (request.method === "POST" && url.pathname === "/webhook/telegram") {
      const trace = new AnywayTraceBuffer(env);
      const payload = (await request.json()) as TelegramUpdate;
      const response = await handleTelegramUpdate(
        env,
        payload,
        env.TELEGRAM_BOT_TOKEN,
        "admin",
        trace,
        enqueueSidecar,
      );
      ctx.waitUntil(trace.flush());
      return response;
    }
    if (request.method === "POST" && url.pathname === "/webhook/telegram-consumer") {
      if (!env.OPENCTO_TELEGRAM_CONSUMER_BOT_TOKEN) {
        return Response.json(
          { ok: false, error: "consumer telegram bot token not configured" },
          { status: 503 },
        );
      }
      const trace = new AnywayTraceBuffer(env);
      const payload = (await request.json()) as TelegramUpdate;
      const response = await handleTelegramUpdate(
        env,
        payload,
        env.OPENCTO_TELEGRAM_CONSUMER_BOT_TOKEN,
        "consumer",
        trace,
        enqueueSidecar,
      );
      ctx.waitUntil(trace.flush());
      return response;
    }
    if (request.method === "POST" && url.pathname === "/webhook/slack") {
      const trace = new AnywayTraceBuffer(env);
      const response = await handleSlackWebhook(request, env, trace, enqueueSidecar);
      ctx.waitUntil(trace.flush());
      return response;
    }
    if (request.method === "POST" && url.pathname === "/webhook/discord") {
      const trace = new AnywayTraceBuffer(env);
      return handleDiscordWebhook(request, env, ctx, trace, enqueueSidecar);
    }
    if (request.method === "POST" && url.pathname === "/webhook/infobip/whatsapp") {
      const trace = new AnywayTraceBuffer(env);
      const response = await handleInfobipWebhook(
        request,
        env,
        "whatsapp",
        trace,
        enqueueSidecar,
      );
      ctx.waitUntil(trace.flush());
      return response;
    }
    if (request.method === "POST" && url.pathname === "/webhook/infobip/sms") {
      const trace = new AnywayTraceBuffer(env);
      const response = await handleInfobipWebhook(
        request,
        env,
        "sms",
        trace,
        enqueueSidecar,
      );
      ctx.waitUntil(trace.flush());
      return response;
    }

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }

    return new Response("Not Found", { status: 404 });
  },
};
