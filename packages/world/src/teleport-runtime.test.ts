import { describe, expect, it, vi } from 'vitest';
import type {
  AudioHost,
  Facing,
  RuntimeHmCutInSnapshot,
} from '@opensinnoh/contracts';
import type {
  Id,
  Pokemon,
} from '@opensinnoh/core';
import { HmCutIn } from './hm-cut-in.ts';
import {
  TeleportTask,
  type TeleportHost,
} from './teleport.ts';

function cutIn(
  snapshot?: RuntimeHmCutInSnapshot,
): HmCutIn {
  const mon = {
    species: 'test:SPECIES' as Id,
    form: 0,
  } as Pokemon;

  const sound = {
    playCry: vi.fn(),
  } as unknown as AudioHost;

  return snapshot
    ? HmCutIn.restore(mon, sound, snapshot)
    : new HmCutIn(mon, sound);
}

function host(
  cutInValue = cutIn(),
) {
  const facings: Facing[] = [];

  const value: TeleportHost = {
    cutIn: cutInValue,
    se: vi.fn(),
    fade: vi.fn(),
    fadeDone: () => true,
    face: (facing) => {
      facings.push(facing);
    },
    changeMap: vi.fn(),
  };

  return {
    value,
    facings,
  };
}

describe('teleport runtime snapshots', () => {
  it('resumes its spin, zoom and phase exactly', () => {
    const originalHost = host();
    const original = new TeleportTask(
      originalHost.value,
      {
        slot: 2,
        destination: {
          zone: 'test:DESTINATION' as Id,
          x: 8,
          z: 12,
          facing: 'left',
        },
        kind: 'teleport',
      },
    );

    for (let tick = 0; tick < 85; tick++) {
      original.tick();
    }

    const snapshot = original.capture();
    const restoredHost = host(
      cutIn(snapshot.cutIn),
    );

    const restored = TeleportTask.restore(
      snapshot,
      restoredHost.value,
    );

    expect(restored.capture()).toEqual(snapshot);
    expect(restored.cameraDistance()).toBe(
      original.cameraDistance(),
    );

    for (let tick = 0; tick < 160; tick++) {
      originalHost.facings.length = 0;
      restoredHost.facings.length = 0;

      original.tick();
      restored.tick();

      expect(restoredHost.facings).toEqual(
        originalHost.facings,
      );

      expect(restored.cameraDistance()).toBe(
        original.cameraDistance(),
      );

      expect(restored.capture()).toEqual(
        original.capture(),
      );

      if (original.done || restored.done) {
        expect(restored.done).toBe(original.done);
        break;
      }
    }

    expect(original.done).toBe(true);
    expect(restored.done).toBe(true);
  });
});
