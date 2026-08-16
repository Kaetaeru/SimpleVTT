import "./persistenceContracts";

declare module "./contracts" {
  interface AppSnapshot {
    persistence?: {
      durability:"durable"|"volatile";
      status:"ready"|"recovered"|"error";
      storageRevision:number;
      message?:string;
      authoringDrafts?: {
        durability:"durable"|"volatile";
        status:"ready"|"recovered"|"error"|"stale";
        storageRevision:number;
        message?:string;
      };
    };
  }
}

export {};
