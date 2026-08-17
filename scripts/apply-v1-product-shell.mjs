import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`missing ${label}`);
  return source.replace(from, to);
}

function replacePattern(source, pattern, to, label) {
  if (source.includes(to)) return source;
  if (!pattern.test(source)) throw new Error(`missing ${label}`);
  return source.replace(pattern, to);
}

let contracts = readFileSync("src/app/contracts.ts", "utf8");
contracts = replaceOnce(
  contracts,
  'export type AppRoute =\n  | "characters"',
  'export type AppRoute =\n  | "home"\n  | "characters"',
  "home route",
);
contracts = replaceOnce(
  contracts,
  '  | "session"\n  | "settings";',
  '  | "session"\n  | "content"\n  | "settings";',
  "content route",
);
writeFileSync("src/app/contracts.ts", contracts);

let app = readFileSync("src/App.tsx", "utf8");
app = replaceOnce(
  app,
  'import { ProductionPlayScreen } from "./ProductionPlayScreen";\n',
  'import { ProductionPlayScreen } from "./ProductionPlayScreen";\nimport { V1HomeScreen } from "./V1HomeScreen";\nimport { V1ContentScreen } from "./V1ContentScreen";\n',
  "v1 screen imports",
);
app = replaceOnce(
  app,
  'import { V1ContentScreen } from "./V1ContentScreen";\n',
  'import { V1ContentScreen } from "./V1ContentScreen";\nimport { CharacterCreateScreenV10 } from "./CharacterCreateV10";\n',
  "explicit CharacterCreateV10 import",
);
app = replaceOnce(app, 'const [route, setRoute] = useState<AppRoute>("characters");', 'const [route, setRoute] = useState<AppRoute>("home");', "initial Home route");
app = replacePattern(
  app,
  /  const playerNav: Array<\[AppRoute, string, string\]> = \[[\s\S]*?  const connectedSession=/,
  `  const nav: Array<[AppRoute, string, string]> = [
    ["home", "홈", "⌂"],
    ["characters", "캐릭터", "◉"],
    ["session", "세션", "⌁"],
    ["content", "콘텐츠", "＋"],
    ["catalog", "규칙", "▤"],
    ["settings", "설정", "⚙"],
  ];
  const connectedSession=`,
  "stable v1 navigation",
);
app = replacePattern(
  app,
  /    <div className="app-shell">\n      <aside className="rail">[\s\S]*?      <section className="workspace">/,
  `    <div className="app-shell v1-shell">
      <aside className="v1-sidebar">
        <button className="v1-brand" onClick={() => setRoute("home")} aria-label="SimpleVTT 홈">
          <span className="v1-brand-mark">S</span>
          <span className="v1-brand-copy"><strong>SimpleVTT</strong><small>TABLETOP PLAY</small></span>
        </button>
        <nav className="v1-nav" aria-label="주요 메뉴">
          {nav.map(([id, label, icon]) => (
            <button key={id} className={route === id || (id === "characters" && ["character", "create", "levelup"].includes(route)) ? "active" : ""} onClick={() => setRoute(id)}>
              <span className="v1-nav-icon">{icon}</span><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="v1-sidebar-spacer" />
        <div className="v1-sidebar-context">
          {liveSession && <button className="primary" onClick={() => setRoute("scene")}>플레이로 돌아가기</button>}
          {connectedSession && <div className={\`v1-sidebar-status \${snapshot.connectionState}\`}><i/><span>{connectionLabel(snapshot.connectionState)}</span></div>}
        </div>
      </aside>

      <section className="workspace">`,
  "v1 sidebar shell",
);
app = replacePattern(
  app,
  /        <header className="topbar">[\s\S]*?        <\/header>/,
  `        <header className="v1-topbar">
          <div className="v1-topbar-title"><span>SimpleVTT</span><strong>{topTitle(route, productionRole)}</strong></div>
          <div className="v1-topbar-actions">
            {liveSession && route !== "scene" && <button className="primary" onClick={() => setRoute("scene")}>플레이로 돌아가기</button>}
            {liveSession && <small>{snapshot.sessionMode === "initiative" ? \`이니셔티브 · \${snapshot.scene.round}라운드\` : "자유 진행"}</small>}
          </div>
        </header>`,
  "v1 topbar",
);
app = replaceOnce(
  app,
  '          {snapshot.edgeState !== "normal" && <EdgeBanner />}\n',
  '          {snapshot.edgeState !== "normal" && <EdgeBanner />}\n          {route === "home" && <V1HomeScreen onCharacters={() => setRoute("characters")} onCreateCharacter={() => setRoute("create")} onSession={() => setRoute("session")} onContent={() => setRoute("content")} onRules={() => setRoute("catalog")} onPlay={() => setRoute("scene")} />}\n',
  "Home composition",
);
app = replaceOnce(
  app,
  '          {snapshot.role === "player" && route === "create" && <CharacterCreateScreen onDone={() => setRoute("character")} onCancel={() => setRoute("characters")} />}\n',
  '          {snapshot.role === "player" && route === "create" && <CharacterCreateScreenV10 onDone={() => setRoute("character")} onCancel={() => setRoute("characters")} />}\n',
  "explicit CharacterCreateV10 route",
);
app = replaceOnce(
  app,
  '          {route === "catalog" && <CatalogScreen />}\n',
  '          {route === "content" && <V1ContentScreen />}\n          {route === "catalog" && <CatalogScreen />}\n',
  "Content composition",
);
app = replaceOnce(
  app,
  'function topTitle(route: AppRoute, role: "player" | "dm") {\n  if (route === "characters") return "캐릭터";',
  'function topTitle(route: AppRoute, role: "player" | "dm") {\n  if (route === "home") return "홈";\n  if (route === "characters") return "캐릭터";',
  "Home title",
);
app = replaceOnce(
  app,
  '  if (route === "session") return "세션";\n  return "설정";',
  '  if (route === "session") return "세션";\n  if (route === "content") return "콘텐츠 · 애드온";\n  return "설정";',
  "Content title",
);
writeFileSync("src/App.tsx", app);

let main = readFileSync("src/main.tsx", "utf8");
main = replaceOnce(
  main,
  'import "./production-ux-redesign.css";\n',
  'import "./production-ux-redesign.css";\nimport "./v1-product-shell.css";\n',
  "v1 product CSS",
);
writeFileSync("src/main.tsx", main);
