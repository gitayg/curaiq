# Homebrew cask for the MoorAI desktop agent (macOS).
# Lives in a tap repo: create `github.com/gitayg/homebrew-tap` and drop this at Casks/moorai.rb,
# then users install with:  brew install --cask gitayg/tap/moorai
#
# Per release, update `version` and `sha256` (shasum -a 256 of the DMG), and confirm the DMG asset
# name matches what `npm run release` / the CI actually produces.
cask "moorai" do
  version "0.27.0"
  sha256 "REPLACE_WITH_DMG_SHA256"   # shasum -a 256 MoorAI_<version>_universal.dmg

  url "https://github.com/gitayg/curaiq/releases/download/v#{version}/MoorAI_#{version}_universal.dmg"
  name "MoorAI"
  desc "On-device guardrails for AI coding agents"
  homepage "https://glick.run/moorai.html"

  app "MoorAI.app"

  # Config + provisioning written by the host. Leaves user data on `brew uninstall`; removed on zap.
  zap trash: [
    "~/.curaiq",
  ]
end
