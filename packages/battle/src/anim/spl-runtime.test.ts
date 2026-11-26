import {
  describe,
  expect,
  it,
} from 'vitest';
import type {
  AnimParticle,
  ParticleEmitter,
  ParticleSystem,
} from '@opensinnoh/contracts';
import type { Id } from '@opensinnoh/core';
import { ParticleCamera } from './camera.ts';
import {
  ParticleManager,
  SplRandom,
} from './spl.ts';

const emitter: ParticleEmitter = {
  flags: 1 << 14,
  basePos: [0, 0, 0],
  count: 4096,
  radius: 0,
  length: 0,
  axis: [0, 4096, 0],
  color: 0x7fff,
  velPos: 0,
  velAxis: 0,
  scale: 4096,
  aspect: 4096,
  startDelay: 0,
  minRotation: 0,
  maxRotation: 0,
  initAngle: 0,
  emitterLife: 8,
  particleLife: 10,
  attenuation: [0, 0, 0],
  interval: 1,
  alpha: 31,
  air: 255,
  texture: 0,
  loopFrames: 0,
  dbbScale: 0,
  tileS: 0,
  tileT: 0,
  scaleDir: 0,
  faceEmitter: false,
  flipS: false,
  flipT: false,
  polygonX: 0,
  polygonY: 0,
};

const system: ParticleSystem = {
  id: 'test:particles/runtime' as Id,
  sourceIndex: 0,
  archive: 'frontier',
  textures: 'test:ui2d/particles' as Id,
  textureParams: [0],
  emitters: [emitter],
};

describe('particle manager runtime snapshots', () => {
  it('resumes emitters, particles, camera and RNG exactly', () => {
    const originalRng = new SplRandom(123);
    const original = new ParticleManager(
      system,
      new ParticleCamera(),
      originalRng,
    );

    original.camera.setTarget([
      100,
      200,
      300,
    ]);
    original.camera.projection = 0;

    original.createEmitter(
      0,
      (live) => {
        live.setPos(0, 4096);
        live.velocity = [4, 5, 6];
        live.particleInitVelocity = [
          7,
          8,
          9,
        ];
      },
    );

    for (let frame = 0; frame < 6; frame++) {
      original.update();
    }

    const snapshot =
      original.captureRuntimeSnapshot();
    const saved = structuredClone(snapshot);
    const restoredRng = new SplRandom(0);
    const restored = new ParticleManager(
      system,
      new ParticleCamera(),
      restoredRng,
    );

    restored.restoreRuntimeSnapshot(
      snapshot,
    );

    expect(
      restored.captureRuntimeSnapshot(),
    ).toEqual(saved);

    snapshot.camera.position[0] = 99999;
    snapshot.resources[0]!.basePos[0] =
      99999;
    snapshot.emitters[0]!.state.position[0] =
      99999;
    snapshot.emitters[0]!.state.particles[0]!
      .pos[0] = 99999;

    expect(
      restored.captureRuntimeSnapshot(),
    ).toEqual(saved);

    for (let frame = 0; frame < 20; frame++) {
      const originalDraw: AnimParticle[] = [];
      const restoredDraw: AnimParticle[] = [];

      original.draw(originalDraw);
      restored.draw(restoredDraw);

      expect(restoredDraw).toEqual(
        originalDraw,
      );

      original.update();
      restored.update();

      expect(
        restored.captureRuntimeSnapshot(),
      ).toEqual(
        original.captureRuntimeSnapshot(),
      );
    }
  });

  it('rejects malformed and mismatched snapshots', () => {
    const manager = new ParticleManager(
      system,
      new ParticleCamera(),
      new SplRandom(0),
    );

    expect(() =>
      manager.restoreRuntimeSnapshot({
        kind: 'particle-manager',
      }),
    ).toThrow(
      'Invalid particle manager runtime snapshot.',
    );

    const valid =
      manager.captureRuntimeSnapshot();

    valid.system =
      'test:particles/other' as Id;

    expect(() =>
      manager.restoreRuntimeSnapshot(valid),
    ).toThrow(
      'Particle snapshot is for test:particles/other, not test:particles/runtime.',
    );
  });
});
