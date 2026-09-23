import { BROWSER_MIMIC_USER_AGENT } from "../../defense/rpc-whitelist";
import {
  classifyExchangeFetchFailure,
  formatExchangeUnavailableWarning,
} from "../safe-exchange-fetch";

export const UA_HEADERS = {
  "User-Agent": BROWSER_MIMIC_USER_AGENT,
  Accept: "application/json, text/plain, */*",
} as const;

export function logHlExchangeWarning(message: string, debugSystemLogs: string[]): void {
  debugSystemLogs.push(message);
  console.warn(message);
}

export function describeSettledFailure(result: PromiseSettledResult<Response>): string {
  if (result.status === "rejected") {
    return classifyExchangeFetchFailure(result.reason).label;
  }
  return String(result.value.status);
}

export { classifyExchangeFetchFailure, formatExchangeUnavailableWarning };
