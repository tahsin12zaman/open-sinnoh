import { WEATHER_LOAD_TICKS, weatherFadeTicks, type Weather } from '@opensinnoh/contracts';
import type { FieldSound } from './sound.ts';

/**
 * The weather tasks' sound and lightning (decomp ov5_021D5EB8.c), stepped on every game tick:
 * - RAINING (ov5_021D7658) plays SEQ_SE_DP_T_AME, HEAVY_RAIN and THUNDERSTORM (ov5_021D9984, ov5_021D9A58) play
 *   SEQ_SE_DP_T_OOAME (ov5_021DB4B8: Sound_PlayEffect, the sequence's own volume, no pan). The loop starts when the
 *   task starts (its fade in, or at full on a map load) and stops when the fade out starts (ov5_021DB4E4:
 *   Sound_StopEffect(seq, 0)), or when the field map ends (ov5_021D68B8: a warp, a battle, a menu app). No other
 *   weather plays a sound (sandstorm, snow, blizzard, hail, ash and fog are silent).
 * - THUNDERSTORM starts task 17 (ov5_021DA748, `Lightning`): each flash plays SEQ_SE_DP_T_KAMI2 (a long one) or
 *   SEQ_SE_DP_T_KAMI (a short one) as it starts. The flash ends with the fade out's start.
 * A change without a map load stops the old loop at once; the new weather starts once the old one's fade out and the
 * load are done (the renderer's `WeatherFades`; overlapping weathers start at once). Sound and flash only: no game
 * state, no game random numbers.
 */

/** decomp OVERWORLD_WEATHER_* → the task's looping sound effect. */
const LOOPS: Record<number, string> = { 2: 'SEQ_SE_DP_T_AME', 3: 'SEQ_SE_DP_T_OOAME', 4: 'SEQ_SE_DP_T_OOAME' };
const THUNDERSTORM = 4;

export interface LightningRuntimeSnapshot {
  wait: number;
  phase: 0 | 1 | 2;
  level: number;
  rise: number;
  fall: number;
  ticks: number;
  seed: number;
}

export interface WeatherTasksRuntimeSnapshot {
  shown: Weather | null;
  next: {
    weather: Weather;
    t: number;
    out: number;
    wait: number;
  } | null;
  loop: string | null;
  lightning: LightningRuntimeSnapshot | null;
  loads: number;
  field: boolean;
}

export class WeatherTasks {
  /** The weather whose task runs (fading in or steady); null while one fades out or none is shown. */
  private shown: Weather | null = null;
  /** A weather waiting for the old one's fade out (`t` of `out` ticks) and its load (`wait`). */
  private next: { weather: Weather; t: number; out: number; wait: number } | null = null;
  private loop: string | null = null;
  private lightning: Lightning | null = null;
  private loads = -1;
  private field = false;

  constructor(private readonly sound: FieldSound) {}

  capture(): WeatherTasksRuntimeSnapshot {
    return structuredClone({
      shown: this.shown,
      next: this.next,
      loop: this.loop,
      lightning: this.lightning?.capture() ?? null,
      loads: this.loads,
      field: this.field,
    });
  }

  static restore(
    sound: FieldSound,
    snapshot: WeatherTasksRuntimeSnapshot,
  ): WeatherTasks {
    const tasks = new WeatherTasks(sound);
    tasks.shown = structuredClone(snapshot.shown);
    tasks.next = structuredClone(snapshot.next);
    tasks.loop = snapshot.loop;
    tasks.lightning = snapshot.lightning
      ? Lightning.restore(snapshot.lightning)
      : null;
    tasks.loads = snapshot.loads;
    tasks.field = snapshot.field;
    return tasks;
  }

  restoreRuntimeSnapshot(
    snapshot: WeatherTasksRuntimeSnapshot,
  ): void {
    Object.assign(
      this,
      WeatherTasks.restore(this.sound, snapshot),
    );
  }

  /** One tick with the state's weather and the map load count; `field`: the field map is up (no battle or menu app). */
  step(weather: Weather, loads: number, field: boolean): void {
    if (!field) {
      if (this.field) this.end();
      this.field = false;
      return;
    }
    if (!this.field || loads !== this.loads) {
      // A map load or the field's return (FieldMap_Init → ov5_021D5F24): the weather at full at once.
      this.end();
      this.field = true;
      this.loads = loads;
      this.start(weather);
    } else this.change(weather);
    if (this.next && ++this.next.t >= this.next.out && --this.next.wait <= 0) {
      const w = this.next.weather;
      this.next = null;
      this.start(w);
    }
    const flash = this.lightning?.step();
    if (flash) this.sound.playNamed(flash === 'long' ? 'SEQ_SE_DP_T_KAMI2' : 'SEQ_SE_DP_T_KAMI');
  }

