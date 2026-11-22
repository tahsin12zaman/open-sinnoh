import { describe, expect, it } from 'vitest';
import { captureActorSnapshot, restoreActorSnapshot, validateActorSnapshot } from './actor-snapshot.ts';
import { createActor, walk, type Actor } from './npc.ts';

function actor(): Actor {
  const a = createActor(7, 'NPC_TEST', 12, 9, 0, 'down', 3, 'TEST_ZONE');
  a.type = {
    originX: 12, originZ: 9, rng: { seed: 0x12345678 }, initial: 'down',
    phase: 'delay', timer: 17, returning: false, loop: 2,
  };
  a.script = { steps: [{ op: 'walk', count: 8 }], index: 0, done: 0 };
  walk(a, 'right', 8, 'walk', 'type');
  a.motion!.elapsed = 3;
  a.frames.frame = 11;
  a.frames.pattern = 2;
  a.cur = [123, 4, 456];
  a.prev = [120, 4, 456];
  return a;
}

describe('actor runtime snapshots', () => {
  it('round-trips in-progress motion, AI RNG, script cursor and billboard state without aliases', () => {
    const source = actor();
    const snapshot = captureActorSnapshot(source);
    source.motion!.elapsed = 7;
    source.type!.rng.seed = 1;
    source.frames.frame = 0;

    const target = createActor(7, 'NPC_TEST', 0, 0, 0, 'up', 0, 'TEST_ZONE');
    restoreActorSnapshot(target, snapshot);

    expect(target).toEqual({
      ...source,
      motion: { ...source.motion!, elapsed: 7 },
      type: { ...source.type!, rng: { seed: 1 } },
      frames: { ...source.frames, frame: 0 },
      x: 13,
      z: 9,
      cur: [123, 4, 456],
      prev: [120, 4, 456],
    });
    expect(target.motion?.elapsed).toBe(3);
    expect(target.type?.rng.seed).toBe(0x12345678);
    expect(target.frames.frame).toBe(11);
    expect(target.motion).not.toBe(snapshot.motion);
    expect(target.type).not.toBe(snapshot.type);
  });

  it('rejects malformed actor state before restoration', () => {
    const snapshot = captureActorSnapshot(actor());
    expect(validateActorSnapshot(snapshot)).toBe(true);
    expect(validateActorSnapshot({ ...snapshot, x: Number.NaN })).toBe(false);
    expect(validateActorSnapshot({ ...snapshot, cur: [0, 1] })).toBe(false);
  });
});
