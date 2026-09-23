/** Session key blast-radius — order execution only (no withdraw / leverage). */
export type SessionKeyPermission =
  | "ORDER_EXECUTE"
  | "ORDER_CANCEL"
  | "WITHDRAW"
  | "SET_LEVERAGE";

export const SESSION_KEY_ALLOWED_PERMISSIONS: readonly SessionKeyPermission[] = [
  "ORDER_EXECUTE",
  "ORDER_CANCEL",
] as const;

const SESSION_KEY_BLOCKED_PERMISSIONS: readonly SessionKeyPermission[] = [
  "WITHDRAW",
  "SET_LEVERAGE",
] as const;

export class HyperliquidAdapterError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus = 403) {
    super(message);
    this.name = "HyperliquidAdapterError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** Block session key permissions outside order execution blast-radius. */
export function assertSessionKeyPermission(
  permission: SessionKeyPermission,
): void {
  if (
    SESSION_KEY_BLOCKED_PERMISSIONS.includes(permission) ||
    !SESSION_KEY_ALLOWED_PERMISSIONS.includes(permission)
  ) {
    throw new HyperliquidAdapterError(
      "SESSION_KEY_PERMISSION_DENIED",
      `Session key scope denied for ${permission} — allowed: ${SESSION_KEY_ALLOWED_PERMISSIONS.join(", ")}`,
      403,
    );
  }
}
