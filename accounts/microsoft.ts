import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { json } from "../downloads/http";
import { Account } from "../shared/types";
const OAUTH = "https://login.microsoftonline.com/consumers/oauth2/v2.0";
const form = (data: Record<string, string>) => ({
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams(data).toString(),
});
export class MicrosoftAuth {
  constructor(
    readonly directory: string,
    readonly encrypt: (text: string) => Buffer,
    readonly decrypt: (data: Buffer) => string,
  ) {}
  private async exchange(
    token: { access_token: string; refresh_token?: string },
    prior?: string,
  ) {
    const xbox = await json<any>(
      "https://user.auth.xboxlive.com/user/authenticate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Properties: {
            AuthMethod: "RPS",
            SiteName: "user.auth.xboxlive.com",
            RpsTicket: "d=" + token.access_token,
          },
          RelyingParty: "http://auth.xboxlive.com",
          TokenType: "JWT",
        }),
      },
    );
    const xsts = await json<any>(
      "https://xsts.auth.xboxlive.com/xsts/authorize",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Properties: { SandboxId: "RETAIL", UserTokens: [xbox.Token] },
          RelyingParty: "rp://api.minecraftservices.com/",
          TokenType: "JWT",
        }),
      },
    );
    const minecraft = await json<any>(
      "https://api.minecraftservices.com/authentication/login_with_xbox",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityToken: `XBL3.0 x=${xsts.DisplayClaims.xui[0].uhs};${xsts.Token}`,
        }),
      },
    );
    const headers = { Authorization: `Bearer ${minecraft.access_token}` };
    const entitlements = await json<any>(
      "https://api.minecraftservices.com/entitlements/mcstore",
      { headers },
    );
    if (
      !entitlements.items?.some((i: any) =>
        ["game_minecraft", "product_minecraft"].includes(i.name),
      )
    )
      throw new Error(
        "This Microsoft account does not own Minecraft Java Edition",
      );
    const profile = await json<any>(
      "https://api.minecraftservices.com/minecraft/profile",
      { headers },
    );
    const account: Account = {
      id: prior || randomUUID(),
      uuid: profile.id,
      name: profile.name,
      type: "microsoft",
      skin: profile.skins?.find((s: any) => s.state === "ACTIVE")?.url,
    };
    await fs.mkdir(this.directory, { recursive: true });
    await fs.writeFile(
      path.join(this.directory, account.id + ".bin"),
      this.encrypt(
        JSON.stringify({
          refreshToken: token.refresh_token,
          accessToken: minecraft.access_token,
          expires: Date.now() + minecraft.expires_in * 1000,
        }),
      ),
      { mode: 0o600 },
    );
    return account;
  }
  async login(
    clientId: string,
    onCode: (message: string, url: string) => void,
    signal: AbortSignal,
  ) {
    if (!clientId)
      throw new Error(
        "Set your registered Microsoft public Client ID in Settings (Xbox/Minecraft API access required)",
      );
    const code = await json<any>(
      OAUTH + "/devicecode",
      form({ client_id: clientId, scope: "XboxLive.signin offline_access" }),
    );
    onCode(code.message, code.verification_uri);
    const until = Date.now() + code.expires_in * 1000;
    let interval = code.interval * 1000;
    while (Date.now() < until) {
      await new Promise<void>((resolve, reject) => {
        if (signal.aborted) {
          reject(new Error("Login cancelled"));
          return;
        }
        const abort = () => {
          clearTimeout(timer);
          reject(new Error("Login cancelled"));
        };
        const timer = setTimeout(() => {
          signal.removeEventListener("abort", abort);
          resolve();
        }, interval);
        signal.addEventListener("abort", abort, { once: true });
      });
      // Device flow returns OAuth errors as HTTP 400: read their structured body separately.
      const token = await oauthPoll(clientId, code.device_code, signal);
      if (token.error === "authorization_pending") continue;
      if (token.error === "slow_down") {
        interval += 5000;
        continue;
      }
      if (token.error) throw new Error(token.error_description || token.error);
      return this.exchange(token);
    }
    throw new Error("Microsoft device code expired");
  }
  async token(account: Account, clientId: string) {
    const file = path.join(this.directory, account.id + ".bin");
    const saved = JSON.parse(this.decrypt(await fs.readFile(file)));
    if (saved.expires > Date.now() + 60000) return saved.accessToken as string;
    const fresh = await json<any>(
      OAUTH + "/token",
      form({
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: saved.refreshToken,
        scope: "XboxLive.signin offline_access",
      }),
    );
    await this.exchange(
      { ...fresh, refresh_token: fresh.refresh_token || saved.refreshToken },
      account.id,
    );
    const updated = JSON.parse(this.decrypt(await fs.readFile(file)));
    return updated.accessToken as string;
  }
  async logout(id: string) {
    await fs.rm(path.join(this.directory, id + ".bin"), { force: true });
  }
}
import https from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";
async function oauthPoll(
  clientId: string,
  code: string,
  signal: AbortSignal,
): Promise<any> {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    device_code: code,
  }).toString();
  return new Promise((resolve, reject) => {
    const proxy = process.env.HTTPS_PROXY;
    const req = https.request(
      OAUTH + "/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal,
        agent: proxy ? new HttpsProxyAgent(proxy) : undefined,
      },
      (res) => {
        let text = "";
        res.on("data", (b) => (text += b));
        res.on("end", () => {
          try {
            resolve(JSON.parse(text));
          } catch {
            reject(new Error("Invalid OAuth response"));
          }
        });
        res.on("error", reject);
      },
    );
    req.setTimeout(30000, () => req.destroy(new Error("OAuth timeout")));
    req.on("error", reject);
    req.end(body);
  });
}
