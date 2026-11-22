import type {
  Button,
  Id,
} from '@opensinnoh/core';
import type { Facing } from './records.ts';

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

export interface RuntimeFishingTaskSnapshot {
  kind: 'fishing';
  rod: 0 | 1 | 2;
  roll: {
    species: Id;
    level: number;
  } | null;
  phase:
    | 'prepare'
    | 'cast'
    | 'wait'
    | 'bite'
    | 'missed'
    | 'reel'
    | 'message'
    | 'put-away'
    | 'done';
  ticks: number;
  caught: boolean;
}

export interface RuntimeHmCutInSnapshot {
  kind: 'hm-cut-in';
  elapsed: number;
}

export interface RuntimeSweetScentTaskSnapshot {
  kind: 'sweet-scent';
  phase:
    | 'cut-in'
    | 'check'
    | 'in'
    | 'hold'
    | 'out'
    | 'fail';
  blend: {
    from: number;
    span: number;
    steps: number;
    at: number;
    value: number;
  };
  wait: number;
}

export interface RuntimeCameraZoomSnapshot {
  offset: number;
  mode: number;
  sub: number;
  step: number;
  target: number;
  count: number;
  frames: number;
  done: boolean;
}

export interface RuntimeSpinSnapshot {
  ticks: (Facing | null)[];
  at: number;
}

export interface RuntimeTeleportTaskSnapshot {
  kind: 'teleport';
  phase:
    | 'cut-in'
    | 'out-start'
    | 'out-spin'
    | 'out-fade'
    | 'map'
    | 'in-start'
    | 'in-fade'
    | 'in-slow'
    | 'in-end';
  spin: RuntimeSpinSnapshot | null;
  delay: number;
  gap: number;
  zoom: RuntimeCameraZoomSnapshot;
  zoomActive: boolean;
  done: boolean;
}

export interface RuntimeHealMachineSnapshot {
  kind: 'heal-machine';
  balls: number;
  final: number;
  pattern: boolean;
  state:
    | 'start'
    | 'add'
    | 'wait-ball'
    | 'final'
    | 'wait-final'
    | 'clean-up';
  placed: number;
  ballTicks: number;
  frame: number;
}

export interface RuntimePlatformLiftSnapshot {
  kind: 'platform-lift';
  lift: number;
  position: [number, number];
  height: number;
  platePlaced: number;
  ride: {
    phase: 'start' | 'move' | 'finish' | 'end';
    target: number;
  } | null;
}

export interface RuntimeWateringTaskSnapshot {
  kind: 'watering';
  direction: 'up' | 'down';
  phase: 'water' | 'input' | 'step' | 'done';
  timer: number;
}
