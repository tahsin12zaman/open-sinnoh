import { describe, expect, it } from 'vitest';
import { Sky } from './sky.ts';
import { CascadeMount } from './surf.ts';

describe('Distortion World animator runtime snapshots', () => {
  it('restores the exact sky cloud accumulators', () => {
    const original = new Sky('giratina-room-dark');
    for (let i = 0; i < 37; i++) original.step(120 + i);
    original.fixedDarkness = 7;

    const snapshot = original.captureRuntimeSnapshot();
    const restored = new Sky('giratina-room-dark');

    expect(restored.validateRuntimeSnapshot(snapshot)).toBeNull();
    restored.restoreRuntimeSnapshot(snapshot);
    expect(restored.captureRuntimeSnapshot()).toEqual(snapshot);
    expect(restored.view()).toEqual(original.view());
  });

  it('rejects a sky snapshot from a different room sky kind', () => {
    const source = new Sky('giratina-room');
    const target = new Sky('normal');
    expect(target.validateRuntimeSnapshot(source.captureRuntimeSnapshot())).not.toBeNull();
  });

  it('restores cascade fixed-point accumulators and camera counters', () => {
    const original = new CascadeMount(true);
    for (let i = 0; i < 13; i++) original.turnIn();
    original.ride(1, 4.25);
    original.ride(2, 5.5);

    const snapshot = original.captureRuntimeSnapshot();
    const restored = new CascadeMount(true);

    expect(restored.validateRuntimeSnapshot(snapshot)).toBeNull();
    restored.restoreRuntimeSnapshot(snapshot);
    expect(restored.captureRuntimeSnapshot()).toEqual(snapshot);
    expect(restored.pose()).toEqual(original.pose());
  });

  it('rejects a cascade snapshot with a different direction', () => {
    const snapshot = new CascadeMount(true).captureRuntimeSnapshot();
    expect(new CascadeMount(false).validateRuntimeSnapshot(snapshot)).not.toBeNull();
  });
});
