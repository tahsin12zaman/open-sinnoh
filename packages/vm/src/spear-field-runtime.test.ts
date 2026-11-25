import type {
  SpearPillarAssets,
} from '@opensinnoh/contracts';
import { describe, expect, it } from 'vitest';
import { Runner } from './runner.ts';
import {
  SpearFieldEffects,
} from './spear-field.ts';
import {
  Driver,
  loadFixture,
  newState,
} from './test-support.ts';

const fixture = loadFixture();

function setup() {
  const driver = new Driver(
    fixture.registries,
    fixture.labels,
    newState(),
  );

  const data = {
    models: {
      '6': {
        frames: 48,
      },
    },
  } as unknown as SpearPillarAssets;

  return {
    driver,
    runner: driver.vm as Runner,
    data,
  };
}

describe('Spear Pillar field-effect snapshots', () => {
  it('resumes the chain animation exactly', () => {
    const { runner, data } = setup();

    const original = new SpearFieldEffects(
      runner,
      data,
      0,
    );

    for (let tick = 0; tick < 19; tick++) {
      original.step();
    }

    const snapshot =
      original.captureRuntimeSnapshot();

    const restored =
      SpearFieldEffects.fromRuntimeSnapshot(
        runner,
        data,
        snapshot,
      );

    expect(
      restored.captureRuntimeSnapshot(),
    ).toEqual(snapshot);

    for (let tick = 0; tick < 40; tick++) {
      original.step();
      restored.step();

      expect(
        restored.captureRuntimeSnapshot(),
      ).toEqual(
        original.captureRuntimeSnapshot(),
      );
    }

    expect(original.done()).toBe(true);
    expect(restored.done()).toBe(true);
  });

  it('rejects malformed runtime counters', () => {
    const { runner, data } = setup();

    const original = new SpearFieldEffects(
      runner,
      data,
      0,
    );

    const snapshot =
      original.captureRuntimeSnapshot();

    expect(() =>
      SpearFieldEffects.fromRuntimeSnapshot(
        runner,
        data,
        {
          ...snapshot,
          tick: -1,
        },
      ),
    ).toThrow(/malformed/i);
  });
});
