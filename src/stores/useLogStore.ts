export type LogLevel="info"|"warning"|"error";
export type LogEntry={level:LogLevel;title:string;detail?:string;at:number};
const entries:LogEntry[]=[];
export function log(level:LogLevel,title:string,detail?:string){entries.push({level,title,detail,at:Date.now()});if(entries.length>100)entries.shift();}
export function getLogs(){return entries.slice();}
