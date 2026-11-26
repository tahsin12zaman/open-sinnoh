import { describe, expect, it } from 'vitest';
import {
  RuntimeSnapshotCoordinator,
  audioSnapshotParticipant,
  gameSnapshotParticipant,
  ownedSnapshotParticipant,
  scriptRunnerSnapshotParticipant,
  worldSnapshotParticipant,
  type RuntimeSnapshotParticipant,
} from './runtime-snapshot.ts';
import {
  createScriptRunner,
  type Runner,
} from '@opensinnoh/vm';
import { createGame } from '@opensinnoh/game';
import { createWorld } from '@opensinnoh/world';
import { readPack } from '../../game/test/packs.ts';
import type { Game } from '@opensinnoh/game';
import {
  CONTRACTS_VERSION,
  type RuntimeJsonValue,
  type World,
} from '@opensinnoh/contracts';

const ids = ['game', 'world', 'vm', 'apps', 'battle', 'audio', 'render'] as const;

describe('audio snapshot participant', () => {
  it('delegates sound capture, validation and restoration', () => {
    const payload = {
      handles: [],
      state: 'idle',
    };
    const restored: unknown[] = [];
    const game = {
      sound: {
        captureRuntimeSnapshot:
          () => payload,
        validateRuntimeSnapshot:
          (value: unknown) =>
            value === payload,
        restoreRuntimeSnapshot:
          (value: unknown) =>
            void restored.push(value),
      },
    } as unknown as Game;

    const participant =
      audioSnapshotParticipant(game);
    const captured =
      participant.capture();

    expect(participant.id).toBe('audio');
    expect(captured).toEqual(payload);
    expect(
      participant.validate(
        payload,
        { actors: [], threads: [] },
      ),
    ).toBeNull();

    participant.restore(
      payload,
      { actors: [], threads: [] },
    );

    expect(restored).toEqual([payload]);
  });
});

describe('world snapshot participant', () => {
  it('delegates world capture, validation and restoration', () => {
    const payload = {
      kind: 'field-world-runtime',
      zone: 'test:ROOM',
    };
    const restored: unknown[] = [];
    const world = {
      captureRuntimeSnapshot: () => payload,
      validateRuntimeSnapshot:
        (value: unknown) =>
          value !== null &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          'kind' in value &&
          value.kind ===
            'field-world-runtime'
            ? null
            : 'wrong world payload',
      restoreRuntimeSnapshot:
        (value: unknown) =>
          void restored.push(value),
    } as unknown as World;

    const participant =
      worldSnapshotParticipant(world);
    const captured = participant.capture();

    expect(participant.id).toBe('world');
    expect(captured).toEqual(payload);
    expect(
      participant.validate(
        captured,
        { actors: [], threads: [] },
      ),
    ).toBeNull();

    participant.restore(
      captured,
      { actors: [], threads: [] },
    );

    expect(restored).toEqual([captured]);
  });
});

describe('script runner snapshot participant', () => {
  it('delegates VM capture, validation and restoration', () => {
    const payload = {
      kind: 'script-runner',
      tick: 12,
      thread: null,
      ui: {},
      input: {},
    } as RuntimeJsonValue;
    const restored: RuntimeJsonValue[] = [];

    const runner = {
      captureRuntimeSnapshot: () => payload,
      validateRuntimeSnapshot: (
        value: RuntimeJsonValue,
      ) => value === payload
        ? null
        : 'wrong payload',
      restoreRuntimeSnapshot: (
        value: RuntimeJsonValue,
      ) => void restored.push(value),
    } as unknown as Runner;

    const participant =
      scriptRunnerSnapshotParticipant(runner);

    expect(participant.id).toBe('vm');
    expect(participant.capture()).toBe(payload);
    expect(
      participant.validate(
        payload,
        { actors: [], threads: [] },
      ),
    ).toBeNull();

    participant.restore(
      payload,
      { actors: [], threads: [] },
    );

    expect(restored).toEqual([payload]);
  });
});

