/**
 * Versioned, independent runtime-state slots.
 *
 * Runtime states are deliberately separate from ordinary game saves: they contain a
 * complete engine continuation and must never be passed to Game.load(). The payload is
 * owned by the runtime snapshot coordinator; this module only validates and persists the
 * portable envelope.
 */
export const RUNTIME_STATE_FORMAT = 'opensinnoh-runtime-state' as const;
export const RUNTIME_STATE_VERSION = 1 as const;
export const DEFAULT_RUNTIME_STATE_DB = 'opensinnoh-runtime-states';
const STORE = 'runtime-states';
const SLOT = /^[a-zA-Z0-9_-]{1,48}$/;

export interface RuntimeStateEnvelope<T = unknown> {
  format: typeof RUNTIME_STATE_FORMAT;
  version: typeof RUNTIME_STATE_VERSION;
  engine: string;
  createdAt: string;
  slot: string;
  payload: T;
}

export interface RuntimeStateSlot {
  slot: string;
  createdAt: string;
  engine: string;
}

/** Reject values JSON would silently omit or coerce; a save must resume without data loss. */
function assertJsonValue(value: unknown, path = 'payload', seen = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`runtime state ${path} contains a non-finite number`);
    return;
  }
  if (typeof value !== 'object') throw new Error(`runtime state ${path} is not JSON-serializable`);
  if (seen.has(value)) throw new Error(`runtime state ${path} contains a cycle`);
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer || value instanceof Date || value instanceof Map || value instanceof Set) {
    throw new Error(`runtime state ${path} contains a non-JSON object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new Error(`runtime state ${path} contains a non-plain object`);
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`, seen));
  } else {
    for (const [key, item] of Object.entries(value)) assertJsonValue(item, `${path}.${key}`, seen);
    for (const key of Object.getOwnPropertySymbols(value)) {
      if (Object.prototype.propertyIsEnumerable.call(value, key)) throw new Error(`runtime state ${path} contains a symbol key`);
    }
  }
  seen.delete(value);
}

/** Builds a validated envelope without mutating the caller's snapshot. */
export function createRuntimeStateEnvelope<T>(
  slot: string,
  engine: string,
  payload: T,
  createdAt = new Date().toISOString(),
): RuntimeStateEnvelope<T> {
  if (!SLOT.test(slot)) throw new Error(`invalid runtime-state slot "${slot}"`);
  if (!engine || engine.length > 128) throw new Error('invalid runtime-state engine identifier');
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error('invalid runtime-state timestamp');
  assertJsonValue(payload);
  return {
    format: RUNTIME_STATE_FORMAT,
    version: RUNTIME_STATE_VERSION,
    engine,
    createdAt,
    slot,
    payload: structuredClone(payload),
  };
}

/** Validates imported or stored data before any live runtime is touched. */
export function validateRuntimeStateEnvelope(value: unknown, expectedEngine?: string): RuntimeStateEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('malformed runtime-state envelope');
  const v = value as Record<string, unknown>;
  if (v.format !== RUNTIME_STATE_FORMAT) throw new Error('not an OpenSinnoh runtime-state file');
  if (v.version !== RUNTIME_STATE_VERSION) throw new Error(`unsupported runtime-state version ${String(v.version)}`);
  if (typeof v.slot !== 'string' || !SLOT.test(v.slot)) throw new Error('invalid runtime-state slot');
  if (typeof v.engine !== 'string' || !v.engine || v.engine.length > 128) throw new Error('invalid runtime-state engine identifier');
  if (expectedEngine !== undefined && v.engine !== expectedEngine) throw new Error(`runtime state belongs to engine ${v.engine}, not ${expectedEngine}`);
  if (typeof v.createdAt !== 'string' || !Number.isFinite(Date.parse(v.createdAt))) throw new Error('invalid runtime-state timestamp');
  if (!('payload' in v)) throw new Error('runtime-state payload is missing');
  assertJsonValue(v.payload);
  return structuredClone(value) as RuntimeStateEnvelope;
}

/** UTF-8 JSON export suitable for a user-managed backup. */
export function runtimeStateToBytes(envelope: RuntimeStateEnvelope): Uint8Array {
  const valid = validateRuntimeStateEnvelope(envelope);
  return new TextEncoder().encode(JSON.stringify(valid));
}

/** Parses untrusted runtime-state bytes. */
export function runtimeStateFromBytes(bytes: Uint8Array, expectedEngine?: string): RuntimeStateEnvelope {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch (error) {
    throw new Error('runtime-state data is not valid UTF-8 JSON', { cause: error });
  }
  return validateRuntimeStateEnvelope(value, expectedEngine);
}

/**
 * Dedicated IndexedDB store. Its database and object store are isolated from ordinary
 * Pokémon game saves; each slot replacement is one atomic IndexedDB transaction.
 */
export class IndexedDbRuntimeStateStore {
  private db: Promise<IDBDatabase> | undefined;
  private handle: IDBDatabase | undefined;

  constructor(
    private readonly name = DEFAULT_RUNTIME_STATE_DB,
    private readonly factory: IDBFactory = globalThis.indexedDB,
  ) {}

  private open(): Promise<IDBDatabase> {
    return (this.db ??= new Promise((resolve, reject) => {
      const request = this.factory.open(this.name, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve((this.handle = request.result));
      request.onerror = () => reject(request.error ?? new Error('runtime-state database open failed'));
    }));
  }

  close(): void {
    this.handle?.close();
    this.handle = undefined;
    this.db = undefined;
  }

  private async run<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = operation(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error ?? request.error ?? new Error('runtime-state transaction failed'));
      transaction.onabort = () => reject(transaction.error ?? new Error('runtime-state transaction aborted'));
    });
  }

  async put(envelope: RuntimeStateEnvelope): Promise<void> {
    const valid = validateRuntimeStateEnvelope(envelope);
    await this.run('readwrite', (store) => store.put(runtimeStateToBytes(valid), valid.slot));
  }

  async get(slot: string, expectedEngine?: string): Promise<RuntimeStateEnvelope | undefined> {
    if (!SLOT.test(slot)) throw new Error(`invalid runtime-state slot "${slot}"`);
    const value = await this.run('readonly', (store) => store.get(slot));
    if (value === undefined) return undefined;
    if (value instanceof Uint8Array) return runtimeStateFromBytes(value, expectedEngine);
    if (value instanceof ArrayBuffer) return runtimeStateFromBytes(new Uint8Array(value), expectedEngine);
    throw new Error(`runtime-state slot "${slot}" contains malformed data`);
  }

  async list(): Promise<RuntimeStateSlot[]> {
    const keys = await this.run('readonly', (store) => store.getAllKeys());
    const slots: RuntimeStateSlot[] = [];
    for (const key of keys) {
      if (typeof key !== 'string') throw new Error('runtime-state database contains a non-string slot key');
      const envelope = await this.get(key);
      if (envelope) slots.push({ slot: envelope.slot, createdAt: envelope.createdAt, engine: envelope.engine });
    }
    return slots.sort((a, b) => a.slot.localeCompare(b.slot));
  }

  async remove(slot: string): Promise<void> {
    if (!SLOT.test(slot)) throw new Error(`invalid runtime-state slot "${slot}"`);
    await this.run('readwrite', (store) => store.delete(slot));
  }
}
