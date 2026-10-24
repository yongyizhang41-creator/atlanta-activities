import { test, expect } from "@playwright/test";
import fs from "node:fs";

test("coverage boundary and nearby distance remain consistent", async ({
  page,
}) => {
  const f = JSON.parse(fs.readFileSync("../../.local/e2e.json", "utf8"));
  await page.goto("/login");
  await page.getByLabel("Email address").fill(f.email);
  await page.getByLabel("Password", { exact: true }).fill(f.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".map-panel")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 30000 },
  );
  await expect(
    page.getByText("Activity coverage", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Location filter").selectOption("radius");
  const number = page.getByLabel("Distance in miles", { exact: true });
  const limit = Number(await number.getAttribute("max"));
  expect(limit).toBeGreaterThan(0);
  expect(limit).toBeLessThan(5);
  await number.fill("50");
  await expect(number).toHaveValue(String(limit));
  await page.context().grantPermissions(["geolocation"]);
  await page
    .context()
    .setGeolocation({ longitude: -84.3963, latitude: 33.7756 });
  await expect(
    page.getByRole("img", { name: "Your current location" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Locate me", exact: true }).click();
  const locationMarker = page.getByRole("img", {
    name: "Your current location",
  });
  await expect(locationMarker).toBeVisible();
  await expect(locationMarker).toHaveAttribute("data-longitude", "-84.3963");
  await expect(locationMarker).toHaveAttribute("data-latitude", "33.7756");
  await page.context().setGeolocation({ longitude: -84.39, latitude: 33.78 });
  await page.getByRole("button", { name: "Locate me", exact: true }).click();
  await expect(locationMarker).toHaveCount(1);
  await expect(locationMarker).toHaveAttribute("data-longitude", "-84.39");
  await expect(
    page.getByRole("button", { name: "Locate me", exact: true }),
  ).toBeEnabled();
  await expect(page.locator("#coverage-distance-note")).toContainText(
    "Results stay inside",
  );
  const canvas = page.locator(".map-canvas");
  await canvas.click({ position: { x: 25, y: 25 } });
  await expect(locationMarker).toHaveAttribute("data-longitude", "-84.39");
  await expect(locationMarker).toHaveAttribute("data-latitude", "33.78");
  await expect(locationMarker).toHaveCount(1);
  await page
    .locator(".map-panel")
    .screenshot({ path: "../../.local/location-marker-map.png" });
  await page.screenshot({
    path: "../../.local/coverage-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByText("Activity coverage", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "../../.local/coverage-mobile.png",
    fullPage: true,
  });
});
