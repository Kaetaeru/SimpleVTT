# SimpleVTT

SimpleVTT is a local-first desktop companion for lightweight D&D play. The repository contains the rule/content contracts plus the UI Session 01 application prototype.

## UI Session 01

Active issue: #36  
Active branch: `agent/36-ui-session-01`

The UI is intentionally backed by a replaceable application adapter during this gate:

```text
React UI
   ↓
Application/ViewModel contracts
   ↓
MockAdapter          ← UI Session 01

later

React UI
   ↓
Application/ViewModel contracts
   ↓
Real adapters        ← rules/domain, persistence, networking
```

### Frontend

- React 19 + TypeScript
- Vite 8
- Korean-first UI
- Player and DM surfaces render the same entity/action model with different authority
- Character creation supports standard array, 4d6-drop-lowest mock rolls, 27-point buy, and explicit custom scores
- Level-up uses a reviewed `ProgressionDraft` flow

### Desktop shell

- Tauri 2
- Desktop-first window
- Rule resolution, production persistence, and real networking remain out of the React components during UI Session 01

### Run the prototype

Requirements:

- Node.js 20.19+ or 22.12+
- Rust stable MSVC toolchain on Windows
- Tauri Windows prerequisites (WebView2 and Visual Studio C++ build tools)

```powershell
npm install
npm run tauri:dev
```

For browser-only UI iteration:

```powershell
npm install
npm run dev
```

Reference-only state controls are intentionally hidden from normal Player/DM screens. Press `Ctrl+Shift+D` to open the developer dock and switch reference role, session mode, current actor, queued d20 value, or connection state.

## Repository contracts

The machine-readable rules and content contracts remain under `rules/`, `content/`, `schemas/`, `templates/`, `examples/`, and `docs/`.