  /** The lightning flash now (0..1), or 0. */
  flash(): number {
    return this.lightning?.alpha ?? 0;
  }

  /** ov5_021D5F7C: a new weather without a map load. */
  private change(weather: Weather): void {
    const target = this.next?.weather ?? this.shown;
    if (target?.id === weather.id) return;
    if (this.next) {
      this.next.weather = weather;
      this.next.wait = WEATHER_LOAD_TICKS;
      return;
    }
    const old = this.shown;
    this.stopTask();
    if (old?.fade?.overlaps?.includes(weather.id)) this.start(weather);
    else this.next = { weather, t: 0, out: old ? weatherFadeTicks(old, 'out') : 0, wait: WEATHER_LOAD_TICKS };
  }

  private start(weather: Weather): void {
    this.shown = weather;
    const loop = LOOPS[weather.sourceIndex ?? -1];
    if (loop) {
      this.sound.playNamed(loop);
      this.loop = loop;
    }
    if (weather.sourceIndex === THUNDERSTORM) this.lightning = new Lightning();
  }

  /** The fade out's start: the loop stops, the lightning ends. */
  private stopTask(): void {
    if (this.loop) this.sound.stopNamed(this.loop);
    this.loop = null;
    this.lightning = null;
    this.shown = null;
  }

  /** The field map ends (ov5_021D68B8). */
  private end(): void {
    this.stopTask();
    this.next = null;
  }
}

/** The lightning's own PRNG (xorshift32): weather rolls no game random numbers. */
/**
 * Lightning (decomp weather task 17, ov5_021DA748): idle a random while, then the BG flash brightens over 2 ticks by
 * 200–680 per tick and fades by 36 (a long flash, SEQ_SE_DP_T_KAMI2) or 200 (a short one, SEQ_SE_DP_T_KAMI) per tick;
 * brightness / 100 = EVA of 16.
 */
export class Lightning {
  private wait = 30;
  private phase: 0 | 1 | 2 = 0;
  private level = 0;
  private rise = 0;
  private fall = 0;
  private ticks = 0;
  private seed = 0x7a11;

  capture(): LightningRuntimeSnapshot {
    return {
      wait: this.wait,
      phase: this.phase,
      level: this.level,
      rise: this.rise,
      fall: this.fall,
      ticks: this.ticks,
      seed: this.seed,
    };
  }

  static restore(
    snapshot: LightningRuntimeSnapshot,
  ): Lightning {
    const lightning = new Lightning();
    lightning.wait = snapshot.wait;
    lightning.phase = snapshot.phase;
    lightning.level = snapshot.level;
    lightning.rise = snapshot.rise;
    lightning.fall = snapshot.fall;
    lightning.ticks = snapshot.ticks;
    lightning.seed = snapshot.seed >>> 0 || 1;
    return lightning;
  }

  private nextRandom(): number {
    let seed = this.seed >>> 0 || 1;
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    this.seed = seed >>> 0;
    return this.seed / 0x100000000;
  }

  /** One tick; a flash that starts now says which. */
  step(): 'long' | 'short' | null {
    const r = () => this.nextRandom();
    if (this.phase === 0) {
      if (this.wait-- > 0) return null;
      this.phase = 1;
      this.ticks = 0;
      this.rise = 200 + Math.floor(r() * 480);
      this.fall = Math.floor(r() * 3) !== 0 ? 36 : 200;
      this.level = 0;
      return this.fall === 36 ? 'long' : 'short';
    }
    if (this.phase === 1) {
      this.level += this.rise;
      if (++this.ticks >= 2) this.phase = 2;
    } else {
      this.level -= this.fall;
      if (this.level <= 0) {
        this.level = 0;
        this.phase = 0;
        this.wait = this.fall === 200 ? Math.floor(r() * 15) : Math.floor(this.rise / 2) + Math.floor(r() * 120);
      }
    }
    return null;
  }

  /** Flash opacity 0..1 (EVA / 16). */
  get alpha(): number {
    return Math.min(16, this.level / 100) / 16;
  }
}
