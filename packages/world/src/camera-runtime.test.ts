import { describe, expect, it, vi } from 'vitest';
import {
  ELEVATOR_START_TICKS,
  ElevatorRide,
  ShakeTask,
} from './camera.ts';
import { createActor } from './npc.ts';
import type { FieldSound } from './sound.ts';

function fakeSound(): FieldSound {
  return {
    play: vi.fn(),
    stop: vi.fn(),
  } as unknown as FieldSound;
}

describe('camera runtime snapshots', () => {
  it('resumes a shake at the exact animation phase', () => {
    const originalActor = createActor(
      7,
      null,
      2,
      3,
      0,
      'down',
      0,
      'test:zone',
    );

    const original = new ShakeTask(
      originalActor,
      2,
      90,
      8,
      4,
    );

    original.step();
    original.step();

    const snapshot = original.capture();

    const restoredActor = structuredClone(
      originalActor,
    );

    const restored = ShakeTask.restore(
      restoredActor,
      snapshot,
    );

    expect(restored.capture()).toEqual(snapshot);

    expect(restored.step()).toBe(original.step());
    expect(restoredActor.offset).toEqual(
      originalActor.offset,
    );
  });

  it('resumes an elevator without replaying earlier cues', () => {
    const originalSound = fakeSound();
    const original = new ElevatorRide(
      'up',
      2,
      originalSound,
    );

    for (
      let tick = 0;
      tick < ELEVATOR_START_TICKS + 5;
      tick++
    ) {
      original.step();
    }

    const snapshot = original.capture();
    const restoredSound = fakeSound();
    const restored = ElevatorRide.restore(
      snapshot,
      restoredSound,
    );

    expect(restored.capture()).toEqual(snapshot);
    expect(restored.view()).toEqual(original.view());

    expect(restored.step()).toBe(original.step());
    expect(restored.view()).toEqual(original.view());
    expect(restoredSound.play).not.toHaveBeenCalled();
    expect(restoredSound.stop).not.toHaveBeenCalled();
  });
});
