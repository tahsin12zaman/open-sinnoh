import {
  serializeRuntimeSnapshot,
  validateRuntimeSnapshot,
  type RuntimeJsonValue,
  type RuntimeSnapshot,
  type RuntimeSnapshotCompatibility,
  type RuntimeSnapshotReferences,
  type RuntimeSnapshotSubsystems,
  type RuntimeSnapshotTarget,
  type World,
} from '@opensinnoh/contracts';
import type { Runner } from '@opensinnoh/vm';
import type { Game } from '@opensinnoh/game';

/** A subsystem owns its serializer and must reject snapshots it cannot safely restore. */
export interface RuntimeSnapshotParticipant<T extends RuntimeJsonValue = RuntimeJsonValue> {
  readonly id: keyof RuntimeSnapshotSubsystems;
  capture(): T;
  validate(payload: RuntimeJsonValue, references: RuntimeSnapshotReferences): string | null;
  restore(payload: T, references: RuntimeSnapshotReferences): void;
}

/**
 * Logical sound timing belongs to the audio participant. Hardware
 * playback is reissued by SoundSystem during restoration.
 */
export function audioSnapshotParticipant(
  game: Game,
): RuntimeSnapshotParticipant {
  return {
    id: 'audio',
    capture: () =>
      JSON.parse(
        JSON.stringify(
          game.sound
            .captureRuntimeSnapshot(),
        ),
      ) as RuntimeJsonValue,
    validate: (payload) =>
      game.sound.validateRuntimeSnapshot(
        payload,
      )
        ? null
        : 'Invalid sound runtime snapshot.',
    restore: (payload) =>
      game.sound.restoreRuntimeSnapshot(
        payload,
      ),
  };
}

/**
 * Apps and battles are currently serialized by the game participant;
 * render interpolation is serialized by the world participant. These
 * markers make that ownership explicit in the envelope.
 */
export function ownedSnapshotParticipant(
  id: 'apps' | 'battle' | 'render',
): RuntimeSnapshotParticipant {
  return {
    id,
    capture: () => null,
    validate: (payload) =>
      payload === null
        ? null
        : `Runtime subsystem "${id}" must use its owning participant.`,
    restore: () => {},
  };
}

/**
 * The game participant owns GameState and the orchestration state
 * that is not owned by world, VM, apps, battle, audio or render.
 */
export function gameSnapshotParticipant(
  game: Game,
): RuntimeSnapshotParticipant {
  return {
    id: 'game',
    capture: () =>
      game.captureRuntimeSnapshot(),
    validate: (payload) =>
      game.validateRuntimeSnapshot(payload),
    restore: (payload) =>
      game.restoreRuntimeSnapshot(payload),
  };
}

/**
 * The field world owns actors, map tasks, movement, fades and every
 * transient field accumulator.
 */
export function worldSnapshotParticipant(
  world: World,
): RuntimeSnapshotParticipant {
  return {
    id: 'world',
    capture: () =>
      JSON.parse(
        JSON.stringify(
          world.captureRuntimeSnapshot(),
        ),
      ) as RuntimeJsonValue,
    validate: (payload) =>
      world.validateRuntimeSnapshot(payload),
    restore: (payload) =>
      world.restoreRuntimeSnapshot(payload),
  };
}

/**
 * The field script VM owns its complete runtime codec. The app only
 * adapts it to the coordinator's participant interface.
 */
export function scriptRunnerSnapshotParticipant(
  runner: Runner,
): RuntimeSnapshotParticipant {
  return {
    id: 'vm',
    capture: () =>
      runner.captureRuntimeSnapshot(),
    validate: (payload) =>
      runner.validateRuntimeSnapshot(payload),
    restore: (payload) =>
      runner.restoreRuntimeSnapshot(payload),
  };
}

/** The game supplies a tick-boundary lock; capture is never allowed during a partial tick. */
export interface RuntimeSnapshotBoundary {
  atTickBoundary<T>(operation: (tick: number) => T): T;
}

export interface RuntimeSnapshotCoordinatorOptions {
  compatibility: RuntimeSnapshotCompatibility;
  boundary: RuntimeSnapshotBoundary;
  participants: RuntimeSnapshotParticipant[];
  references(): RuntimeSnapshotReferences;
}

/**
 * Coordinates subsystem serializers into one tick-consistent envelope.
 * It deliberately does not invent subsystem state: missing participants make capture fail closed.
 */
