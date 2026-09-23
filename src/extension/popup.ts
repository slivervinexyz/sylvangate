const STORAGE_KEY = "enabled";

const toggle = document.getElementById("guard-toggle") as HTMLInputElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const badgeEl = document.getElementById("badge") as HTMLDivElement;

function render(enabled: boolean): void {
  toggle.checked = enabled;
  badgeEl.className = enabled ? "shield on" : "shield off";
  statusEl.className = enabled ? "status on" : "status off";
  statusEl.textContent = enabled
    ? "Active — Guard enabled"
    : "Paused — Pass-through mode";
}

async function loadState(): Promise<void> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const enabled = stored[STORAGE_KEY] !== false;
  render(enabled);
}

toggle.addEventListener("change", async () => {
  const enabled = toggle.checked;
  await chrome.storage.local.set({ [STORAGE_KEY]: enabled });
  render(enabled);
});

loadState();
