import type { TakeLog } from '../sim/types.ts';

export interface Ghost { i: number[]; k: number; h: string }

export function logsHash(logs: TakeLog[]): string {
  const s = JSON.stringify(logs);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

// Keeps failed takes whose tracks at the time were a prefix of the final solution, so they replay exactly.
export function keepGhosts(pending: Ghost[], finalLogs: TakeLog[], max = 12): string[] {
  const prefix: string[] = [];
  for (let k = 0; k <= finalLogs.length; k++) prefix.push(logsHash(finalLogs.slice(0, k)));
  return pending.filter((g) => prefix[g.k] === g.h).slice(-max).map((g) => JSON.stringify({ i: g.i, k: g.k }));
}
