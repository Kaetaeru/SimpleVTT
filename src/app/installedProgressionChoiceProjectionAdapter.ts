import { validateChoiceDefinitions } from "../domain/choiceDefinition";
import { MockAdapter } from "./mockAdapter";
import { installedProgressionChoices } from "./progressionRuntimeAdapter";

const oldGetSnapshot=MockAdapter.prototype.getSnapshot;

MockAdapter.prototype.getSnapshot=async function getSnapshotWithInstalledProgressionChoices(){
  const snapshot=await oldGetSnapshot.call(this);
  if(!snapshot.progressionPlan||!snapshot.levelUpDraft)return snapshot;
  const choices=installedProgressionChoices(snapshot,snapshot.progressionPlan);
  const existing=new Set(snapshot.progressionPlan.choices.map((choice)=>choice.id));
  const additions=choices.filter((choice)=>!existing.has(choice.id));
  if(!additions.length)return snapshot;
  snapshot.progressionPlan.choices.push(...additions);
  const blocking=validateChoiceDefinitions(additions,snapshot.levelUpDraft.progressionSelections??{})
    .filter((issue)=>issue.severity==="blocking")
    .map((issue)=>issue.message);
  snapshot.progressionPlan.blocking.push(...blocking);
  snapshot.levelUpDraft.validation.push(...blocking.map((message)=>({severity:"blocking" as const,message})));
  return snapshot;
};
