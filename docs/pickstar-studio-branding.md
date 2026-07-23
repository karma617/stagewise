# PickStar Studio branding

## Identity

The desktop app is branded as **PickStar Studio**.

- Display name: `PickStar Studio`
- Base package/executable name: `pickstar-studio`
- Bundle identifier / app id: `asia.pickstar`
- Homepage: `https://pickstar.asia`

The pnpm workspace package name under `apps/browser/package.json` remains `stagewise` so existing monorepo commands such as `pnpm -F stagewise ...` keep working.

## About page

The About page shows the PickStar Studio name, the `asia.pickstar` bundle id, the PickStar homepage, and a short project note describing that this is a modified Stagewise build with account/proxy pool experiments, Codex-like goal mode, and modified core prompting.

The old runtime `otherVersions` block is intentionally hidden from the About page so no Electron/Node/Chrome version list appears below the homepage.

## Onboarding auth

The onboarding authentication step is optional. If no account, API key, or coding plan is connected, the bottom action changes to **Skip and enter** and marks onboarding as completed with an `unknown` auth method so the user can enter the main chat UI directly.

When a user is already signed in, onboarding shows only the signed-in account and the option to use a different email. The previous checkbox for sharing identifiable chat and usage data is not rendered.

## Icon assets

The app icon was regenerated from the provided PickStar artwork for all packaged channels:

- `apps/browser/assets/icons/dev/`
- `apps/browser/assets/icons/nightly/`
- `apps/browser/assets/icons/release/`

Each channel includes PNG sizes from 16 to 1024, plus `icon.ico`, `icon.icns`, and `icon.png`. The renderer also uses `apps/browser/assets/pages/pickstar-icon.png` for the in-app logo component.

