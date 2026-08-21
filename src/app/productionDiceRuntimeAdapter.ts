import { MockAdapter } from "./mockAdapter";

type DiceInternal={queuedD20:number|null};
type DicePrototype={d20(actionId:string,index?:number):number};

const prototype=MockAdapter.prototype as unknown as DicePrototype;
const previousD20=prototype.d20;

function secureD20() {
  const cryptoApi=globalThis.crypto;
  if (!cryptoApi?.getRandomValues) return Math.floor(Math.random()*20)+1;
  const range=0x1_0000_0000;
  const limit=range-(range%20);
  const value=new Uint32Array(1);
  do cryptoApi.getRandomValues(value); while (value[0]>=limit);
  return (value[0]%20)+1;
}

prototype.d20=function productionD20(actionId:string,index=0) {
  const internal=this as unknown as DiceInternal;
  if (internal.queuedD20!==null) return previousD20.call(this,actionId,index);
  // Node regression suites intentionally retain the deterministic reference replay.
  // The browser/Tauri production runtime uses an actual random authoritative face.
  if (typeof window==="undefined") return previousD20.call(this,actionId,index);
  return secureD20();
};
