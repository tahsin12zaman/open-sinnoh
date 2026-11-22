import { describe, expect, it } from 'vitest';
import { validateEffectsRuntimeSnapshot } from './effects.ts';

describe('field effects runtime snapshots', () => {
  const base = {
    nextKey: 2,
    live: [{
      key: 1,
      effect: 'FIELD_EFFECT_TEST',
      renderer: 11,
      anim: 'tracks',
      tick: 4,
      ticks: 32,
      cur: [1, 2, 3],
      prev: [0, 2, 3],
      follow: false,
      facing: 'left',
    }],
  };

  it('accepts a timed effect with animation progress', () => {
    expect(validateEffectsRuntimeSnapshot(base)).toBe(true);
  });

  it('accepts an indefinite held effect with a stable occupant key', () => {
    expect(validateEffectsRuntimeSnapshot({
      nextKey: 2,
      live: [{
        key: 1, effect: 'FIELD_EFFECT_GRASS', renderer: 19, anim: 'rustle',
        tick: 2, ticks: null, cur: [1, 2, 3], prev: [1, 2, 3], follow: false,
        held: { occupant: 'actor:4', x: 1, z: 3, clip: 12 },
      }],
    })).toBe(true);
  });

  it('rejects duplicate keys, invalid timing, malformed vectors and missing occupant identities', () => {
    expect(validateEffectsRuntimeSnapshot({ ...base, nextKey: 1 })).toBe(false);
    expect(validateEffectsRuntimeSnapshot({ ...base, live: [...base.live, base.live[0]] })).toBe(false);
    expect(validateEffectsRuntimeSnapshot({
      ...base, live: [{ ...base.live[0], tick: 32 }],
    })).toBe(false);
    expect(validateEffectsRuntimeSnapshot({
      ...base, live: [{ ...base.live[0], cur: [1, Number.NaN, 3] }],
    })).toBe(false);
    expect(validateEffectsRuntimeSnapshot({
      nextKey: 2,
      live: [{ ...base.live[0], ticks: null, held: { occupant: '', x: 1, z: 2, clip: 12 } }],
    })).toBe(false);
  });
});
