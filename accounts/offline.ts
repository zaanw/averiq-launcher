import { createHash, randomUUID } from "node:crypto";
import { Account } from "../shared/types";
export function offlineUUID(name: string) {
  const b = createHash("md5")
    .update("OfflinePlayer:" + name)
    .digest();
  b[6] = (b[6] & 15) | 48;
  b[8] = (b[8] & 63) | 128;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export function offlineAccount(name: string): Account {
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name))
    throw new Error(
      "Minecraft nickname must contain 3–16 letters, digits or underscores",
    );
  return { id: randomUUID(), name, uuid: offlineUUID(name), type: "offline" };
}
