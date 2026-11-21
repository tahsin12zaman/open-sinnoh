import { describe, expect, it, vi } from 'vitest';
import type {
  AudioHost,
} from '@opensinnoh/contracts';
import type {
  Id,
  Pokemon,
} from '@opensinnoh/core';
import {
  HmCutIn,
} from './hm-cut-in.ts';
import {
  SweetScentTask,
  type SweetScentHost,
} from './sweet-scent.ts';

function pokemon(): Pokemon {
  return {
    species: 'test:SPECIES' as Id,
    form: 0,
  } as Pokemon;
}

function audio() {
  return {
    host: {
      playCry: vi.fn(),
    } as unknown as AudioHost,
  };
}

function sweetHost(): SweetScentHost {
  return {
    cutIn: null,
    blocked: () => false,
    zoneEncounters: () => false,
    tileRate: () => false,
    playSe: vi.fn(),
  };
}

describe('field-move runtime snapshots', () => {
  it('restores an HM cut-in without replaying its cry', () => {
    const originalAudio = audio();
    const original = new HmCutIn(
      pokemon(),
      originalAudio.host,
    );

    for (let tick = 0; tick < 20; tick++) {
      original.step();
    }

    const snapshot = original.capture();
    const restoredAudio = audio();

    const restored = HmCutIn.restore(
      pokemon(),
      restoredAudio.host,
      snapshot,
    );

    expect(restored.capture()).toEqual(snapshot);
    expect(
      restoredAudio.host.playCry,
    ).not.toHaveBeenCalled();

    for (let tick = 0; tick < 45; tick++) {
      expect(restored.step()).toBe(original.step());
      expect(restored.capture()).toEqual(
        original.capture(),
      );
    }
  });

  it('resumes Sweet Scent at the exact blend step', () => {
    const originalHost = sweetHost();
    const original = new SweetScentTask(
      originalHost,
    );

    for (let tick = 0; tick < 14; tick++) {
      original.step();
    }

    const snapshot = original.capture();
    const restoredHost = sweetHost();

    const restored = SweetScentTask.restore(
      snapshot,
      restoredHost,
    );

    expect(restored.capture()).toEqual(snapshot);
    expect(restored.alpha()).toBe(original.alpha());

    for (let tick = 0; tick < 80; tick++) {
      expect(restored.step()).toBe(original.step());
      expect(restored.alpha()).toBe(original.alpha());
      expect(restored.capture()).toEqual(
        original.capture(),
      );
    }
  });
});
