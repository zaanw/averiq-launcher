# Validation record

Current cloud task, 2026-11-01. Evidence describes this instance, not Windows certification or a future environment snapshot.

| Check                                       | Result                         | Scope                                                                                                            |
| ------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| npm dependency installation                 | Passed                         | Exact versions and package-lock; Electron installed via official installer with inherited proxy/TLS trust        |
| TypeScript typecheck                        | Passed                         | Renderer, shared API, Electron, backend modules                                                                  |
| Production build                            | Passed                         | Vite renderer and compiled main/preload/backend                                                                  |
| Automated suites                            | 29 passed, 0 failed, 0 skipped | Four test files; listed below                                                                                    |
| Real Electron smoke                         | Passed                         | Production app, sandboxed renderer settings, temporary user data, actual preload IPC and UI                      |
| Runtime dependency audit                    | Passed                         | `npm audit --omit=dev`: 0 known vulnerabilities at test time; not a claim of complete security                   |
| Windows packaging                           | Passed                         | NSIS installer and portable EXE built using electron-builder and verified Debian Wine tools; no signing identity |
| Windows install/uninstall                   | Unrun                          | Windows 10/11 machine required                                                                                   |
| Official live manifest                      | Blocked                        | Real HTTPS request returned HTTP 403 at managed proxy for piston-meta.mojang.com                                 |
| Real Minecraft installation/launch          | Unrun                          | Network access, game rights/profile and platform validation required                                             |
| Microsoft/Xbox/Minecraft login, skin upload | Unrun                          | Registered public Client ID, API permissions and licensed account required                                       |
| Real Fabric/Quilt/Modrinth integration      | Unrun                          | Required hosts not available under current network policy                                                        |
| GitHub Actions / environment publication    | Unrun                          | Workflow/configuration saved only                                                                                |

Automated suites test stable offline UUIDs, nickname rejection, atomic profile/settings persistence and corrupt-store errors; traversal/Windows filename boundaries and checksum verification; Java parsing/selection and missing binaries; instance isolation/duplication; real XMCL argument generation; IPC schemas and actual service dispatch; launch prerequisites; delete confirmation; refusal to store unencrypted Microsoft tokens; overlapping-operation rejection/cancellation; real ZIP round-trip and unsafe archive rejection; skin PNG validation; manifest caching/error propagation; Modrinth filters, dependency order, incompatible/artifact-path rejection and failed download behavior.

`tests/java-process.test.ts` compiles a tiny Java fixture using the installed JDK modules, packages a real JAR and launches it through `GameRunner` → XMCL → real Java process with strict file checks enabled. It asserts a real PID, username arguments, stdout, stderr and exit code 0. **This is not Minecraft and is not reported as a game-launch test.** Network-specific unit tests use explicitly mocked API/download boundaries and do not establish live remote compatibility.

`scripts/electron-smoke.cjs` launches the compiled production Electron application on a temporary profile and uses Playwright to create a real local profile, create/select an instance, reload the renderer, inspect persisted selection, navigate Home/Accounts/Settings/Console, reject an invalid IPC request and assert renderer `require`/`process` are unavailable. The test stores `artifacts/averiq-home.png`. In this restricted Linux container it needs a dummy display and `AVERIQ_TEST_NO_SANDBOX=1`; this opt-in affects only the test launcher, not production configuration.

Reproduce:

```sh
npm ci
npx install-electron --no
npm run build
npm test
npm run test:desktop
npm run test:integration
npm run dist
npm run source
```

Desktop/live/package checks have different prerequisites, described in README. A blocked integration command exits nonzero; there are no synthetic success states or fake progress timers. Re-run live checks after the environment's saved host additions are applied. Validate the generated Windows artifacts on a Windows host before distribution.
