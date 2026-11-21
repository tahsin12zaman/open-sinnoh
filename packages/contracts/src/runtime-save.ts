import type { Button } from '@opensinnoh/core';

/**
 * Raw input state between game ticks. `previous` is required so a
 * restored held button does not incorrectly become a fresh press.
 */
export interface RuntimeInputSnapshot {
  held: Button[];
  previous: Button[];
  touch: {
    x: number;
    y: number;
  } | null;
  tap: string | null;
}

export interface RuntimeShakeTaskSnapshot {
  kind: 'shake';
  actor: number;
  degrees: number;
  times: number;
  speed: number;
  x: number;
  z: number;
}

export interface RuntimeElevatorRideSnapshot {
  kind: 'elevator';
  direction: 'up' | 'down';
  loops: number;
  elapsed: number;
}
