import { test, expect } from "@playwright/test";

test.describe("Frontend Smoke Test", () => {
  test("homepage loads and shows main elements", async ({ page }) => {
    await page.goto("http://localhost:3000/");
    await expect(
      page.getByRole("heading", { name: "Bun Actionhero" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View API Endpoints" }),
    ).toBeVisible();
  });
});
