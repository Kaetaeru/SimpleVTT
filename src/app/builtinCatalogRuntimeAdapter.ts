import generated from "../generated/builtinCatalog.generated.json";
import type { CatalogEntry } from "./contracts";

const cp = <T,>(value:T):T => structuredClone(value);
type GeneratedBuiltinCatalog = {
  rulesProfile:{id:string;version:string};
  entries:CatalogEntry[];
};
const catalog = generated as unknown as GeneratedBuiltinCatalog;
const builtin = catalog.entries.map((entry) => cp(entry));

export function generatedBuiltinCatalog() {
  return cp(builtin);
}

export function generatedBuiltinCatalogForTests() {
  return generatedBuiltinCatalog();
}
