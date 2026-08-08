import { expect, test } from "@playwright/test";

test("a twenty-player town renders and keeps adaptive timing", async ({
  page,
  baseURL,
}) => {
  const code = "LOAD-20";
  await page.addInitScript(({ room }) => {
    const now = Date.now();
    const players = Array.from({ length: 20 }, (_, index) => ({
      id: `large-${index}`,
      name: `Player ${index + 1}`,
      emoji: ["🦊", "🌻", "🐸", "🪩", "🧢", "🌙", "🐙", "🦋"][index % 8],
      color: ["orange", "yellow", "green", "pink", "blue", "purple", "coral", "mint"][index % 8],
      alive: true,
    }));
    const roles = Object.fromEntries(
      players.map((player, index) => [
        player.id,
        index < 5
          ? "mafia"
          : index === 5
            ? "detective"
            : index === 6
              ? "doctor"
              : "villager",
      ]),
    );
    const state = {
      revision: 4,
      phase: "night",
      round: 1,
      endsAt: now + 46_000,
      phaseDuration: 55,
      players,
      screenMode: "shared",
      createdAt: now,
      lastActivityAt: now,
    };
    localStorage.setItem(
      "house-party:session",
      JSON.stringify({
        code: room,
        name: "",
        mode: "display",
        view: "game",
        updatedAt: now,
      }),
    );
    localStorage.setItem(`house-party:display-state:${room}`, JSON.stringify(state));
    localStorage.setItem(`house-party:display-roles:${room}`, JSON.stringify(roles));
  }, { room: code });
  await page.goto(`${baseURL}/?room=${code}&display=1`);
  await expect(page.getByTestId("game-display")).toHaveAttribute("data-phase", "night");
  await expect(page.getByText("20 active · 20 players")).toBeVisible();
  await expect(page.getByTestId("phase-timer")).toContainText(/[4-5][0-9]/);
  await expect(page.getByTestId("palermo-3d-stage")).toBeVisible();
  await expect(page.getByTestId("palermo-3d-stage").locator("canvas")).toBeVisible();
  await page.waitForTimeout(2_500);
  await page.screenshot({
    path: "artifacts/large-room-20.png",
    animations: "allow",
  });
});
