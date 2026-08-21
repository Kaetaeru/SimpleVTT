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
pkg.devDependencies={...pkg.devDependencies,"@types/three":"^0.180.0"};
writeFileSync("package.json",JSON.stringify(pkg,null,2)+"\n");