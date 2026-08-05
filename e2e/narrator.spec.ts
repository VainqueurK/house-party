import { expect, test } from "@playwright/test";

test("natural narrator model loads in the host browser", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await page.getByRole("button", { name: "Create a room" }).click();
  await expect(page.getByTestId("narration-toggle")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByTestId("prepare-narrator").click();
  await expect(page.getByTestId("prepare-narrator")).toHaveText(
    "Natural voice ready",
    { timeout: 170_000 },
  );
});
