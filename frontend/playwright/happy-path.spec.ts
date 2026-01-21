import { expect, test } from "@playwright/test";

test("happy path: sign up, sign in, send a message", async ({ page }) => {
  const runId = Date.now();
  const name = `Playwright User ${runId}`;
  const email = `pw_${runId}@example.com`;
  const password = `password-${runId}!`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bun Actionhero" })).toBeVisible();

  // Sign up (creates user account)
  const signUp = page.getByTestId("signup-form");
  await signUp.getByTestId("signup-name").fill(name);
  await signUp.getByTestId("signup-email").fill(email);
  await signUp.getByTestId("signup-password").fill(password);
  await signUp.getByTestId("signup-submit").click();

  await expect(page.getByText(`Hello ${name}!`)).toBeVisible({ timeout: 5000 });

  // Reload so the app returns to the sign-in state (signup doesn't create a session)
  await page.reload();

  // Sign in (creates session + localStorage userId)
  const signIn = page.getByTestId("signin-form");
  await signIn.getByTestId("signin-email").fill(email);
  await signIn.getByTestId("signin-password").fill(password);
  await signIn.getByTestId("signin-submit").click();

  await expect(page.getByText(`Welcome back, ${name}!`)).toBeVisible({
    timeout: 5000,
  });
  await expect(page.getByText(`Signed in as ${name}`)).toBeVisible();

  // Send a message via websocket and ensure it renders in the table
  const message = `hello from playwright ${runId}`;
  await expect(page.getByTestId("chat-send")).toBeEnabled({ timeout: 10_000 });
  await page.getByTestId("chat-message").fill(message);
  await page.getByTestId("chat-send").click();

  await expect(
    page
      .getByTestId("messages-table")
      .getByRole("cell", { name: message, exact: true }),
  ).toBeVisible({ timeout: 10_000 });
});

