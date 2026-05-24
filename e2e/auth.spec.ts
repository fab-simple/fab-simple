import { test, expect } from "@playwright/test";

// These tests target a running local stack with the demo seed applied
// (npx supabase start && npx supabase db reset).
// Demo credentials match the demo seed migration.
const DEMO_EMAIL = process.env.E2E_DEMO_EMAIL ?? "owner@fabsimple.demo";
const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? "demo-password-12345";

test.describe("Auth flow", () => {
  test("anonymous user redirected from /dashboard to /auth/signin", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test("signin renders form fields", async ({ page }) => {
    await page.goto("/auth/signin");
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
  });

  test("signin with demo credentials lands on dashboard", async ({ page }) => {
    test.skip(!process.env.E2E_RUN_AUTH, "Set E2E_RUN_AUTH=1 to run signed-in flows");
    await page.goto("/auth/signin");
    await page.getByPlaceholder(/email/i).fill(DEMO_EMAIL);
    await page.getByPlaceholder(/password/i).fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/);
    await expect(page.getByText(/Dashboard/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Public marketing pages", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    expect(page.url()).toBeTruthy();
  });
});
