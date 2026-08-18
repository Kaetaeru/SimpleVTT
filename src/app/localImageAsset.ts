export const PORTRAIT_IMAGE_MAX_BYTES=2*1024*1024;
export const HANDOUT_IMAGE_MAX_BYTES=4*1024*1024;
export const LOCAL_IMAGE_ACCEPT="image/png,image/jpeg,image/webp";

export type LocalImageMimeType="image/png"|"image/jpeg"|"image/webp";

export interface LocalImageAssetV1 {
  mimeType:LocalImageMimeType;
  dataUrl:string;
  byteLength:number;
  fileName?:string;
}

const MIME_TYPES=new Set<LocalImageMimeType>(["image/png","image/jpeg","image/webp"]);
const DATA_URL=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

function decodedBase64Bytes(base64:string) {
  const padding=base64.endsWith("==")?2:base64.endsWith("=")?1:0;
  return Math.floor(base64.length*3/4)-padding;
}

function safeFileName(value:unknown) {
  if (value===undefined) return undefined;
  if (typeof value!=="string") throw new Error("이미지 파일 이름이 올바르지 않습니다.");
  const trimmed=value.trim();
  if (!trimmed||trimmed.length>255) throw new Error("이미지 파일 이름이 올바르지 않습니다.");
  return trimmed;
}

export function parseLocalImageDataUrl(dataUrl:string,fileName:string|undefined,maxBytes:number):LocalImageAssetV1 {
  if (typeof dataUrl!=="string") throw new Error("이미지 데이터가 문자열이 아닙니다.");
  const match=DATA_URL.exec(dataUrl);
  if (!match) throw new Error("PNG, JPEG, WebP 이미지만 사용할 수 있습니다.");
  const mimeType=match[1] as LocalImageMimeType;
  if (!MIME_TYPES.has(mimeType)) throw new Error("지원하지 않는 이미지 형식입니다.");
  const byteLength=decodedBase64Bytes(match[2]);
  if (byteLength<=0) throw new Error("빈 이미지는 사용할 수 없습니다.");
  if (!Number.isInteger(maxBytes)||maxBytes<=0||byteLength>maxBytes) throw new Error(`이미지가 허용 크기 ${Math.floor(maxBytes/1024/1024)} MiB를 초과합니다.`);
  return {mimeType,dataUrl,byteLength,fileName:safeFileName(fileName)};
}

export function isLocalImageAssetV1(value:unknown,maxBytes:number):value is LocalImageAssetV1 {
  if (!value||typeof value!=="object"||Array.isArray(value)) return false;
  const raw=value as Record<string,unknown>;
  if (typeof raw.mimeType!=="string"||typeof raw.dataUrl!=="string"||!Number.isInteger(raw.byteLength)) return false;
  try {
    const parsed=parseLocalImageDataUrl(raw.dataUrl,raw.fileName as string|undefined,maxBytes);
    return parsed.mimeType===raw.mimeType&&parsed.byteLength===raw.byteLength;
  } catch {
    return false;
  }
}

export async function readLocalImageFile(file:File,maxBytes:number):Promise<LocalImageAssetV1> {
  if (!MIME_TYPES.has(file.type as LocalImageMimeType)) throw new Error("PNG, JPEG, WebP 이미지만 사용할 수 있습니다.");
  if (file.size<=0) throw new Error("빈 이미지는 사용할 수 없습니다.");
  if (file.size>maxBytes) throw new Error(`이미지가 허용 크기 ${Math.floor(maxBytes/1024/1024)} MiB를 초과합니다.`);
  const dataUrl=await new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error("이미지 파일을 읽지 못했습니다."));
    reader.onload=()=>typeof reader.result==="string"?resolve(reader.result):reject(new Error("이미지 파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
  const parsed=parseLocalImageDataUrl(dataUrl,file.name,maxBytes);
  if (parsed.mimeType!==file.type||parsed.byteLength!==file.size) throw new Error("이미지 파일 메타데이터가 실제 데이터와 일치하지 않습니다.");
  return parsed;
}
