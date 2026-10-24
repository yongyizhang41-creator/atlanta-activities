import { test, expect } from "@playwright/test";
import fs from "node:fs";

test("open board removes ended activities and refreshes cancellation on focus", async ({
  page,
}) => {
  const f = JSON.parse(fs.readFileSync("../../.local/e2e.json", "utf8"));
  await page.goto("/login");
  await page.getByLabel("Email address").fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const card = page.locator("article").filter({
    has: page.getByRole("heading", { name: f.titles[0], exact: true }),
  });
  await card.getByRole("button", { name: "Maybe", exact: true }).click();
  await page.getByRole("link", { name: "My plans", exact: true }).click();
  const data = await (await page.request.get("/api/me/plans")).json();
  const plan = data.items.find((p: any) => p.event.title === f.titles[0]);
  await page
    .getByRole("button", { name: "Remove " + f.titles[0], exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: f.titles[0], exact: true }),
  ).toHaveCount(0);
  // Keep the real database clean; model the API response as time/state changes.
  plan.event.starts_at = new Date(Date.now() - 3600000).toISOString();
  plan.event.ends_at = new Date(Date.now() + 5000).toISOString();
  let available = true;
  await page.route("**/api/me/plans", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const ended =
      plan.event.ends_at &&
      new Date(plan.event.ends_at).getTime() <= Date.now();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: available && !ended ? [plan] : [] }),
    });
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: f.titles[0], exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: f.titles[0], exact: true }),
  ).toHaveCount(0, { timeout: 10000 });
  plan.event.ends_at = null;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("heading", { name: f.titles[0], exact: true }),
  ).toBeVisible();
  available = false;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("heading", { name: f.titles[0], exact: true }),
  ).toHaveCount(0);
});
