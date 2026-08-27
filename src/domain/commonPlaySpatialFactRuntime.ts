export type CommonPlayFactValueType="boolean"|"number"|"string"|"targets"|"destination";

export interface CommonPlayFactDefinition {
  valueType:CommonPlayFactValueType;
}

export type CommonPlayFactRegistry=Record<string,CommonPlayFactDefinition>;

export interface CommonPlayFactQuery {
  id:string;
  fact:string;
  subject?:string;
  authority:"host"|"actor-owner"|"target-owner"|"dm"|"profile";
  visibility:"public"|"actor"|"dm"|"actor-and-dm"|"authority-only";
  unknownPolicy:"block"|"request-authority"|"treat-false"|"unsupported";
}

export type CommonPlayFactValue=boolean|number|string|string[];

export interface CommonPlayFactProviderAnswer {
  status:"answered";
  value:unknown;
}

export type CommonPlayFactProviderResult=CommonPlayFactProviderAnswer|{status:"unknown"}|{status:"unsupported";reason?:string};

export interface CommonPlayFactProvider {
  id:string;
  resolve(query:CommonPlayFactQuery):Promise<CommonPlayFactProviderResult>|CommonPlayFactProviderResult;
}

export interface CommonPlayFactAnswer {
  queryId:string;
  fact:string;
  subject?:string;
  value:CommonPlayFactValue;
  resolutionId:string;
  provenance:
    | {kind:"provider";providerId:string}
    | {kind:"authority";responderId:string}
    | {kind:"policy";policy:"treat-false"};
}

export interface CommonPlayAuthorityFactRequest {
  id:string;
  queryId:string;
  fact:string;
  subject?:string;
  authority:Exclude<CommonPlayFactQuery["authority"],"profile">;
  visibility:CommonPlayFactQuery["visibility"];
  inputType:"boolean"|"number"|"text"|"targets";
  valueType:CommonPlayFactValueType;
  expectedRevision:number;
  resolutionId:string;
  idempotencyKey:string;
}

export type CommonPlayFactResolution=
  | {status:"resolved";answer:CommonPlayFactAnswer}
  | {status:"awaiting-authority";request:CommonPlayAuthorityFactRequest}
  | {status:"blocked";reason:string}
  | {status:"unsupported";reason:string}
  | {status:"rejected";reason:string}
  | {status:"stale";reason:string};

export interface ResolveCommonPlayFactQueryInput {
  registry:CommonPlayFactRegistry;
  query:CommonPlayFactQuery;
  resolutionId:string;
  expectedRevision:number;
  provider?:CommonPlayFactProvider|null;
}

export interface CommonPlayAuthorityFactResponse {
  requestId:string;
  idempotencyKey:string;
  expectedRevision:number;
  responderId:string;
  value:unknown;
}

function normalizeTargets(value:unknown) {
  if(!Array.isArray(value)||value.some((entry)=>typeof entry!=="string"||!entry))return undefined;
  return [...new Set(value)].sort();
}

function normalizeValue(valueType:CommonPlayFactValueType,value:unknown):CommonPlayFactValue|undefined {
  switch(valueType){
    case "boolean": return typeof value==="boolean"?value:undefined;
    case "number": return typeof value==="number"&&Number.isFinite(value)?value:undefined;
    case "string":
    case "destination": return typeof value==="string"&&value.length>0?value:undefined;
    case "targets": return normalizeTargets(value);
  }
}

function interactionInputType(valueType:CommonPlayFactValueType):CommonPlayAuthorityFactRequest["inputType"] {
  switch(valueType){
    case "boolean": return "boolean";
    case "number": return "number";
    case "targets": return "targets";
    case "string":
    case "destination": return "text";
  }
}

function resolved(
  query:CommonPlayFactQuery,
  resolutionId:string,
  value:CommonPlayFactValue,
  provenance:CommonPlayFactAnswer["provenance"],
):CommonPlayFactResolution {
  return {
    status:"resolved",
    answer:{
      queryId:query.id,
      fact:query.fact,
      subject:query.subject,
      value,
      resolutionId,
      provenance,
    },
  };
}

export async function resolveCommonPlayFactQuery(input:ResolveCommonPlayFactQueryInput):Promise<CommonPlayFactResolution> {
  const definition=input.registry[input.query.fact];
  if(!definition)return {status:"unsupported",reason:`unregistered fact: ${input.query.fact}`};

  if(input.provider){
    const providerResult=await input.provider.resolve(input.query);
    if(providerResult.status==="answered"){
      const value=normalizeValue(definition.valueType,providerResult.value);
      if(value===undefined)return {status:"rejected",reason:`invalid ${definition.valueType} answer for fact ${input.query.fact}`};
      return resolved(input.query,input.resolutionId,value,{kind:"provider",providerId:input.provider.id});
    }
    if(providerResult.status==="unsupported"&&input.query.unknownPolicy==="unsupported"){
      return {status:"unsupported",reason:providerResult.reason??`provider does not support fact ${input.query.fact}`};
    }
  }

  switch(input.query.unknownPolicy){
    case "block":
      return {status:"blocked",reason:`fact is unresolved: ${input.query.fact}`};
    case "unsupported":
      return {status:"unsupported",reason:`fact is unsupported: ${input.query.fact}`};
    case "treat-false":
      if(definition.valueType!=="boolean")return {status:"rejected",reason:`treat-false requires a boolean fact: ${input.query.fact}`};
      return resolved(input.query,input.resolutionId,false,{kind:"policy",policy:"treat-false"});
    case "request-authority": {
      if(input.query.authority==="profile")return {status:"unsupported",reason:`profile fact has no manual authority fallback: ${input.query.fact}`};
      const id=`${input.resolutionId}:${input.query.id}`;
      return {
        status:"awaiting-authority",
        request:{
          id,
          queryId:input.query.id,
          fact:input.query.fact,
          subject:input.query.subject,
          authority:input.query.authority,
          visibility:input.query.visibility,
          inputType:interactionInputType(definition.valueType),
          valueType:definition.valueType,
          expectedRevision:input.expectedRevision,
          resolutionId:input.resolutionId,
          idempotencyKey:`${id}:fact-answer`,
        },
      };
    }
  }
}

export function answerCommonPlayFactRequest(
  request:CommonPlayAuthorityFactRequest,
  response:CommonPlayAuthorityFactResponse,
  currentRevision:number,
):CommonPlayFactResolution {
  if(response.requestId!==request.id||response.idempotencyKey!==request.idempotencyKey){
    return {status:"rejected",reason:"fact response identity mismatch"};
  }
  if(response.expectedRevision!==request.expectedRevision||currentRevision!==request.expectedRevision){
    return {status:"stale",reason:`fact response is stale: expected revision ${request.expectedRevision}, current ${currentRevision}`};
  }
  const value=normalizeValue(request.valueType,response.value);
  if(value===undefined)return {status:"rejected",reason:`invalid ${request.valueType} authority answer for fact ${request.fact}`};
  return resolved(
    {
      id:request.queryId,
      fact:request.fact,
      subject:request.subject,
      authority:request.authority,
      visibility:request.visibility,
      unknownPolicy:"request-authority",
    },
    request.resolutionId,
    value,
    {kind:"authority",responderId:response.responderId},
  );
}
