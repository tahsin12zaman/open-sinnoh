import { describe, expect, it } from 'vitest';
import { SplRandom } from '@opensinnoh/battle/particles';
import type { FrontierEffectsArt, ParticleEmitter, ParticleSystem, Ui2dAnimation } from '@opensinnoh/contracts';
import type { Id } from '@opensinnoh/core';
import { BrainCutIn, FrontierParticles } from './effects.ts';

/** A self-maintaining point emitter (bit 14): 4 frames of one particle a frame, each living 6. */
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
  emitterLife: 4,
  particleLife: 6,
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
const system: ParticleSystem = { id: 'test:frontier_particles/5' as Id, sourceIndex: 5, archive: 'frontier', textures: 'test:ui2d/p' as Id, textureParams: [0], emitters: [emitter, { ...emitter, basePos: [-4096, 0, 0] }] };

describe('frontier particle systems (frontier_particle_system.c)', () => {
  it('draws what its emitters made, waits for them to end, and refuses systems that are not loaded', () => {
    const p = new FrontierParticles(new SplRandom(0), (n) => (n === 5 ? system : (() => { throw new Error(`no ${n}`); })()));
    expect(() => p.createEmitter(0, 0)).toThrow(/not loaded/);
    p.init(0, 5, 1);
    expect(() => p.init(0, 5, 1)).toThrow(/already loaded/);
    p.createEmitter(0, 0);
    p.createEmitter(0, 1, (e) => e.setPos(0, 4096));
    expect(p.idle()).toBe(false);
    let frames = 0;
    let drawn = 0;
    for (; frames < 50 && !p.idle(); frames++) {
      p.step();
      drawn = Math.max(drawn, p.drawn.length);
    }
    expect(p.idle()).toBe(true);
    expect(frames).toBeGreaterThan(6);
    expect(drawn).toBeGreaterThan(2);
    p.free(0);
    expect(() => p.free(0)).toThrow(/not loaded/);
  });
});

describe('frontier particle runtime snapshots', () => {
  it('restores every loaded system and the shared RNG exactly', () => {
    const original = new FrontierParticles(
      new SplRandom(77),
      (n) => {
        if (n !== 5) {
          throw new Error(`no ${n}`);
        }

        return system;
      },
    );

    original.init(2, 5, 1);
    original.createEmitter(2, 0);
    original.createEmitter(
      2,
      1,
      (live) => live.setPos(1, 4096),
    );

    for (let frame = 0; frame < 5; frame++) {
      original.step();
    }

    const snapshot =
      original.captureRuntimeSnapshot();
    const saved = structuredClone(snapshot);
    const restored = new FrontierParticles(
      new SplRandom(0),
      (n) => {
        if (n !== 5) {
          throw new Error(`no ${n}`);
        }

        return system;
      },
    );

    restored.restoreRuntimeSnapshot(
      snapshot,
    );

    expect(
      restored.captureRuntimeSnapshot(),
    ).toEqual(saved);

    snapshot.drawn.length = 0;
    snapshot.systems[2]!.manager.rngState =
      999;

    expect(
      restored.captureRuntimeSnapshot(),
    ).toEqual(saved);

    for (let frame = 0; frame < 20; frame++) {
      original.step();
      restored.step();

      expect(restored.drawn).toEqual(
        original.drawn,
      );
      expect(
        restored.captureRuntimeSnapshot(),
      ).toEqual(
        original.captureRuntimeSnapshot(),
      );
    }
  });

  it('rejects malformed Frontier particle snapshots', () => {
    const particles = new FrontierParticles(
      new SplRandom(0),
      () => system,
    );

    expect(() =>
      particles.restoreRuntimeSnapshot({
        kind: 'frontier-particles',
        systems: [],
      }),
    ).toThrow(
      'Invalid Frontier particles runtime snapshot.',
    );
  });
});

