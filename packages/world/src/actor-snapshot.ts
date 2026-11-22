import type { Actor } from './npc.ts';

/**
 * JSON-only representation of one live field actor. Actor deliberately contains no runtime handles:
 * motion progress, movement-type PRNG state, script cursor, animation phase and interpolated positions
 * are all plain data and therefore belong in the snapshot.
 */
export type ActorSnapshot = Actor;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Reject malformed actor payloads before any live actor is mutated. */
export function validateActorSnapshot(value: unknown): value is ActorSnapshot {
  if (!isRecord(value)) return false;
  const requiredNumbers = [
    'localId', 'x', 'z', 'y', 'movementType', 'trainerType', 'sight',
    'emote', 'poseTick', 'lift', 'sink', 'roll',
  ];
  if (!requiredNumbers.every((key) => isFiniteNumber(value[key]))) return false;
  if (typeof value.zone !== 'string' || !['up', 'down', 'left', 'right'].includes(String(value.facing))) return false;
  if (value.sprite !== null && typeof value.sprite !== 'string') return false;
  if (!['persistent', 'passThrough', 'visible', 'dirLocked', 'paused', 'emoteDouble', 'animPaused', 'heightFixed']
    .every((key) => typeof value[key] === 'boolean')) return false;
  if (!Array.isArray(value.cur) || value.cur.length !== 3 || !value.cur.every(isFiniteNumber)) return false;
  if (!Array.isArray(value.prev) || value.prev.length !== 3 || !value.prev.every(isFiniteNumber)) return false;
  if (!isRecord(value.frames) || !isFiniteNumber(value.frames.frame) ||
      typeof value.frames.run !== 'boolean' || !isFiniteNumber(value.frames.code) ||
      typeof value.frames.held !== 'boolean' || !isFiniteNumber(value.frames.pattern)) return false;
  if (value.motion !== null && !isRecord(value.motion)) return false;
  if (value.type !== null && !isRecord(value.type)) return false;
  if (value.script !== null && !isRecord(value.script)) return false;
  if (!isRecord(value.range) || !isFiniteNumber(value.range.x) || !isFiniteNumber(value.range.z)) return false;
  if (value.offset === undefined || !Array.isArray(value.offset) || value.offset.length !== 3 ||
      !value.offset.every(isFiniteNumber)) return false;
  return true;
}

/** Capture all mutable actor state without retaining aliases to the running simulation. */
export function captureActorSnapshot(actor: Actor): ActorSnapshot {
  const serialized = JSON.stringify(actor);
  if (serialized === undefined) throw new Error('Cannot snapshot an actor without a JSON representation.');
  const snapshot: unknown = JSON.parse(serialized);
  if (!validateActorSnapshot(snapshot)) throw new Error(`Actor ${actor.localId} produced an invalid runtime snapshot.`);
  return snapshot;
}

/**
 * Restore into the existing actor object so references held by tasks/features remain valid.
 * Callers must validate every actor snapshot and resolve all cross-actor references before this step.
 */
export function restoreActorSnapshot(actor: Actor, snapshot: ActorSnapshot): void {
  if (!validateActorSnapshot(snapshot)) throw new Error('Cannot restore an invalid actor runtime snapshot.');
  const copy = JSON.parse(JSON.stringify(snapshot)) as Actor;
  for (const key of Object.keys(actor) as (keyof Actor)[]) delete (actor as unknown as Record<string, unknown>)[key];
  Object.assign(actor, copy);
}
