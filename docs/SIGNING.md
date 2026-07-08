# Code signing & notarization (macOS)

The build is already wired for Developer ID signing + notarization — it activates
automatically when these environment variables are present at `tauri build` time.
Until then, builds are adhoc-signed (Gatekeeper warns on first open).

## One-time setup (after the $99/yr Apple Developer enrollment)

1. In Xcode → Settings → Accounts, add your Apple ID and create a
   **Developer ID Application** certificate. Confirm it's installed:
   ```
   security find-identity -v -p codesigning
   # → "Developer ID Application: Your Name (TEAMID)"
   ```
2. Create an app-specific password for notarization at appleid.apple.com
   (Sign-In & Security → App-Specific Passwords).

## Build a signed + notarized app

Set these and run the normal build — Tauri signs with the identity, then submits
to Apple's notary service and staples the ticket:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="abcd-efgh-ijkl-mnop"   # app-specific password
export APPLE_TEAM_ID="TEAMID"

npx tauri build --bundles app,dmg
```

The hardened runtime + `entitlements.plist` are applied automatically. Verify:

```bash
codesign -dv --verbose=2 "src-tauri/target/release/bundle/macos/RAISEME.app"   # Authority=Developer ID …
xcrun stapler validate "src-tauri/target/release/bundle/dmg/RAISEME_0.8.16_aarch64.dmg"
```

A notarized, stapled DMG opens with **no Gatekeeper warning**.

## Publish

Copy the notarized DMG to `dist/RAISEME.dmg`; the server serves it from
`/download/app`. (CI can do this on a version tag.)
