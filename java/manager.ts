import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { JavaInfo } from "../shared/types";
const exec = promisify(execFile);
export function parseJava(output: string, file: string): JavaInfo {
  const v = output.match(/(?:java\.version\s*=\s*|version ")([^\s"]+)/)?.[1];
  if (!v) throw new Error("Cannot determine Java version");
  return {
    path: file,
    version: v,
    major: Number(v.startsWith("1.") ? v.split(".")[1] : v.split(".")[0]),
    arch: output.match(/os\.arch\s*=\s*(\S+)/)?.[1] || "unknown",
  };
}
export async function inspectJava(file: string) {
  const executable = file.replace(/javaw\.exe$/i, "java.exe");
  const { stdout, stderr } = await exec(
    executable,
    ["-XshowSettings:properties", "-version"],
    { timeout: 15000, windowsHide: true, maxBuffer: 1024 * 1024 },
  );
  return parseJava(stdout + stderr, file);
}
export async function discoverJava(custom = "") {
  const candidates = new Set<string>([custom, "java"]);
  if (process.env.JAVA_HOME)
    candidates.add(
      path.join(
        process.env.JAVA_HOME,
        "bin",
        process.platform === "win32" ? "java.exe" : "java",
      ),
    );
  const dirs =
    process.platform === "win32"
      ? [
          path.join(process.env.ProgramFiles || "C:\\Program Files", "Java"),
          path.join(
            process.env.ProgramFiles || "C:\\Program Files",
            "Eclipse Adoptium",
          ),
        ]
      : ["/usr/lib/jvm"];
  for (const dir of dirs) {
    try {
      for (const entry of await fs.readdir(dir))
        candidates.add(
          path.join(
            dir,
            entry,
            "bin",
            process.platform === "win32" ? "java.exe" : "java",
          ),
        );
    } catch {}
  }
  const found: JavaInfo[] = [];
  for (const c of candidates) {
    if (!c) continue;
    try {
      found.push(await inspectJava(c));
    } catch {}
  }
  return found;
}
export function selectJava(list: JavaInfo[], required: number) {
  const java = list.find(
    (j) => j.major === required && /amd64|x86_64|aarch64/.test(j.arch),
  );
  if (!java)
    throw new Error(
      `Java ${required} (64-bit) is required. Install it or choose its executable in Settings.`,
    );
  return java;
}
