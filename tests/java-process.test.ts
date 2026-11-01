import { it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { GameRunner } from "../minecraft/launch";
import { createInstance } from "../instances/manager";
import { Store } from "../settings/store";
import { offlineAccount } from "../accounts/offline";
const exec = promisify(execFile);
it("launches a real Java fixture through XMCL and records output/exit (not Minecraft)", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "averiq-java-"));
  let runner: GameRunner | undefined;
  try {
    const source = path.join(root, "LauncherFixture.java");
    await fs.writeFile(
      source,
      'public class LauncherFixture { public static void main(String[] args) { System.out.println("AVERIQ_REAL_JAVA " + String.join(" ",args)); System.err.println("fixture stderr"); } }',
    );
    await exec("java", [
      "--module",
      "jdk.compiler/com.sun.tools.javac.Main",
      source,
    ]);
    const dir = path.join(root, "versions", "fixture");
    await fs.mkdir(dir, { recursive: true });
    const jar = path.join(dir, "fixture.jar");
    await exec("java", [
      "--module",
      "jdk.jartool/sun.tools.jar.Main",
      "--create",
      "--file",
      jar,
      "-C",
      root,
      "LauncherFixture.class",
    ]);
    const sha1 = createHash("sha1")
      .update(await fs.readFile(jar))
      .digest("hex");
    const index = Buffer.from('{"objects":{}}');
    await fs.mkdir(path.join(root, "assets", "indexes"), { recursive: true });
    await fs.writeFile(
      path.join(root, "assets", "indexes", "fixture.json"),
      index,
    );
    await fs.writeFile(
      path.join(dir, "fixture.json"),
      JSON.stringify({
        id: "fixture",
        type: "release",
        mainClass: "LauncherFixture",
        assets: "fixture",
        assetIndex: {
          id: "fixture",
          sha1: createHash("sha1").update(index).digest("hex"),
          url: "https://example.com/fixture",
          size: index.length,
          totalSize: 0,
        },
        downloads: {
          client: {
            sha1,
            url: "https://example.com/fixture.jar",
            size: (await fs.stat(jar)).size,
          },
        },
        libraries: [],
        javaVersion: { majorVersion: 21, component: "fixture" },
        arguments: {
          game: [
            "--username",
            "${auth_player_name}",
            "--gameDir",
            "${game_directory}",
          ],
          jvm: ["-cp", "${classpath}"],
        },
      }),
    );
    const store = new Store(root);
    store.data.settings.root = root;
    store.data.settings.javaPath = "java";
    store.data.settings.minRam = 256;
    store.data.settings.maxRam = 512;
    const instance = await createInstance(root, "Fixture", "fixture");
    const events: string[] = [];
    runner = new GameRunner((e) => events.push(e.message));
    let ended!: (value: { seconds: number; code: number | null }) => void;
    const exit = new Promise<{ seconds: number; code: number | null }>(
      (r) => (ended = r),
    );
    const process = await runner.start(
      store.data.settings,
      instance,
      offlineAccount("AveriqTest"),
      "0",
      async (seconds, code) => ended({ seconds, code }),
    );
    expect(process.pid).toBeGreaterThan(0);
    expect((await exit).code).toBe(0);
    expect(events.join("\n")).toContain(
      "AVERIQ_REAL_JAVA --username AveriqTest",
    );
    expect(events.join("\n")).toContain("fixture stderr");
    expect(runner.process).toBeUndefined();
  } finally {
    runner?.process?.kill();
    await fs.rm(root, { recursive: true, force: true });
  }
}, 30000);
