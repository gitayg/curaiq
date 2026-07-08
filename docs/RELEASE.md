# Releasing

One command does everything: bump → build the app + DMG → upload the installer to
AppCrane's `/data` volume → push the server code → deploy → verify.

```bash
npm run release          # re-ship the current version
npm run release patch    # x.y.Z+1, then ship
npm run release minor    # x.Y+1.0, then ship
npm run release 1.0.0    # set an exact version, then ship
```

The bump updates `server/version.js`, `package.json`, `deployhub.json`,
`src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` together, so the host,
server, and installer always report the same version (no false update prompts).

It verifies on the way out: production health must report the new version, and
`/download/app` must return the exact bytes that were just built (sha256 checked).

## Signing

If `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID` are
exported, the build is signed + notarized automatically (see `docs/SIGNING.md`).
Otherwise the DMG is adhoc and macOS warns on first open.

## Credentials

The AppCrane key comes from `APPCRANE_API_KEY`, or the untracked
`.appcrane-key.local` file (gitignored). Keep it out of source control.
