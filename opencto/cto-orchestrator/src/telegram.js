function telegramUrl(token) {
  return `https://api.telegram.org/bot${token}/sendMessage`;
}

export async function sendTelegramAlert(cfg, incident, triage) {
  if (!cfg.telegramEnabled || !cfg.telegramBotToken || cfg.telegramChatIds.length === 0) {
    return { sent: 0, skipped: true };
  }

  const text = [
    "OpenCTO Incident",
    `Key: ${incident.key}`,
    `Priority: ${triage.priority}`,
    `Title: ${incident.title}`,
    "",
    triage.summary,
  ].join("\n");

  let sent = 0;
  for (const chatId of cfg.telegramChatIds) {
    const response = await fetch(telegramUrl(cfg.telegramBotToken), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(cfg.httpTimeoutMs),
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const raw = await response.text();
      throw new Error(`Telegram send failed (${response.status}) for chat ${chatId}: ${raw}`);
    }
    sent += 1;
  }

  return { sent, skipped: false };
}
