import { test, expect } from "@playwright/test";

// Synthetic public activity data: no account, email, ingestion or delivery side effects.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const activity = {
      id: "magazine-fixture",
      title: "An afternoon of art in Midtown",
      description:
        "Explore local art and spend an afternoon in the neighborhood. ".repeat(
          6,
        ),
      starts_at: "2099-10-23T18:00:00Z",
      ends_at: "2099-10-23T20:00:00Z",
      venue: "Midtown Arts Center",
      address: "Midtown, Atlanta",
      latitude: 33.7756,
      longitude: -84.3963,
      categories: ["Arts"],
      eligibility: "Open to everyone",
      price: "Free",
      registration: "None",
      status: "active",
      version: 1,
      source_urls: ["https://example.com/activity"],
      last_verified_at: new Date().toISOString(),
    };
    const coverage = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-84.42, 33.75],
                [-84.37, 33.75],
                [-84.37, 33.8],
                [-84.42, 33.8],
                [-84.42, 33.75],
              ],
            ],
          },
        },
      ],
    };
    let data: unknown = {};
    if (path === "/api/auth/session")
      data = {
        user: { id: "preview", email: "preview@example.test", verified: true },
        csrf: "fixture",
      };
    else if (path === "/api/config")
      data = {
        categories: ["Arts", "Music"],
        map_style: "/magazine-map-style",
        coverage,
        timezone: "America/New_York",
        services: {},
        sources: [],
      };
    else if (path === "/api/me/plans") data = { items: [] };
    else if (path === "/api/events/search")
      data = {
        items: [activity],
        total: 1,
        next_cursor: null,
        week_start: "2099-10-19",
        week_end: "2099-10-25",
      };
    else if (path === "/api/events/map")
      data = { type: "FeatureCollection", features: [], total: 1 };
    else if (path === "/api/events/magazine-fixture") data = activity;
    await route.fulfill({ json: data });
  });
  await page.route("**/magazine-map-style", (route) =>
    route.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#eaf0ee" },
          },
        ],
      },
    }),
  );
});

test("mobile views preserve filters, map instance and detail access", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/explore");
  await expect(
    page.getByRole("heading", { name: "Your Atlanta week." }),
  ).toBeVisible();
  const list = page.getByRole("button", { name: "List view", exact: true });
  const map = page.getByRole("button", { name: "Map view", exact: true });
  await expect(list).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByLabel("Arts", { exact: true }).check();
  await page.getByRole("button", { name: "Next week", exact: true }).click();
  await map.click();
  await expect(
    page.getByRole("region", { name: "Activity map", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Activities", exact: true }),
  ).toBeHidden();
  await expect(page.getByLabel("Arts", { exact: true })).toBeChecked();
  await list.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Next week", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "An afternoon of art in Midtown" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../../.local/magazine-mobile-day.png",
    fullPage: true,
  });
});

test("desktop shows list and map together on the glass city canvas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/explore");
  await expect(
    page.getByRole("region", { name: "Activities", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Activity map", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Map view", exact: true }),
  ).toBeHidden();
  const glass = await page.locator(".filter-panel").evaluate((el) => ({
    blur: getComputedStyle(el).backdropFilter,
    city: getComputedStyle(document.querySelector(".city-backdrop-scene")!)
      .backgroundImage,
  }));
  expect(glass.blur).toContain("blur");
  expect(glass.city).toContain("atlanta-skyline.png");
  await expect(page.locator(".map-panel")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page.locator(".maplibregl-ctrl-group")).toHaveCSS(
    "background-color",
    "rgba(28, 49, 69, 0.95)",
  );
  await expect(page.locator(".maplibregl-ctrl-attrib")).toHaveCSS(
    "background-color",
    "rgba(24, 44, 64, 0.94)",
  );
  await page.screenshot({
    path: "../../.local/magazine-desktop-day.png",
    fullPage: true,
  });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
  await page.screenshot({
    path: "../../.local/magazine-desktop-unified.png",
    fullPage: true,
  });
});

