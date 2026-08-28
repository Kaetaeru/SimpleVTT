import profile from "../../rules/profiles/dnd.srd-5.2.1.profile.json";
import type { RulesProfileLike } from "../domain/profileEngine";

/** Runtime view of the persisted active RulesProfile. Keep policy in profile data, not feature adapters. */
export const ACTIVE_RULES_PROFILE_RUNTIME=profile as unknown as RulesProfileLike;
