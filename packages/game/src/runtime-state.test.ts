import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  createRuntimeStateEnvelope,
  IndexedDbRuntimeStateStore,
  runtimeStateFromBytes,
  runtimeStateToBytes,
  validateRuntimeStateEnvelope,
} from './runtime-state.ts';

describe('runtime-state envelope', () => {
  it('round-trips a versioned payload through portable bytes', () => {
    const envelope = createRuntimeStateEnvelope('slot-1', 'engine-test', {
      tick: 42,
      rng: { seed: 123 },
      actors: [{ id: 'fixture:hero', x: 12.5 }],
    }, '2026-11-23T00:00:00.000Z');
    expect(runtimeStateFromBytes(runtimeStateToBytes(envelope), 'engine-test')).toEqual(envelope);
  });

  it('rejects malformed, incompatible and unsupported envelopes before restore', () => {
    const valid = createRuntimeStateEnvelope('slot-1', 'engine-test', { tick: 1 });
    expect(() => validateRuntimeStateEnvelope({ ...valid, format: 'ordinary-save' })).toThrow(/not an OpenSinnoh runtime-state/);
    expect(() => validateRuntimeStateEnvelope({ ...valid, version: 999 })).toThrow(/unsupported runtime-state version/);
    expect(() => validateRuntimeStateEnvelope(valid, 'different-engine')).toThrow(/belongs to engine/);
    expect(() => validateRuntimeStateEnvelope({ ...valid, slot: '../save' })).toThrow(/invalid runtime-state slot/);
    expect(() => runtimeStateFromBytes(new TextEncoder().encode('{bad json'))).toThrow(/not valid UTF-8 JSON/);
  });

  it('rejects payloads that cannot survive JSON serialization', () => {
    expect(() => createRuntimeStateEnvelope('slot-1', 'engine-test', undefined)).toThrow(/not JSON-serializable/);
    expect(() => createRuntimeStateEnvelope('slot-1', 'engine-test', 1n)).toThrow(/not JSON-serializable/);
  });
});

describe('runtime-state storage', () => {
  it('stores independent slots atomically and lists metadata', async () => {
    const store = new IndexedDbRuntimeStateStore('opensinnoh-runtime-state-test');
    const first = createRuntimeStateEnvelope('slot-1', 'engine-test', { tick: 10 });
    const second = createRuntimeStateEnvelope('slot-2', 'engine-test', { tick: 20 });
    await store.put(first);
    await store.put(second);
    expect(await store.get('slot-1', 'engine-test')).toEqual(first);
    expect(await store.list()).toEqual([
      { slot: 'slot-1', createdAt: first.createdAt, engine: 'engine-test' },
      { slot: 'slot-2', createdAt: second.createdAt, engine: 'engine-test' },
    ]);
    await store.remove('slot-1');
    expect(await store.get('slot-1')).toBeUndefined();
    expect(await store.get('slot-2')).toEqual(second);
    store.close();
  });

  it('does not overwrite ordinary save storage', async () => {
    const runtime = new IndexedDbRuntimeStateStore('opensinnoh-runtime-state-isolation');
    const saves = new (await import('./storage.ts')).IndexedDbSaveStore('opensinnoh-runtime-state-isolation');
    await runtime.put(createRuntimeStateEnvelope('slot-1', 'engine-test', { tick: 3 }));
    expect(await saves.get('slot-1')).toBeUndefined();
    expect(await runtime.get('slot-1')).toMatchObject({ payload: { tick: 3 } });
    runtime.close();
    saves.close();
  });
});
