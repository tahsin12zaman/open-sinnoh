import { describe, expect, it } from 'vitest';
import { RuntimeSnapshotCoordinator, type RuntimeSnapshotParticipant } from './runtime-snapshot.ts';
import type { RuntimeJsonValue } from '@opensinnoh/contracts';

const ids = ['game', 'world', 'vm', 'apps', 'battle', 'audio', 'render'] as const;

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
    expect(boundaryCalls).toBe(2);
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
