import type { CharacterPortraitV1 } from "../../app/characterPortraitContracts";
import { HANDOUT_IMAGE_MAX_BYTES, PORTRAIT_IMAGE_MAX_BYTES, parseLocalImageDataUrl, readLocalImageFile, type LocalImageAssetV1 } from "../../app/localImageAsset";

/** A picked file becomes a token portrait: read, then shrunk to at most `edge` px so the wire and the saved library stay small. */
export async function readPortraitFile(file:File,edge=384):Promise<CharacterPortraitV1> {
  const asset=await readLocalImageFile(file,PORTRAIT_IMAGE_MAX_BYTES);
  const shrunk=await shrinkDataUrl(asset.dataUrl,edge).catch(()=>null);
  return {asset:shrunk?parseLocalImageDataUrl(shrunk,asset.fileName,PORTRAIT_IMAGE_MAX_BYTES):asset,focalX:0.5,focalY:0.35};
}

/** A handout image: read, shrunk to at most 1280 px (the wire carries it to every peer). */
export async function readHandoutFile(file:File,edge=1280):Promise<LocalImageAssetV1> {
  const asset=await readLocalImageFile(file,HANDOUT_IMAGE_MAX_BYTES);
  const shrunk=await shrinkDataUrl(asset.dataUrl,edge).catch(()=>null);
  return shrunk?parseLocalImageDataUrl(shrunk,asset.fileName,HANDOUT_IMAGE_MAX_BYTES):asset;
}

async function shrinkDataUrl(dataUrl:string,edge:number):Promise<string|null> {
  if(typeof document==="undefined") return null;
  const image=await new Promise<HTMLImageElement>((resolve,reject)=>{ const element=new Image(); element.onload=()=>resolve(element); element.onerror=()=>reject(new Error("이미지를 열지 못했습니다.")); element.src=dataUrl; });
  const scale=Math.min(1,edge/Math.max(image.naturalWidth,image.naturalHeight));
  if(scale>=1&&dataUrl.length<200_000) return null;
  const canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const context=canvas.getContext("2d");
  if(!context) return null;
  context.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas.toDataURL("image/jpeg",0.82);
}