test("wide desktop uses the available width with bounded side gutters", async ({
  page,
}) => {
  await page.setViewportSize({ width: 2560, height: 1100 });
  await page.goto("/explore");
  await expect(page.locator(".city-hero")).toBeVisible();
  const gutters = await page.locator(".city-hero").evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return [rect.left, document.documentElement.clientWidth - rect.right];
  });
  for (const gutter of gutters) {
    expect(gutter).toBeGreaterThanOrEqual(24);
    expect(gutter).toBeLessThanOrEqual(64);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("map canvas survives view changes and responsive reflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/explore");
  await page.getByRole("button", { name: "Map view", exact: true }).click();
  await expect(page.locator(".map-panel")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const canvas = await page.locator(".map-canvas canvas").elementHandle();
  expect(canvas).not.toBeNull();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByLabel("Location filter").selectOption("polygon");
  await page.locator(".map-canvas canvas").scrollIntoViewIfNeeded();
  let bounds = await page.locator(".map-canvas canvas").boundingBox();
  if (!bounds) throw new Error("Map has no visible geometry");
  for (const [x, y] of [
    [0.25, 0.25],
    [0.75, 0.25],
  ])
    await page.mouse.click(
      bounds.x + bounds.width * x,
      bounds.y + bounds.height * y,
    );
  await expect(page.getByRole("button", { name: "Undo point" })).toBeEnabled();
  await page.getByRole("button", { name: "List view", exact: true }).click();
  await page.getByRole("button", { name: "Map view", exact: true }).click();
  await expect(page.getByRole("button", { name: "Undo point" })).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Finish area" }),
  ).toBeDisabled();
  await page.locator(".map-canvas canvas").scrollIntoViewIfNeeded();
  bounds = await page.locator(".map-canvas canvas").boundingBox();
  if (!bounds) throw new Error("Map has no visible geometry");
  await page.mouse.click(
    bounds.x + bounds.width * 0.5,
    bounds.y + bounds.height * 0.6,
  );
  const searched = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/events/search") &&
      !!request.postDataJSON().polygon,
  );
  await page.getByRole("button", { name: "Finish area" }).click();
  expect((await searched).postDataJSON().polygon.coordinates[0]).toHaveLength(
    4,
  );

  await page.getByRole("button", { name: "List view", exact: true }).click();
  await page.getByRole("button", { name: "Map view", exact: true }).click();
  expect(
    await canvas!.evaluate(
      (el) => el === document.querySelector(".map-canvas canvas"),
    ),
  ).toBe(true);
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect
      .poll(async () =>
        page
          .locator(".map-canvas canvas")
          .evaluate((el) =>
            Math.abs(
              el.getBoundingClientRect().width -
                el.parentElement!.getBoundingClientRect().width,
            ),
          ),
      )
      .toBeLessThan(2);
    if (width > 900)
      await expect(
        page.getByRole("region", { name: "Activities", exact: true }),
      ).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "../../.local/magazine-mobile-unified.png",
    fullPage: true,
  });
});

