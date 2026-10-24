import { test, expect } from "@playwright/test";

test("full-screen background plays one sequential city film and preserves login", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  const videos = page.locator(".auth-video-background video");
  await expect(videos).toHaveCount(1);
  await expect
    .poll(
      () =>
        videos.evaluateAll((elements) =>
          elements.every((element) => {
            const video = element as HTMLVideoElement;
            return (
              video.duration > 20 &&
              video.muted &&
              video.loop &&
              video.playsInline &&
              !video.controls &&
              video.currentTime > 0 &&
              !video.paused
            );
          }),
        ),
      { timeout: 20000 },
    )
    .toBe(true);
  await expect(page.locator(".auth-form > div")).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: "../../.local/auth-film-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Pause city scenes" }).click();
  await expect
    .poll(() =>
      videos.evaluateAll((elements) =>
        elements.every((element) => (element as HTMLVideoElement).paused),
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Play city scenes" }).click();
  await expect
    .poll(() =>
      videos.evaluateAll((elements) =>
        elements.every((element) => !(element as HTMLVideoElement).paused),
      ),
    )
    .toBe(true);
  await page.getByLabel("Email address").fill("invalid");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Continue with Google/ }),
  ).toHaveAttribute("href", "/api/auth/google/start");
  await page.screenshot({
    path: "../../.local/auth-film-error.png",
    fullPage: true,
  });
});

for (const scenario of ["reduced", "failure"] as const) {
  test(`${scenario} keeps film-frame fallback and usable form`, async ({
    page,
  }) => {
    let requests = 0;
    await page.route("**/videos/*.mp4", (route) => {
      requests++;
      return route.abort();
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    if (scenario === "reduced")
      await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/login");
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".auth-video-background")).toHaveAttribute(
      "data-mode",
      "static",
    );
    await expect(page.locator(".auth-video-background video")).toHaveCount(0);
    await expect(page.locator(".auth-form > div")).toHaveCSS("opacity", "1");
    if (scenario !== "failure") expect(requests).toBe(0);
    else expect(requests).toBeGreaterThan(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../../.local/auth-film-${scenario}.png`,
      fullPage: true,
    });
  });
}

test("live reduced motion preference unloads playing videos", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await expect(page.locator(".auth-video-background video")).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".auth-video-background video")).toHaveCount(0);
  await expect(page.locator(".auth-video-background")).toHaveAttribute(
    "data-mode",
    "static",
  );
  await expect(page.getByLabel("Email address")).toBeVisible();
});

test("mobile also plays one full-screen film without the original photograph", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  const video = page.locator(".auth-video-background video");
  await expect(video).toHaveCount(1);
  await expect
    .poll(() => video.evaluate((el) => (el as HTMLVideoElement).currentTime))
    .toBeGreaterThan(0);
  await expect(page.locator(".auth-video-poster")).toHaveCSS(
    "background-image",
    /atlanta-night-film.jpg/,
  );
  await expect(page.locator(".auth-form > div")).toHaveCSS("opacity", "1");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../../.local/auth-film-mobile.png",
    fullPage: true,
  });
});
