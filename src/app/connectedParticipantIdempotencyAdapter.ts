import {
  HostSessionLedger,
  type ConnectedEventPayload,
  type ConnectedSessionEvent,
  type HostEventCandidate,
} from "./connectedSessionProtocol";

type ParticipantPayload=Extract<ConnectedEventPayload,{kind:"participant"}>;

function sameParticipantState(left:ParticipantPayload,right:ParticipantPayload) {
  return left.participantId===right.participantId
    && left.participantName===right.participantName
    && left.characterName===right.characterName
    && left.state===right.state
    && left.ready===right.ready;
}

const previousCommitHostEvent=HostSessionLedger.prototype.commitHostEvent;

HostSessionLedger.prototype.commitHostEvent=function commitHostEventIdempotently(candidate:HostEventCandidate):ConnectedSessionEvent {
  if (candidate.payload.kind==="participant") {
    const participant=candidate.payload;
    const latestForParticipant=this.eventsAfter(0)
      .reverse()
      .find((event)=>event.payload.kind==="participant"&&event.payload.participantId===participant.participantId);
    if (latestForParticipant?.payload.kind==="participant"&&sameParticipantState(latestForParticipant.payload,participant)) {
      return latestForParticipant;
    }
  }
  return previousCommitHostEvent.call(this,candidate);
};
