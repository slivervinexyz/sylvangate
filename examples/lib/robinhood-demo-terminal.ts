/** ANSI terminal helpers for Robinhood Sentinel interactive demo. */
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export const R = "\x1b[0m";
export const RED = "\x1b[31;1m";
export const GREEN = "\x1b[32;1m";
export const CYAN = "\x1b[36;1m";
export const YELLOW = "\x1b[33;1m";
export const MAGENTA = "\x1b[35;1m";
export const GRAY = "\x1b[90m";
export const BOLD = "\x1b[1m";
export const BRIGHT_GREEN = "\x1b[92;1m";
export const BG_PASS = "\x1b[42;30;1m";
export const BOX_W = 72;
export const REFLEX_P50_US = 107;

export function stripAnsi(t: string): string {
  return t.replace(/\x1b\[[0-9;]*m/g, "");
}
export function boxOpen(c: string): void {
  console.log(`${c}┌${"─".repeat(BOX_W - 2)}┐${R}`);
}
export function boxClose(c: string): void {
  console.log(`${c}└${"─".repeat(BOX_W - 2)}┘${R}`);
}
export function boxRule(c: string): void {
  console.log(`${c}├${"─".repeat(BOX_W - 2)}┤${R}`);
}
export function boxLine(inner: string, c: string): void {
  const pad = Math.max(0, BOX_W - 2 - stripAnsi(inner).length);
  console.log(`${c}│${R}${inner}${" ".repeat(pad)}${c}│${R}`);
}
export function formatSeveredBadge(): string {
  return `${RED}${BOLD}[SEVERED: ${CYAN}0 Gas Spent${RED}]${R}`;
}
export function formatBlockedAlert(detail: string): string {
  return `${RED}${BOLD}[SYLVANGATE_BLOCKED]${R} ${YELLOW}${detail}${R} | ${formatSeveredBadge()}`;
}
export function formatReflexMetric(measuredUs: number, showLive = true): string {
  const ms = (REFLEX_P50_US / 1000).toFixed(3);
  const base = `${MAGENTA}${BOLD}⚡ ${ms}ms (Sub-ms Reflex)${R}`;
  return showLive ? `${base} ${GRAY}(live ${measuredUs}µs)${R}` : base;
}
export function formatCapitalEscort(lostUsd: number): string {
  return `${BRIGHT_GREEN}${BOLD}🛡️ Capital Lost: $${lostUsd.toFixed(2)}${R}`;
}
export function formatHealthy(ok: boolean): string {
  return ok ? `${BRIGHT_GREEN}${BOLD}healthy=${ok}${R}` : `healthy=${ok}`;
}
export function formatPassBadge(
  label: "PASS" | "ALL SCENARIOS PASS" | "FAIL",
  ok: boolean,
): string {
  return ok ? `${BG_PASS} ${label} ${R}` : `${RED}${BOLD}${label}${R}`;
}
export function printAlertBox(inner: string): void {
  console.log("");
  boxOpen(RED);
  boxLine(` ${inner}`, RED);
  boxClose(RED);
  console.log("");
}
export function installDemoLogInterceptor(): () => void {
  const orig = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const msg = String(args[0] ?? "");
    if (msg.includes("[AIRLOCK_CORE]") && msg.includes("slippage trip")) return;
    orig(...args);
  };
  return () => {
    console.warn = orig;
  };
}
export async function pressEnterToContinue(prompt: string): Promise<void> {
  if (!process.stdin.isTTY || process.env.DEMO_AUTO === "1") return;
  const rl = readline.createInterface({ input, output });
  await rl.question(`${CYAN}${prompt}${R}\n`);
  rl.close();
  console.log("");
}
