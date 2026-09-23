/** Tailwind/shadcn class merge — v0.app compatible. */
export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(" ");
}
