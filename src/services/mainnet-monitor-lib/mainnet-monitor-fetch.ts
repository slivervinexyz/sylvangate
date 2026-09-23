import { HL_INFO_URL } from "../../config/constants";

export async function postInfo(
  body: Record<string, unknown>,
  timeoutMs = 8_000,
): Promise<unknown> {
  const res = await fetch(HL_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HL info HTTP ${res.status}`);
  return res.json();
}
