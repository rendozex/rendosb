# RendoSB

A desktop LLM workbench with a VS Code–style UI. Chat with **Grok CLI** or **local Ollama** models, browse a project folder, edit files, and watch the workspace update in real time while the agent runs.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)

## Features

- **Grok CLI integration** — streams responses from the local `grok` binary (`grok-composer-2.5-fast`, `grok-build`)
- **Ollama / Docker** — connect to `http://127.0.0.1:11434` with an in-app setup guide
- **VS Code–style layout** — file explorer, code editor, and chat panel side by side
- **Working directory picker** — native Windows folder dialog; explorer scoped to the folder you choose
- **Live file watching** — explorer refreshes while Grok is generating
- **25 color themes** — Dark Modern, Dracula, Nord, Abyss, Monokai Dimmed, Red, Quiet Light, Catppuccin, GitHub themes, high contrast, and more
- **Windows `.exe`** — build a portable desktop app with Electron

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| [Node.js](https://nodejs.org/) 18+ | For development and builds |
| [Grok CLI](https://grok.com) | Installed at `%USERPROFILE%\.grok\bin\grok.exe` (or on `PATH`) |
| [Docker](https://www.docker.com/) + Ollama | Optional, for local models only |

## Quick start

### Desktop app (recommended)

```powershell
cd grok-gui
npm install
npm start
```

Or download the pre-built release (no Node.js required):

**https://github.com/rendozex/rendosb/releases/latest**

1. Download `RendoSB-1.0.0-win-x64.zip`
2. Extract anywhere
3. Run `RendoSB.exe`

Or run a local build:

```text
release\win-unpacked\RendoSB.exe
```

### Web mode (browser)

```powershell
npm run start:web
```

Open http://127.0.0.1:3847

## Usage

1. Click **Browse** in the title bar and select your project folder.
2. Choose **Provider** — `Grok CLI` or `Docker / Ollama`.
3. Pick a **Model** from the dropdown (loaded from `grok models` or Ollama).
4. Type in the chat panel and press Enter.

**Settings** (gear icon): theme, Ollama URL, Grok permission mode, max turns.

### Ollama quick setup

```powershell
docker run -d -p 11434:11434 --name ollama ollama/ollama
docker exec -it ollama ollama pull llama3.2
```

Switch provider to **Docker / Ollama** and select the model in the dropdown.

## Build Windows executable

```powershell
npm run build
```

Output:

- `release\win-unpacked\RendoSB.exe`
- `release\RendoSB-1.0.0-win-x64.zip`

Close any running `RendoSB.exe` before rebuilding.

## Publish a GitHub Release

Build and upload the pre-compiled zip to GitHub Releases:

```powershell
.\publish-release.ps1
```

Upload an existing build without rebuilding:

```powershell
.\publish-release.ps1 -SkipBuild
```

## Themes

Open **Settings → Theme**. Choices are grouped as **Dark**, **Light**, and **High Contrast**. Your selection is saved in `localStorage`.

## Project structure

```text
grok-gui/
├── electron/           # Main process, IPC, Grok/Ollama providers, file service
├── renderer/         # UI (HTML, CSS, JS) — VS Code chat styles
├── server.js         # Optional web server fallback
├── scripts/          # Build helpers
├── push-to-github.ps1
└── package.json
```

## Sync UI from VS Code source

When `vscode-main` gets updates, pull the latest chat CSS and themes into RendoSB:

```powershell
.\sync-from-vscode.cmd
```

Or:

```powershell
.\scripts\sync-from-vscode.ps1
```

This copies chat styles, codicons, code-block CSS, workbench chrome (activity bar, status bar, panel, editor tabs), and theme JSON files from `../vscode-main` into `renderer/styles/vscode-ui/`. A manifest is written to `renderer/styles/vscode-ui/sync-manifest.json`.

**Batch 2 assets** (synced from vscode-main):

| Category | Files |
|----------|-------|
| Chat polish | `chatAgentHover`, `chatStatus`, `chatViewPane`, `chatConfirmationWidget`, `chatTipContent`, `chatTerminalToolProgressPart` |
| Workbench chrome | `activitybarpart`, `statusbarpart`, `panelpart`, `editortabscontrol` |
| Extension themes | Abyss, Tomorrow Night Blue, Quiet Light, Red, Kimbie Dark |

**Batch 3 assets** (synced from vscode-main):

| Category | Files |
|----------|-------|
| Workbench shell | `sidebarpart`, `titlebarpart`, `views`, `editorgroupview`, `editorplaceholder`, `activityaction`, `compositepart` |
| Chat view | `chatViewTitleControl`, `chatGoalBannerWidget`, `chatContextUsageWidget` |
| Extension theme | Monokai Dimmed |

Custom RendoSB themes in `renderer/styles/themes.css` are not overwritten — only the extracted VS Code assets are updated.

## Push to GitHub

Requires [GitHub CLI](https://cli.github.com/) (`gh auth login`):

```powershell
.\push-to-github.ps1
```

Options:

```powershell
.\push-to-github.ps1 -RepoName rendosb -Visibility private
.\push-to-github.ps1 -SkipCreate   # commit + push only
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Launch Electron desktop app |
| `npm run start:web` | Run local web server |
| `npm run dev:desktop` | Desktop app with DevTools |
| `npm run build` | Build Windows app + zip |

## Environment

| Variable | Purpose |
|----------|---------|
| `GROK_PATH` | Override path to `grok` executable |
| `PORT` | Web server port (default `3847`) |

## License

MIT