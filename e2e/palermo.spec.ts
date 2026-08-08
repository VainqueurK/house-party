import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

type PlayerDevice = { name: string; context: BrowserContext; page: Page };

async function joinPlayer(
  browser: Browser,
  baseURL: string,
  code: string,
  name: string,
): Promise<PlayerDevice> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(`${baseURL}/?room=${encodeURIComponent(code)}`);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Join the room" }).click();
  await expect(page.getByTestId("lobby")).toBeVisible();
  await expect(page.getByTestId("connection-status")).toContainText(
    "ROOM OPEN",
  );
  return { name, context, page };
}

test("TV display and five phones complete a recoverable Palermo game", async ({
  browser,
  baseURL,
}) => {
  const origin = baseURL!;
  const displayContext = await browser.newContext();
  const display = await displayContext.newPage();
  const devices: PlayerDevice[] = [];

  try {
    await display.goto(origin);
    await display.getByRole("button", { name: "Use a shared screen" }).click();
    await expect(display.getByTestId("lobby")).toBeVisible();
    await expect(display.getByTestId("connection-status")).toContainText(
      "ROOM OPEN",
    );
    const code = (await display.getByTestId("room-code").textContent())!.trim();
    expect(code).toMatch(/^[A-Z]{4}-\d{2}$/);

    for (const name of ["Alice", "Ben", "Cara", "Drew", "Eve"]) {
      devices.push(await joinPlayer(browser, origin, code, name));
    }
    await expect(display.getByTestId("player-count")).toHaveText("5");
    await expect(display.getByTestId("narration-toggle")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(display.getByTestId("graphics-quality")).toHaveText(
      "Cinematic",
    );

    // Player phones have no lobby authority.
    await expect(devices[0].page.getByTestId("start-game")).toHaveCount(0);
    await expect(
      devices[0].page.getByText("Waiting for the display to start"),
    ).toBeVisible();

    // Lobby chat reaches every device and the display.
    await devices[0].page
      .getByLabel("Lobby message")
      .fill("Ready when you are!");
    await devices[0].page.getByRole("button", { name: "Send" }).click();
    await expect(display.getByText("Ready when you are!")).toBeVisible();
    await expect(
      devices[3].page.getByText("Ready when you are!"),
    ).toBeVisible();

    // Presence leaves cleanly and the same device can recover its lobby session.
    await devices[4].page.goto("about:blank");
    await expect(display.getByTestId("player-count")).toHaveText("4");
    await devices[4].page.goto(`${origin}/?room=${encodeURIComponent(code)}`);
    await expect(devices[4].page.getByTestId("lobby")).toBeVisible();
    await expect(display.getByTestId("player-count")).toHaveText("5");

    await display.getByTestId("start-game").click();
    await expect(display.getByTestId("game-display")).toHaveAttribute(
      "data-phase",
      "role-reveal",
    );
    await expect(display.getByTestId("palermo-3d-stage")).toHaveAttribute(
      "data-quality",
      "cinematic",
    );
    for (const device of devices)
      await expect(device.page.getByTestId("player-controller")).toBeVisible();

    const roles = new Map<string, string>();
    for (const device of devices) {
      await expect(device.page.getByTestId("private-role")).not.toHaveText(
        "Your role",
      );
      const role = (await device.page
        .getByTestId("private-role")
        .textContent())!.trim();
      roles.set(device.name, role);
    }
    expect([...roles.values()].filter((role) => role === "Mafia")).toHaveLength(
      1,
    );
    expect([...roles.values()]).toContain("Detective");
    expect([...roles.values()]).toContain("Doctor");

    // Player reload restores identity, private role, and active phase.
    const beforeReloadRole = roles.get("Cara")!;
    await devices[2].page.reload();
    await expect(
      devices[2].page.getByTestId("player-controller"),
    ).toBeVisible();
    await expect(devices[2].page.getByTestId("private-role")).toHaveText(
      beforeReloadRole,
    );

    // Display reload restores authority, roles, timer, and game state.
    await display.reload();
    await expect(display.getByTestId("game-display")).toHaveAttribute(
      "data-phase",
      "role-reveal",
    );
    await display.getByRole("button", { name: /Skip timer|Continue/ }).click();
    await expect(display.getByTestId("game-display")).toHaveAttribute(
      "data-phase",
      "night",
    );

    // Every active night role submits an action from its private controller.
    for (const device of devices) {
      const role = roles.get(device.name)!;
      if (["Mafia", "Detective", "Doctor"].includes(role)) {
        const target = device.page.locator('[data-testid^="target-"]').first();
        await target.click();
        await expect(target).toHaveClass(/selected/);
      }
    }
    await expect(display.getByTestId("action-count")).toHaveText(
      "3 / 3 choices received",
    );

    // The TV can reload mid-phase and asks phones to replay their acknowledged choices.
    await display.reload();
    await expect(display.getByTestId("game-display")).toHaveAttribute(
      "data-phase",
      "night",
    );
    await expect(display.getByTestId("action-count")).toHaveText(
      "3 / 3 choices received",
    );
    await display.getByRole("button", { name: /Skip timer|Continue/ }).click();
    await expect(display.getByTestId("game-display")).toHaveAttribute(
      "data-phase",
      "night-result",
    );
    await expect(display.getByTestId("palermo-3d-stage")).toHaveAttribute(
      "data-cinematic",
      "night",
    );

    // The exact resolved cinematic also survives a display reload without resolving twice.
    await display.reload();
    await expect(display.getByTestId("game-display")).toHaveAttribute(
      "data-phase",
      "night-result",
    );
    await expect(display.getByTestId("palermo-3d-stage")).toHaveAttribute(
      "data-cinematic",
      "night",
    );
    await display
      .getByRole("button", { name: /Skip cinematic|Continue/ })
      .click();
    await expect(display.getByTestId("game-display")).toHaveAttribute(
      "data-phase",
      "discussion",
    );
    const detective = devices.find(
      (device) => roles.get(device.name) === "Detective",
    )!;
    await expect(
      detective.page.getByText(/Only you can see this investigation/),
    ).toBeVisible();

    await display.getByRole("button", { name: /Skip timer|Continue/ }).click();
    await expect(display.getByTestId("game-display")).toHaveAttribute(
      "data-phase",
      "voting",
    );
    for (const device of devices)
      await expect(device.page.getByTestId("player-controller")).toHaveAttribute(
        "data-phase",
        "voting",
      );

    const mafiaName = [...roles.entries()].find(
      ([, role]) => role === "Mafia",
    )![0];
    let livingVoters = 0;
    for (const device of devices) {
      const mafiaButton = device.page
        .locator('[data-testid^="target-"]')
        .filter({ hasText: mafiaName });
      if (await mafiaButton.count()) {
        livingVoters += 1;
        await mafiaButton.first().click();
        await expect(mafiaButton.first()).toHaveClass(/selected/);
      }
    }
    await expect(display.getByTestId("action-count")).toHaveText(
      `${livingVoters} / ${livingVoters} choices received`,
    );
    await display.getByRole("button", { name: /Skip timer|Continue/ }).click();
    await expect(display.getByTestId("game-display")).toHaveAttribute(
      "data-phase",
      "vote-result",
    );
    await expect(display.getByTestId("palermo-3d-stage")).toHaveAttribute(
      "data-cinematic",
      "vote",
    );
    await display
      .getByRole("button", { name: /Skip cinematic|Continue/ })
      .click();
    await expect(display.getByTestId("game-display")).toHaveAttribute(
      "data-phase",
      "won",
    );
    await expect(
      display.getByRole("heading", { name: "The town wins." }),
    ).toBeVisible();

    // Completed state also survives refresh on a phone.
    await devices[0].page.reload();
    await expect(
      devices[0].page.getByRole("heading", { name: "Town wins." }),
    ).toBeVisible();
  } finally {
    for (const device of devices) await device.context.close();
    await displayContext.close();
  }
});

test("everyone plays mode lets the laptop host receive a role and show cinematics", async ({
  browser,
  baseURL,
}) => {
  const origin = baseURL!;
  const hostContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const host = await hostContext.newPage();
  const phones: PlayerDevice[] = [];
  try {
    await host.goto(origin);
    await host.getByRole("button", { name: "Create & play" }).click();
    await host.getByLabel("Your name").fill("Laptop host");
    await host.getByRole("button", { name: "Create player room" }).click();
    await expect(host.getByTestId("lobby")).toBeVisible();
    await expect(host.getByTestId("player-count")).toHaveText("1");
    const code = (await host.getByTestId("room-code").textContent())!.trim();

    // Keep the focused test fast; narration is covered independently.
    await host.getByTestId("narration-toggle").click();
    for (const name of ["Nia", "Theo", "Rae"])
      phones.push(await joinPlayer(browser, origin, code, name));
    await expect(host.getByTestId("player-count")).toHaveText("4");
    await host.getByTestId("start-game").click();

    const participants = [
      { name: "Laptop host", page: host },
      ...phones.map(({ name, page }) => ({ name, page })),
    ];
    await Promise.all(participants.map(async (participant) => {
      await expect(participant.page.getByTestId("player-controller")).toHaveAttribute(
        "data-phase",
        "role-reveal",
      );
      await expect(participant.page.getByTestId("palermo-3d-stage")).toBeVisible();
      await expect(participant.page.getByTestId("private-role")).not.toHaveText(
        "Your role",
      );
    }));
    await expect(host.getByTestId("host-controls")).toBeVisible();
    const hostRole = await host.getByTestId("private-role").textContent();

    // Host authority and its private role survive a laptop reload.
    await host.reload();
    await expect(host.getByTestId("host-controls")).toBeVisible();
    await expect(host.getByTestId("private-role")).toHaveText(hostRole!.trim());
    await host
      .getByTestId("host-controls")
      .getByRole("button", { name: /Skip timer|Continue/ })
      .click();
    await expect(host.getByTestId("player-controller")).toHaveAttribute(
      "data-phase",
      "night",
    );
    await Promise.all(
      participants.map((participant) =>
        expect(participant.page.getByTestId("player-controller")).toHaveAttribute(
          "data-phase",
          "night",
        ),
      ),
    );

    let offlinePhone: PlayerDevice | undefined;
    for (const phone of phones) {
      if ((await phone.page.locator('[data-testid^="target-"]').count()) > 0) {
        offlinePhone = phone;
        break;
      }
    }
    expect(offlinePhone).toBeTruthy();
    if (!offlinePhone) throw new Error("Expected a phone with a night role");
    await offlinePhone.context.setOffline(true);
    const offlineTarget = offlinePhone.page.locator('[data-testid^="target-"]').first();
    await offlineTarget.click();
    await expect(offlineTarget).toHaveClass(/selected/);

    for (const participant of participants) {
      if (participant.page === offlinePhone.page) continue;
      const target = participant.page.locator('[data-testid^="target-"]').first();
      if (await target.count()) await target.click();
    }
    await offlinePhone.context.setOffline(false);
    await offlinePhone.page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(host.getByTestId("host-controls")).toContainText("2/2 choices in");
    await host
      .getByTestId("host-controls")
      .getByRole("button", { name: /Skip timer|Continue/ })
      .click();

    await Promise.all(participants.map(async (participant) => {
      await expect(participant.page.getByTestId("player-controller")).toHaveAttribute(
        "data-phase",
        "night-result",
      );
      await expect(participant.page.getByTestId("palermo-3d-stage")).toHaveAttribute(
        "data-cinematic",
        "night",
      );
    }));
  } finally {
    for (const phone of phones) await phone.context.close();
    await hostContext.close();
  }
});

test("closing a display room cleanly releases joined phones", async ({
  browser,
  baseURL,
}) => {
  const displayContext = await browser.newContext();
  const display = await displayContext.newPage();
  const origin = baseURL!;
  let phone: PlayerDevice | undefined;
  try {
    await display.goto(origin);
    await display.getByRole("button", { name: "Use a shared screen" }).click();
    const code = (await display.getByTestId("room-code").textContent())!.trim();
    phone = await joinPlayer(browser, origin, code, "Cleanup tester");
    await expect(display.getByTestId("player-count")).toHaveText("1");

    await display
      .getByRole("button", { name: "Leave room" })
      .dispatchEvent("click");
    await expect(
      display.getByRole("button", { name: "Create & play" }),
    ).toBeVisible();
    await expect(
      phone.page.getByRole("button", { name: "Create & play" }),
    ).toBeVisible();
    await expect(phone.page).toHaveURL(origin + "/");
  } finally {
    await phone?.context.close();
    await displayContext.close();
  }
});
