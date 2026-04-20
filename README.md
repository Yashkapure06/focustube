<div align="center">

# 📺 FocusTube

**Watch YouTube videos inside VS Code - distraction-free, developer-first.**

[![VS Code](https://img.shields.io/badge/VS%20Code-1.74+-007ACC?style=flat-square&logo=visual-studio-code&logoColor=white)](https://code.visualstudio.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

---

_No browser tab switching. No autoplay rabbit holes. No related video distractions._
_Just your code and the tutorial you actually need._

</div>

---

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
  - [Loading a Video](#1-loading-a-video)
  - [Mini Player Mode](#2-mini-player-mode)
  - [Saving Timestamps](#3-saving-timestamps)
  - [Saved Clips Panel](#4-saved-clips-panel)
  - [Command Palette](#5-command-palette)
- [Supported URL Formats](#supported-url-formats)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

---

## Features

|     | Feature             | Description                                                                             |
| --- | ------------------- | --------------------------------------------------------------------------------------- |
| ▶   | **Embedded Player** | Watch any YouTube video without leaving VS Code                                         |
| ⊡   | **Mini Mode**       | Shrink the player to a compact view while you code                                      |
| ⚑   | **Save Timestamps** | Bookmark moments in a video with optional notes                                         |
| 📋  | **Saved Clips**     | Persistent clip list - click any entry to jump back instantly                           |
| 🎨  | **Theme-Aware**     | Adapts to any VS Code theme: dark, light, or high-contrast                              |
| 🔒  | **Privacy-First**   | Uses `youtube-nocookie.com` embeds - no tracking, no recommendations, no autoplay traps |

---

## Getting Started

### Prerequisites

- [VS Code](https://code.visualstudio.com/) `v1.74` or newer
- [Node.js](https://nodejs.org/) `v18` or newer
- [npm](https://www.npmjs.com/) (comes with Node.js)

### Installation (Development Build)

```bash
# 1. Clone or download the extension folder
cd focustube

# 2. Install dependencies
npm install

# 3. Compile TypeScript
npm run compile

# 4. Open the folder in VS Code
code .
```

Then press **`F5`** to launch the **Extension Development Host** - a separate VS Code window with FocusTube active.

> **Tip:** Use `npm run watch` instead of `compile` while developing. It recompiles automatically on every file save.

---

## Usage Guide

### 1. Loading a Video

Open the **FocusTube** panel in the Explorer sidebar (look for the `FocusTube` section).

```
Paste a YouTube URL → Press Enter  (or click ▶)
```

FocusTube also **auto-loads on paste** - if you paste a valid YouTube URL, the video starts immediately without pressing Enter.

If the URL contains a timestamp (e.g. `?t=90` or `?t=1h30m`), the video will seek to that position automatically.

---

### 2. Mini Player Mode

Click the **⊡** button in the player bar to shrink the player into a compact view.

```
⊡  →  Mini mode ON   (small player, URL bar and notes hidden)
⊞  →  Mini mode OFF  (full player restored)
```

Mini mode lets you keep the video visible in a corner of the sidebar while you focus on your code. Click **⊞** any time to restore the full view.

---

### 3. Saving Timestamps

While a video is playing:

1. _(Optional)_ Type a note in the **Note** field - e.g. `"explain async/await"`
2. Click **⚑ Save Timestamp**

The current playback position, video URL, and your note are saved permanently using VS Code's built-in storage. They survive restarts and window reloads.

> **Keyboard shortcut:** Focus the note field and press `Ctrl+Enter` (`Cmd+Enter` on Mac) to save instantly.

---

### 4. Saved Clips Panel

All saved timestamps appear in the **Saved Clips** panel below the player.

| Action               | How                                     |
| -------------------- | --------------------------------------- |
| **Jump to clip**     | Click anywhere on the clip row          |
| **Delete one clip**  | Hover the row → click the **✕** button  |
| **Delete all clips** | Click **Clear all** in the panel header |

Each clip displays:

- The **timestamp** (e.g. `12:34`)
- Your **note** (or _No note_ if none was added)
- The **date** it was saved

---

### 5. Command Palette

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and search for:

| Command                       | Action                                                        |
| ----------------------------- | ------------------------------------------------------------- |
| `FocusTube: Open`             | Focus and reveal the FocusTube sidebar panel                  |
| `FocusTube: Save Timestamp`   | Save the current video position (same as clicking the button) |
| `FocusTube: Show Saved Clips` | Scroll the panel to your saved clips list                     |

---

## Supported URL Formats

FocusTube recognises all common YouTube URL patterns:

```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90
https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m30s
https://youtu.be/dQw4w9WgXcQ
https://youtu.be/dQw4w9WgXcQ?t=90
https://www.youtube.com/embed/dQw4w9WgXcQ?start=90
https://www.youtube.com/shorts/dQw4w9WgXcQ
https://www.youtube.com/live/dQw4w9WgXcQ
```

**Invalid URLs** (non-YouTube links, playlists without a video ID, malformed URLs) are rejected with a clear error message.

---

## Keyboard Shortcuts

| Shortcut                   | Context            | Action                                           |
| -------------------------- | ------------------ | ------------------------------------------------ |
| `Enter`                    | URL input focused  | Load the video                                   |
| `Ctrl+Enter` / `Cmd+Enter` | Note input focused | Save current timestamp                           |
| `Ctrl+Shift+P`             | Anywhere           | Open Command Palette → run any FocusTube command |

---

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                   VS Code Extension Host                 │
│                                                         │
│  extension.ts                                           │
│  ├── Registers sidebar WebviewViewProvider              │
│  ├── Handles messages from webview                      │
│  │   ├── saveTimestamp  → globalState.update()          │
│  │   ├── deleteClip     → globalState.update()          │
│  │   └── getClips       → postMessage(clips)            │
│  └── Registers 3 commands                               │
└───────────────────────────┬─────────────────────────────┘
                            │ postMessage / onDidReceiveMessage
┌───────────────────────────▼─────────────────────────────┐
│               Webview (isolated browser context)         │
│                                                         │
│  main.js                                                │
│  ├── Parses YouTube URLs                                │
│  ├── Creates YT.Player via YouTube IFrame API           │
│  │   └── Embedded as youtube-nocookie.com iframe        │
│  ├── Mini mode toggle (CSS class swap)                  │
│  ├── Reads getCurrentTime() → sends to extension        │
│  └── Renders saved clips list                           │
│                                                         │
│  style.css - VS Code CSS variables for theming          │
└─────────────────────────────────────────────────────────┘
```

**Storage:** Clips are saved via `vscode.ExtensionContext.globalState` - VS Code's built-in key-value store. No files are written, no external services are contacted.

**Privacy:** The player uses `youtube-nocookie.com` embeds with `rel=0` and `modestbranding=1` - YouTube's own privacy-enhanced mode that disables tracking cookies and suppresses recommendations.

---

## Project Structure

```
focustube/
│
├── src/
│   └── extension.ts          # Extension entry point
│                             # - FocusTubeViewProvider (WebviewViewProvider)
│                             # - Command registrations
│                             # - globalState read/write
│
├── media/
│   ├── main.js               # Webview JavaScript
│   │                         # - URL parser, YouTube IFrame API
│   │                         # - Mini mode, timestamp saving
│   │                         # - Clips rendering & interaction
│   └── style.css             # Webview styles (VS Code theme-aware)
│
├── out/
│   └── extension.js          # Compiled TypeScript (auto-generated)
│
├── .vscode/
│   ├── launch.json           # F5 debug configuration
│   └── tasks.json            # TypeScript watch build task
│
├── package.json              # Extension manifest & commands
├── tsconfig.json             # TypeScript configuration
└── .vscodeignore             # Files excluded from VSIX package
```

---

## Development

### Available Scripts

```bash
# One-time compile
npm run compile

# Watch mode - recompiles on save (recommended during development)
npm run watch

# Build for publishing
npm run vscode:prepublish
```

### Debug Cycle

1. Run `npm run watch` in a terminal (keeps compiler running)
2. Press **F5** in VS Code to launch Extension Development Host
3. Make changes to `src/extension.ts` or `media/` files
4. For extension host changes: press `Ctrl+Shift+F5` to reload
5. For webview changes: the webview auto-refreshes on panel reopen

### Packaging for Distribution

```bash
# Install vsce globally (VS Code Extension CLI)
npm install -g @vscode/vsce

# Package as a .vsix file
vsce package

# Install the .vsix locally
code --install-extension focustube-0.1.0.vsix
```

---

## Troubleshooting

**Video won't load / blank player**

- Check that the URL is a valid YouTube video link (playlists alone won't work)
- Some videos have embedding disabled by the uploader - FocusTube will show an error
- Age-restricted or private videos cannot be embedded

**"Cannot read current time" error on Save Timestamp**

- The YouTube IFrame API needs a moment to initialise. Wait for the video to start playing before saving a timestamp

**Clips disappeared after reloading VS Code**

- Clips are stored in `globalState` scoped to the extension. If you reinstalled or reset the extension, the state is cleared. This is expected behaviour

**Player appears very small**

- Drag the Explorer sidebar wider - the player maintains a 16:9 ratio relative to the panel width
- Use Mini Mode (⊡) intentionally for compact viewing while coding

**F5 doesn't launch the extension**

- Make sure you've run `npm run compile` at least once so `out/extension.js` exists
- Check the terminal for TypeScript errors

---

<div align="center">

Built with the [VS Code Extension API](https://code.visualstudio.com/api) · [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)

_Stay in the zone. Keep coding._

</div>
