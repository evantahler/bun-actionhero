import { expect, test } from "@playwright/test";

test("swagger page renders API docs", async ({ page }) => {
  // Start waiting before navigation so we can't miss the request.
  const swaggerSpecResponsePromise = page.waitForResponse(
    (resp) =>
      resp.status() === 200 &&
      resp.url().endsWith("/swagger") &&
      (resp.headers()["content-type"] ?? "").includes("application/json"),
  );

  await page.goto("/swagger");
  await expect(page).toHaveTitle("API Endpoints");

  const container = page.getByTestId("swagger-container");
  await expect(container).toBeVisible();

  // Confirm we actually got a valid OpenAPI document from the backend.
  const swaggerSpecResponse = await swaggerSpecResponsePromise;
  const spec = (await swaggerSpecResponse.json()) as {
    openapi?: string;
    paths?: Record<string, unknown>;
  };
  expect(spec.openapi).toBeTruthy();
  expect(spec.paths).toBeTruthy();
  expect(spec.paths).toHaveProperty("/status");

  // Confirm the Swagger UI actually rendered into the page.
  const swaggerUI = container.locator(".swagger-ui");
  await expect(swaggerUI).toBeVisible({ timeout: 20_000 });

  // One high-signal sanity check that endpoints made it to the UI.
  await expect(swaggerUI).toContainText("status", { timeout: 20_000 });
});
