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
