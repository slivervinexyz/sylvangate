import { expect, test } from "@playwright/test";

test("FW-11-ui intercepts infinite approve with plainTextWarning", async ({ page }) => {
  await page.goto("/");
  await page.locator("#fw11-trigger").click();
  const toast = page.locator("#fw11-toast");
  await expect(toast).toBeVisible();
  await expect(page.locator("#fw11-toast-msg")).toContainText("Unauthorized ERC20 approval");
  await expect(page.locator("#fw11-toast-msg")).toContainText("INFINITE");
  await expect(page.locator("#fw11-toast-code")).toContainText("UNAUTHORIZED_SPENDER_REJECTED");
});