describe('real runtime snapshot composition', () => {
  it('captures and restores the real game, world, VM and audio as one JSON envelope', () => {
    const game = createGame({
      packs: [readPack('fixture')],
      createWorld,
      createScriptRunner,
      seed: 17,
    });
    const compatibility = {
      build: 'test-runtime',
      contracts: CONTRACTS_VERSION,
    };
    const coordinator =
      new RuntimeSnapshotCoordinator({
        compatibility,
        boundary: {
          atTickBoundary: (operation) =>
            operation(game.state.tick),
        },
        participants: [
          gameSnapshotParticipant(game),
          worldSnapshotParticipant(game.world),
          scriptRunnerSnapshotParticipant(
            game.scripts as Runner,
          ),
          ownedSnapshotParticipant('apps'),
          ownedSnapshotParticipant('battle'),
          audioSnapshotParticipant(game),
          ownedSnapshotParticipant('render'),
        ],
        references: () => ({
          actors: game.state.objects
            .map((actor) => actor.localId)
            .filter((id) => id >= 0),
          threads: [],
        }),
      });

    const snapshot = coordinator.capture();
    const encoded = coordinator.serialize(snapshot);

    game.advance(3);

    expect(
      coordinator.restore(
        JSON.parse(encoded),
      ),
    ).toBe(snapshot.tick);
    expect(game.state.tick).toBe(snapshot.tick);
    expect(coordinator.capture()).toEqual(snapshot);
  });
});

describe('RuntimeSnapshotCoordinator', () => {
  it('captures every registered subsystem at one tick boundary and restores without ticking', () => {
    let tick = 120;
    let boundaryCalls = 0;
    const restored: string[] = [];
    const participants: RuntimeSnapshotParticipant[] = ids.map((id) => ({
      id,
      capture: () => ({ owner: id, value: tick }) as RuntimeJsonValue,
      validate: (payload) => (typeof payload === 'object' && payload !== null && !Array.isArray(payload) ? null : 'invalid test payload'),
      restore: () => { restored.push(id); },
    }));
    const coordinator = new RuntimeSnapshotCoordinator({
      compatibility: { build: 'test', contracts: '0.50.4' },
      boundary: { atTickBoundary: (operation) => { boundaryCalls++; return operation(tick); } },
      participants,
      references: () => ({ actors: [0], threads: [] }),
    });
    const snapshot = coordinator.capture();
    expect(snapshot.tick).toBe(120);
    expect(boundaryCalls).toBe(1);
    tick = 900;
    expect(coordinator.restore(snapshot)).toBe(120);
    expect(tick).toBe(900);
    expect(restored).toEqual(ids);
  });

  it('fails closed if a subsystem is missing or rejects its payload', () => {
    expect(() => new RuntimeSnapshotCoordinator({
      compatibility: { build: 'test', contracts: '0.50.4' },
      boundary: { atTickBoundary: (operation) => operation(0) },
      participants: [],
      references: () => ({ actors: [], threads: [] }),
    })).toThrow(/Missing runtime snapshot participant/);

    const participants: RuntimeSnapshotParticipant[] = ids.map((id) => ({
      id,
      capture: () => null,
      validate: (_payload) => id === 'battle' ? 'battle serializer unavailable' : null,
      restore: () => { throw new Error('restore must not run during preflight'); },
    }));
    const coordinator = new RuntimeSnapshotCoordinator({
      compatibility: { build: 'test', contracts: '0.50.4' },
      boundary: { atTickBoundary: (operation) => operation(0) },
      participants,
      references: () => ({ actors: [], threads: [] }),
    });
    const snapshot = coordinator.capture();
    expect(() => coordinator.restore(snapshot)).toThrow(/battle serializer unavailable/);
  });
  it('rolls back a subsystem that mutates before throwing during restore', () => {
    const state = new Map<string, number>(ids.map((id) => [id, 10]));
    let fail = true;
    const participants: RuntimeSnapshotParticipant[] = ids.map((id) => ({
      id,
      capture: () => ({ value: state.get(id)! }) as RuntimeJsonValue,
      validate: (payload) => (typeof payload === 'object' && payload !== null && !Array.isArray(payload) &&
        typeof payload.value === 'number' ? null : 'invalid'),
      restore: (payload) => {
        if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) state.set(id, payload.value as number);
        if (id === 'battle' && fail && typeof payload === 'object' && payload !== null &&
            !Array.isArray(payload) && payload.value === 99) {
          fail = false;
          throw new Error('simulated restore failure after mutation');
        }
      },
    }));
    const coordinator = new RuntimeSnapshotCoordinator({
      compatibility: { build: 'test', contracts: '0.50.4' },
      boundary: { atTickBoundary: (operation) => operation(42) },
      participants,
      references: () => ({ actors: [], threads: [] }),
    });
    const snapshot = coordinator.capture();
    for (const id of ids) state.set(id, 99);
    const target = { ...snapshot, subsystems: { ...snapshot.subsystems, battle: { value: 99 } } };
    expect(() => coordinator.restore(target)).toThrow(/simulated restore failure after mutation/);
    expect(ids.map((id) => state.get(id))).toEqual(ids.map(() => 99));
  });

});
