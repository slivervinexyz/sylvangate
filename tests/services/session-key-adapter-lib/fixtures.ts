import { HL_SESSION_KEY_ALLOWED_CONTRACTS } from "../../../src/services/fool-proof-guard";

export const BASE_ORDER = {
  asset: 0,
  isBuy: true,
  limitPx: "100",
  sz: "1",
  reduceOnly: false,
  orderType: { limit: { tif: "Gtc" as const } },
};

export const DEFAULT_SESSION_GATE_OPTS = {
  contractTarget: HL_SESSION_KEY_ALLOWED_CONTRACTS[0],
  hlAction: "order" as const,
};
