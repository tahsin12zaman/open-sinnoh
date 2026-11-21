import { describe, expect, it } from 'vitest';
import type { Id, Button } from '@opensinnoh/core';
import type { InputFrame } from '@opensinnoh/contracts';
import { FishingTask } from './fishing.ts';

const idle: InputFrame = {
  held: [],
  pressed: [],
  touch: null,
};

function pressed(button: Button): InputFrame {
  return {
    held: [button],
    pressed: [button],
    touch: null,
  };
}

function makeTask(): FishingTask {
  return new FishingTask(
    1,
    {
      species: 'test:FISH' as Id,
      level: 12,
    },
    () => 0,
    () => {},
    () => {},
  );
}

describe('fishing runtime snapshots', () => {
  it('resumes at the exact task phase and timer', () => {
    const original = makeTask();

    for (let tick = 0; tick < 20; tick++) {
      original.step(idle, false);
    }

    const snapshot = original.capture();

    const restored = FishingTask.restore(
      snapshot,
      () => 0,
      () => {},
      () => {},
    );

    expect(restored.capture()).toEqual(snapshot);

    for (let tick = 0; tick < 20; tick++) {
      expect(
        restored.step(idle, false),
      ).toBe(original.step(idle, false));

      expect(restored.capture()).toEqual(
        original.capture(),
      );
    }
  });

  it('preserves a caught encounter', () => {
    const original = makeTask();

    for (let guard = 0; guard < 200; guard++) {
      if (original.capture().phase === 'bite') {
        break;
      }

      original.step(idle, false);
    }

    expect(original.capture().phase).toBe('bite');

    original.step(pressed('a'), false);

    const snapshot = original.capture();

    const restored = FishingTask.restore(
      snapshot,
      () => 0,
      () => {},
      () => {},
    );

    expect(restored.result()).toEqual({
      species: 'test:FISH',
      level: 12,
    });

    expect(restored.capture()).toEqual(snapshot);
  });
});
