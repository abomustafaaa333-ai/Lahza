const DEFAULT_WAHA_SESSION = "default";

export type WahaMessage = {
  title?: string;
  body: string;
};

export type WahaReplyButton = { id: string; text: string };

export function normalizeWahaChatId(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits ? `${digits}@c.us` : null;
}

export function isWahaConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.WAHA_URL?.trim() && env.WAHA_API_KEY?.trim());
}

function getWahaConfig(env: NodeJS.ProcessEnv = process.env) {
  const baseUrl = env.WAHA_URL?.trim().replace(/\/$/, "");
  const apiKey = env.WAHA_API_KEY?.trim();
  if (!baseUrl || !apiKey) return null;
  return {
    baseUrl,
    apiKey,
    session: env.WAHA_SESSION?.trim() || DEFAULT_WAHA_SESSION,
  };
}

export async function sendWahaText(phone: string, message: WahaMessage) {
  const config = getWahaConfig();
  const chatId = normalizeWahaChatId(phone);
  if (!config || !chatId) return { configured: Boolean(config), sent: false };

  try {
    const response = await fetch(`${config.baseUrl}/api/sendText`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Api-Key": config.apiKey,
      },
      body: JSON.stringify({
        session: config.session,
        chatId,
        text: message.title ? `*${message.title}*\n${message.body}` : message.body,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error(`WAHA returned ${response.status}${details ? `: ${details.slice(0, 200)}` : ""}`);
    }

    return { configured: true, sent: true };
  } catch (error) {
    console.error("WAHA WhatsApp delivery failed", error);
    return { configured: true, sent: false };
  }
}

export async function sendWahaReplyButtons(phone: string, message: WahaMessage, buttons: WahaReplyButton[]) {
  const config = getWahaConfig();
  const chatId = normalizeWahaChatId(phone);
  if (!config || !chatId) return { configured: Boolean(config), sent: false };
  try {
    const response = await fetch(`${config.baseUrl}/api/sendButtons`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "X-Api-Key": config.apiKey },
      body: JSON.stringify({ session: config.session, chatId, body: message.body, footer: "اختر أحد الخيارين للمتابعة", buttons: buttons.map(button => ({ id: button.id, type: "reply", text: button.text })) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`WAHA buttons returned ${response.status}`);
    return { configured: true, sent: true };
  } catch (error) {
    console.error("WAHA interactive button delivery failed", error);
    return { configured: true, sent: false };
  }
}
