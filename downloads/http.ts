import https from "node:https";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { HttpsProxyAgent } from "https-proxy-agent";
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
export async function request(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | Buffer;
    signal?: AbortSignal;
  } = {},
  redirects = 0,
): Promise<Buffer> {
  const u = new URL(url);
  if (u.protocol !== "https:" || u.username || u.password)
    throw new Error("Only HTTPS URLs without credentials are allowed");
  if (redirects > 5) throw new Error("Too many redirects");
  return new Promise((resolve, reject) => {
    const req = https.request(
      u,
      {
        method: options.method || "GET",
        headers: { "User-Agent": "AveriqLauncher/0.1.0", ...options.headers },
        agent: proxy ? new HttpsProxyAgent(proxy) : undefined,
        signal: options.signal,
      },
      (res) => {
        if (
          res.statusCode &&
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location
        ) {
          const redirected = new URL(res.headers.location, u);
          if (
            (options.body || options.headers?.Authorization) &&
            redirected.origin !== u.origin
          ) {
            res.resume();
            reject(new Error("Cross-origin authenticated redirect refused"));
            return;
          }
          res.resume();
          resolve(
            request(
              new URL(res.headers.location, u).href,
              options,
              redirects + 1,
            ),
          );
          return;
        }
        if ((res.statusCode || 500) >= 400) {
          res.resume();
          reject(
            new Error(`HTTP ${res.statusCode}: ${u.hostname}${u.pathname}`),
          );
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (b) => {
          size += b.length;
          if (size > 512 * 1024 * 1024) {
            req.destroy(new Error("Download exceeds 512 MiB limit"));
            return;
          }
          chunks.push(b);
        });
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      },
    );
    req.setTimeout(60000, () => req.destroy(new Error("Network timeout")));
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}
export async function json<T = any>(
  url: string,
  options: Parameters<typeof request>[1] = {},
): Promise<T> {
  return JSON.parse((await request(url, options)).toString("utf8"));
}
export async function verify(file: string, hash: string, algorithm = "sha1") {
  try {
    return (
      createHash(algorithm)
        .update(await fs.readFile(file))
        .digest("hex") === hash
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw e;
  }
}
export async function download(
  url: string,
  file: string,
  hash: string,
  algorithm = "sha1",
  signal?: AbortSignal,
) {
  if (await verify(file, hash, algorithm)) return;
  let error: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const b = await request(url, { signal });
      if (createHash(algorithm).update(b).digest("hex") !== hash)
        throw new Error("Checksum mismatch: " + path.basename(file));
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file + ".part", b);
      await fs.rename(file + ".part", file);
      return;
    } catch (e) {
      error = e;
      if (signal?.aborted) throw e;
    }
  }
  throw error;
}
