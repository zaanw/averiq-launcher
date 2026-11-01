import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { offlineAccount, offlineUUID } from "../accounts/offline";
import { Store } from "../settings/store";
import { safeJoin, fileName, redact } from "../core/security";
import { verify } from "../downloads/http";
import { parseJava, selectJava, inspectJava } from "../java/manager";
import {
  createInstance,
  duplicateInstance,
  instancePath,
} from "../instances/manager";
import { launchOptions } from "../minecraft/launch";
import { generateArguments, Version } from "@xmcl/core";
import { validate } from "../shared/validation";
let temp: string;
beforeEach(async () => {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), "averiq-test-"));
});
afterEach(async () => {
  await fs.rm(temp, { recursive: true, force: true });
});
describe("local profiles and persistence", () => {
  it("generates Java-compatible stable offline UUIDs", () => {
    expect(offlineUUID("Notch")).toBe("b50ad385-829d-3141-a216-7e7d7539ba7f");
    expect(offlineAccount("Player_1").uuid).toBe(
      offlineAccount("Player_1").uuid,
    );
    expect(offlineUUID("Player")).not.toBe(offlineUUID("player"));
  });
  it("rejects invalid names", () => {
    for (const name of ["", "ab", "../player", "a b", "x".repeat(17)])
      expect(() => offlineAccount(name)).toThrow();
  });
  it("atomically saves and reloads profiles/settings", async () => {
    const store = new Store(temp);
    await store.load();
    const account = offlineAccount("Player_1");
    store.data.accounts.push(account);
    store.data.selectedAccount = account.id;
    await Promise.all([store.save(), store.save()]);
    const fresh = new Store(temp);
    await fresh.load();
    expect(fresh.data.accounts).toEqual([account]);
    expect(fresh.data.selectedAccount).toBe(account.id);
    // Windows does not expose POSIX chmod bits through fs.stat.
    if (process.platform !== "win32") {
      expect((await fs.stat(path.join(temp, "state.json"))).mode & 0o777).toBe(
        0o600,
      );
    }
  });
  it("does not silently overwrite corrupt settings", async () => {
    await fs.writeFile(path.join(temp, "state.json"), "{oops");
    await expect(new Store(temp).load()).rejects.toThrow(
      "Cannot read settings",
    );
  });
});
describe("files and boundaries", () => {
  it("rejects path traversal and sibling prefixes", () => {
    expect(() => safeJoin(temp, "..", "escape")).toThrow();
    expect(() => safeJoin(temp, temp + "-other", "file")).toThrow();
    expect(safeJoin(temp, "assets", "a")).toBe(path.join(temp, "assets", "a"));
    for (const name of [
      "../a",
      "a/b",
      "a\\b",
      "..",
      "CON.jar",
      ".. ",
      "trailing.",
      "evil:stream",
      "a?b",
    ])
      expect(() => fileName(name)).toThrow();
  });
  it("detects missing, corrupt and valid hashes", async () => {
    const f = path.join(temp, "artifact");
    const hash = createHash("sha1").update("real bytes").digest("hex");
    expect(await verify(f, hash)).toBe(false);
    await fs.writeFile(f, "corrupted");
    expect(await verify(f, hash)).toBe(false);
    await fs.writeFile(f, "real bytes");
    expect(await verify(f, hash)).toBe(true);
  });
  it("redacts credentials from process output", () => {
    expect(redact("Bearer abc.def --accessToken secret")).not.toContain(
      "secret",
    );
    expect(redact("access_token: token")).not.toContain(": token");
  });
});
describe("Java selection", () => {
  it("parses Java 8 and 21 and selects exact major/architecture", () => {
    const a = parseJava("java.version = 1.8.0_402\nos.arch = amd64", "java8");
    const b = parseJava("java.version = 21.0.2\nos.arch = aarch64", "java21");
    expect(a.major).toBe(8);
    expect(selectJava([a, b], 21).path).toBe("java21");
    expect(() => selectJava([a], 17)).toThrow("Java 17");
    expect(() => parseJava("not java", "bad")).toThrow();
  });
  it("reports missing executable as an error", async () => {
    await expect(
      inspectJava(path.join(temp, "missing-java")),
    ).rejects.toThrow();
  });
});
describe("isolated instances and launch arguments", () => {
  it("creates independent directories and duplicates worlds", async () => {
    const a = await createInstance(temp, "Survival", "1.21.1");
    await fs.writeFile(
      path.join(instancePath(temp, a.id), "saves", "world.dat"),
      "world",
    );
    const b = await duplicateInstance(temp, a);
    expect(b.id).not.toBe(a.id);
    expect(
      await fs.readFile(
        path.join(instancePath(temp, b.id), "saves", "world.dat"),
        "utf8",
      ),
    ).toBe("world");
    await fs.writeFile(
      path.join(instancePath(temp, b.id), "saves", "world.dat"),
      "copy",
    );
    expect(
      await fs.readFile(
        path.join(instancePath(temp, a.id), "saves", "world.dat"),
        "utf8",
      ),
    ).toBe("world");
  });
  it("generates actual XMCL classpath and arguments without invoking a shell", async () => {
    const store = new Store(temp);
    const account = offlineAccount("Player_1");
    const i = await createInstance(temp, "Test", "fixture");
    store.data.settings.root = temp;
    await fs.mkdir(path.join(temp, "versions", "fixture"), { recursive: true });
    await fs.writeFile(
      path.join(temp, "versions", "fixture", "fixture.json"),
      JSON.stringify({
        id: "fixture",
        type: "release",
        mainClass: "net.minecraft.client.main.Main",
        assets: "fixture",
        assetIndex: {
          id: "fixture",
          sha1: "0".repeat(40),
          url: "https://example.com/index",
          size: 1,
          totalSize: 1,
        },
        downloads: {
          client: {
            sha1: "0".repeat(40),
            url: "https://example.com/client",
            size: 1,
          },
        },
        libraries: [],
        javaVersion: { majorVersion: 21, component: "java-runtime-delta" },
        arguments: {
          game: [
            "--username",
            "${auth_player_name}",
            "--uuid",
            "${auth_uuid}",
            "--accessToken",
            "${auth_access_token}",
            "--gameDir",
            "${game_directory}",
          ],
          jvm: ["-cp", "${classpath}"],
        },
      }),
    );
    const options = launchOptions(store.data.settings, i, account, "java", "0");
    const args = await generateArguments(options);
    expect(args).toContain("Player_1");
    expect(args).toContain("-Xmx4096M");
    expect(args).toContain("net.minecraft.client.main.Main");
    expect(args).toContain(instancePath(temp, i.id));
    expect(options.extraExecOption?.shell).toBe(false);
    expect(options.ignoreInvalidMinecraftCertificates).toBe(false);
  });
});
describe("IPC validation", () => {
  it("rejects unknown methods and extra fields", () => {
    expect(() => validate("exec", { command: "evil" })).toThrow();
    expect(() =>
      validate("createAccount", { name: "Player", command: "evil" }),
    ).toThrow();
    expect(() =>
      validate("deleteVersion", { version: "../../world" }),
    ).toThrow();
    expect(() => validate("selectInstance", { id: "oops" })).toThrow();
  });
  it("rejects RAM inversion, injection JVM arguments and accepts legitimate tuning", () => {
    const s = new Store(temp).data.settings;
    expect(() =>
      validate("settings", { ...s, minRam: 8000, maxRam: 1024 }),
    ).toThrow();
    expect(() =>
      validate("settings", { ...s, jvmArgs: ["-javaagent:evil.jar"] }),
    ).toThrow();
    expect(() =>
      validate("settings", { ...s, jvmArgs: ["-XX:OnError=calc.exe"] }),
    ).toThrow();
    expect(() =>
      validate("settings", {
        ...s,
        jvmArgs: ["-XX:+UseG1GC", "-Dfile.encoding=UTF-8"],
      }),
    ).not.toThrow();
  });
});
