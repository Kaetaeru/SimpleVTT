import type { CharacterCreateDraft } from "./contracts";
import { META, classIdFromName, type Meta } from "./srdCatalogBridge";
export { META, type Meta };
export const classId = (draft: CharacterCreateDraft) => classIdFromName(draft.className);
export const meta = (draft: CharacterCreateDraft) => META[classId(draft)] ?? META["dnd.srd521.class.fighter"];
