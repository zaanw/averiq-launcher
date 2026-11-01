const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { versions } = require("../dist-electron/minecraft/manifest");
const { MinecraftInstaller } = require("../dist-electron/minecraft/installer");
const { discoverJava } = require("../dist-electron/java/manager");
(async () => {
  const root =
    process.env.AVERIQ_INTEGRATION_ROOT ||
    (await fs.mkdtemp(path.join(os.tmpdir(), "averiq-live-")));
  const manifest = await versions(root);
  assert(!manifest.cached, "A live manifest is required");
  assert(manifest.versions.length > 100);
  console.log("LIVE manifest:", manifest.versions.length, "versions");
  const javas = await discoverJava();
  console.log(
    "Detected Java:",
    javas.map((j) => `${j.major}/${j.arch}`).join(", "),
  );
  if (process.env.AVERIQ_INTEGRATION_INSTALL === "1") {
    const id = process.env.AVERIQ_INTEGRATION_VERSION || "1.21.1";
    const installer = new MinecraftInstaller(root, (e) => {
      if (e.type === "status") console.log(e.message);
    });
    await installer.install(id);
    const report = await installer.check(id);
    assert.equal(report.issues.length, 0, JSON.stringify(report.issues));
    console.log("PASS: real installation and strict checksums:", id);
  }
  console.log(
    "No game process launched: a licensed account/compatible local installation and graphical session are separate requirements.",
  );
})().catch((e) => {
  console.error("LIVE integration failed:", e.message);
  process.exitCode = 1;
});
