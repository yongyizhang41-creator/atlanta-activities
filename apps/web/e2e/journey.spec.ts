import { test, expect } from "@playwright/test";
import fs from "node:fs";
const fixture = () =>
  JSON.parse(fs.readFileSync("../../.local/e2e.json", "utf8"));
test("complete activity, map, conflict and reminder journey", async ({
  page,
}) => {
  const f = fixture();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Good things are happening." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: f.titles[0], exact: true }),
  ).toBeVisible();
  await expect(page.locator('[aria-label="Activity map"]')).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 25000 },
  );
  await page.getByRole("button", { name: "Next week", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Next week", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "This week", exact: true }).click();
  await page.getByLabel("Football", { exact: true }).check();
  await expect(
    page.getByRole("heading", { name: f.titles[0], exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await page.getByLabel("Location filter").selectOption("radius");
  await page.context().clearPermissions();
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(
    page.getByText("Location access was unavailable.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Location filter").selectOption("none");
  const card = page.locator("article").filter({
    has: page.getByRole("heading", { name: f.titles[0], exact: true }),
  });
  await card.getByRole("button", { name: "Maybe", exact: true }).click();
  await expect(card.getByText("In Maybe")).toBeVisible();
  await page.getByRole("link", { name: "My plans", exact: true }).click();
  const plan = page.locator(".plan-card").filter({
    has: page.getByRole("heading", { name: f.titles[0], exact: true }),
  });
  await plan.getByRole("button", { name: "Going", exact: true }).click();
  await expect(plan.getByRole("button", { name: "Remind me" })).toBeVisible();
  await plan.getByRole("button", { name: "Remind me" }).click();
  await page.getByLabel("1 hour", { exact: true }).check();
  await page
    .getByRole("button", { name: "Save reminder", exact: true })
    .click();
  await expect(
    plan.getByRole("button", { name: "Edit reminder" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  const card2 = page.locator("article").filter({
    has: page.getByRole("heading", { name: f.titles[1], exact: true }),
  });
  await card2.getByRole("button", { name: "I’m going", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Two good plans. One time slot." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add anyway", exact: true }).click();
  await page.getByRole("link", { name: "My plans", exact: true }).click();
  await expect(
    page.locator(".plan-warning").filter({ hasText: "Overlaps with" }),
  ).toHaveCount(2);
  await page.screenshot({
    path: "../../.local/my-plans-desktop.png",
    fullPage: true,
  });
  const first = page.locator(".plan-card").filter({
    has: page.getByRole("heading", { name: f.titles[0], exact: true }),
  });
  await first.getByRole("button", { name: "Maybe", exact: true }).click();
  await expect(
    first.getByRole("button", { name: "Going", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".plan-warning").filter({ hasText: "Overlaps with" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await page
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: f.titles[0], exact: true }),
    })
    .getByRole("button")
    .first()
    .click();
  await page.getByLabel("Question about activity").fill("Who can attend?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.locator(".notice[role=alert]")).toContainText(
    "not configured",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.screenshot({
    path: "../../.local/explore-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "../../.local/explore-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("auth validation and password recovery explain errors", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Email address").fill("bad");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.locator(".notice[role=alert]")).toContainText(
    "valid email",
  );
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("nobody@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText(
    "If the account is eligible",
  );
});

test("draw area, clear, manual radius and pointer drag work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 1100 });
  const f = fixture();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator('[aria-label="Activity map"]')).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 25000 },
  );
  await page.getByLabel("Location filter").selectOption("polygon");
  const canvas = page.locator(".map-canvas canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Map has no geometry");
  for (const [x, y] of [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.5, 0.75],
  ])
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
  const searched = page.waitForResponse(
    (r) => r.url().endsWith("/api/events/search") && r.status() === 200,
  );
  await page.getByRole("button", { name: "Finish area" }).click();
  await searched;
  await page.getByRole("button", { name: "Clear & redraw" }).click();
  await expect(
    page.getByRole("button", { name: "Finish area" }),
  ).toBeDisabled();
  await page.getByLabel("Location filter").selectOption("radius");
  const radiusSearch = page.waitForResponse(
    (r) => r.url().endsWith("/api/events/search") && r.status() === 200,
  );
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await radiusSearch;
  await page.getByLabel("Location filter").selectOption("none");
  const card = page.locator("article").filter({
    has: page.getByRole("heading", { name: f.titles[2], exact: true }),
  });
  await card.getByRole("button", { name: "Maybe", exact: true }).click();
  await page.getByRole("link", { name: "My plans", exact: true }).click();
  const drag = page.getByRole("button", {
    name: "Drag or open " + f.titles[2],
    exact: true,
  });
  const from = await drag.boundingBox();
  const target = await page
    .locator(".board-column")
    .nth(1)
    .locator(".drop-zone")
    .boundingBox();
  if (!from || !target) throw new Error("Drag geometry missing");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    from.x + from.width / 2 + 15,
    from.y + from.height / 2,
    { steps: 3 },
  );
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    { steps: 20 },
  );
  await page.mouse.up();
  const moved = page
    .locator(".board-column")
    .nth(1)
    .locator(".plan-card")
    .filter({
      has: page.getByRole("heading", { name: f.titles[2], exact: true }),
    });
  await expect(moved).toBeVisible();
});

test("older load-more response cannot replace a new week", async ({ page }) => {
  const f = fixture();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Good things are happening." }),
  ).toBeVisible();
  const base = {
    id: "mock-current",
    title: "Current week activity",
    description: "Network race test fixture",
    starts_at: "2026-10-23T18:00:00Z",
    ends_at: "2026-10-23T20:00:00Z",
    venue: "Fixture venue",
    address: "",
    latitude: 33.77,
    longitude: -84.4,
    categories: ["Community"],
    eligibility: "Fixture",
    price: "Unknown",
    registration: "Unknown",
    status: "scheduled",
    version: 1,
    source_urls: ["https://example.org"],
    last_verified_at: "2026-10-22T12:00:00Z",
  };
  let release: (() => void) | undefined;
  let entered = false;
  await page.route("**/api/events/search", async (route) => {
    const body = route.request().postDataJSON();
    if (body.cursor === 30) {
      entered = true;
      await new Promise<void>((r) => {
        release = r;
      });
      await route.fulfill({
        json: {
          items: [{ ...base, id: "old-page", title: "STALE previous week" }],
          total: 31,
          next_cursor: null,
          week_start: "2026-10-19T04:00:00Z",
          week_end: "2026-10-26T04:00:00Z",
          server_now: "2026-10-22T12:00:00Z",
        },
      });
      return;
    }
    const next = body.week === "next";
    await route.fulfill({
      json: {
        items: [
          {
            ...base,
            id: next ? "new-week" : "current-week",
            title: next ? "New week activity" : "Current week activity",
          },
        ],
        total: next ? 1 : 31,
        next_cursor: next ? null : 30,
        week_start: next ? "2026-10-26T04:00:00Z" : "2026-10-19T04:00:00Z",
        week_end: next ? "2026-11-02T05:00:00Z" : "2026-10-26T04:00:00Z",
        server_now: "2026-10-22T12:00:00Z",
      },
    });
  });
  await page.getByRole("button", { name: "Next week", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "New week activity", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "This week", exact: true }).click();
  await page.getByRole("button", { name: "Load more activities" }).click();
  await expect.poll(() => entered).toBe(true);
  await page.getByRole("button", { name: "Next week", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "New week activity", exact: true }),
  ).toBeVisible();
  release?.();
  await expect(
    page.getByRole("heading", { name: "STALE previous week" }),
  ).toHaveCount(0);
});
