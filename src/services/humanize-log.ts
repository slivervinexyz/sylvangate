/**
 * Operator logs — re-export + hardlock helpers for API/UI.
 */
export {
  humanizeSystemLog,
  humanizeSystemLogs,
} from "./defense/humanize-log";

import { humanizeSystemLog } from "./defense/humanize-log";

const HARDLOCK_HUMAN =
  "[Risk] Physical deadlock — CRI zeroed; Hot Key signing channel severed.";

/** Canonical hardlock message for HTTP 403 bodies */
export function humanizeHardlockMessage(raw?: string): string {
  const line = String(raw ?? "").trim();
  if (/CRI.?HARDLOCK|HARDLOCK|CRI.*0|SIGNING CHANNEL/i.test(line)) {
    return HARDLOCK_HUMAN;
  }
  return humanizeSystemLog(line) || HARDLOCK_HUMAN;
}
