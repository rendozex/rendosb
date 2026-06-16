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
- **19 color themes** — Dark Modern, Dracula, Nord, Catppuccin, GitHub themes, high contrast, and more
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

Or run the built executable:

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