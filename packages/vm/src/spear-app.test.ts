import {
  expect,
  it,
} from 'vitest';
import type {
  SpearPillarAssets,
  StorySceneView,
} from '@opensinnoh/contracts';
import type { Id } from '@opensinnoh/core';
import {
  cameraTranslation,
  SpearPillarApplication,
} from './spear-app.ts';
import type {
  Runner,
  Thread,
} from './runner.ts';
it('the native camera helper translates on N−1 calls with truncated signed fx32 steps', () => {
  expect(cameraTranslation(-46, 60)).toBe(-45.2294921875);
  expect(cameraTranslation(70, 60)).toBe(68.82373046875);
  expect(cameraTranslation(-80, 90)).toBe(-79.091796875);
});


it('restores the Spear Pillar generator at its exact tick', () => {
  const models = Object.fromEntries(
    [
      13,
      24,
      46,
      61,
      63,
      65,
      79,
    ].map((asset) => [
      String(asset),
      { frames: 1_000 },
    ]),
  );

  const data = {
    models,
    backgrounds: {},
    messages: Array.from(
      { length: 30 },
      (_, index) =>
        `test:text/${index}` as Id,
    ),
  } as unknown as SpearPillarAssets;

  const make = () => {
    let view: StorySceneView | null = null;

    const runner = {
      audio: {
        setDualCry: () => {},
        playSe: () => {},
        playBgm: () => {},
        fadeOutBgm: () => {},
        stopBgm: () => {},
        playCry: () => {},
      },
      state: {
        names: { player: 'DAWN' },
        gender: 'female',
      },
      field: {
        setStoryScene: (
          next: StorySceneView | null,
        ) => {
          view = next;
        },
      },
      ui: { message: null },
      textSpeed: () => 1,
      showMessage: () => ({
        done: true,
      }),
      namedSequence: () => undefined,
      source: () => undefined,
    } as unknown as Runner;

    const thread = {
      slots: [],
    } as unknown as Thread;

    return {
      runner,
      thread,
      view: () => view,
    };
  };

  const first = make();
  const original =
    new SpearPillarApplication(
      first.runner,
      first.thread,
      data,
    );

  for (let tick = 0; tick < 90; tick++) {
    expect(original.step()).toBe(false);
  }

  const snapshot =
    original.captureRuntimeSnapshot();
  const second = make();
  const restored =
    SpearPillarApplication.fromRuntimeSnapshot(
      second.runner,
      second.thread,
      snapshot,
    );

  expect(
    restored.captureRuntimeSnapshot(),
  ).toEqual(snapshot);
  expect(second.view()).toEqual(first.view());

  snapshot.messageDoneAt.push(999);

  expect(
    restored.captureRuntimeSnapshot(),
  ).not.toEqual(snapshot);

  for (let tick = 0; tick < 40; tick++) {
    expect(restored.step()).toBe(
      original.step(),
    );
    expect(second.view()).toEqual(
      first.view(),
    );
    expect(
      restored.captureRuntimeSnapshot(),
    ).toEqual(
      original.captureRuntimeSnapshot(),
    );
  }
});

it('rejects malformed Spear Pillar application snapshots', () => {
  const runner = {
    audio: { setDualCry: () => {} },
    state: {
      names: { player: 'DAWN' },
    },
  } as unknown as Runner;

  expect(() =>
    SpearPillarApplication.fromRuntimeSnapshot(
      runner,
      { slots: [] } as unknown as Thread,
      {
        kind: 'spear-pillar-application',
        tick: -1,
      },
    ),
  ).toThrow(
    'Invalid Spear Pillar application runtime snapshot.',
  );
});
