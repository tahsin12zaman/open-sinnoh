import { describe, expect, it, vi } from 'vitest';
import type {
  GameState,
} from '@opensinnoh/contracts';
import {
  WateringTask,
  type WateringHost,
} from './berry-patches.ts';
import {
  HealMachine,
  type HealMachineSound,
} from './heal-machine.ts';
import {
  PlatformLift,
} from './platform-lift.ts';

function healSound(): HealMachineSound {
  return {
    ball: vi.fn(),
    fanfare: vi.fn(),
    fanfareWaiting: () => false,
  };
}

function liftData() {
  return {
    lift: 0,
    floor: 'bottom',
    notUsedWhenEntered: true,
  } as NonNullable<GameState['platformLift']>;
}

function wateringHost(): WateringHost {
  return {
    patches: [],
    patchAt: () => null,
    blocked: () => false,
    player: () => ({
      x: 4,
      z: 5,
    }),
    step: vi.fn(),
    stepping: () => false,
    face: vi.fn(),
  };
}

describe('world task runtime snapshots', () => {
  it('resumes healing counters and animation frame', () => {
    const original = new HealMachine(
      3,
      45,
      true,
      healSound(),
    );

    for (let tick = 0; tick < 24; tick++) {
      original.step();
    }

    const snapshot = original.capture();
    const restored = HealMachine.restore(
      snapshot,
      healSound(),
    );

    expect(restored.capture()).toEqual(snapshot);
    expect(restored.view()).toEqual(original.view());

    for (let tick = 0; tick < 100; tick++) {
      const originalDone = original.step();
      const restoredDone = restored.step();

      expect(restoredDone).toBe(originalDone);
      expect(restored.capture()).toEqual(
        original.capture(),
      );

      if (originalDone) break;
    }
  });

  it('resumes a platform lift mid-ride', () => {
    const originalData = liftData();
    const original = new PlatformLift(
      0,
      originalData,
      [100, 200],
    );

    original.trigger();

    for (let tick = 0; tick < 20; tick++) {
      original.step();
    }

    const snapshot = original.capture();
    const restoredData = structuredClone(
      originalData,
    );

    const restored = PlatformLift.restore(
      snapshot,
      restoredData,
    );

    expect(restored.capture()).toEqual(snapshot);
    expect(restored.view()).toEqual(original.view());

    for (let tick = 0; tick < 200; tick++) {
      expect(restored.step()).toEqual(
        original.step(),
      );

      expect(restored.capture()).toEqual(
        original.capture(),
      );

      if (original.done()) break;
    }

    expect(restored.done()).toBe(true);
  });

  it('resumes watering input and timeout state', () => {
    const original = new WateringTask(
      wateringHost(),
      'up',
    );

    original.step([]);

    for (let tick = 0; tick < 30; tick++) {
      original.step([]);
    }

    const snapshot = original.capture();
    const restored = WateringTask.restore(
      snapshot,
      wateringHost(),
    );

    expect(restored.capture()).toEqual(snapshot);

    restored.step(['left']);
    original.step(['left']);

    expect(restored.capture()).toEqual(
      original.capture(),
    );

    expect(restored.done).toBe(original.done);
  });
});
