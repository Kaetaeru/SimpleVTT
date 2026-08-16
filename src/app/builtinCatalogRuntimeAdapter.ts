import generated from "../generated/builtinCatalog.generated.json";
import type { CatalogEntry } from "./contracts";
import { MockAdapter } from "./mockAdapter";

const cp = <T,>(value:T):T => structuredClone(value);
type GeneratedBuiltinCatalog = {
  rulesProfile:{id:string;version:string};
  entries:CatalogEntry[];
};
const catalog = generated as unknown as GeneratedBuiltinCatalog;
const builtin = catalog.entries.map((entry) => cp(entry));
const oldGetSnapshot = MockAdapter.prototype.getSnapshot;

MockAdapter.prototype.getSnapshot = async function getSnapshotWithCanonicalBuiltinCatalog() {
  const snapshot = await oldGetSnapshot.call(this);
  const nonBuiltin = snapshot.catalog.filter((entry) => entry.scope !== "builtin");
  snapshot.catalog = [...cp(builtin),...nonBuiltin];
  return snapshot;
};

export function generatedBuiltinCatalogForTests() {
  return cp(builtin);
}