test("empty and failed searches keep recovery controls reachable", async ({
  page,
}) => {
  let failed = true;
  await page.route("**/api/events/search", (route) =>
    route.fulfill(
      failed
        ? {
            status: 503,
            json: { message: "Fixture service unavailable. Try again." },
          }
        : { json: { items: [], total: 0, next_cursor: null } },
    ),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/explore");
  await page.getByRole("button", { name: "Map view", exact: true }).click();
  await expect(
    page.getByText("Fixture service unavailable. Try again."),
  ).toBeVisible();
  failed = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByRole("button", { name: "List view", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No activities in this selection." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "This week", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("shared auth, plans and settings retain the single Day theme", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const path of ["/login", "/my-plans", "/settings"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
    await page.screenshot({
      path: `../../.local/magazine-${path.slice(1)}-unified.png`,
      fullPage: true,
    });
    await expect(
      page.getByRole("button", { name: /Switch to .* mode/ }),
    ).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
  }
});

test("journal merges paged days and retains activity actions and status", async ({
  page,
}) => {
  const base = {
    description:
      "A neighborhood afternoon with art, conversation and a reason to get outside.",
    venue: "Midtown Arts Center",
    address: "Midtown, Atlanta",
    latitude: 33.7756,
    longitude: -84.3963,
    categories: ["Arts"],
    eligibility: "Open to everyone",
    price: "Free",
    registration: "None",
    status: "active",
    version: 1,
    source_urls: ["https://example.com/activity"],
    last_verified_at: new Date().toISOString(),
  };
  const events = [
    {
      ...base,
      id: "journal-a",
      title: "Neighborhood art workshop",
      starts_at: "2099-10-23T18:00:00Z",
      ends_at: "2099-10-23T20:00:00Z",
    },
    {
      ...base,
      id: "journal-b",
      title: "Evening in the park",
      categories: ["Music"],
      starts_at: "2099-10-24T00:30:00Z",
      ends_at: null,
    },
    {
      ...base,
      id: "journal-c",
      title: "Saturday community market",
      categories: ["Community"],
      starts_at: "2099-10-24T15:00:00Z",
      ends_at: "2099-10-24T18:00:00Z",
      status: "cancelled",
    },
  ];
  await page.route("**/api/events/search", (route) => {
    const more = route.request().postDataJSON().cursor != null;
    return route.fulfill({
      json: {
        items: more ? events.slice(1) : events.slice(0, 1),
        total: 3,
        next_cursor: more ? null : 1,
      },
    });
  });
  await page.setViewportSize({ width: 1680, height: 1000 });
  await page.goto("/explore");
  await expect(
    page.getByText("1 activity loaded", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Load more activities" }).click();
  await expect(
    page.getByRole("heading", { name: "Friday, Oct 23", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Saturday, Oct 24", exact: true }),
  ).toHaveCount(1);
  await expect(page.getByText("2 activities", { exact: true })).toBeVisible();
  const evening = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Evening in the park" }),
  });
  await expect(evening.getByText("8:30 PM", { exact: true })).toBeVisible();
  await expect(
    evening.getByText("End time unknown", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("article")
      .filter({ hasText: "Saturday community market" })
      .getByRole("button", { name: "I’m going" }),
  ).toBeDisabled();
  const mutation = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/me/plans/journal-b") &&
      request.method() === "PUT",
  );
  await evening.getByRole("button", { name: "Maybe", exact: true }).click();
  expect((await mutation).postDataJSON().status).toBe("maybe");
  await evening.getByRole("button", { name: "Evening in the park" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .locator(".explorer")
    .screenshot({ path: "../../.local/journal-desktop-day.png" });
  await page
    .locator(".explorer")
    .screenshot({ path: "../../.local/journal-desktop-unified.png" });
  await page.setViewportSize({ width: 1680, height: 400 });
  await expect
    .poll(async () => (await page.locator(".map-panel").boundingBox())!.height)
    .toBeLessThanOrEqual(360);
  expect(
    (await page.locator(".map-canvas").boundingBox())!.height,
  ).toBeGreaterThan(80);
  await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator(".activities")
    .screenshot({ path: "../../.local/journal-mobile-unified.png" });
});

test("spring card hover lifts without shifting the timeline and returns on exit", async ({
  page,
}) => {
  await page.goto("/explore");
  const card = page.locator(".journal-card").first();
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(750);
  const before = (await card.boundingBox())!;
  const layoutBefore = await page
    .locator(".journal-entry")
    .first()
    .evaluate((el) => (el as HTMLElement).offsetHeight);
  await card.hover();
  await expect
    .poll(async () => (await card.boundingBox())!.y)
    .toBeLessThan(before.y - 4);
  await expect
    .poll(async () => (await card.boundingBox())!.width)
    .toBeGreaterThan(before.width * 1.01);
  expect(
    await page
      .locator(".journal-entry")
      .first()
      .evaluate((el) => (el as HTMLElement).offsetHeight),
  ).toBe(layoutBefore);
  await page.mouse.move(0, 0);
  await expect
    .poll(async () => Math.abs((await card.boundingBox())!.y - before.y))
    .toBeLessThan(1);
});

test("reduced motion keeps cards still and stops cinematic background motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/explore");
  const card = page.locator(".journal-card").first();
  await card.scrollIntoViewIfNeeded();
  const before = (await card.boundingBox())!;
  await card.hover();
  await page.waitForTimeout(400);
  const after = (await card.boundingBox())!;
  expect(Math.abs(after.y - before.y)).toBeLessThan(1);
  expect(Math.abs(after.width - before.width)).toBeLessThan(1);
  await expect(page.locator(".city-backdrop-scene")).toHaveCSS(
    "animation-name",
    "none",
  );
});

test("card hover and keyboard focus highlight its map point without moving the canvas", async ({
  page,
}) => {
  await page.route("**/api/events/map", (route) =>
    route.fulfill({
      json: {
        type: "FeatureCollection",
        total: 1,
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [-84.3963, 33.7756] },
            properties: {
              id: "magazine-fixture",
              title: "An afternoon of art in Midtown",
              category: "Arts",
            },
          },
        ],
      },
    }),
  );
  await page.goto("/explore");
  const map = page.locator(".map-panel");
  await expect(map).toHaveAttribute("data-ready", "true");
  const card = page.locator(".journal-card").first();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  const canvas = page.locator(".map-canvas canvas");
  const before = await canvas.boundingBox();
  await card.hover();
  await expect(map).toHaveAttribute(
    "data-highlighted-activity",
    "magazine-fixture",
  );
  expect(await canvas.boundingBox()).toEqual(before);
  const preview = page.getByRole("img", {
    name: "Map location for An afternoon of art in Midtown",
    exact: true,
  });
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("data-longitude", "-84.3963");
  await expect(preview).toHaveAttribute("data-latitude", "33.7756");
  await expect(preview).toContainText("An afternoon of art in Midtown");
  await page.mouse.move(0, 0);
  await expect(map).not.toHaveAttribute("data-highlighted-activity");
  await expect(preview).toHaveCount(0);
  await card
    .getByRole("button", { name: "An afternoon of art in Midtown" })
    .focus();
  await expect(map).toHaveAttribute(
    "data-highlighted-activity",
    "magazine-fixture",
  );
  await page.getByRole("button", { name: "Locate me", exact: true }).focus();
  await expect(map).not.toHaveAttribute("data-highlighted-activity");
});

test("buttons recover after a long press and rapid week changes show the newest result", async ({
  page,
}) => {
  await page.goto("/explore");
  const initial = await page.evaluate(async () =>
    (
      await fetch("/api/events/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week: "this",
          categories: [],
          geo_mode: "none",
        }),
      })
    ).json(),
  );
  await page.route("**/api/events/search", async (route) => {
    const week = route.request().postDataJSON().week;
    await new Promise((resolve) =>
      setTimeout(resolve, week === "this" ? 450 : 60),
    );
    await route.fulfill({
      json: {
        ...initial,
        items: [
          {
            ...initial.items[0],
            id: week,
            title:
              week === "next" ? "Next week activity" : "This week activity",
          },
        ],
      },
    });
  });
  const next = page.getByRole("button", { name: "Next week", exact: true });
  await next.hover();
  await page.mouse.down();
  await page.waitForTimeout(900);
  await page.mouse.up();
  await page.mouse.move(0, 0);
  await expect
    .poll(async () =>
      next.evaluate((el) => {
        const transform = getComputedStyle(el).transform;
        return transform === "none" ? 1 : new DOMMatrixReadOnly(transform).a;
      }),
    )
    .toBeGreaterThan(0.999);
  await page.getByRole("button", { name: "This week", exact: true }).click();
  await next.click();
  await expect(next).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".activities")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".journal-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Next week activity", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "This week activity", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "../../.local/premium-motion-desktop.png",
    fullPage: true,
  });
});

