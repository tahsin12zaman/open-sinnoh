import {
  describe,
  expect,
  it,
} from 'vitest';
import { ParticleCamera } from './camera.ts';

describe('particle camera runtime snapshots', () => {
  it('restores every mutable camera field without retaining references', () => {
    const source = new ParticleCamera();

    source.position = [1, 2, 3];
    source.target = [4, 5, 6];
    source.up = [7, 8, 9];
    source.angle = [10, 11, 12];
    source.projection = 0;

    const snapshot =
      source.captureRuntimeSnapshot();
    const restored = new ParticleCamera();

    restored.restoreRuntimeSnapshot(snapshot);

    expect(
      restored.captureRuntimeSnapshot(),
    ).toEqual(snapshot);

    snapshot.position[0] = 999;
    snapshot.target[0] = 999;
    snapshot.up[0] = 999;
    snapshot.angle[0] = 999;

    expect(
      restored.captureRuntimeSnapshot(),
    ).toEqual({
      position: [1, 2, 3],
      target: [4, 5, 6],
      up: [7, 8, 9],
      angle: [10, 11, 12],
      projection: 0,
    });
  });

  it('rejects malformed camera snapshots', () => {
    const camera = new ParticleCamera();

    expect(() =>
      camera.restoreRuntimeSnapshot({
        position: [0, 0],
      }),
    ).toThrow(
      'Invalid particle camera runtime snapshot.',
    );
  });
});
