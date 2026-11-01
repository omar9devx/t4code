# T4 Code

T4 Code is an "agent harness control surface". It enables control of the agents on your machine with a best-in-class mobile app ([iOS](https://apps.apple.com/us/app/t4-code-remote-claude-more/id6787819824), [Android](https://play.google.com/store/apps/details?id=com.t4tools.T4CODE)), web app, and Electron-based desktop app.

Works with your subscriptions on Claude Code, Codex, Cursor, Grok Build, OpenCode, Google Antigravity, and fx. If they're set up on your computer, T4 Code can control them.

## Vorynixal versioning

Vorynixal uses its own release versions, independent of T3 Code's version numbers. Version **1.0.0 Stable** is based on [T3 Code Nightly 0.1.7-nightly.20261101.4035](https://github.com/pingdotgg/t3code/releases/tag/v0.1.7-nightly.20261101.4035) (source commit `80120b1aa34a`). T3's version is source provenance only; future T3 updates do not change Vorynixal's version unless we publish a Vorynixal release.

## "Wait, what are you selling me?"

Nothing. We built T4 Code because we wanted the best possible development experience with agents. We were inspired by existing solutions like the Codex desktop app, Conductor, Claude Desktop and Cursor Glass, but none met our bar.

We wanted something performant, remote-ready, and truly open. If we ever go the wrong direction, we want you to have everything you need to fork and build the editor that you want.

## Installation

> [!WARNING]
> T4 Code currently supports Codex, Claude, Cursor, Grok Build, OpenCode, Antigravity, and fx. Install and authenticate at least one provider before use:
>
> - Codex: install [Codex CLI](https://developers.openai.com/codex/cli) and run `codex login`
> - Claude: install [Claude Code](https://claude.com/product/claude-code) and run `claude auth login`
> - Cursor: install [Cursor CLI](https://cursor.com/cli) and run `agent login`
> - Grok Build: install [Grok Build CLI](https://x.ai/cli) and run `grok login`
> - OpenCode: install [OpenCode](https://opencode.ai) and run `opencode auth login`
> - Antigravity: enable it in Settings, then use **Install Antigravity** and **Sign in with Google**. No CLI is required.
> - fx: install [fx](https://fx.sh) and run `fx login` on the machine running the T4 Code server ([setup guide](./docs/user/providers-fx.md))

### Command line

```bash
curl -fsSL https://raw.githubusercontent.com/omar9devx/t4code/main/scripts/install.sh | sh
```

On Windows, in PowerShell:

```powershell
irm https://raw.githubusercontent.com/omar9devx/t4code/main/scripts/install.ps1 | iex
```

Then run `t4` to start the server and open the local web app. `t4 service install` keeps it running in the background, `t4 update` moves to a newer release, and `t4 --help` has the full reference.

To try it once without installing, run `npx t4@latest` instead.

### Desktop app

Install the latest version of the desktop app from [GitHub Releases](https://github.com/omar9devx/t4code/releases), or from your favorite package registry:

#### Windows (`winget`)

```bash
winget install t4tools.T4CODE
```

#### Windows (`scoop`)

```bash
scoop install extras/T4CODE
```

#### macOS (Homebrew)

```bash
brew install --cask t4-code
```

#### Debian, Ubuntu (`.deb`)

Download the `.deb` from [GitHub Releases](https://github.com/omar9devx/t4code/releases), then:

```bash
sudo apt install ./T4 Code-Code-*.deb
```

#### Arch Linux (AUR)

Stable:

```bash
yay -S T4CODE-bin
```

Nightly:

```bash
yay -S T4CODE-nightly-bin
```

The AUR packaging is maintained in this repository under [`packaging/aur`](./packaging/aur).

#### Nix (nixpkgs)

```bash
nix profile add github:NixOS/nixpkgs/nixos-unstable#T4CODE
```

The package is maintained in [nixpkgs](https://github.com/NixOS/nixpkgs/tree/nixos-unstable/pkgs/by-name/t4/T4CODE)
and includes the desktop app (`T4CODE-desktop`) and the `t4` command.
See [Nix installation](./docs/user/install.md#nix-nixpkgs) for NixOS configuration and updates.

## Some notes

We are very very early in this project. Expect bugs.

We are (mostly) not accepting contributions yet. Small fixes may be considered. Big features will not be.

## Documentation

Full docs live in [docs/](./docs). There's no docs site yet.

- [FAQ](./docs/user/faq.md)
- [Install and first run](./docs/user/install.md)
- [Permission modes](./docs/user/permission-modes.md)
- [Keyboard shortcuts](./docs/user/keybindings.md)
- [Project settings](./docs/user/project-settings.md)
- [Appearance preferences](./docs/user/appearance.md)
- [Remote access from a phone or another machine](./docs/user/remote-access.md)
- [Connect Claude Code, Codex, ChatGPT and other agents over MCP](./docs/user/outside-agents.md)
- [Keeping app and server in sync](./docs/user/updating.md)
- [Source control integrations](./docs/user/source-control.md)
- Multiple accounts: [Codex](./docs/user/providers-codex.md) · [Claude](./docs/user/providers-claude.md)
- [Run T4 Code as a background service](./docs/user/background-service.md)

Building from source? Start at [docs/internals/overview.md](./docs/internals/overview.md).

## If you REALLY want to contribute still.... read this first

### Install `vp`

T4 Code uses Vite+ so you'll need to install the global `vp` command-line tool.

#### macOS / Linux

```bash
curl -fsSL https://vite.plus | bash
```

#### Windows

```bash
irm https://vite.plus/ps1 | iex
```

Checkout their getting started guide for more information: https://viteplus.dev/guide/

### Install dependencies

```bash
vp i
```

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before reporting a bug or opening a PR.

Have a feature request? Start an [Ideas discussion](https://github.com/omar9devx/t4code/discussions/categories/ideas).

Need support? Join the [Discord](https://discord.gg/jn4EGJjrvv).
