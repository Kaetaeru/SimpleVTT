import { clearCampaignSessionSnapshot } from "./campaignRuntimeAdapter";
import { MockAdapter } from "./mockAdapter";

function campaignTimeLabel(absoluteMinute:number){
  const day=Math.floor(absoluteMinute/1440)+1;const minute=absoluteMinute%1440;
  return `Day ${day} ${String(Math.floor(minute/60)).padStart(2,"0")}:${String(minute%60).padStart(2,"0")}`;
}

const previousStopSession=MockAdapter.prototype.stopSession;
MockAdapter.prototype.stopSession=async function stopSessionWithCampaignSummary(){
  const before=await this.getSnapshot();
  const captured=before.campaignSessionSnapshot;
  const wasHost=before.session.role==="host";
  const result=await previousStopSession.call(this);
  if(!captured||!wasHost||result.session.role!=="offline") return result;
  const campaign=(result.campaigns??[]).find((item)=>item.campaignId===captured.campaignId);
  if(!campaign){clearCampaignSessionSnapshot(this);return result;}
  const participantLabels=before.session.participants.map((participant)=>participant.characterName??participant.name).filter(Boolean);
  const summarized=await this.appendCampaignSessionSummary(captured.campaignId,{
    sessionId:captured.sessionId,
    title:before.session.name.trim()||captured.sessionName,
    startedAt:captured.startedAt,
    endedAt:new Date().toISOString(),
    participantLabels,
    calendarBefore:captured.calendar.enabled?campaignTimeLabel(captured.calendarAbsoluteMinuteAtStart):undefined,
    calendarAfter:captured.calendar.enabled?campaignTimeLabel(campaign.calendar.state.absoluteMinute):undefined,
    rationDelta:captured.rations.enabled?(campaign.rations.ledger.balances.ration??0)-captured.rationBalanceAtStart:undefined,
    stashTransactionCount:Math.max(0,campaign.partyStash.revision-captured.stashRevisionAtStart),
  });
  clearCampaignSessionSnapshot(this);
  return {...summarized,campaignSessionSnapshot:null};
};
