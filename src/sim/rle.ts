// Run-length pairs: [mask, count, mask, count, ...]
export function encode(masks: number[]): number[] {
  const out: number[] = [];
  for (const m of masks) {
    const n = out.length;
    if (n && out[n - 2] === m) out[n - 1]++;
    else out.push(m, 1);
  }
  return out;
}

export function decode(rle: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < rle.length; i += 2) for (let k = 0; k < rle[i + 1]; k++) out.push(rle[i]);
  return out;
}
