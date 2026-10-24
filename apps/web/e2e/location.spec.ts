import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data =
      path === "/api/auth/session"
        ? {
            user: {
              id: "location-test",
              email: "test@example.com",
              verified: true,
            },
          }
        : path === "/api/config"
          ? {
              categories: ["Music"],
              map_style: "/test-map-style.json",
              coverage: {
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
                          [-84.36, 33.75],
                          [-84.36, 33.8],
                          [-84.42, 33.8],
                          [-84.42, 33.75],
                        ],
                      ],
                    },
                  },
                ],
              },
              sources: [],
              services: {},
            }
          : path === "/api/events/map"
            ? { type: "FeatureCollection", features: [], total: 0 }
            : { items: [], total: 0, next_cursor: null };
    await route.fulfill({ json: data });
  });
  await page.route("**/test-map-style.json", (route) =>
    route.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#f3f6f5" },
          },
        ],
      },
    }),
  );
});

test("Locate me preserves filters and refreshes the position on desktop and mobile", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ longitude: -84.3963, latitude: 33.7756 });
  await page.goto("/explore");
  const locate = page.getByRole("button", { name: "Locate me", exact: true });
  await expect(locate).toBeVisible();
  await locate.click();
  const marker = page.getByRole("img", { name: "Your current location" });
  await expect(marker).toHaveAttribute("data-longitude", "-84.3963");
  await expect(marker).toBeVisible();
  await expect(page.getByLabel("Location filter")).toHaveValue("none");
  await page.getByLabel("Location filter").selectOption("polygon");
  await context.setGeolocation({ longitude: -84.39, latitude: 33.78 });
  await locate.click();
  await expect(marker).toHaveCount(1);
  await expect(marker).toHaveAttribute("data-longitude", "-84.39");
  await expect(marker).toBeVisible();
  await expect(page.getByLabel("Location filter")).toHaveValue("polygon");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(locate).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/location-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByLabel("Location filter").selectOption("radius");
  await expect(
    page.getByRole("button", { name: "Use my location", exact: true }),
  ).toHaveCount(0);
  await locate.click();
  await expect(marker).toHaveAttribute("data-latitude", "33.78");
});

test("location denial displays feedback and allows retry", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (
          _success: unknown,
          failure: PositionErrorCallback,
        ) => {
          setTimeout(
            () =>
              failure({
                code: 1,
                message: "Denied",
              } as GeolocationPositionError),
            100,
          );
        },
      },
    });
  });
  await page.goto("/explore");
  const locate = page.getByRole("button", { name: "Locate me", exact: true });
  await locate.click();
  await expect(
    page.getByText(
      "Location permission is blocked. Allow location access in your browser settings and try again.",
    ),
  ).toBeVisible();
  await expect(locate).toBeEnabled();
  await expect(page.getByLabel("Location filter")).toHaveValue("none");
});

test("Nearby updates map results during slider input without waiting for the list", async ({
  page,
}) => {
  await page.goto("/explore");
  await expect(page.locator(".map-panel")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.getByLabel("Location filter").selectOption("radius");
  await expect(
    page.getByRole("button", { name: "Use my location", exact: true }),
  ).toHaveCount(0);
  await page.route("**/api/events/search", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await route.fulfill({ json: { items: [], total: 0, next_cursor: null } });
  });
  await page.route("**/api/events/map", async (route) => {
    const filters = route.request().postDataJSON();
    await route.fulfill({
      json: {
        type: "FeatureCollection",
        features: [],
        total: Math.round((filters.radius_m / 1609.344) * 10),
      },
    });
  });
  for (const miles of [0.5, 1, 0.2]) {
    const request = page.waitForRequest(
      (req) =>
        req.url().endsWith("/api/events/map") &&
        Math.abs(req.postDataJSON().radius_m - miles * 1609.344) < 0.01,
    );
    await page.locator("#distance").evaluate((node, value) => {
      const input = node as HTMLInputElement;
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, String(value));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, miles);
    const body = (await request).postDataJSON();
    expect(body.center).toEqual([-84.391, 33.774]);
    await expect(page.locator(".map-caption")).toContainText(
      `${miles * 10} activities in your selection`,
      { timeout: 1500 },
    );
  }
});
