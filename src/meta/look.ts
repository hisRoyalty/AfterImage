// The player's chosen look: body colour and hat. Visual only; the sim never reads it.
export const COLOUR_IDS = ['yellow', 'peach', 'pink', 'lime', 'mint', 'sand'];
export const HAT_IDS = ['none', 'cans', 'beanie', 'tophat', 'beret', 'cap', 'bow'];

export interface Look { colour: string; hat: string }

export function defaultLook(): Look {
  return { colour: 'yellow', hat: 'none' };
}

export function cleanLook(x: unknown): Look {
  const o = (typeof x === 'object' && x !== null ? x : {}) as Partial<Look>;
  return {
    colour: typeof o.colour === 'string' && COLOUR_IDS.includes(o.colour) ? o.colour : 'yellow',
    hat: typeof o.hat === 'string' && HAT_IDS.includes(o.hat) ? o.hat : 'none',
  };
}
