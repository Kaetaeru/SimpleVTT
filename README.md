# SimpleVTT

SimpleVTT is a local-first desktop companion for lightweight D&D play. The repository currently contains the rule/content contracts plus the UI Session 01 application prototype.

## UI Session 01

The active implementation branch is `agent/36-ui-session-01` for Issue #36.

### Frontend

- React 19 + TypeScript
- Vite 8
- Korean-first UI
- Application/ViewModel contracts backed by a replaceable `MockAdapter`

### Desktop shell

- Tauri 2
- Desktop-first window
- Real rule resolution, persistence, and networking remain behind the adapter boundary during UI Session 01.

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
