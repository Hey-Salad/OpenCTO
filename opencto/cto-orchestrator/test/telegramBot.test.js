import test from "node:test";
import assert from "node:assert/strict";
import { handleCommand } from "../src/telegramBot.js";

test("handleCommand returns usage for bare /approve", async () => {
  const result = await handleCommand({
    cfg: {},
    state: {},
    chatId: "chat_1",
    text: "/approve",
  });

  assert.equal(result, "Usage: /approve <approval_id>");
});

test("handleCommand returns usage for bare /deny", async () => {
  const result = await handleCommand({
    cfg: {},
    state: {},
    chatId: "chat_1",
    text: "/deny",
  });

  assert.equal(result, "Usage: /deny <approval_id>");
});
