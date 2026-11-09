// Telegram message to the owner (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID). Own module so light code (the partner e-mail) can alert
// without loading lib/health.ts. Never throws.
export async function sendTelegram(html: string): Promise<{ ok: boolean; error?: string }> {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const chat = (process.env.TELEGRAM_CHAT_ID ?? "").trim();
  if (!token || !chat) return { ok: false, error: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: html.slice(0, 4000), parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    return j.ok ? { ok: true } : { ok: false, error: j.description ?? `HTTP ${r.status}` };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "error" }; }
}
