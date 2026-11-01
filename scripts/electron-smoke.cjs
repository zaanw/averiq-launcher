// Runs the actual production Electron app against a disposable user-data directory.
const { _electron: electron } = require("playwright");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "averiq-desktop-"));
  let app;
  try {
    app = await electron.launch({
      executablePath: require("electron"),
      args: [
        ...(process.env.AVERIQ_TEST_NO_SANDBOX === "1" ? ["--no-sandbox"] : []),
        path.resolve("."),
        "--user-data-dir=" + profile,
      ],
      env: { ...process.env, AVERIQ_DEV: "0" },
      timeout: 30000,
    });
    const window = await app.firstWindow();
    const errors = [];
    window.on("pageerror", (e) => errors.push(e.message));
    await window.waitForSelector(".hero");
    const isolation = await window.evaluate(() => ({
      api: typeof window.averiq?.call,
      require: typeof window.require,
      process: typeof window.process,
    }));
    assert.equal(isolation.api, "function");
    assert.equal(isolation.require, "undefined");
    assert.equal(isolation.process, "undefined");
    const initial = await window.evaluate(() => window.averiq.call("state"));
    assert.equal(initial.accounts.length, 0);
    await window.getByRole("button", { name: "Accounts", exact: true }).click();
    await window
      .getByRole("textbox", { name: "Minecraft nickname" })
      .fill("AveriqTest");
    await window
      .getByRole("button", { name: "Локальный профиль", exact: true })
      .click();
    await window.waitForFunction(
      () =>
        document.querySelector(".account-row h3")?.textContent === "AveriqTest",
    );
    let data = await window.evaluate(() => window.averiq.call("state"));
    assert.equal(data.accounts[0].name, "AveriqTest");
    await window.evaluate(() =>
      window.averiq.call("createInstance", {
        name: "Smoke survival",
        version: "1.21.1",
      }),
    );
    await window.getByRole("button", { name: "Home", exact: true }).click();
    await window.reload();
    await window.waitForSelector(".hero");
    assert.equal(
      await window.locator('select[aria-label="Active instance"]').inputValue(),
      (await window.evaluate(() => window.averiq.call("state")))
        .selectedInstance,
    );
    await window.getByRole("button", { name: "Console", exact: true }).click();
    await window.getByRole("button", { name: "Settings", exact: true }).click();
    await window.waitForSelector(".settings-grid input[type=number]");
    assert.equal(await window.locator("input[type=number]").count(), 5);
    await window.getByRole("button", { name: "Home", exact: true }).click();
    await window.waitForSelector(".hero");
    await window.screenshot({ path: "artifacts/averiq-home.png" });
    const rejected = await window.evaluate(async () => {
      try {
        await window.averiq.call("createAccount", {
          name: "Player",
          command: "calc.exe",
        });
        return false;
      } catch {
        return true;
      }
    });
    assert.equal(rejected, true);
    data = await window.evaluate(() => window.averiq.call("state"));
    assert.equal(data.instances[0].name, "Smoke survival");
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log(
      "PASS: real Electron preload, renderer isolation, profile creation, persistence/reload, instance selection, navigation and IPC rejection",
    );
  } finally {
    if (app) await app.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
