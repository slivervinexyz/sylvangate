"use strict";
(() => {
  // src/extension/popup.ts
  var STORAGE_KEY = "enabled";
  var toggle = document.getElementById("guard-toggle");
  var statusEl = document.getElementById("status");
  var badgeEl = document.getElementById("badge");
  function render(enabled) {
    toggle.checked = enabled;
    badgeEl.className = enabled ? "shield on" : "shield off";
    statusEl.className = enabled ? "status on" : "status off";
    statusEl.textContent = enabled ? "Active \u2014 Guard enabled" : "Paused \u2014 Pass-through mode";
  }
  async function loadState() {
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
})();