describe('the Frontier Brain cut-in (frontier_brain_encounter_effect.c)', () => {
  const art = {
    brains: { tower: { banner: [], mugshot: 'test:ui2d/m' as Id, name: 'test:name' as Id } },
    vs: 'test:ui2d/vs' as Id,
  } as unknown as FrontierEffectsArt;
  const anims = (sheet: Id): Ui2dAnimation[] =>
    sheet === art.vs
      ? [{ mode: 'forward', loopStart: 0, frames: [{ cell: 3, ticks: 1 }] }, { mode: 'forward', loopStart: 0, frames: [{ cell: 7, ticks: 1 }] }]
      : [{ mode: 'forward', loopStart: 0, frames: [{ cell: 1, ticks: 1 }] }];

  it('restores a cut-in at the exact frame', () => {
    let originalFade = 0;
    let restoredFade = 0;

    const original = new BrainCutIn('tower', {
      fade: (_out, frames) => {
        originalFade = frames;
      },
      fadeDone: () => originalFade === 0,
    });

    for (let frame = 0; frame < 53; frame++) {
      original.step();

      if (originalFade > 0) {
        originalFade--;
      }
    }

    const snapshot =
      original.captureRuntimeSnapshot();
    restoredFade = originalFade;

    const restored =
      BrainCutIn.restoreRuntimeSnapshot(
        snapshot,
        {
          fade: (_out, frames) => {
            restoredFade = frames;
          },
          fadeDone: () => restoredFade === 0,
        },
      );

    expect(
      restored.captureRuntimeSnapshot(),
    ).toEqual(snapshot);
    expect(
      restored.view(art, 'PALMER', anims),
    ).toEqual(
      original.view(art, 'PALMER', anims),
    );

    snapshot.vs[0]!.lerp.value = 99999;

    expect(
      restored.captureRuntimeSnapshot(),
    ).not.toEqual(snapshot);

    for (
      let frame = 0;
      frame < 100 &&
      !original.finished;
      frame++
    ) {
      original.step();
      restored.step();

      if (originalFade > 0) originalFade--;
      if (restoredFade > 0) restoredFade--;

      expect(restoredFade).toBe(originalFade);
      expect(
        restored.captureRuntimeSnapshot(),
      ).toEqual(
        original.captureRuntimeSnapshot(),
      );
      expect(
        restored.view(art, 'PALMER', anims),
      ).toEqual(
        original.view(art, 'PALMER', anims),
      );
    }

    expect(restored.finished).toBe(true);
  });

  it('rejects malformed cut-in snapshots', () => {
    expect(() =>
      BrainCutIn.restoreRuntimeSnapshot(
        {
          kind: 'frontier-brain-cut-in',
          facility: 'tower',
        },
        {
          fade: () => {},
          fadeDone: () => true,
        },
      ),
    ).toThrow(
      'Invalid Frontier Brain cut-in runtime snapshot.',
    );
  });

  it('flashes, opens the banner, grows the VS in, slides the silhouette in, lights it with the name, then fades to white', () => {
    let fading = 0;
    const fades: string[] = [];
    const cutIn = new BrainCutIn('tower', {
      fade: (out, frames) => {
        fades.push(`${out ? 'out' : 'in'} ${frames}`);
        fading = frames;
      },
      fadeDone: () => fading === 0,
    });
    const views = [];
    for (let i = 0; i < 200 && !cutIn.finished; i++) {
      cutIn.step();
      if (fading) fading--;
      views.push(cutIn.view(art, 'PALMER', anims));
    }
    expect(cutIn.finished).toBe(true);
    expect(views.length).toBeGreaterThan(100);
    expect(views.length).toBeLessThan(130);
    expect(fades).toEqual(['out 3', 'in 3', 'out 3', 'in 3', 'out 15']);
    const bands = views.flatMap((v) => (v.band ? [`${v.band.y1}-${v.band.y2}`] : []));
    expect(bands.slice(0, 5)).toEqual(['72-88', '64-96', '56-104', '48-112', '46-114']);
    expect(new Set(views.map((v) => v.banner)).size).toBe(8);
    // The VS sprites: three grow from 2× to 1× (animation 1), the fourth stays at 1× (animation 0), 3 frames apart.
    const vs = views.find((v) => v.vs.length === 1)!.vs[0]!;
    expect(vs).toEqual({ cell: 7, x: 72, y: 82, scale: 2 });
    const last = views.at(-1)!;
    expect(last.vs.map((v) => [v.cell, v.scale])).toEqual([[7, 1], [7, 1], [7, 1], [3, 1]]);
    // The mugshot slides 15 px a frame from 256 to 208 as a silhouette; the flash lights it and shows the name.
    const xs = views.flatMap((v) => (v.mugshot ? [v.mugshot.x] : []));
    expect(xs.slice(0, 5)).toEqual([256, 241, 226, 211, 208]);
    expect(views.find((v) => v.mugshot)!.mugshot!.dark).toBe(true);
    expect(last.mugshot).toEqual({ cell: 1, x: 208, y: 80, dark: false });
    expect(last.name).toEqual({ text: 'PALMER', x: 116, y: 80 });
    expect(last.roomDark).toBe(true);
    expect(views.find((v) => v.name)!.mugshot!.dark).toBe(false);
  });
});
