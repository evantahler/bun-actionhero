import { expect, test } from "@playwright/test";

function parseNumber(text: string): number {
  const n = Number(String(text).trim());
  return Number.isFinite(n) ? n : NaN;
}

test("homepage status card loads and refreshes", async ({ page }) => {
  await page.goto("/");

  const card = page.getByTestId("status-card");
  await expect(card).toBeVisible();

  // Initial load should populate fields.
  await expect(page.getByTestId("status-name")).toHaveText(/.+/, {
    timeout: 10_000,
  });
  await expect(page.getByTestId("status-pid")).toHaveText(/.+/);
  await expect(page.getByTestId("status-version")).toHaveText(/.+/);

  const uptime1 = parseNumber(
    await page.getByTestId("status-uptime").innerText(),
  );
  expect(uptime1).not.toBeNaN();

  // Refresh should trigger a new /status response and update uptime.
  await page.waitForTimeout(1000);
  const statusResponsePromise = page.waitForResponse(
    (resp) =>
      resp.status() === 200 &&
      resp.url().includes("/status") &&
      resp.url().includes(":8080"),
  );
  await page.getByTestId("status-refresh").click();
  await statusResponsePromise;

  const uptime2 = parseNumber(
    await page.getByTestId("status-uptime").innerText(),
  );
  expect(uptime2).not.toBeNaN();
  expect(uptime2).toBeGreaterThanOrEqual(uptime1);
});
