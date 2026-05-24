import { test, expect } from "@playwright/test";

const DEMO_EMAIL = process.env.E2E_DEMO_EMAIL ?? "owner@fabsimple.demo";
const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? "demo-password-12345";

test.describe("Project flow", () => {
  test.skip(!process.env.E2E_RUN_AUTH, "Set E2E_RUN_AUTH=1 to run signed-in flows");

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/signin");
    await page.getByPlaceholder(/email/i).fill(DEMO_EMAIL);
    await page.getByPlaceholder(/password/i).fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test("dashboard KPIs load", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/projects/i).first()).toBeVisible();
  });

  test("can create a new project", async ({ page }) => {
    await page.goto("/dashboard/projects");
    await page.getByRole("button", { name: /new project/i }).click();
    const name = `E2E ${Date.now()}`;
    await page.getByPlaceholder(/project name|name/i).first().fill(name);
    await page.getByRole("button", { name: /create|save|submit/i }).first().click();
    await expect(page.getByText(name)).toBeVisible({ timeout: 8_000 });
  });

  test("⌘K command palette opens", async ({ page }) => {
    await page.goto("/dashboard");
    await page.keyboard.press("Meta+K");
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });
});
