# Averiq Launcher

**Created by Averiq.** Minecraft Java Edition launcher for Windows 10/11 x64, built with Electron, React, TypeScript, Vite, Tailwind, Lucide and Motion. Midnight UI, original icon and local JSON persistence.

This is an early implementation with real backend operations, **not a production-certified release**. Read [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) and [VALIDATION.md](VALIDATION.md) before using it. Minecraft installation and actual game launch have not been validated end to end in this cloud session because the required Minecraft domains are blocked by the environment's network policy. Microsoft login also needs a registered application Client ID. No game binaries, accounts or tokens are included.

## Development

Use Node.js 24 LTS and npm. On Windows, use PowerShell or a terminal with an installed 64-bit Java runtime. Java 8, 17 or 21 may be required depending on the selected Minecraft version; newer Minecraft versions can require newer Java. The exact major is read from version metadata.

```sh
npm install
npx install-electron --no
npm run dev
```

Production compilation and checks:

```sh
npm run typecheck
npm test
npm run build
npm run test:desktop
npm run dist
npm run source
```

`npm ci` reproduces the lockfile. `npm run dev` starts Vite, the TypeScript compiler and Electron. `npm run build` compiles the renderer and main/preload code. `npm run dist` produces x64 Windows NSIS installer and portable EXE in `release/`. `npm run source` creates a source ZIP without credentials, dependencies, game files or build output. Release binaries are unsigned unless a signing identity is explicitly configured in electron-builder. They are not automatically published.

On a restricted-proxy cloud host running Node 24:

```sh
export NODE_USE_ENV_PROXY=1
export ELECTRON_GET_USE_PROXY=1
npm ci
npx install-electron --no
npm run build
npm test
```

Keep inherited TLS trust and proxy settings. Never disable TLS verification. Linux desktop tests require X11/Wayland and a desktop session; production does not disable Chromium's sandbox. In this container only, the desktop test was run with `DISPLAY=:98 AVERIQ_TEST_NO_SANDBOX=1` because Chromium's namespace sandbox cannot start here. This test-only flag is opt-in and is never included in distributed startup.

## First game

1. Open **Settings**. Choose your Minecraft data root before creating instances, select a suitable Java executable if autodetection does not find it, and configure RAM.
2. In **Accounts**, create a local profile for a compatible local installation you have the right to use, or sign in with Microsoft.
3. In **Versions**, install an official Minecraft version. Downloads use SHA-1 checksums from official metadata and Maven repositories, retry failed files and reuse valid existing files. Progress reports completed verified bytes with a known total, rather than simulated timers.
4. In **Modpacks**, create an instance for that version and select it. Each instance gets separate `mods`, `config`, `saves`, `resourcepacks`, `shaderpacks`, `logs` and game options. Shared versions, libraries and assets stay in the data root.
5. Select a profile and press **PLAY**. The backend validates the installation, chooses Java, asks XMCL to form arguments/extract native libraries and starts Java without a shell. Console displays process stdout/stderr. Exit status and elapsed process time are recorded.
6. For Fabric/Quilt, install the base game first, then choose a loader version in the active instance's Mod loader panel. The loader profile and dependencies are installed using XMCL and checksummed downloads. These code paths exist but real game compatibility remains unvalidated in this environment. Forge/NeoForge are visibly unavailable.

Local profiles have stable Minecraft-compatible offline UUIDs, generated from the nickname. Renaming changes the UUID and can change local player inventories; back up worlds first. A local profile is not a Microsoft account and does not grant Minecraft ownership or authenticate to online-mode servers. No authentication replacement or DRM bypass is supplied.

## Microsoft accounts and skins

Register an appropriate Microsoft public/native client, enable device-code/public-client flow and obtain the required Xbox Live/Minecraft API permission/approval. Put its **public Client ID** in Settings. No client secret or Microsoft password is requested. The implementation performs Microsoft device authorization → Xbox Live → XSTS → Minecraft token exchange, checks Minecraft entitlements and retrieves the Minecraft profile. Token refresh and logout are implemented. Access/refresh tokens are encrypted using Electron `safeStorage` (Windows DPAPI); authentication fails if secure OS storage is unavailable rather than writing plaintext tokens.

