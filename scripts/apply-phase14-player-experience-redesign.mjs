import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source,from,to,label){
  if(source.includes(to)) return source;
  if(!source.includes(from)) throw new Error(`missing ${label}`);
  return source.replace(from,to);
}

let app=readFileSync("src/App.tsx","utf8");
app=replaceOnce(app,
  'import { useSimpleVtt } from "./app/AppProvider";\n',
  'import { useSimpleVtt } from "./app/AppProvider";\nimport { CharacterSheetPlayScreen } from "./CharacterSheetPlayScreen";\nimport { ProductionPlayScreen } from "./ProductionPlayScreen";\n',
  "App imports",
);
app=replaceOnce(app,
  '{snapshot.role === "player" && route === "character" && <CharacterSheetScreen onScene={() => setRoute("scene")} onLevelUp={() => setRoute("levelup")} onEdit={() => setRoute("create")} />}',
  '{snapshot.role === "player" && route === "character" && <CharacterSheetPlayScreen onScene={() => setRoute("scene")} onLevelUp={() => setRoute("levelup")} onEdit={() => setRoute("create")} />}',
  "Character Sheet route",
);
app=replaceOnce(app,
  '{route === "scene" && (productionRole === "player" ? <PlayerSceneScreen /> : <DmSceneScreen />)}',
  '{route === "scene" && <ProductionPlayScreen role={productionRole} />}',
  "Play route",
);
writeFileSync("src/App.tsx",app);

let main=readFileSync("src/main.tsx","utf8");
main=replaceOnce(main,
  'import "./visual-dice.css";\n',
  'import "./visual-dice.css";\nimport "./physics-dice.css";\nimport "./player-experience-redesign.css";\n',
  "main CSS imports",
);
writeFileSync("src/main.tsx",main);

const pkg=JSON.parse(readFileSync("package.json","utf8"));
pkg.dependencies={...pkg.dependencies,"cannon-es":"^0.20.0","three":"^0.180.0"};
writeFileSync("package.json",JSON.stringify(pkg,null,2)+"\n");

let workflow=readFileSync(".github/workflows/ui.yml","utf8");
const anchor='      - name: Verify Phase 14 unified production session UX\n        run: npx tsx --test tests/ui/productionSessionWorkspaceRedesign.test.ts\n';
const inserted=anchor+'      - name: Verify Phase 14 tabletop sheet, physics dice, and intent-first play UX\n        run: npx tsx --test tests/ui/physicsDice3DStructure.test.ts tests/ui/characterSheetPlayableUx.test.ts tests/ui/productionPlayIntentUx.test.ts\n';
workflow=replaceOnce(workflow,anchor,inserted,"UI workflow player experience step");
writeFileSync(".github/workflows/ui.yml",workflow);
