import OpenAI from "openai";

interface Env {
  OPENAI_API_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  OPENCTO_SLACK_BOT_TOKEN?: string;
  OPENCTO_SLACK_SIGNING_SECRET?: string;
  OPENCTO_SLACK_ALLOWED_CHANNELS?: string;
  OPENCTO_VECTOR_RAG_ENABLED?: string;
  OPENCTO_EMBED_MODEL?: string;
  OPENCTO_AGENT_MODEL?: string;
  OPENCTO_APPROVAL_REQUIRED?: string;
  OPENCTO_ADMIN_TOKEN?: string;
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

function tgSendUrl(token: string) {
  return `https://api.telegram.org/bot${token}/sendMessage`;
}

async function sendTelegram(env: Env, chatId: number, text: string) {
  await fetch(tgSendUrl(env.TELEGRAM_BOT_TOKEN), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000) }),
  });
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

function vectorEnabled(env: Env) {
  const flag = (env.OPENCTO_VECTOR_RAG_ENABLED || "true").toLowerCase();
  return flag !== "false" && Boolean(env.OPENCTO_VECTOR_INDEX);
}

async function embedText(env: Env, text: string) {
  const model = env.OPENCTO_EMBED_MODEL || "text-embedding-3-small";
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
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

function tokenSet(text: string) {
  const words = text.toLowerCase().match(/[a-z0-9_]+/g) || [];
  return new Set(words.filter((w) => w.length > 2));
}

function overlapScore(a: Set<string>, b: Set<string>) {
  let count = 0;
  for (const w of a) if (b.has(w)) count += 1;
  return count;
}

async function retrieveMemories(env: Env, chatId: ChatScope, query: string) {
  const index = await getJson<MemoryIndexItem[]>(env, memoryIndexKey(chatId), []);
  if (!index.length) return [];
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
  return out;
}

async function retrieveSemanticMemories(
  env: Env,
  chatId: ChatScope,
  query: string,
): Promise<MemoryRetrievalItem[]> {
  if (!vectorEnabled(env)) return [];
  try {
    const embedding = await embedText(env, query);
    if (!embedding.length) return [];
    const matches = await env.OPENCTO_VECTOR_INDEX?.query(embedding, {
      namespace: scopeNamespace(chatId),
      topK: VECTOR_TOP_K,
      returnMetadata: "all",
    });
    const rows = matches?.matches || [];
    return rows
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
      .filter((x): x is MemoryRetrievalItem => Boolean(x));
  } catch {
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

async function buildContext(env: Env, chatId: ChatScope, text: string) {
  const lexicalMemories = await retrieveMemories(env, chatId, text);
  const semanticMemories = await retrieveSemanticMemories(env, chatId, text);
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

async function handleCommand(env: Env, chatId: ChatScope, text: string) {
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
      "/daily - show today activity log",
    ].join("\n");
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

function badRequest(message: string) {
  return Response.json({ ok: false, error: message }, { status: 400 });
}

function unauthorized() {
  return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
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
    const chatId = Number(url.searchParams.get("chatId") || "0");
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
    const chatId = Number(url.searchParams.get("chatId") || "0");
    const date = url.searchParams.get("date") || dayKey();
    if (!chatId) return badRequest("chatId required");
    const activities = await getDailyActivity(env, chatId, date, 100);
    return Response.json({ ok: true, date, activities });
  }

  return new Response("Not Found", { status: 404 });
}

async function handleTelegramUpdate(env: Env, update: TelegramUpdate): Promise<Response> {
  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim();
  if (!chatId || !text) {
    return new Response("ok", { status: 200 });
  }

  await addActivity(env, chatId, "telegram.user", text.slice(0, 300));

  const commandReply = isCommand(text) ? await handleCommand(env, chatId, text) : null;
  if (commandReply) {
    await sendTelegram(env, chatId, commandReply);
    await addActivity(env, chatId, "telegram.bot", commandReply.slice(0, 300));
    return new Response("ok", { status: 200 });
  }

  const answer = await generateAssistantReply(env, chatId, text);
  await sendTelegram(env, chatId, answer);
  await addActivity(env, chatId, "telegram.bot", answer.slice(0, 300));

  return new Response("ok", { status: 200 });
}

async function generateAssistantReply(env: Env, chatId: ChatScope, text: string) {
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const session = await loadSession(env, chatId);
  session.push({ role: "user", content: text });
  const ragContext = await buildContext(env, chatId, text);
  const input = [
    { role: "system", content: SYSTEM_PROMPT },
    ragContext ? { role: "system", content: `Context:\n${ragContext}` } : null,
    ...session.map((m) => ({ role: m.role, content: m.content })),
  ].filter(Boolean);

  const res = await openai.responses.create({
    model: env.OPENCTO_AGENT_MODEL || "gpt-4.1-mini",
    input: input as Array<{ role: "system" | "user" | "assistant"; content: string }>,
    max_output_tokens: 700,
  });
  const answer = (res.output_text || "No response generated.").trim();
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

async function handleSlackWebhook(request: Request, env: Env): Promise<Response> {
  const raw = await request.text();
  const ok = await verifySlackRequest(request, env, raw);
  if (!ok) return new Response("invalid signature", { status: 401 });

  const payload = JSON.parse(raw) as SlackEventEnvelope;
  if (payload.type === "url_verification") {
    return Response.json({ challenge: payload.challenge || "" });
  }
  if (payload.type !== "event_callback" || !payload.event) {
    return new Response("ok", { status: 200 });
  }

  const event = payload.event;
  if (!event.channel || !event.type || !event.ts) {
    return new Response("ok", { status: 200 });
  }
  if (!slackAllowedChannel(env, event.channel)) {
    return new Response("ok", { status: 200 });
  }
  if (event.bot_id || event.subtype) {
    return new Response("ok", { status: 200 });
  }

  const isMention = event.type === "app_mention";
  const isDirectMessage = event.type === "message" && event.channel_type === "im";
  const isThreadReply =
    event.type === "message" &&
    event.channel_type !== "im" &&
    Boolean(event.thread_ts);
  if (!isMention && !isDirectMessage && !isThreadReply) {
    return new Response("ok", { status: 200 });
  }

  const team = payload.team_id || "team";
  const threadTs = event.thread_ts || event.ts;
  if (isThreadReply && !isMention) {
    const active = await isSlackThreadActive(env, team, event.channel, threadTs);
    if (!active) {
      return new Response("ok", { status: 200 });
    }
  }

  const text = normalizeSlackText(event.text || "");
  if (!text) {
    return new Response("ok", { status: 200 });
  }

  const scope = `slack:${team}:${event.channel}:${threadTs}`;

  await addActivity(env, scope, "slack.user", text.slice(0, 300), nowIso());
  const commandReply = isCommand(text) ? await handleCommand(env, scope, text) : null;
  const answer = commandReply || (await generateAssistantReply(env, scope, text));
  await sendSlackMessage(env, event.channel, answer, threadTs);
  await markSlackThreadActive(env, team, event.channel, threadTs);
  await addActivity(env, scope, "slack.bot", answer.slice(0, 300), nowIso());
  return new Response("ok", { status: 200 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "opencto-cloudbot-worker",
        slack_configured: Boolean(
          env.OPENCTO_SLACK_BOT_TOKEN && env.OPENCTO_SLACK_SIGNING_SECRET,
        ),
        vector_rag_enabled: vectorEnabled(env),
        vector_bound: Boolean(env.OPENCTO_VECTOR_INDEX),
        embed_model: env.OPENCTO_EMBED_MODEL || "text-embedding-3-small",
      });
    }

    if (request.method === "POST" && url.pathname === "/webhook/telegram") {
      const payload = (await request.json()) as TelegramUpdate;
      return handleTelegramUpdate(env, payload);
    }
    if (request.method === "POST" && url.pathname === "/webhook/slack") {
      return handleSlackWebhook(request, env);
    }

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }

    return new Response("Not Found", { status: 404 });
  },
};
