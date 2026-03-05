import { denyApproval, executeApprovedAction, executeToolCall, toolDefinitions } from "./botTools.js";
import { buildPlaybookContext, routePlaybooks } from "./playbookRouter.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractText(response) {
  if (response?.output_text) {
    return response.output_text;
  }
  const output = Array.isArray(response?.output) ? response.output : [];
  for (const item of output) {
    if (item.type !== "message") continue;
    const content = Array.isArray(item.content) ? item.content : [];
    for (const block of content) {
      if (block.type === "output_text" && block.text) {
        return block.text;
      }
      if (block.type === "text" && block.text) {
        return block.text;
      }
    }
  }
  return "I could not produce a response for that request.";
}

function parseJsonObject(raw) {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function allowedChat(cfg, chatId) {
  const set = new Set((cfg.telegramChatIds || []).map((item) => String(item)));
  return set.has(String(chatId));
}

function ensureTelegramState(state) {
  if (!state.telegram || typeof state.telegram !== "object") {
    state.telegram = { lastUpdateId: 0, sessions: {} };
  }
  if (!state.telegram.sessions || typeof state.telegram.sessions !== "object") {
    state.telegram.sessions = {};
  }
  return state.telegram;
}

function sessionFor(state, chatId) {
  const telegram = ensureTelegramState(state);
  const key = String(chatId);
  if (!telegram.sessions[key]) {
    telegram.sessions[key] = { history: [] };
  }
  return telegram.sessions[key];
}

function pushHistory(session, role, content) {
  session.history.push({ role, content: String(content).slice(0, 3000) });
  if (session.history.length > 12) {
    session.history = session.history.slice(-12);
  }
}

async function tgRequest(cfg, method, payload) {
  const timeoutMs = method === "getUpdates" ? Math.max(cfg.httpTimeoutMs, 30000) : cfg.httpTimeoutMs;
  const response = await fetch(`https://api.telegram.org/bot${cfg.telegramBotToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`Telegram API ${method} failed (${response.status}): ${raw}`);
  }
  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Telegram API ${method} returned not ok`);
  }
  return data.result;
}

async function sendMessage(cfg, chatId, text) {
  return tgRequest(cfg, "sendMessage", {
    chat_id: chatId,
    text: String(text).slice(0, 4000),
    disable_web_page_preview: true,
  });
}

function helpText() {
  return [
    "OpenCTO Bot Commands:",
    "/help - show this help",
    "/status - show orchestrator mode and summary",
    "/pending - list pending risky approvals",
    "/kickoff_release <version> - create milestone + starter issues",
    "/approve <approval_id> - approve and execute queued action",
    "/deny <approval_id> - deny queued action",
    "",
    "Natural language examples:",
    "- check health of orchestrator service",
    "- show recent logs for cloudflared",
    "- restart monitor service (will require approval)",
  ].join("\n");
}

function statusText(cfg, state) {
  const incidentCount = Object.keys(state.incidents || {}).length;
  const approvals = Object.values(state.approvals || {}).filter((item) => item.status === "pending").length;
  return [
    `Mode: ${cfg.dryRun ? "DRY_RUN" : "LIVE"}`,
    `Repo: ${cfg.githubOwner}/${cfg.githubRepo}`,
    `Incidents tracked: ${incidentCount}`,
    `Pending approvals: ${approvals}`,
  ].join("\n");
}

function pendingText(state) {
  const pending = Object.values(state.approvals || {})
    .filter((item) => item.status === "pending")
    .slice(0, 10);
  if (pending.length === 0) {
    return "No pending approvals.";
  }
  return pending
    .map((item) => `- ${item.id}: ${item.action} ${item.service || ""} (${item.reason || ""})`)
    .join("\n");
}

async function runAgent({ cfg, ai, state, chatId, userText, onEvent }) {
  const session = sessionFor(state, chatId);
  pushHistory(session, "user", userText);
  const playbookIds = routePlaybooks(userText);
  const playbookContext = buildPlaybookContext(playbookIds);
  onEvent?.("bot_route", `Playbooks selected: ${playbookIds.join(", ")}`, {
    playbooks: playbookIds,
  });

  const systemPrompt = [
    "You are OpenCTO, an autonomous but safety-constrained CTO/devops assistant.",
    "You must naturally lean on the selected playbooks for strategy, tone, and decision quality.",
    "Use tools for facts and operations.",
    "For risky operations, request_service_restart queues approval; never claim it already executed unless approved.",
    "Respond concisely and include concrete next steps when relevant.",
  ].join(" ");

  const input = [
    { role: "system", content: systemPrompt },
    {
      role: "system",
      content: `Selected playbooks: ${playbookIds.join(", ")}\n\n${playbookContext}`,
    },
    ...session.history.map((item) => ({ role: item.role, content: item.content })),
  ];

  let response = await ai.responses.create({
    model: cfg.agentModel,
    input,
    tools: toolDefinitions(),
    max_output_tokens: 900,
  });

  for (let step = 0; step < 6; step += 1) {
    const calls = (response.output || []).filter((item) => item.type === "function_call");
    if (calls.length === 0) {
      break;
    }

    const outputs = [];
    for (const call of calls) {
      const args = parseJsonObject(call.arguments);
      try {
        onEvent?.("bot_tool_call", `Tool call: ${call.name}`, { name: call.name, args });
        const result = await executeToolCall({ cfg, state, name: call.name, args });
        outputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(result),
        });
      } catch (error) {
        outputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify({ error: error?.message || String(error) }),
        });
      }
    }

    response = await ai.responses.create({
      model: cfg.agentModel,
      previous_response_id: response.id,
      input: outputs,
      tools: toolDefinitions(),
      max_output_tokens: 900,
    });
  }

  const answer = extractText(response);
  pushHistory(session, "assistant", answer);
  return answer;
}

