import { useEffect, useReducer } from "react";
import { hostLibrary, type HostLibrary } from "../library";

/** The host library as React state: re-renders on every change of the shared store. */
export function useHostLibrary(instance?:HostLibrary):HostLibrary {
  const library=instance??hostLibrary();
  const [,bump]=useReducer((n:number)=>n+1,0);
  useEffect(()=>library.subscribe(()=>bump()),[library]);
  return library;
}