export class RuntimeSnapshotCoordinator {
  private readonly participants: Map<keyof RuntimeSnapshotSubsystems, RuntimeSnapshotParticipant>;

  constructor(private readonly options: RuntimeSnapshotCoordinatorOptions) {
    this.participants = new Map();
    for (const participant of options.participants) {
      if (this.participants.has(participant.id)) throw new Error(`Duplicate runtime snapshot participant: ${participant.id}`);
      this.participants.set(participant.id, participant);
    }
    for (const id of ['game', 'world', 'vm', 'apps', 'battle', 'audio', 'render'] as const) {
      if (!this.participants.has(id)) throw new Error(`Missing runtime snapshot participant: ${id}`);
    }
  }

  capture(): RuntimeSnapshot {
    return this.options.boundary.atTickBoundary((tick) => {
      const references = this.options.references();
      const subsystems = {} as RuntimeSnapshotSubsystems;
      for (const [id, participant] of this.participants) {
        // A participant may throw; no snapshot is returned unless every participant succeeds.
        subsystems[id] = participant.capture();
      }
      const snapshot: RuntimeSnapshot = {
        format: 'opensinnoh-runtime-snapshot',
        version: 1,
        compatibility: this.options.compatibility,
        tick,
        references,
        subsystems,
      };
      const valid = validateRuntimeSnapshot(snapshot, this.options.compatibility);
      if (!valid.ok) throw new Error(valid.detail);
      return snapshot;
    });
  }

  /**
   * Preflight every subsystem before the first mutation. Participants must keep restore() synchronous
   * and side-effect-free until their own validation has succeeded.
   */
  validate(snapshot: unknown, target: RuntimeSnapshotTarget = this.options.compatibility): RuntimeSnapshot {
    const envelope = validateRuntimeSnapshot(snapshot, target);
    if (!envelope.ok) throw new Error(envelope.detail);
    for (const [id, participant] of this.participants) {
      const error = participant.validate(envelope.snapshot.subsystems[id], envelope.snapshot.references);
      if (error) throw new Error(`Cannot restore runtime subsystem "${id}": ${error}`);
    }
    return envelope.snapshot;
  }

  /** Restore in caller-specified dependency order; no simulation tick is run by this coordinator. */
  restore(snapshot: unknown, order: (keyof RuntimeSnapshotSubsystems)[] = [
    'game', 'world', 'vm', 'apps', 'battle', 'audio', 'render',
  ]): number {
    return this.options.boundary.atTickBoundary(() => {
      const valid = this.validate(snapshot);
      if (new Set(order).size !== order.length || order.length !== this.participants.size ||
          order.some((id) => !this.participants.has(id))) {
        throw new Error('Runtime snapshot restore order must contain every subsystem exactly once.');
      }

      // Take a rollback image before mutation. If any participant unexpectedly throws during
      // restore, put already-mutated participants back in reverse dependency order.
      const rollback = new Map<keyof RuntimeSnapshotSubsystems, RuntimeJsonValue>();
      for (const id of order) {
        const participant = this.participants.get(id)!;
        const payload = participant.capture();
        const error = participant.validate(payload, valid.references);
        if (error) throw new Error(`Cannot establish rollback state for "${id}": ${error}`);
        rollback.set(id, payload);
      }

      const restored: (keyof RuntimeSnapshotSubsystems)[] = [];
      try {
        for (const id of order) {
          // Include the currently executing participant: it may mutate before throwing.
          restored.push(id);
          this.participants.get(id)!.restore(valid.subsystems[id], valid.references);
        }
      } catch (cause) {
        const rollbackErrors: string[] = [];
        for (const id of restored.reverse()) {
          try {
            this.participants.get(id)!.restore(rollback.get(id)!, valid.references);
          } catch (error) {
            rollbackErrors.push(`${id}: ${String(error)}`);
          }
        }
        if (rollbackErrors.length) {
          throw new AggregateError(
            [cause, ...rollbackErrors],
            'Runtime restore failed and rollback was incomplete.',
            { cause },
          );
        }
        throw cause;
      }
      return valid.tick;
    });
  }

  serialize(snapshot: RuntimeSnapshot = this.capture()): string {
    this.validate(snapshot);
    return serializeRuntimeSnapshot(snapshot);
  }
}
