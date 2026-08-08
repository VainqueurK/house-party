import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

type Device = {
  name: string;
  context: BrowserContext;
  page: Page;
  role?: string;
};

const output = path.resolve("artifacts/showcase/raw");

async function caption(page: Page, title: string, detail: string) {
  await page.evaluate(
    ({ title, detail }) => {
      let card = document.querySelector<HTMLDivElement>("#showcase-caption");
      if (!card) {
        card = document.createElement("div");
        card.id = "showcase-caption";
        Object.assign(card.style, {
          position: "fixed",
          left: "18px",
          bottom: "18px",
          zIndex: "999999",
          width: "min(420px, calc(100vw - 36px))",
          padding: "13px 16px",
          border: "1px solid rgba(255,255,255,.24)",
          borderRadius: "12px",
          color: "#fff8e9",
          background: "rgba(7,8,19,.88)",
          boxShadow: "0 12px 40px rgba(0,0,0,.4)",
          backdropFilter: "blur(12px)",
          fontFamily: "Arial, sans-serif",
          pointerEvents: "none",
        });
        document.body.append(card);
      }
      card.innerHTML = `<strong style="display:block;color:#ffc85c;font-size:13px;letter-spacing:1.2px;text-transform:uppercase">${title}</strong><span style="display:block;margin-top:4px;font-size:12px;line-height:1.35;color:rgba(255,248,233,.78)">${detail}</span>`;
    },
    { title, detail },
  );
}

async function join(context: BrowserContext, origin: string, code: string, name: string) {
  const page = await context.newPage();
  await page.goto(`${origin}/?room=${encodeURIComponent(code)}`);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Join the room" }).click();
  await expect(page.getByTestId("connection-status")).toContainText("ROOM OPEN");
  return page;
}

async function throttleOffCameraRendering(context: BrowserContext) {
  await context.addInitScript(() => {
    window.requestAnimationFrame = ((callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 160)) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((handle: number) =>
      window.clearTimeout(handle)) as typeof window.cancelAnimationFrame;
  });
}

async function advance(host: Page) {
  await host
    .getByTestId("host-controls")
    .getByRole("button", { name: /Skip timer|Continue/ })
    .click();
}

async function choose(page: Page, name: string) {
  const target = page.locator('[data-testid^="target-"]').filter({ hasText: name }).first();
  await target.click();
  await expect(target).toHaveClass(/selected/);
}

test("record a labeled Palermo acceptance reel", async ({ browser, baseURL }) => {
  test.setTimeout(420_000);
  await mkdir(output, { recursive: true });
  const phoneVideo = { dir: output, size: { width: 390, height: 844 } };
  const hostContext = await browser.newContext({
    viewport: { width: 960, height: 540 },
  });
  await throttleOffCameraRendering(hostContext);
  const host = await hostContext.newPage();
  const devices: Device[] = [{ name: "Laptop host", context: hostContext, page: host }];

  try {
    await host.goto(baseURL!);
    await caption(host, "EVERYONE PLAYS", "The laptop is both host and a private player. No TV required.");
    await host.getByRole("button", { name: "Create & play" }).click();
    await host.getByLabel("Your name").fill("Laptop host");
    await host.getByRole("button", { name: "Create player room" }).click();
    await host.getByTestId("narration-toggle").click();
    const code = (await host.getByTestId("room-code").textContent())!.trim();

    for (const [index, name] of ["Nia", "Theo", "Rae", "Omar"].entries()) {
      const context = await browser.newContext({
        viewport: index === 0 ? { width: 390, height: 844 } : { width: 300, height: 600 },
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true,
        ...(index === 0 ? { recordVideo: phoneVideo } : {}),
      });
      if (index !== 0) await throttleOffCameraRendering(context);
      const page = await join(context, baseURL!, code, name);
      devices.push({ name, context, page });
    }
    await expect(host.getByTestId("player-count")).toHaveText("5");
    await caption(host, "ROOM READY", "Five synchronized players; the host alone controls the lobby.");
    await host.waitForTimeout(1800);
    await host.getByTestId("start-game").click();

    for (const device of devices) {
      await expect(device.page.getByTestId("private-role")).not.toHaveText("Your role");
      device.role = (await device.page.getByTestId("private-role").textContent())!.trim();
      await caption(device.page, `${device.name} · ${device.role}`, "Private role reveal. Other devices cannot see this HUD.");
    }
    await devices[1].page.getByTestId("role-reveal-toggle").click();
    await expect(devices[1].page.getByTestId("role-reveal-toggle")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await host.waitForTimeout(1600);

    const mafia = devices.find((device) => device.role === "Mafia")!;
    const doctor = devices.find((device) => device.role === "Doctor")!;
    const detective = devices.find((device) => device.role === "Detective")!;
    const villagers = devices.filter((device) => device.role === "Villager" && device !== devices[0]);
    const firstTarget = villagers[0] ?? devices.find((device) => device !== mafia && device !== devices[0])!;

    await advance(host);
    for (const device of devices)
      await caption(device.page, "NIGHT ONE", "Residents follow their routes home. Private actions remain on each controller.");
    await host.waitForTimeout(4200);

    await caption(mafia.page, "SPOTTY WI-FI", "This Mafia choice is saved locally while the controller is offline.");
    await mafia.context.setOffline(true);
    await choose(mafia.page, firstTarget.name);
    await mafia.page.waitForTimeout(800);
    await mafia.context.setOffline(false);
    await mafia.page.evaluate(() => window.dispatchEvent(new Event("online")));
    await caption(mafia.page, "CHOICE RECOVERED", "Connection restored; the saved action replayed automatically.");
    await choose(doctor.page, firstTarget.name);
    await choose(detective.page, mafia.name);
    await expect(host.getByTestId("host-controls")).toContainText("3/3 choices in");
    await advance(host);
    for (const device of devices)
      await caption(device.page, "DOCTOR PROTECTION", `${firstTarget.name} was attacked, but the protection animation resolves on every screen.`);
    await host.waitForTimeout(7000);

    await advance(host);
    for (const device of devices)
      await caption(device.page, "DAWN · EVERYONE SURVIVED", "The town returns to the square for face-to-face discussion.");
    await host.waitForTimeout(3200);
    await advance(host);
    for (const device of devices)
      await caption(device.page, "VOTE ONE", "Private tap targets, immediate feedback, and a synchronized result.");
    const voteTargets = devices.map((device) => device.name);
    await choose(devices[0].page, voteTargets[0]);
    await choose(devices[1].page, voteTargets[0]);
    await choose(devices[2].page, voteTargets[1]);
    await choose(devices[3].page, voteTargets[1]);
    await choose(devices[4].page, voteTargets[2]);
    await expect(host.getByTestId("host-controls")).toContainText("5/5 choices in");
    await advance(host);
    for (const device of devices)
      await caption(device.page, "TIED VOTE", "The town is divided. Nobody is ejected.");
    await host.waitForTimeout(6200);
  } finally {
    const mobileRecording = devices[1]?.page
      .video()
      ?.saveAs(path.join(output, "mobile.webm"));
    await Promise.allSettled([
      ...devices.slice(2).map((device) => device.context.close()),
      devices[1]?.context.close(),
      hostContext.close(),
    ]);
    await mobileRecording;
  }
});
