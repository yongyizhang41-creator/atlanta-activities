import { test, expect } from "@playwright/test";

// Synthetic fixture only: no real accounts or emails are changed.
test("saving a new time replaces the displayed reminder and survives reopening", async ({
  page,
}) => {
  const event = {
    id: "reminder-fixture",
    title: "Atlanta evening fixture",
    description: "Fixture activity",
    starts_at: "2099-10-24T17:00:00Z",
    ends_at: "2099-10-24T20:00:00Z",
    venue: "Downtown",
    address: "Atlanta",
    latitude: 33.76,
    longitude: -84.4,
    categories: ["Arts"],
    eligibility: "Open to everyone",
    price: "Free",
    registration: "None",
    status: "active",
    version: 1,
    source_urls: ["https://example.test/event"],
    last_verified_at: "2099-10-23T12:00:00Z",
  };
  const old = {
    id: "past",
    event_id: event.id,
    remind_at: "2099-10-23T10:00:00Z",
    status: "sent",
    editable: false,
    sent_at: "2099-10-23T10:00:00Z",
    error: null,
  };
  let current: null | {
    id: string;
    event_id: string;
    remind_at: string;
    status: string;
    editable: boolean;
    sent_at: null;
    error: null;
  } = null;
  const saves: string[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = {};
    if (path === "/api/auth/session")
      data = {
        user: { id: "preview", email: "preview@example.test", verified: true },
        csrf: "fixture",
      };
    else if (path === "/api/me/plans")
      data = {
        items: [
          {
            event_id: event.id,
            event,
            status: "going",
            position: 0,
            version: 1,
            notice: null,
            conflicts: [],
            unknown_end_events: [],
            has_sent_reminder: true,
            reminder: current,
            reminders: [old, ...(current ? [current] : [])],
          },
        ],
      };
    else if (path.endsWith("/reminder") && route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      saves.push(body.remind_at);
      current = {
        id: "current",
        event_id: event.id,
        remind_at: body.remind_at,
        status: "pending",
        editable: true,
        sent_at: null,
        error: null,
      };
      data = current;
    } else if (
      path.endsWith("/reminders/current") &&
      route.request().method() === "DELETE"
    ) {
      current = null;
      data = { ok: true };
    } else if (path.endsWith("/reminders"))
      data = [old, ...(current ? [current] : [])];
    await route.fulfill({ json: data });
  });
  await page.goto("/my-plans");
  await page.getByRole("button", { name: "Manage reminders" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".reminder-list li")).toHaveCount(0);
  await expect(dialog.getByText(/Saving a new time replaces/)).toBeVisible();
  await dialog.getByLabel("1 hour", { exact: true }).check();
  await dialog
    .getByRole("button", { name: "Save reminder", exact: true })
    .click();
  await expect(dialog.locator(".reminder-list li")).toHaveCount(1);
  await dialog.getByLabel("30 minutes", { exact: true }).check();
  await dialog
    .getByRole("button", { name: "Save reminder", exact: true })
    .click();
  await expect.poll(() => saves.length).toBe(2);
  await expect(dialog.locator(".reminder-list li")).toHaveCount(1);
  expect(saves).toEqual([
    "2099-10-24T16:00:00.000Z",
    "2099-10-24T16:30:00.000Z",
  ]);
  await dialog.getByRole("button", { name: /Edit reminder at/ }).click();
  await dialog.getByLabel("Reminder time · Eastern").fill("2099-10-24T12:15");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect.poll(() => saves.length).toBe(3);
  expect(new Date(saves[2]).toISOString()).toBe("2099-10-24T16:15:00.000Z");
  await expect(dialog.locator(".reminder-list li")).toHaveCount(1);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Manage reminders" }).click();
  await expect(dialog.locator(".reminder-list li")).toHaveCount(1);
  await expect(dialog.locator(".reminder-list li")).toContainText("12:15 PM");
  await page.screenshot({
    path: "../../.local/reminder-replacement.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: /Cancel reminder at/ }).click();
  await expect(dialog.locator(".reminder-list li")).toHaveCount(0);
});
