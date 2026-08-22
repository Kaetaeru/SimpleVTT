import "./campaignRuntimeAdapter";
import { CampaignCorruptError, CampaignMigrationRequiredError, CampaignSchemaError } from "./campaignPersistence";
import { MockAdapter } from "./mockAdapter";

export type CampaignHydrationIssue = {
  kind:"migration-required"|"schema-unsupported"|"corrupt";
  title:string;
  message:string;
};

type Listener=(issue:CampaignHydrationIssue|null)=>void;

let currentIssue:CampaignHydrationIssue|null=null;
const listeners=new Set<Listener>();

export function campaignHydrationIssue(){
  return currentIssue ? {...currentIssue} : null;
}

export function subscribeCampaignHydrationIssue(listener:Listener){
  listeners.add(listener);
  return ()=>listeners.delete(listener);
}

function publish(issue:CampaignHydrationIssue|null){
  const same=currentIssue?.kind===issue?.kind&&currentIssue?.title===issue?.title&&currentIssue?.message===issue?.message;
  currentIssue=issue ? {...issue} : null;
  if(same) return;
  for(const listener of listeners) listener(currentIssue ? {...currentIssue} : null);
}

function issueFrom(error:unknown):CampaignHydrationIssue|null {
  if(error instanceof CampaignMigrationRequiredError){
    return {
      kind:"migration-required",
      title:"캠페인 데이터 마이그레이션이 필요합니다.",
      message:`현재 앱이 직접 열 수 없는 Campaign schema version ${String(error.schemaVersion)}입니다. 데이터를 덮어쓰지 않았습니다. 호환되는 SimpleVTT 버전 또는 명시적 마이그레이션을 사용한 뒤 다시 시도하세요.`,
    };
  }
  if(error instanceof CampaignSchemaError){
    return {
      kind:"schema-unsupported",
      title:"지원하지 않는 캠페인 저장 형식입니다.",
      message:`${error.message} 데이터를 자동 변환하거나 초기화하지 않았습니다. 저장 파일의 출처와 앱 버전을 확인한 뒤 다시 시도하세요.`,
    };
  }
  if(error instanceof CampaignCorruptError){
    return {
      kind:"corrupt",
      title:"복구 가능한 캠페인 저장 세대를 찾지 못했습니다.",
      message:`${error.message} SimpleVTT는 손상된 데이터를 자동 삭제하지 않습니다. 백업 또는 이전 정상 저장 세대를 복구한 뒤 다시 시도하세요.`,
    };
  }
  return null;
}

const previousGetSnapshot=MockAdapter.prototype.getSnapshot;
MockAdapter.prototype.getSnapshot=async function getSnapshotWithCampaignHydrationIssue(){
  try{
    const snapshot=await previousGetSnapshot.call(this);
    publish(null);
    return snapshot;
  }catch(error){
    const issue=issueFrom(error);
    if(issue) publish(issue);
    throw error;
  }
};
