import { createContext, useContext } from "react";
import type { TableCommand } from "../commands";
import type { TableSessionFacade } from "../facade";
import type { Outcome } from "../runtime";

/** The table facade the workspace screens talk to (TABLE_RUNTIME.md §6); null outside a V2 table. */
export const TableFacadeContext=createContext<TableSessionFacade|null>(null);

export function useTableFacade():TableSessionFacade|null { return useContext(TableFacadeContext); }

/** Dispatch a table command from a screen; the facade publishes the merged snapshot to the provider. */
export function useTableDispatch():(command:TableCommand)=>Promise<Outcome> {
  const facade=useTableFacade();
  return async(command)=>{
    if(!facade) return {status:"refused",refusal:{code:"no-table",message:"테이블 런타임이 없습니다.",id:0}} as Outcome;
    return facade.dispatch(command);
  };
}
