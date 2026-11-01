# Known limitations — 0.1.0

Averiq 0.1.0 is an early implementation. A successful TypeScript build or Java fixture test does not establish Minecraft compatibility.

## External blockers in this cloud session

- The real official Minecraft manifest request returned HTTP 403 through the managed network proxy. Minecraft/Modrinth/loader/Microsoft domains have been saved to the environment configuration draft, but that save does not apply network policy. No real game installation, native extraction for an actual game, mod download, or Minecraft window has been validated here.
- Microsoft device authorization, Xbox/XSTS exchange, ownership checks, token refresh and skin upload/reset have code paths but have not been exercised with a real registered Client ID and licensed account. The application deliberately has no hardcoded third-party Client ID, credentials or license bypass.
- Windows x64 installer and portable binaries are built on Linux. Actual installation, uninstallation, SmartScreen behavior and Minecraft launching on Windows 10/11 have not been tested. There is no signing certificate configured; artifacts are unsigned.

## Incomplete features and compatibility limits

- Forge and NeoForge are not implemented or advertised as supported. They require installer processor integration and real launch validation. Fabric and Quilt profiles/dependency installation are implemented via XMCL; end-to-end loader/game launching remains unverified.
- Historical versions are listed from Mojang, but versions without modern client/asset metadata, legacy HTTP-only libraries, obsolete Java requirements, platform-native gaps or unusual authentication may fail explicitly. There is no blanket compatibility claim for every historical version.
- Java runtimes are discovered and selected, not downloaded automatically. Install the exact required 64-bit major. The automated Java-process test needs Java 21 including `jdk.compiler` and `jdk.jartool` modules; it runs through `java --module` and does not need separate `javac`/`jar` commands.
- Custom instance ZIP is Averiq format only. No `.mrpack`/CurseForge pack-format import, pack catalogue installation, optional dependency selection or complete mod conflict solver. Minecraft/loader shared files are not exported with instances and need separate installation on the receiving machine.
- Updating a mod uses the latest compatible Modrinth version and required dependencies, not a lockfile across an entire pack. No automatic bulk-update scan. External/manual JARs are listed and removable, but are not silently managed as Modrinth projects. Dependency cycles are bounded, but complex mutually incompatible mod requirements can need manual resolution.
- Resource packs require enabling in-game. Shaders require Iris or another compatible loader; Averiq does not silently install/configure Iris or modify game graphics settings.
- Installations share the chosen game root. Changing root does not migrate existing instances/worlds. Choose the root before creating instances, or move/restore your data explicitly. Imported instances are installed into new random UUID directories; source IDs are not trusted.
- Downloads currently buffer each artifact in memory (maximum 512 MiB per response), use three attempts, and report completed verified bytes. There is cancellation and valid-file reuse, but no partial-file HTTP resume or continuous per-packet progress.
- Export/import ZIPs are memory-based, capped at 1 GiB compressed and 4 GiB declared expanded size. Large worlds can exceed practical memory limits. Export does not include shared game files. Mods/imported configs are trusted local executable game content after installation; the launcher is not a sandbox for mod code.
- English/Russian selection covers primary UI text; some diagnostic/control labels remain English. Light is currently a visual color transformation, not a separately tuned theme.
- Skins are shown as official PNG textures, not a 3D player preview. Local/offline skins are not uploaded to Microsoft or spoofed on authenticated servers.
- Launcher update checks notify from GitHub Releases; there is no automatic updater, executable replacement or release publishing. No release exists in the initially empty remote repository, so the current update check can return a real 404.
- Playtime measures Java-process lifetime, including loading/menus. A forced system shutdown can lose the active session's elapsed time. History is capped at 200 completed sessions and logs at 5,000 chunks; tokens are redacted before persistence/export.
- Linux desktop validation used a dummy Xorg display with a test-only `--no-sandbox` opt-in because this container does not permit Chromium's namespace sandbox. The distributed application keeps sandbox, contextIsolation and webSecurity enabled.
- No GitHub commits/pushes, GitHub Actions runs, Microsoft app registration, binary signing, release publication or environment publication have been performed by this task. Source files and dependencies exist in the current workspace and source ZIP. The original remote had no refs; publish the sources to your own repository when ready.

Before treating this as a production launcher, complete real Windows installation/uninstallation, official vanilla installation/repair, licensed Microsoft login, a real Minecraft launch/exit, offline launch of an authorized local installation, loader/mod/skin integration, and packaging/signing tests. These checks are recorded as unrun, not passed.
