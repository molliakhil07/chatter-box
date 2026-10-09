
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Keep browser tests isolated from the real backend.
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Not authenticated" }),
    });
  });
});

test("shows the Chatter Box sign-in form", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "ChatterBox" }),
  ).toBeVisible();

  await expect(
    page.getByPlaceholder("Email, username"),
  ).toBeVisible();

  await expect(
    page.getByPlaceholder("Password"),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: "Sign In", exact: true }),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: "Create Account", exact: true }),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: "Forgot password?" }),
  ).toBeVisible();
});

test("opens the registration form", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("button", { name: "Create Account", exact: true })
    .click();

  await expect(
    page.getByPlaceholder("Your name"),
  ).toBeVisible();

  await expect(
    page.getByPlaceholder("Email address"),
  ).toBeVisible();

  await expect(
    page.getByPlaceholder("Username"),
  ).toBeVisible();

  await expect(
    page.getByPlaceholder("Create a password"),
  ).toBeVisible();

  await expect(
    page.getByRole("combobox", { name: "Gender" }),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: "Create Account", exact: true }),
  ).toBeVisible();
});

test("opens forgot-password form and returns to sign-in", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Forgot password?" }).click();

  await expect(
    page.getByText("Reset your password."),
  ).toBeVisible();

  await expect(
    page.getByPlaceholder("Email address"),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: "Send Reset Link" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Sign In", exact: true }).click();

  await expect(
    page.getByPlaceholder("Email, username"),
  ).toBeVisible();
});

test("shows the backend error after a failed sign-in", async ({ page }) => {
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Invalid credentials" }),
    });
  });

  await page.goto("/");

  await page.getByPlaceholder("Email, username").fill("test-user");
  await page.getByPlaceholder("Password").fill("WrongPassword123!");

  await page
    .getByRole("button", { name: "Sign In", exact: true })
    .click();

  await expect(page.getByRole("alert")).toHaveText("Invalid credentials");
});
