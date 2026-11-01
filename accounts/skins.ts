import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { request } from "../downloads/http";
export async function uploadSkin(
  file: string,
  token: string,
  variant: "classic" | "slim",
) {
  const stat = await fs.stat(file);
  if (stat.size > 1024 * 1024) throw new Error("Skin PNG exceeds 1 MiB");
  const png = await fs.readFile(file);
  if (
    png.length < 24 ||
    png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
  )
    throw new Error("Choose a PNG skin");
  const width = png.readUInt32BE(16),
    height = png.readUInt32BE(20);
  if (width !== 64 || ![32, 64].includes(height))
    throw new Error("Skin must be 64×64 or 64×32 pixels");
  const boundary = "averiq-" + randomBytes(16).toString("hex");
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="variant"\r\n\r\n${variant}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="skin.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    png,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return JSON.parse(
    (
      await request(
        "https://api.minecraftservices.com/minecraft/profile/skins",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "multipart/form-data; boundary=" + boundary,
          },
          body,
        },
      )
    ).toString(),
  );
}
export async function resetSkin(token: string) {
  await request(
    "https://api.minecraftservices.com/minecraft/profile/skins/active",
    { method: "DELETE", headers: { Authorization: "Bearer " + token } },
  );
}
