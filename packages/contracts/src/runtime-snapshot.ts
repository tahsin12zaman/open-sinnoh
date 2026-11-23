/**
 * Versioned envelope and persistence boundary for emulator-style runtime snapshots.
 *
 * This is deliberately separate from GameState and the ordinary Pokémon save schema.
 * Subsystem payloads are JSON data produced by their owning runtime serializers; runtime
 * objects, closures, generators and renderer handles must never cross this boundary.
 */

export type RuntimeJsonValue =
  | null
  | boolean
  | number
  | string
  | RuntimeJsonValue[]
  | { [key: string]: RuntimeJsonValue };

export interface RuntimeSnapshotCompatibility {
  /** Exact application build identifier; snapshots are not portable across arbitrary builds. */
  build: string;
  /** Contracts package version used to define the snapshot payloads. */
  contracts: string;
}

export interface RuntimeSnapshotReferences {
  /** Stable runtime object identifiers, scoped by subsystem. */
  actors: number[];
  /** Stable script/thread identifiers, scoped by VM implementation. */
  threads: string[];
}

export interface RuntimeSnapshotSubsystems {
  /** Each payload is emitted by the subsystem that owns its mutable state. */
  game: RuntimeJsonValue;
  world: RuntimeJsonValue;
  vm: RuntimeJsonValue;
  apps: RuntimeJsonValue;
  battle: RuntimeJsonValue;
  audio: RuntimeJsonValue;
  render: RuntimeJsonValue;
}

export interface RuntimeSnapshot {
  format: 'opensinnoh-runtime-snapshot';
  version: 1;
  compatibility: RuntimeSnapshotCompatibility;
  /** The exact completed simulation tick represented by this snapshot. */
  tick: number;
  references: RuntimeSnapshotReferences;
  subsystems: RuntimeSnapshotSubsystems;
}

export type RuntimeSnapshotValidationError =
  | 'invalid-json'
  | 'invalid-shape'
  | 'unsupported-version'
  | 'invalid-tick'
  | 'invalid-compatibility'
  | 'invalid-references'
  | 'invalid-subsystem-data'
  | 'incompatible-build';

export type RuntimeSnapshotValidation =
  | { ok: true; snapshot: RuntimeSnapshot }
  | { ok: false; error: RuntimeSnapshotValidationError; detail: string };

export interface RuntimeSnapshotTarget {
  build: string;
  contracts: string;
}

const SUBSYSTEMS = ['game', 'world', 'vm', 'apps', 'battle', 'audio', 'render'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown, depth = 0): value is RuntimeJsonValue {
  if (depth > 128) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item, depth + 1));
  if (!isRecord(value)) return false;
  return Object.values(value).every((item) => isJsonValue(item, depth + 1));
}

/** Validate the entire envelope before a caller mutates any live runtime subsystem. */
export function validateRuntimeSnapshot(value: unknown, target?: RuntimeSnapshotTarget): RuntimeSnapshotValidation {
  if (!isRecord(value) || value.format !== 'opensinnoh-runtime-snapshot') {
    return { ok: false, error: 'invalid-shape', detail: 'Not an OpenSinnoh runtime snapshot.' };
  }
  if (value.version !== 1) {
    return { ok: false, error: 'unsupported-version', detail: `Unsupported runtime snapshot version: ${String(value.version)}.` };
  }
  if (!Number.isSafeInteger(value.tick) || (value.tick as number) < 0) {
    return { ok: false, error: 'invalid-tick', detail: 'Snapshot tick must be a non-negative safe integer.' };
  }
  if (!isRecord(value.compatibility) || typeof value.compatibility.build !== 'string' ||
      !value.compatibility.build || typeof value.compatibility.contracts !== 'string' ||
      !value.compatibility.contracts) {
    return { ok: false, error: 'invalid-compatibility', detail: 'Snapshot compatibility metadata is missing or invalid.' };
  }
  if (target && (value.compatibility.build !== target.build ||
      value.compatibility.contracts !== target.contracts)) {
    return { ok: false, error: 'incompatible-build', detail: 'Snapshot was created by an incompatible build or contracts version.' };
  }
  if (!isRecord(value.references) || !Array.isArray(value.references.actors) ||
      !value.references.actors.every((id) => Number.isSafeInteger(id) && (id as number) >= 0) ||
      !Array.isArray(value.references.threads) ||
      !value.references.threads.every((id) => typeof id === 'string' && id.length > 0)) {
    return { ok: false, error: 'invalid-references', detail: 'Snapshot stable-reference table is invalid.' };
  }
  if (!isRecord(value.subsystems)) {
    return { ok: false, error: 'invalid-subsystem-data', detail: 'Snapshot subsystem data is incomplete or contains non-JSON values.' };
  }
  const subsystems = value.subsystems;
  if (!SUBSYSTEMS.every((key) =>
    Object.prototype.hasOwnProperty.call(subsystems, key) && isJsonValue(subsystems[key]))) {
    return { ok: false, error: 'invalid-subsystem-data', detail: 'Snapshot subsystem data is incomplete or contains non-JSON values.' };
  }
  return { ok: true, snapshot: value as unknown as RuntimeSnapshot };
}

/** Parse and validate untrusted persisted data without exposing partially parsed state. */
export function parseRuntimeSnapshot(serialized: string, target?: RuntimeSnapshotTarget): RuntimeSnapshotValidation {
  let value: unknown;
  try {
    value = JSON.parse(serialized) as unknown;
  } catch {
    return { ok: false, error: 'invalid-json', detail: 'Runtime snapshot is not valid JSON.' };
  }
  return validateRuntimeSnapshot(value, target);
}

export interface RuntimeSnapshotSlotInfo {
  slot: string;
  tick: number;
  build: string;
}

/**
 * Implementations must make set() atomic: a failed write must leave the previous slot intact.
 * This abstraction is intentionally independent of ordinary GameState save storage.
 */
export interface RuntimeSnapshotSlotStorage {
  get(slot: string): Promise<string | null>;
  set(slot: string, serialized: string): Promise<void>;
  delete(slot: string): Promise<void>;
  list(): Promise<string[]>;
}

export function serializeRuntimeSnapshot(snapshot: RuntimeSnapshot): string {
  const validation = validateRuntimeSnapshot(snapshot);
  if (!validation.ok) throw new Error(validation.detail);
  return JSON.stringify(snapshot);
}

export async function saveRuntimeSnapshotSlot(
  storage: RuntimeSnapshotSlotStorage,
  slot: string,
  snapshot: RuntimeSnapshot,
  target: RuntimeSnapshotTarget,
): Promise<void> {
  if (!slot.trim()) throw new Error('Runtime snapshot slot name cannot be empty.');
  const validation = validateRuntimeSnapshot(snapshot, target);
  if (!validation.ok) throw new Error(validation.detail);
  // Serialize before writing so validation/stringification failures cannot damage an existing slot.
  const serialized = JSON.stringify(validation.snapshot);
  await storage.set(slot, serialized);
}

export async function loadRuntimeSnapshotSlot(
  storage: RuntimeSnapshotSlotStorage,
  slot: string,
  target: RuntimeSnapshotTarget,
): Promise<RuntimeSnapshotValidation> {
  const serialized = await storage.get(slot);
  if (serialized === null) {
    return { ok: false, error: 'invalid-shape', detail: `Runtime snapshot slot "${slot}" is empty.` };
  }
  return parseRuntimeSnapshot(serialized, target);
}
