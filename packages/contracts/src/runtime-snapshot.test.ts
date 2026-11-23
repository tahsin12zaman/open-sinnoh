import { describe, expect, it } from 'vitest';
import {
  loadRuntimeSnapshotSlot,
  parseRuntimeSnapshot,
  saveRuntimeSnapshotSlot,
  serializeRuntimeSnapshot,
  validateRuntimeSnapshot,
  type RuntimeSnapshot,
  type RuntimeSnapshotSlotStorage,
} from './runtime-snapshot.ts';

const compatibility = { build: 'test-build', contracts: '0.50.4' };
const snapshot: RuntimeSnapshot = {
  format: 'opensinnoh-runtime-snapshot',
  version: 1,
  compatibility,
  tick: 42,
  references: { actors: [0, 3], threads: ['field:1'] },
  subsystems: {
    game: { rng: 123 },
    world: { actors: [{ id: 0, x: 12, motion: { elapsed: 4 } }] },
    vm: { contexts: [] },
    apps: null,
    battle: null,
    audio: { sequenceTick: 88 },
    render: { weather: { particles: [] } },
  },
};

function validationError(result: ReturnType<typeof validateRuntimeSnapshot> | ReturnType<typeof parseRuntimeSnapshot>) {
  return 'error' in result ? result.error : undefined;
}

describe('runtime snapshot envelope', () => {
  it('round-trips JSON while preserving tick and transient subsystem data', () => {
    const parsed = parseRuntimeSnapshot(serializeRuntimeSnapshot(snapshot), compatibility);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.snapshot.tick).toBe(42);
      expect(parsed.snapshot.subsystems.world).toEqual(snapshot.subsystems.world);
      expect(parsed.snapshot.subsystems.audio).toEqual(snapshot.subsystems.audio);
    }
  });

  it('rejects unsupported versions, incompatible builds and corrupt JSON', () => {
    expect(validationError(validateRuntimeSnapshot({ ...snapshot, version: 99 }))).toBe('unsupported-version');
    expect(validationError(validateRuntimeSnapshot(snapshot, { ...compatibility, build: 'other' }))).toBe('incompatible-build');
    expect(validationError(parseRuntimeSnapshot('{not json'))).toBe('invalid-json');
  });

  it('rejects missing references and non-JSON runtime values', () => {
    expect(validationError(validateRuntimeSnapshot({ ...snapshot, references: { actors: ['bad'], threads: [] } }))).toBe('invalid-references');
    const invalid = structuredClone(snapshot) as unknown as { subsystems: Record<string, unknown> };
    invalid.subsystems.vm = { callback: () => undefined };
    expect(validationError(validateRuntimeSnapshot(invalid))).toBe('invalid-subsystem-data');
  });

  it('persists and independently loads multiple slots', async () => {
    const slots = new Map<string, string>();
    const storage: RuntimeSnapshotSlotStorage = {
      get: async (slot) => slots.get(slot) ?? null,
      set: async (slot, value) => { slots.set(slot, value); },
      delete: async (slot) => { slots.delete(slot); },
      list: async () => [...slots.keys()],
    };
    await saveRuntimeSnapshotSlot(storage, 'A', snapshot, compatibility);
    await saveRuntimeSnapshotSlot(storage, 'B', { ...snapshot, tick: 99 }, compatibility);
    const a = await loadRuntimeSnapshotSlot(storage, 'A', compatibility);
    const b = await loadRuntimeSnapshotSlot(storage, 'B', compatibility);
    expect(a.ok && a.snapshot.tick).toBe(42);
    expect(b.ok && b.snapshot.tick).toBe(99);
  });
});