test("filter removal and reset preserve keyed cards and finish their layout transitions", async ({
  page,
}) => {
  await page.goto("/explore");
  const initial = await page.evaluate(async () =>
    (
      await fetch("/api/events/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week: "this",
          categories: [],
          geo_mode: "none",
        }),
      })
    ).json(),
  );
  const activities = ["a", "b", "c"].map((id, index) => ({
    ...initial.items[0],
    id,
    title: `Layout activity ${id}`,
    categories: [index === 2 ? "Music" : "Arts"],
  }));
  await page.route("**/api/events/search", (route) => {
    const selected = route.request().postDataJSON().categories;
    const items = selected.length
      ? activities.filter((item) => selected.includes(item.categories[0]))
      : activities;
    return route.fulfill({ json: { ...initial, items, total: items.length } });
  });
  await page.getByRole("button", { name: "Next week", exact: true }).click();
  await expect(page.locator(".journal-card")).toHaveCount(3);
  const retained = await page.locator('[data-activity-id="c"]').elementHandle();
  await page.getByLabel("Music", { exact: true }).check();
  await expect(page.locator(".journal-card")).toHaveCount(1);
  expect(
    await retained!.evaluate(
      (el) => el === document.querySelector('[data-activity-id="c"]'),
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await expect(page.locator(".journal-card")).toHaveCount(3);
  await expect(page.getByLabel("Music", { exact: true })).not.toBeChecked();
  await page.waitForTimeout(750);
  const heights = await page
    .locator(".journal-entry")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().top),
    );
  expect(heights[1]).toBeGreaterThan(heights[0]);
  expect(heights[2]).toBeGreaterThan(heights[1]);
});

