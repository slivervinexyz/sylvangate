/** Grant Audit page view role — query param SSOT. */

export type GrantAuditViewRole = "grant" | "vault";

export type GrantAuditSiteView = GrantAuditViewRole | "b2b";

export const GRANT_AUDIT_ROLE_LABEL: Readonly<Record<GrantAuditViewRole, string>> = {
  grant: "🛡️ Grant Audit View",
  vault: "💧 BeΔ Zero-Delta Vault",
};

export function parseGrantAuditRole(search: string): GrantAuditViewRole {
  const role = new URLSearchParams(search).get("role");
  return role === "vault" ? "vault" : "grant";
}

export function grantAuditRoleSearch(role: GrantAuditViewRole): string {
  return role === "vault" ? "?role=vault" : "";
}

export function parseGrantAuditSiteView(
  pathname: string,
  search: string = "",
): GrantAuditSiteView {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/b2b") return "b2b";
  return parseGrantAuditRole(search);
}

export function isB2bInstitutionalPath(pathname: string): boolean {
  return parseGrantAuditSiteView(pathname) === "b2b";
}

export function syncGrantAuditRoleUrl(role: GrantAuditViewRole): void {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  const next = `${path}${grantAuditRoleSearch(role)}`;
  window.history.replaceState(null, "", next);
}
