import { describe, expect, it } from 'vitest';
import { ContainmentUnits } from './containment.ts';
import { VistaBinoculars } from './vista-binoculars.ts';
import { GreatMarshLookout } from './great-marsh-lookout.ts';
import { BoatTrip } from './boat.ts';
import { PokeRadar } from './poke-radar.ts';
import { Lightning, WeatherTasks } from './weather-tasks.ts';
import { VsSeekerTask } from './vs-seeker.ts';
import { UndergroundField } from './underground.ts';

describe('secondary field-task runtime snapshots', () => {
  it('restores containment shutdown at the exact frame', () => {
    const original = new ContainmentUnits(7, 9, false);

    for (let tick = 0; tick < 4; tick++) {
      original.step();
    }

    original.deactivate();

    for (let tick = 0; tick < 6; tick++) {
      original.step();
    }

    const snapshot = original.capture();
    const restored = ContainmentUnits.restore(snapshot);

    expect(restored.capture()).toEqual(snapshot);

    for (let tick = 0; tick < 30; tick++) {
      expect(restored.capture()).toEqual(
        original.capture(),
      );

      if (original.done() || restored.done()) {
        expect(restored.done()).toBe(original.done());
        break;
      }

      original.step();
      restored.step();
    }

    expect(original.done()).toBe(true);
    expect(restored.done()).toBe(true);
  });

  it('restores Boat without replaying constructor effects', () => {
    const snapshot = {
      phase: 'cinematic' as const,
      speed: 1,
      speedTick: 3,
      distance: 120,
      pan: 24,
      shipOffset: [1, 2, 3] as [
        number,
        number,
        number,
      ],
      cameraOffset: [4, 5, 6] as [
        number,
        number,
        number,
      ],
      bridges: [2, 3] as [number, number],
      bridgeReached: true,
      cinematic: { tick: 7, frames: 90 },
      travelDir: 0,
      exit: 'down' as const,
      zone: 'test:DEST' as never,
      x: 8,
      z: 9,
    };

    const restored = BoatTrip.restore(
      {} as never,
      snapshot,
    );

    expect(restored.capture()).toEqual(snapshot);
  });

  it('restores Great Marsh lookout without drawing RNG', () => {
    const snapshot = {
      spots: [
        {
          zone: 'test:MARSH' as never,
          x: 4,
          z: 5,
          facing: 'up' as const,
        },
      ],
      views: 2,
      state: 5,
      timer: 17,
      iris: { from: 0, to: 1, t: 3 },
      irisValue: 0.4,
      pokemon: {
        species: 'test:MON' as never,
        female: true,
      },
    };

    const restored = GreatMarshLookout.restore(
      {} as never,
      snapshot,
    );

    expect(restored.capture()).toEqual(snapshot);
  });

  it('restores the complete Poké Radar chain', () => {
    const original = new PokeRadar(
      {} as never,
      {} as never,
      {},
    );
    const initial = original.capture();
    const snapshot = {
      ...initial,
      shake: 'hard' as const,
      count: 23,
      species: 'test:MON' as never,
      level: 42,
      active: true,
      first: false,
      fromPatch: true,
      recordSlot: 2,
    };

    const restored = PokeRadar.restore(
      {} as never,
      {} as never,
      {},
      snapshot,
    );

    expect(restored.capture()).toEqual(snapshot);
  });

  it('restores Lightning including its private RNG', () => {
    const original = new Lightning();

    for (let tick = 0; tick < 47; tick++) {
      original.step();
    }

    const snapshot = original.capture();
    const restored = Lightning.restore(snapshot);

    expect(restored.capture()).toEqual(snapshot);

    for (let tick = 0; tick < 300; tick++) {
      expect(restored.alpha).toBe(original.alpha);
      expect(restored.step()).toBe(original.step());
      expect(restored.capture()).toEqual(
        original.capture(),
      );
    }
  });

  it('restores weather transition state', () => {
    const original = new WeatherTasks({} as never);
    const base = original.capture();
    const snapshot = {
      ...base,
      loads: 7,
      field: true,
    };

    const restored = WeatherTasks.restore(
      {} as never,
      snapshot,
    );

    expect(restored.capture()).toEqual(snapshot);
  });

  it('rehydrates Vs. Seeker actor references', () => {
    const actors = [{}, {}, {}] as never[];
    const host = {
      objects: () => actors,
    } as never;

    const snapshot = {
      phase: 'wait-anims' as const,
      trainers: [0, 2],
      animating: [2, 1],
      outcome: null,
      result: 0,
    };

    const restored = VsSeekerTask.restore(
      host,
      snapshot,
    );

    expect(restored.capture()).toEqual(snapshot);
  });

  it('restores Underground transient state and RNG', () => {
    const original = new UndergroundField({} as never);
    const base = original.capture();

    const snapshot = {
      ...base,
      log: ['first', 'second'],
      blips: base.blips.map((blip, index) =>
        index === 0 ? { x: 12, z: 34 } : blip
      ),
      still: 27,
      sparkleTimer: 43,
      notices: [
        {
          text: 'test:NOTICE' as never,
          slots: ['A', 'B'],
        },
      ],
      radarSeed: 0x12345678,
      mining: '987654321012345',
      toolSpent: true,
      drilling: {
        x: 4,
        z: 5,
        dir: 'left' as const,
        slot: 2,
      },
      closed: true,
      touchCooldown: 17,
      moving: true,
      retrieved: {
        count: 11,
        trap: 20,
      },
      emote: {
        kind: 'ok' as const,
        ticks: 42,
      },
      trapShadow: 0.75,
    };

    const restored = UndergroundField.restore(
      {} as never,
      snapshot,
    );

    expect(restored.capture()).toEqual(snapshot);
  });

  it('restores Vista binoculars during the iris animation', () => {
    const calls = () => {
      const log: string[] = [];
      const host = {
        fade: (
          kind: 'in' | 'out',
          frames: number,
        ) => log.push(`fade ${kind} ${frames}`),
        fadeDone: () => true,
        changeMap: (
          zone: string,
          x: number,
          z: number,
          facing: string,
        ) => log.push(
          `map ${zone} ${x} ${z} ${facing}`,
        ),
        league: 'test:LEAGUE',
        home: {
          zone: 'test:HOME',
          x: 3,
          z: 4,
        },
        hidePlayer: (hidden: boolean) =>
          log.push(`player ${hidden}`),
        hidePoketch: (hidden: boolean) =>
          log.push(`poketch ${hidden}`),
        setCamera: (camera: unknown) =>
          log.push(`camera ${camera === null}`),
        pressedAB: () => false,
        playSe: (source: number) =>
          log.push(`se ${source}`),
      };

      return { host, log };
    };

    const a = calls();
    const b = calls();
    const original = new VistaBinoculars(
      a.host as never,
    );

    for (let tick = 0; tick < 5; tick++) {
      original.step();
    }

    const snapshot = original.capture();
    const restored = VistaBinoculars.restore(
      b.host as never,
      snapshot,
    );

    expect(restored.capture()).toEqual(snapshot);
    expect(restored.view()).toEqual(original.view());

    for (let tick = 0; tick < 20; tick++) {
      expect(restored.view()).toEqual(original.view());
      original.step();
      restored.step();
      expect(restored.capture()).toEqual(
        original.capture(),
      );
    }
  });
});