These remote flows were not exercised with a real Microsoft account. Depending on tenant/app permissions Microsoft can reject Xbox/Minecraft access. The error is shown, not converted into a successful login. Skin upload (classic/slim PNG 64×64/64×32) and reset use the authenticated official Minecraft profile API. Local profiles cannot upload official skins.

## Mods and instances

**Mods** queries Modrinth with game-version, loader and content-type filters. Install/update selects the latest compatible release, resolves required dependencies, verifies SHA-512 and records installed project/version metadata. An update replaces only earlier files installed by Averiq for that project after the new artifact succeeds. Manually installed files are not silently replaced. Required dependencies are installed; complete cross-mod compatibility/conflict solving is not implemented. Shaders require a suitable shader loader (e.g. Iris), which must be installed separately. Resource packs still need enabling in Minecraft.

Custom instance ZIP export/import contains instance data and metadata, **not shared Minecraft binaries**. After importing, install the referenced game/loader separately. Archives are checked for traversal, symlinks and unexpected files. This format is not `.mrpack` or CurseForge format. Treat imported instances/mod JARs as executable third-party content; install only trusted projects. World files can be large, so export/import currently has memory/size limits.

**Versions → Diagnose** checks jars, libraries and assets. **Repair** redownloads missing/corrupt artifacts without fabricating success. **Console → Export logs** writes redacted launcher/process logs through a native save dialog. Launcher updates query GitHub Releases and notify the user; automatic executable replacement is not implemented.

## Data layout

Settings, profile metadata and history: Electron's per-user `userData/state.json` (normally `%APPDATA%/averiq-launcher`). Encrypted tokens: `userData/accounts/*.bin`. Minecraft default root: `userData/minecraft`.

```text
accounts/       Microsoft OAuth, encrypted tokens, offline UUID, skins
core/           Path boundaries and token redaction
minecraft/      Manifest, verified installation, launch, loaders
java/           Runtime discovery, version/architecture selection
instances/      Instance directories, duplication
mods/           Modrinth search, dependencies, verified installation
downloads/     HTTPS/proxy/checksum/retry code
settings/       Atomic queued JSON writes
diagnostics/    Bounded, redacted logs
shared/         Typed preload API, IPC schemas
electron/      Secure BrowserWindow, preload, validated service dispatch
renderer/       Midnight/Light React UI
tests/         Core, service/IPC, filesystem and network fixtures
scripts/        Real Electron smoke, opt-in live integration, source archive
resources/      Original icon and custom NSIS installer
```

`contextIsolation`, sandbox and web security are enabled; `nodeIntegration` is disabled. The preload exposes only validated method invocation and bounded event subscription. Main verifies the sender frame, rejects unknown IPC methods/extra properties, blocks navigation and denies renderer permissions. Java is launched with argument arrays and `shell:false`; JVM tuning flags are allowlisted. Paths are bounded to the selected game root, downloads use HTTPS and checksum verification. Archive operations do not copy executable game binaries into the launcher distribution.

## Live integration

```sh
npm run test:integration
# Explicitly opt in to a real game installation (can download hundreds of MB):
AVERIQ_INTEGRATION_INSTALL=1 AVERIQ_INTEGRATION_VERSION=1.21.1 npm run test:integration
```

The script deliberately fails if only a cached manifest is available. It never invents a successful game launch. On PowerShell set the environment variables using `$env:AVERIQ_INTEGRATION_INSTALL='1'`. Required domains include `piston-meta.mojang.com`, `piston-data.mojang.com`, `libraries.minecraft.net`, `resources.download.minecraft.net`, Modrinth and loader Maven/API hosts. The cloud configuration draft contains the required domain additions; saving a draft alone does not change live access.

The Windows CI workflow builds/tests and uploads artifacts when invoked on GitHub. It has been authored, not run in this session. No GitHub push, release publication, app registration or environment publication has been performed.

Averiq is an independent project and is not affiliated with Mojang or Microsoft. Minecraft ownership, licenses and server authentication remain the user's responsibility.
