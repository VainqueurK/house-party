import { expect, test } from "@playwright/test";

test("natural narrator model loads in the host browser", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await page.getByRole("button", { name: "Use a shared screen" }).click();
  await expect(page.getByTestId("narration-toggle")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  // Creating a narrated room preloads the voice while players gather. The
  // button therefore transitions through loading without an explicit click.
  await expect(page.getByTestId("prepare-narrator")).toHaveText(
    "Natural voice ready",
    { timeout: 170_000 },
  );
});
