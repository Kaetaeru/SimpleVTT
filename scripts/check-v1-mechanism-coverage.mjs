import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_FAMILIES=[
  "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
  "AA","AB","AC","AD","AE","AF","AG","AH","AI","AJ",
];

const REQUIRED_FIELDS=[
  "id","family","representativeRules","sourceEvidence","currentState","requiredSemantics","transactionDomain","disposition",
  "implementationEvidence","productionEvidence","identityInvarianceEvidence","connectedEvidenceIfRelevant","persistenceEvidenceIfRelevant","remainingNamedSeams",
];
const FINAL_DISPOSITIONS=new Set(["IMPLEMENTED","PROVEN_UNNEEDED"]);

function strings(value){return Array.isArray(value)&&value.every((entry)=>typeof entry==="string"&&entry.length>0);}

export function checkV1MechanismCoverage(ledger,{gateN=false}={}){
  const errors=[];
  if(ledger?.schemaVersion!=="1") errors.push("ledger.schemaVersion must be 1");
  if(!strings(ledger?.gateNBlockingNamedFallbacks)) errors.push("ledger.gateNBlockingNamedFallbacks must be a string array");
  if(gateN&&ledger?.gateNBlockingNamedFallbacks?.length) errors.push("ledger.gateNBlockingNamedFallbacks must be empty for Gate N");
  if(!Array.isArray(ledger?.rows)) return {ok:false,errors:[...errors,"ledger.rows must be an array"],summary:null};
  const seenIds=new Set();
  const seenFamilies=new Set();
  for(const [index,row] of ledger.rows.entries()){
    const label=`rows[${index}]`;
    if(!row||typeof row!=="object") {errors.push(`${label} must be an object`);continue;}
    for(const field of REQUIRED_FIELDS) if(!(field in row)) errors.push(`${label}.${field} is required`);
    if(typeof row.id!=="string"||!row.id) errors.push(`${label}.id must be non-empty`);
    else if(seenIds.has(row.id)) errors.push(`duplicate row id: ${row.id}`);
    else seenIds.add(row.id);
    if(typeof row.family!=="string"||!REQUIRED_FAMILIES.includes(row.family)) errors.push(`${label}.family is invalid`);
    else if(seenFamilies.has(row.family)) errors.push(`duplicate family: ${row.family}`);
    else seenFamilies.add(row.family);
    for(const field of ["representativeRules","sourceEvidence","requiredSemantics"]){
      if(!strings(row[field])||row[field].length===0) errors.push(`${label}.${field} must contain non-empty strings`);
    }
    for(const field of ["implementationEvidence","productionEvidence","identityInvarianceEvidence","connectedEvidenceIfRelevant","persistenceEvidenceIfRelevant","remainingNamedSeams"]){
      if(!strings(row[field])) errors.push(`${label}.${field} must be a string array`);
    }
    if(typeof row.currentState!=="string"||!row.currentState) errors.push(`${label}.currentState must be non-empty`);
    if(typeof row.transactionDomain!=="string"||!row.transactionDomain) errors.push(`${label}.transactionDomain must be non-empty`);
    if(!FINAL_DISPOSITIONS.has(row.disposition)&&row.disposition!=="INCOMPLETE") errors.push(`${label}.disposition is invalid: ${row.disposition}`);
    if(gateN&&FINAL_DISPOSITIONS.has(row.disposition)){
      for(const field of ["implementationEvidence","productionEvidence","identityInvarianceEvidence"]){
        if(row[field].length===0) errors.push(`${label}.${field} is required for Gate N`);
      }
      if(row.connectedRelevant===true&&row.connectedEvidenceIfRelevant.length===0) errors.push(`${label}.connectedEvidenceIfRelevant is required for Gate N`);
      if(row.persistenceRelevant===true&&row.persistenceEvidenceIfRelevant.length===0) errors.push(`${label}.persistenceEvidenceIfRelevant is required for Gate N`);
    }
    if(gateN&&!FINAL_DISPOSITIONS.has(row.disposition)) errors.push(`${label} is not Gate-N complete: ${row.disposition}`);
  }
  for(const family of REQUIRED_FAMILIES) if(!seenFamilies.has(family)) errors.push(`missing required family: ${family}`);
  for(const family of seenFamilies) if(!REQUIRED_FAMILIES.includes(family)) errors.push(`unexpected family: ${family}`);
  const summary={
    total:ledger.rows.length,
    implemented:ledger.rows.filter((row)=>row.disposition==="IMPLEMENTED").length,
    provenUnneeded:ledger.rows.filter((row)=>row.disposition==="PROVEN_UNNEEDED").length,
    incomplete:ledger.rows.filter((row)=>!FINAL_DISPOSITIONS.has(row.disposition)).length,
  };
  return {ok:errors.length===0,errors,summary};
}

const self=fileURLToPath(import.meta.url);
if(resolve(process.argv[1]??"")===self){
  const repoRoot=resolve(dirname(self),"..");
  const ledger=JSON.parse(readFileSync(resolve(repoRoot,"docs/rules/v1-mechanism-coverage-ledger.json"),"utf8"));
  const gateN=process.argv.includes("--gate-n");
  const result=checkV1MechanismCoverage(ledger,{gateN});
  if(!result.ok){
    console.error(`V1 mechanism coverage ${gateN?"Gate N ":""}check failed:`);
    for(const error of result.errors) console.error(`- ${error}`);
    process.exitCode=1;
  }else{
    const {total,implemented,provenUnneeded,incomplete}=result.summary;
    console.log(`V1 mechanism coverage OK: total=${total} IMPLEMENTED=${implemented} PROVEN_UNNEEDED=${provenUnneeded} INCOMPLETE=${incomplete}${gateN?" Gate-N-ready":""}`);
  }
}