async function handleCommand({ cfg, state, chatId, text, onEvent }) {
  if (text === "/help" || text === "/start") {
    return helpText();
  }
  if (text === "/status") {
    return statusText(cfg, state);
  }
  if (text === "/pending") {
    return pendingText(state);
  }
  if (text.startsWith("/kickoff_release")) {
    const version = text.split(/\s+/, 2)[1]?.trim() || `v${new Date().toISOString().slice(0, 10)}-agent`;
    const result = await executeToolCall({
      cfg,
      state,
      name: "start_release_kickoff",
      args: {
        version,
        goal: "Ship autonomous CTO + dev workflow with guarded production actions and weekly releases.",
        due_days: 7,
      },
    });
    onEvent?.("release_kickoff", `Release kickoff created for ${version}`, result);
    return [
      `Kickoff created for ${version}`,
      `Milestone: ${result.milestone.url}`,
      "Issues:",
      ...result.issues.map((i) => `- ${i.url}`),
    ].join("\n");
  }
  if (text.startsWith("/approve ")) {
    const id = text.split(/\s+/, 2)[1]?.trim();
    if (!id) return "Usage: /approve <approval_id>";
    const result = await executeApprovedAction(state, id);
    onEvent?.("approval", result.message, { id, ok: result.ok });
    return result.message;
  }
  if (text.startsWith("/deny ")) {
    const id = text.split(/\s+/, 2)[1]?.trim();
    if (!id) return "Usage: /deny <approval_id>";
    const result = denyApproval(state, id);
    onEvent?.("approval", result.message, { id, ok: result.ok });
    return result.message;
  }
  return null;
}

export async function startTelegramBot({ cfg, ai, state, onEvent, onStateChanged }) {
  if (!cfg.telegramEnabled || !cfg.telegramBotMode || !cfg.telegramBotToken) {
    return { stop: () => {} };
  }
  const telegram = ensureTelegramState(state);
  let running = true;

  async function loop() {
    while (running) {
      try {
        const updates = await tgRequest(cfg, "getUpdates", {
          offset: (telegram.lastUpdateId || 0) + 1,
          timeout: 20,
          allowed_updates: ["message"],
        });

        for (const update of updates) {
          telegram.lastUpdateId = update.update_id;
          const message = update.message;
          if (!message || typeof message.text !== "string") continue;
          const chatId = message.chat?.id;
          if (!allowedChat(cfg, chatId)) {
            continue;
          }
          try {
            const text = message.text.trim();
            onEvent?.("bot_message", `Telegram message received: ${text.slice(0, 80)}`, {
              chatId,
            });
            onStateChanged?.();

            const maybeCommand = await handleCommand({ cfg, state, chatId, text, onEvent });
            if (maybeCommand) {
              await sendMessage(cfg, chatId, maybeCommand);
              onStateChanged?.();
              continue;
            }

            if (!ai) {
              await sendMessage(cfg, chatId, "Agent model unavailable. Set OPENAI_API_KEY.");
              continue;
            }

            await sendMessage(cfg, chatId, "Working on it. I will send updates shortly.");
            const answer = await runAgent({ cfg, ai, state, chatId, userText: text, onEvent });
            await sendMessage(cfg, chatId, answer);
            onEvent?.("bot_response", "Telegram response sent", { chatId });
            onStateChanged?.();
          } catch (error) {
            const errMsg = error?.message || String(error);
            onEvent?.("bot_error", errMsg, { chatId });
            try {
              await sendMessage(cfg, chatId, `I hit an error: ${errMsg}`);
            } catch {
              // no-op
            }
            onStateChanged?.();
          }
        }
      } catch (error) {
        onEvent?.("bot_error", error?.message || String(error), {});
      }
      onStateChanged?.();
      await sleep(cfg.telegramPollSeconds * 1000);
    }
  }

  loop();
  return {
    stop: () => {
      running = false;
    },
  };
}
