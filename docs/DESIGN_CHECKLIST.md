# Pre-delivery design checklist

Run through this before every release that touches UI (the desktop app `src/`, or the
server-rendered console in `server/dashboard.js` / `server/landing.js`). Cheap to check,
easy to regress.

## Accessibility
- [ ] **Visible focus rings** on every interactive element (buttons, links, selects, inputs,
      chips). Keyboard-Tab through the app — you must always see where focus is.
      Never `outline: none` without a replacement ring. (App uses a global `:focus-visible`
      rule in `styles.css`.)
- [ ] **Contrast ≥ 4.5:1** for body text, ≥ 3:1 for large text / UI borders. Muted text
      (`--muted #8b949e` on `--bg #0e1116`) is the usual offender — check any new muted copy.
- [ ] **Hit targets** ≥ 24×24px for anything clickable.

## Motion
- [ ] **Hover/focus transitions** 150–300ms on interactive elements (no instant color flips).
- [ ] **`prefers-reduced-motion: reduce`** respected — the app has a global override that kills
      transitions/animations; don't add motion that bypasses it.

## Iconography & type
- [ ] **No emoji as icons** — use inline SVG (`ICON.*` in `app.js`, `currentColor` stroke).
      Emoji render inconsistently across macOS versions and read as amateur.
- [ ] **Font stack** intact: `Inter, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI"`.
      (Inter is not vendored — SF Pro is the macOS default. Vendor woff2 only if going cross-platform.)

## Tokens & rhythm
- [ ] **Colors** reference semantic tokens (`--accent`, `--crit`, `--muted`, …), not raw hexes.
- [ ] **Corner radius** uses the scale — `--r-sm 6` / `--r-md 8` / `--r-lg 12` / `--r-pill 999`.
      No new ad-hoc `border-radius` px values.

## Sanity
- [ ] No CSP violations in the console (the server sets a nonce CSP; inline styles are allowed,
      inline scripts must carry the request nonce — handled centrally in `server.js`).
- [ ] Layout holds at a narrow window (the app can be resized small).