test("Maybe and Going columns share spring hover without shifting their drop targets", async ({
  page,
}) => {
  await page.goto("/my-plans");
  const columns = page.locator(".board-column");
  await expect(columns).toHaveCount(2);
  await columns.first().scrollIntoViewIfNeeded();
  for (let i = 0; i < 2; i++) {
    await page.mouse.move(0, 0);
    await page.waitForTimeout(600);
    const column = columns.nth(i);
    const before = (await column.boundingBox())!;
    const neighbor = (await columns.nth(1 - i).boundingBox())!;
    await column.hover({ position: { x: 45, y: 45 } });
    await expect
      .poll(async () => (await column.boundingBox())!.y)
      .toBeLessThan(before.y - 4);
    await expect
      .poll(async () => (await column.boundingBox())!.width)
      .toBeGreaterThan(before.width * 1.01);
    expect(await columns.nth(1 - i).boundingBox()).toEqual(neighbor);
    await page.mouse.move(0, 0);
    await expect
      .poll(async () => Math.abs((await column.boundingBox())!.y - before.y))
      .toBeLessThan(1);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await columns.first().scrollIntoViewIfNeeded();
  const before = (await columns.first().boundingBox())!;
  await columns.first().hover();
  await page.waitForTimeout(400);
  expect(await columns.first().boundingBox()).toEqual(before);
});

test("plan dragging remains accurate while column hover motion is suspended", async ({
  page,
}) => {
  await page.goto("/explore");
  const initial = await page.evaluate(async () =>
    (
      await fetch("/api/events/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week: "this",
          categories: [],
          geo_mode: "none",
        }),
      })
    ).json(),
  );
  let status = "maybe";
  await page.route("**/api/me/plans", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            event_id: "magazine-fixture",
            status,
            position: 0,
            version: 1,
            notice: null,
            event: initial.items[0],
            conflicts: [],
            unknown_end_events: [],
            reminder: null,
            reminders: [],
            has_sent_reminder: false,
          },
        ],
      },
    }),
  );
  await page.route("**/api/me/plans/magazine-fixture", (route) => {
    status = route.request().postDataJSON().status;
    return route.fulfill({ json: {} });
  });
  await page.getByRole("link", { name: "My plans", exact: true }).click();
  const handle = page.getByRole("button", {
    name: "Drag or open An afternoon of art in Midtown",
    exact: true,
  });
  await handle.scrollIntoViewIfNeeded();
  await handle.hover();
  await page.waitForTimeout(650);
  const from = (await handle.boundingBox())!;
  await page.mouse.down();
  await page.mouse.move(
    from.x + from.width / 2 + 18,
    from.y + from.height / 2,
    { steps: 4 },
  );
  const columns = page.locator(".board-column");
  await expect(columns.first()).toHaveAttribute("data-dragging", "true");
  await expect(columns.first()).toHaveCSS("transform", "none");
  const target = (await columns.nth(1).locator(".drop-zone").boundingBox())!;
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    { steps: 20 },
  );
  await page.mouse.up();
  await expect(columns.nth(1).locator(".plan-card")).toHaveCount(1);
  await expect(columns.first().locator(".plan-card")).toHaveCount(0);
  await expect(columns.first()).toHaveAttribute("data-dragging", "false");
  await columns
    .nth(1)
    .getByRole("button", { name: "Maybe", exact: true })
    .click();
  await expect(columns.first().locator(".plan-card")).toHaveCount(1);
});

test("hover reveals an activity outside the current map viewport without changing its filter", async ({
  page,
}) => {
  await page.route("**/api/events/map", (route) =>
    route.fulfill({
      json: {
        type: "FeatureCollection",
        total: 1,
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [-84.36, 33.9] },
            properties: {
              id: "magazine-fixture",
              title: "An afternoon of art in Midtown",
              category: "Arts",
            },
          },
        ],
      },
    }),
  );
  await page.goto("/explore");
  await expect(page.locator(".map-panel")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const card = page.locator(".journal-card").first();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(650);
  await card.hover();
  const preview = page.getByRole("img", {
    name: "Map location for An afternoon of art in Midtown",
    exact: true,
  });
  await expect(preview).toHaveAttribute("data-latitude", "33.9");
  await expect
    .poll(async () => {
      const point = await preview.boundingBox();
      const canvas = await page.locator(".map-canvas").boundingBox();
      return (
        !!point &&
        !!canvas &&
        point.x >= canvas.x &&
        point.y >= canvas.y &&
        point.x + point.width <= canvas.x + canvas.width &&
        point.y + point.height <= canvas.y + canvas.height
      );
    })
    .toBe(true);
  await expect(page.getByLabel("Location filter")).toHaveValue("none");
  await page
    .locator(".map-panel")
    .screenshot({ path: "../../.local/activity-map-hover.png" });
  await page.mouse.move(0, 0);
  await expect(preview).toHaveCount(0);
});
