# Packaging & distribution

Two install channels for MoorAI: **npm** (the CLI tools — `moorai-aibom`, `moorai-guard`,
`moorai-hook`) and **Homebrew** (the macOS desktop app). Both are prepared here; publishing needs
your accounts and is a manual step (do it only after the repo is public and the name is secured).

## npm — the CLI tools

`package.json` is already publish-ready: `bin` exposes the three CLIs and `files` ships only
`cli/ src/ data/ scripts/redteam.mjs` (not the Rust/Tauri host). After publishing, anyone can run the
standalone AIBOM with no install:

```bash
npx moorai-aibom --format md      # content-free AI Bill of Materials for the machine
npx moorai-guard -- "prompt"      # pre-flight guard for claude -p
```

**Publish:**
```bash
npm login                          # once, as the account that owns the "moorai" name
npm publish --access public        # from the repo root
```
> Reserve the `moorai` name on npm now (even with a stub) so nobody squats it before launch.
> The package is ESM, Node ≥ 20 (uses global fetch). No runtime deps for the CLIs.

## Homebrew — the desktop app

`homebrew/moorai.rb` is a cask that installs the signed macOS DMG from GitHub Releases.

**Set up the tap (once):**
1. Create a public repo `github.com/gitayg/homebrew-tap`.
2. Add this file at `Casks/moorai.rb`.
3. Users then: `brew install --cask gitayg/tap/moorai`

**Per release:**
1. Bump `version` in the cask.
2. `shasum -a 256 MoorAI_<version>_universal.dmg` → paste into `sha256`.
3. Confirm the `url` matches the actual release-asset filename Tauri produced.
4. Commit the tap repo.

> Optional later: submit to `homebrew-cask` core once there's adoption (they require a notable
> user base). The personal tap works immediately with no such bar.

## PyPI (optional, name protection)

There's no Python package, but reserving `moorai` on PyPI with a stub pointing at the repo prevents
squatting and aids discovery. Low priority; do it when convenient.
