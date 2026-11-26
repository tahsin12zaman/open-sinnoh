import {
  describe,
  expect,
  it,
} from 'vitest';
import { SplRandom } from '@opensinnoh/battle/particles';
import type {
  FrontierSceneData,
  FrontierTables,
  Ui2dAnimation,
} from '@opensinnoh/contracts';
import type { Id } from '@opensinnoh/core';
import { FrontierParticles } from './effects.ts';
import { FrontierScene } from './scene.ts';
import { BlockWipe } from './wipes.ts';

const sheet = 'test:ui2d/frontier' as Id;

const animations: Ui2dAnimation[] =
  Array.from({ length: 16 }, () => ({
    mode: 'forward',
    loopStart: 0,
    frames: [
      { cell: 0, ticks: 2 },
      { cell: 1, ticks: 2 },
    ],
  }));

const data: FrontierSceneData = {
  entry: 'test:frontier/0' as Id,
  textBank: 'test:text/frontier' as Id,
  bgm: null,
  bg: null,
  fg: null,
  setup: false,
};

const tables = {
  characters: { 1: sheet },
  objects: { 2: sheet },
  shadow: sheet,
} as unknown as FrontierTables;

const makeScene = () =>
  new FrontierScene(
    7,
    data,
    tables,
    () => animations,
    { color: 'black', alpha: 0 },
    new FrontierParticles(
      new SplRandom(19),
      () => {
        throw new Error(
          'no particle system expected',
        );
      },
    ),
  );

describe('Frontier scene runtime snapshots', () => {
  it('restores actors, animations, tasks, fades and wipes exactly', () => {
    const original = makeScene();

    original.loadCharacter(1);
    original.addActor(
      7,
      1,
      3,
      80,
      96,
      true,
      true,
    );
    original.applyMovement(7, [
      {
        op: 'fr_walk_east',
        count: 2,
      },
      {
        op: 'fr_delay_2',
        count: 1,
      },
    ]);

    original.loadSpriteResources(2);
    original.addSprite(
      0,
      2,
      40,
      48,
      true,
      true,
    );
    original.playSprite(0, 1);
    original.startFade(
      true,
      12,
      'white',
    );
    original.startShake(2, 1, 2, 5);
    original.startWindow(
      {
        x1: 4,
        y1: 8,
        x2: 120,
        y2: 96,
      },
      4,
      true,
    );
    original.setActorDarken(7, 6);
    original.corridorFloor = true;
    original.fgBelow = true;
    original.spritesOnTop = true;
    original.wipe =
      new BlockWipe('rows');

    for (let frame = 0; frame < 5; frame++) {
      original.wipe.step();
      original.step();
    }

    const snapshot =
      original.captureRuntimeSnapshot();
    const saved = structuredClone(snapshot);
    const restored = makeScene();

    restored.restoreRuntimeSnapshot(
      snapshot,
    );

    expect(
      restored.captureRuntimeSnapshot(),
    ).toEqual(saved);
    expect(restored.view()).toEqual(
      original.view(),
    );

    snapshot.loaded.length = 0;
    snapshot.camera.x = 99999;
    snapshot.actors[31]!.cur.x = 99999;

    expect(
      restored.captureRuntimeSnapshot(),
    ).toEqual(saved);

    for (let frame = 0; frame < 20; frame++) {
      original.wipe?.step();
      restored.wipe?.step();
      original.step();
      restored.step();

      expect(restored.view()).toEqual(
        original.view(),
      );
      expect(
        restored.captureRuntimeSnapshot(),
      ).toEqual(
        original.captureRuntimeSnapshot(),
      );
    }
  });

  it('rejects malformed and mismatched scene snapshots', () => {
    const scene = makeScene();

    expect(() =>
      scene.restoreRuntimeSnapshot({
        kind: 'frontier-scene',
      }),
    ).toThrow(
      'Invalid Frontier scene runtime snapshot.',
    );

    const snapshot =
      scene.captureRuntimeSnapshot();

    snapshot.id = 8;

    expect(() =>
      scene.restoreRuntimeSnapshot(snapshot),
    ).toThrow(
      'Frontier scene snapshot is for 8, not 7.',
    );
  });
});
