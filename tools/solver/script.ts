import { IN_L, IN_R, IN_J, IN_JP, IN_WAIT } from '../../src/sim/constants.ts';

// "R12 RJ8 W30": keys L R J W followed by a tick count. Jump press is added on the rising edge.
export function parseScript(src: string, prevJ = 0): number[] {
  const out: number[] = [];
  for (const tok of src.trim().split(/\s+/).filter(Boolean)) {
    const m = /^([LRJW]+)(\d+)$/.exec(tok);
    if (!m) throw new Error(`bad script token ${tok}`);
    let base = IN_WAIT;
    if (m[1].includes('L')) base |= IN_L;
    if (m[1].includes('R')) base |= IN_R;
    const j = m[1].includes('J') ? 1 : 0;
    for (let k = 0; k < Number(m[2]); k++) {
      out.push(base | (j ? IN_J : 0) | (j && !prevJ ? IN_JP : 0));
      prevJ = j;
    }
  }
  return out;
}
