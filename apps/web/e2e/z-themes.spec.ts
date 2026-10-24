import { test, expect } from "@playwright/test";

test("the only Day theme ignores system dark mode and obsolete stored preferences", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() =>
    localStorage.setItem("atl-out-theme", "night"),
  );
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
  await expect(
    page.getByRole("button", { name: /Switch to .* mode/ }),
  ).toHaveCount(0);
  const before = await page.locator("body").evaluate((el) => ({
    color: getComputedStyle(el).color,
    background: getComputedStyle(el).backgroundColor,
  }));
  await page.emulateMedia({ colorScheme: "light" });
  const after = await page.locator("body").evaluate((el) => ({
    color: getComputedStyle(el).color,
    background: getComputedStyle(el).backgroundColor,
  }));
  expect(after).toEqual(before);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("all authentication routes use the city glass palette with readable fields and feedback", async ({
  page,
}) => {
  for (const path of [
    "/login",
    "/register",
    "/forgot-password",
    "/verify",
    "/reset",
  ]) {
    await page.goto(path);
    await expect(page.locator(".auth-video-poster")).toHaveCount(1);
    await expect(page.locator(".auth-form > div")).toHaveCSS(
      "backdrop-filter",
      /blur\(22px\)/,
    );
    await expect(page.locator(".auth-form h2")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
    await expect(
      page.getByRole("button", { name: /Switch to .* mode/ }),
    ).toHaveCount(0);
  }
  await page.goto("/login");
  await expect(page.locator(".auth-form > div")).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: "../../.local/auth-glass-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("Email address").fill("invalid");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText("Enter a valid email address.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveValue("invalid");
  await page.screenshot({
    path: "../../.local/auth-glass-error.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Password", { exact: true }).focus();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../../.local/auth-glass-mobile.png",
    fullPage: true,
  });
});
