import { test, expect } from "@playwright/test";

test.describe("Sign Up Functionality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display sign up form when not logged in", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Sign Up" })).toBeVisible();

    // Target the sign-up form specifically (second form on the page)
    const signUpForm = page.locator("form").nth(1);
    await expect(signUpForm.locator("#name")).toBeVisible();
    await expect(signUpForm.locator("#email")).toBeVisible();
    await expect(signUpForm.locator("#password")).toBeVisible();
    await expect(
      signUpForm.getByRole("button", { name: "Submit" }),
    ).toBeVisible();
  });

  test("should successfully sign up a new user", async ({ page }) => {
    const testName = `TestUser${Date.now()}`;
    const testEmail = `test${Date.now()}@example.com`;
    const testPassword = "testpassword123";

    // Target the sign-up form specifically (second form on the page)
    const signUpForm = page.locator("form").nth(1);

    // Fill out the sign up form
    await signUpForm.locator("#name").fill(testName);
    await signUpForm.locator("#email").fill(testEmail);
    await signUpForm.locator("#password").fill(testPassword);

    // Submit the form
    await signUpForm.getByRole("button", { name: "Submit" }).click();

    // Wait for success message
    await expect(page.getByText(`Hello ${testName}!`)).toBeVisible();

    // Verify user is now signed in
    await expect(page.getByText(`Signed in as ${testName}`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

    // Verify sign up form is no longer visible
    await expect(
      page.getByRole("heading", { name: "Sign Up" }),
    ).not.toBeVisible();
  });

  test("should validate required fields", async ({ page }) => {
    const signUpForm = page.locator("form").nth(1);

    // Try to submit without filling any fields
    await signUpForm.getByRole("button", { name: "Submit" }).click();

    // Form should still be visible (no navigation)
    await expect(page.getByRole("heading", { name: "Sign Up" })).toBeVisible();
  });

  test("should handle form with partial data", async ({ page }) => {
    const signUpForm = page.locator("form").nth(1);

    // Fill only name and email, leave password empty
    await signUpForm.locator("#name").fill("PartialUser");
    await signUpForm.locator("#email").fill("partial@example.com");

    await signUpForm.getByRole("button", { name: "Submit" }).click();

    // Should still be on sign up page
    await expect(page.getByRole("heading", { name: "Sign Up" })).toBeVisible();
  });
});
