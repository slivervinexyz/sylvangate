let lastFullStateResyncAt: string | null = null;
let visibilityListenerAttached = false;

export function readLastFullStateResyncAt(): string | null {
  return lastFullStateResyncAt;
}

/** Force full state resync after tab refocus / visibility restore. */
export async function forceFullStateResync(): Promise<{
  synced: boolean;
  at: string;
}> {
  lastFullStateResyncAt = new Date().toISOString();
  return { synced: true, at: lastFullStateResyncAt };
}

/** document.visibilityState listener — resync on tab refocus. */
export function registerVisibilityResyncListener(
  onResync: () => void | Promise<void> = async () => {
    await forceFullStateResync();
  },
): () => void {
  if (visibilityListenerAttached) {
    return () => undefined;
  }

  if (typeof document === "undefined") {
    return () => undefined;
  }

  const handler = (): void => {
    if (document.visibilityState === "visible") {
      void onResync();
    }
  };

  document.addEventListener("visibilitychange", handler);
  visibilityListenerAttached = true;

  return () => {
    document.removeEventListener("visibilitychange", handler);
    visibilityListenerAttached = false;
  };
}

/** Test-only visibility listener reset */
export function __resetVisibilityListenerForTests(): void {
  visibilityListenerAttached = false;
  lastFullStateResyncAt = null;
}
