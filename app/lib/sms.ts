/**
 * SMS through SMS Ethiopia (smsethiopia.com):
 * POST https://smsethiopia.com/api/sms/send, header `KEY: <api key>`,
 * JSON body { msisdn: "2519xxxxxxxx", text }. The key lives in the
 * SMS_ETHIOPIA_API_KEY environment variable, never in the code.
 */
const ENDPOINT = "https://smsethiopia.com/api/sms/send";

/** People texted when a job is submitted for budget approval. */
export const APPROVAL_SMS_PHONES = ["0993649461", "0947431247"];

/** "0993649461" / "+251993649461" → "251993649461" */
export function toMsisdn(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("251")) return digits;
  if (digits.startsWith("0")) return `251${digits.slice(1)}`;
  return `251${digits}`;
}

export interface SmsResult {
  phone: string;
  ok: boolean;
  error?: string;
}

async function sendOne(key: string, phone: string, text: string): Promise<SmsResult> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { KEY: key, "Content-Type": "application/json" },
      body: JSON.stringify({ msisdn: toMsisdn(phone), text }),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (res.ok) return { phone, ok: true };
    const body = (await res.text().catch(() => "")).slice(0, 200);
    return { phone, ok: false, error: `HTTP ${res.status}${body ? `: ${body}` : ""}` };
  } catch (err) {
    return { phone, ok: false, error: err instanceof Error ? err.message : "send failed" };
  }
}

/** Sends `text` to every phone at the same time. Never throws. */
export async function sendSms(phones: string[], text: string): Promise<SmsResult[]> {
  const key = process.env.SMS_ETHIOPIA_API_KEY;
  if (!key) return phones.map((phone) => ({ phone, ok: false, error: "SMS_ETHIOPIA_API_KEY is not set" }));
  return Promise.all(phones.map((p) => sendOne(key, p, text)));
}

/** Short enough for one SMS (160 characters): job number, title, link. */
export function approvalSmsText(job: { id: string; jobNumber: string; title: string }): string {
  const base = (process.env.AUTH_URL || "https://hdr-mgmt-app.app.aletcloud.com").replace(/\/+$/, "");
  const link = `${base}/jobs/${job.id}`;
  const head = `Hadar: Job ${job.jobNumber} "`;
  const tail = `" is waiting for budget approval. ${link}`;
  const room = 160 - head.length - tail.length;
  const title = job.title.length > room ? `${job.title.slice(0, Math.max(0, room - 1))}…` : job.title;
  return `${head}${title}${tail}`;
}
