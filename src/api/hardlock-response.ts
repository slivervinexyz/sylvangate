import { CORS_JSON_HEADERS } from "../services/config";
import { humanizeHardlockMessage } from "../services/humanize-log";
import {
  buildBlockedSystemState,
  type SystemState,
} from "../services/systemState";
import { HardlockError } from "../core/errors";

export interface HardlockResponseBody {
  success: false;
  error: string;
  hardlock: true;
  code: "HARDLOCK";
  /** Session / Hot-key signing channel severed */
  signingChannelOpen: false;
  systemState: SystemState;
}

export function hardlockResponse(
  err: HardlockError,
  accountBalanceUsd?: number,
): Response {
  const systemState = buildBlockedSystemState(accountBalanceUsd);
  const body: HardlockResponseBody = {
    success: false,
    error: humanizeHardlockMessage(err.message),
    hardlock: true,
    code: "HARDLOCK",
    signingChannelOpen: false,
    systemState,
  };

  return new Response(JSON.stringify(body), {
    status: 403,
    headers: CORS_JSON_HEADERS,
  });
}
