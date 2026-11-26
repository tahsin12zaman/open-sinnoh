/**
 * A frontier scene's effects, headless: its SPL particle systems (decomp frontier_particle_system.c, on the battle's SPL
 * port) and a Frontier Brain's cut-in (frontier_brain_encounter_effect.c). Both step once per scene frame.
 */
import {
  ParticleCamera,
  ParticleManager,
  validateParticleManagerRuntimeSnapshot,
  type Emitter,
  type ParticleManagerRuntimeSnapshot,
  type SplRandom,
} from '@opensinnoh/battle/particles';
import type { AnimParticle, FrontierBrainCutInView, FrontierBrainFacility, FrontierEffectsArt, ParticleSystem, Ui2dAnimation } from '@opensinnoh/contracts';
import type { Id } from '@opensinnoh/core';

/** Decomp NUM_FRONTIER_PARTICLE_SYSTEMS. */
const SYSTEMS = 8;

export interface FrontierParticlesRuntimeSnapshot {
  kind: 'frontier-particles';
  rngState: number;
  systems: (
    | {
        narcIdx: number;
        manager: ParticleManagerRuntimeSnapshot;
      }
    | null
  )[];
  drawn: AnimParticle[];
}

export function validateFrontierParticlesRuntimeSnapshot(
  value: unknown,
): value is FrontierParticlesRuntimeSnapshot {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const snapshot = value as Record<
    string,
    unknown
  >;

  if (
    snapshot.kind !== 'frontier-particles' ||
    !Number.isSafeInteger(snapshot.rngState) ||
    (snapshot.rngState as number) < 0 ||
    (snapshot.rngState as number) > 0xffffffff ||
    !Array.isArray(snapshot.systems) ||
    snapshot.systems.length !== SYSTEMS ||
    !Array.isArray(snapshot.drawn)
  ) {
    return false;
  }

  return snapshot.systems.every((entry) => {
    if (entry === null) return true;

    if (
      typeof entry !== 'object' ||
      Array.isArray(entry)
    ) {
      return false;
    }

    const system = entry as Record<
      string,
      unknown
    >;

    return (
      Number.isSafeInteger(system.narcIdx) &&
      (system.narcIdx as number) >= 0 &&
      validateParticleManagerRuntimeSnapshot(
        system.manager,
      )
    );
  });
}

/** Decomp FrontierParticleSystem: up to 8 particle systems, drawn then updated each frame (FrontierParticleSystem_Update). */
export class FrontierParticles {
  private readonly systems: (ParticleManager | null)[] = Array(SYSTEMS).fill(null);
  /** What the last frame drew (`FrontierView.particles`). */
  drawn: AnimParticle[] = [];

  constructor(
    private readonly rng: SplRandom,
    private readonly systemOf: (narcIdx: number) => ParticleSystem,
  ) {}

  captureRuntimeSnapshot(): FrontierParticlesRuntimeSnapshot {
    return {
      kind: 'frontier-particles',
      rngState: this.rng.state,
      systems: this.systems.map(
        (manager) => {
          if (!manager) return null;

          const narcIdx =
            manager.system.sourceIndex;

          if (narcIdx === undefined) {
            throw new Error(
              `Frontier particle system ${manager.system.id} has no source index.`,
            );
          }

          return {
            narcIdx,
            manager:
              manager.captureRuntimeSnapshot(),
          };
        },
      ),
      drawn: structuredClone(this.drawn),
    };
  }

  restoreRuntimeSnapshot(
    value: unknown,
  ): void {
    if (
      !validateFrontierParticlesRuntimeSnapshot(
        value,
      )
    ) {
      throw new Error(
        'Invalid Frontier particles runtime snapshot.',
      );
    }

    this.rng.state = value.rngState;

    value.systems.forEach(
      (entry, index) => {
        if (!entry) {
          this.systems[index] = null;
          return;
        }

        const manager = new ParticleManager(
          this.systemOf(entry.narcIdx),
          new ParticleCamera(),
          this.rng,
        );

        manager.restoreRuntimeSnapshot(
          entry.manager,
        );

        this.systems[index] = manager;
      },
    );

    this.rng.state = value.rngState;
    this.drawn = structuredClone(value.drawn);
  }

  /** FrontierParticleSystem_NewParticleSystem: `projection` 1 orthographic (every script's), 0 perspective. */
  init(index: number, narcIdx: number, projection: number): void {
    if (index >= SYSTEMS) throw new Error(`frontier particles: system ${index} of ${SYSTEMS}`);
    if (this.systems[index]) throw new Error(`frontier particles: system ${index} is already loaded`);
    const camera = new ParticleCamera();
    camera.projection = projection;
    this.systems[index] = new ParticleManager(this.systemOf(narcIdx), camera, this.rng);
  }

  /** FrontierParticleSystem_FreeParticleSystem. */
  free(index: number): void {
    if (!this.systems[index]) throw new Error(`frontier particles: free system ${index}, which is not loaded`);
    this.systems[index] = null;
  }

  /** ParticleSystem_CreateEmitterWithCallback; `init` is the callback (run before the emitter is listed). */
  createEmitter(index: number, resource: number, init: (e: Emitter) => void = () => {}): void {
    const system = this.systems[index];
    if (!system) throw new Error(`frontier particles: an emitter on system ${index}, which is not loaded`);
    system.createEmitter(resource, init);
  }

  /** FrontierParticleSystem_NoActiveEmitters. */
  idle(): boolean {
    return this.systems.every((s) => !s || s.emitters.length === 0);
  }

  /** FrontierParticleSystem_Update: every system drawn, then updated. */
  step(): void {
    this.drawn = [];
    const live = this.systems.filter((s): s is ParticleManager => !!s && s.emitters.length > 0);
    for (const s of live) s.draw(this.drawn);
    for (const s of live) s.update();
  }
}

/** Decomp FACILITY_TOWER … FACILITY_ARCADE (the cut-in's operand). */
export const BRAIN_FACILITIES: Record<number, FrontierBrainFacility> = { 1: 'tower', 2: 'factory', 3: 'factory', 4: 'castle', 5: 'hall', 6: 'arcade' };

/** frontier_brain_encounter_effect.c: BANNER_CENTERLINE, BANNER_HEIGHT, BANNER_STEP (fx 8.8), NUM_BANNER_PALETTES. */
const BANNER = { centre: 80, height: 68, step: 0x800, palettes: 8 } as const;
/** The sprites' screen places: the VS (CreateVsSprites), the mugshot's row and slide (UpdateMugshotSpritePosition), the name. */
const VS_AT = { x: 72, y: 82 };
const MUGSHOT = { y: 80, from: 256, to: 208, step: 3840 } as const;
const NAME_AT = { x: 208 - 92, y: 11 * 8 - 8 };

interface LerpRuntimeSnapshot {
  start: number;
  delta: number;
  steps: number;
  step: number;
  value: number;
}

export interface BrainCutInRuntimeSnapshot {
  kind: 'frontier-brain-cut-in';
  facility: FrontierBrainFacility;
  state: number;
  delay: number;
  bannerIndex: number;
  banner: {
    top: number;
    bottom: number;
    open: boolean;
    finished: boolean;
  } | null;
  vs: {
    lerp: LerpRuntimeSnapshot;
    drawn: boolean;
  }[];
  vsDelay: number;
  vsStarted: number;
  mugshot: {
    x: number;
    slid: boolean;
  } | null;
  lit: boolean;
  finished: boolean;
}

const runtimeRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value);

const runtimeInteger = (
  value: unknown,
): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value);

const runtimeNumber = (
  value: unknown,
): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value);

const runtimeLerp = (
  value: unknown,
): value is LerpRuntimeSnapshot =>
  runtimeRecord(value) &&
  runtimeNumber(value.start) &&
  runtimeNumber(value.delta) &&
  runtimeInteger(value.steps) &&
  value.steps > 0 &&
  runtimeInteger(value.step) &&
  value.step >= 0 &&
  value.step <= value.steps &&
  runtimeNumber(value.value);

export function validateBrainCutInRuntimeSnapshot(
  value: unknown,
): value is BrainCutInRuntimeSnapshot {
  if (
    !runtimeRecord(value) ||
    value.kind !== 'frontier-brain-cut-in' ||
    ![
      'tower',
      'factory',
      'castle',
      'hall',
      'arcade',
    ].includes(value.facility as string) ||
    !runtimeInteger(value.state) ||
    value.state < 0 ||
    value.state > 18 ||
    !runtimeInteger(value.delay) ||
    !runtimeInteger(value.bannerIndex) ||
    value.bannerIndex < 0 ||
    value.bannerIndex >= BANNER.palettes ||
    !Array.isArray(value.vs) ||
    value.vs.length !== 4 ||
    !value.vs.every(
      (entry) =>
        runtimeRecord(entry) &&
        runtimeLerp(entry.lerp) &&
        typeof entry.drawn === 'boolean',
    ) ||
    !runtimeInteger(value.vsDelay) ||
    !runtimeInteger(value.vsStarted) ||
    value.vsStarted < 0 ||
    value.vsStarted > 4 ||
    typeof value.lit !== 'boolean' ||
    typeof value.finished !== 'boolean'
  ) {
    return false;
  }

  if (
    value.banner !== null &&
    (
      !runtimeRecord(value.banner) ||
      !runtimeNumber(value.banner.top) ||
      !runtimeNumber(value.banner.bottom) ||
      typeof value.banner.open !== 'boolean' ||
      typeof value.banner.finished !== 'boolean'
    )
  ) {
    return false;
  }

  if (
    value.mugshot !== null &&
    (
      !runtimeRecord(value.mugshot) ||
      !runtimeNumber(value.mugshot.x) ||
      typeof value.mugshot.slid !== 'boolean'
    )
  ) {
    return false;
  }

  return true;
}

/** LinearInterpolationTaskFX32 (the VS sprites' scale, fx32). */
class Lerp {
  value: number;
  private step = 0;
  constructor(
    private readonly start: number,
    private readonly delta: number,
    private readonly steps: number,
  ) {
    this.value = start;
  }
  captureRuntimeSnapshot(): LerpRuntimeSnapshot {
    return {
      start: this.start,
      delta: this.delta,
      steps: this.steps,
      step: this.step,
      value: this.value,
    };
  }

  static restoreRuntimeSnapshot(
    snapshot: LerpRuntimeSnapshot,
  ): Lerp {
    const lerp = new Lerp(
      snapshot.start,
      snapshot.delta,
      snapshot.steps,
    );

    lerp.step = snapshot.step;
    lerp.value = snapshot.value;
    return lerp;
  }

  /** LinearInterpolationTaskFX32_Update: true once it has reached its end. */
  update(): boolean {
    this.value = this.start + Math.trunc((this.delta * this.step) / this.steps);
    if (this.step + 1 <= this.steps) {
      this.step++;
      return false;
    }
    this.step = this.steps;
    return true;
  }
}

export interface BrainCutInHost {
  /** StartScreenFade on the main screen: `out` toward white over `frames`. */
  fade(out: boolean, frames: number): void;
  fadeDone(): boolean;
}

/**
 * A Frontier Brain's cut-in (decomp Task_PlayEncounterEffect and its tasks): white flashes, the banner opening from
 * the centre line with its palette cycling, the VS sprites growing in from twice their size, the mugshot sliding in as
 * a silhouette, then a flash that lights the mugshot, shows the name and dims the room, a hold, and the fade to white.
 */
export class BrainCutIn {
  private state = 0;
  private delay = 0;
  private bannerIndex = 0;
  private banner: { top: number; bottom: number; open: boolean; finished: boolean } | null = null;
  private readonly vs = Array.from({ length: 4 }, (_, i) => ({ lerp: new Lerp(i === 3 ? 4096 : 8192, i === 3 ? 0 : -4096, 6), drawn: false }));
  private vsDelay = 0;
  private vsStarted = 0;
  private mugshot: { x: number; slid: boolean } | null = null;
  private lit = false;
  finished = false;

  constructor(
    readonly facility: FrontierBrainFacility,
    private readonly host: BrainCutInHost,
  ) {}

  /** One frame: the effect's task (priority 1000), the banner's (1000, started after it), the palette's (1100). */
  step(): void {
    if (this.finished) return;
    this.effect();
    if (this.banner && !this.banner.finished) this.openBanner();
    // UpdateBannerPalette: its timer never goes below 0, so the next palette every frame.
    this.bannerIndex = (this.bannerIndex + 1) % BANNER.palettes;
  }

  private effect(): void {
    switch (this.state) {
      case 0: // the resources and sprites (hidden)
        this.state++;
        return;
      case 1:
        this.host.fade(true, 3);
        this.state++;
        return;
      case 2:
      case 4:
      case 17:
        if (this.host.fadeDone()) this.state++;
        return;
      case 3:
        this.host.fade(false, 3);
        this.state++;
        return;
      case 5: // StartBannerTask
        this.banner = { top: BANNER.centre << 8, bottom: BANNER.centre << 8, open: true, finished: false };
        this.state++;
        return;
      case 6:
        if (this.banner!.finished) {
          this.state++;
          this.delay = 10;
        }
        return;
      case 7:
        if (--this.delay >= 0) return;
        if (this.updateVs()) this.state++;
        return;
      case 8:
        this.state++;
        return;
      case 9:
        if (this.slideMugshot()) this.state++;
        return;
      case 10:
        this.delay = 10;
        this.state++;
        return;
      case 11:
        if (--this.delay >= 0) return;
        this.host.fade(true, 3);
        this.state++;
        return;
      case 12:
        // The mugshot's palette unblended, the name shown, the other sprites and the room dimmed.
        if (this.host.fadeDone()) {
          this.lit = true;
          this.state++;
        }
        return;
      case 13:
        this.host.fade(false, 3);
        this.state++;
        return;
      case 14:
        if (this.host.fadeDone()) {
          this.delay = 26;
          this.state++;
        }
        return;
      case 15:
        if (--this.delay < 0) this.state++;
        return;
      case 16:
        this.host.fade(true, 15);
        this.state++;
        return;
      default: // 18: the sprites freed, the script resumes
        this.finished = true;
    }
  }

  /** Task_OpenEncounterBanner: 8 px up and down a frame from the centre line to the banner's height, then done. */
  private openBanner(): void {
    const b = this.banner!;
    if (!b.open) {
      b.finished = true;
      return;
    }
    b.top -= BANNER.step;
    b.bottom += BANNER.step;
    if (b.top <= (BANNER.centre << 8) - ((BANNER.height / 2) << 8)) {
      b.top = (BANNER.centre - BANNER.height / 2) << 8;
      b.bottom = (BANNER.centre + BANNER.height / 2) << 8;
      b.open = false;
    }
  }

  /** UpdateVsSprites: a sprite starts every 3 frames; each scales 2 → 1 in 6 steps (the fourth stays at 1). */
  private updateVs(): boolean {
    let done = true;
    if (this.vsStarted < 4) {
      done = false;
      if (--this.vsDelay <= 0) {
        this.vsDelay = 3;
        this.vsStarted++;
      }
    }
    for (let i = 0; i < this.vsStarted; i++) {
      const v = this.vs[i]!;
      if (!v.lerp.update()) done = false;
      v.drawn = true;
    }
    return done;
  }

  /** UpdateMugshotSpritePosition: shown at the right edge, then 15 px a frame left to x 208. */
  private slideMugshot(): boolean {
    if (!this.mugshot) {
      this.mugshot = { x: MUGSHOT.from << 8, slid: false };
      return false;
    }
    const m = this.mugshot;
    if (m.slid) return true;
    m.x = Math.max(m.x - MUGSHOT.step, MUGSHOT.to << 8);
    if (m.x === MUGSHOT.to << 8) m.slid = true;
    return false;
  }

  captureRuntimeSnapshot(): BrainCutInRuntimeSnapshot {
    return {
      kind: 'frontier-brain-cut-in',
      facility: this.facility,
      state: this.state,
      delay: this.delay,
      bannerIndex: this.bannerIndex,
      banner: this.banner
        ? { ...this.banner }
        : null,
      vs: this.vs.map((entry) => ({
        lerp:
          entry.lerp.captureRuntimeSnapshot(),
        drawn: entry.drawn,
      })),
      vsDelay: this.vsDelay,
      vsStarted: this.vsStarted,
      mugshot: this.mugshot
        ? { ...this.mugshot }
        : null,
      lit: this.lit,
      finished: this.finished,
    };
  }

  static restoreRuntimeSnapshot(
    value: unknown,
    host: BrainCutInHost,
  ): BrainCutIn {
    if (!validateBrainCutInRuntimeSnapshot(value)) {
      throw new Error(
        'Invalid Frontier Brain cut-in runtime snapshot.',
      );
    }

    const cutIn = new BrainCutIn(
      value.facility,
      host,
    );

    cutIn.state = value.state;
    cutIn.delay = value.delay;
    cutIn.bannerIndex = value.bannerIndex;
    cutIn.banner = value.banner
      ? { ...value.banner }
      : null;
    cutIn.vsDelay = value.vsDelay;
    cutIn.vsStarted = value.vsStarted;
    cutIn.mugshot = value.mugshot
      ? { ...value.mugshot }
      : null;
    cutIn.lit = value.lit;
    cutIn.finished = value.finished;

    value.vs.forEach((entry, index) => {
      cutIn.vs[index] = {
        lerp: Lerp.restoreRuntimeSnapshot(
          entry.lerp,
        ),
        drawn: entry.drawn,
      };
    });

    return cutIn;
  }

  view(art: FrontierEffectsArt, name: string, animationsOf: (sheet: Id) => readonly Ui2dAnimation[]): FrontierBrainCutInView {
    const cell = (sheet: Id, anim: number) => {
      const a = animationsOf(sheet)[anim];
      if (!a) throw new Error(`frontier cut-in: ${sheet} has no animation ${anim}`);
      return a.frames[0]!.cell;
    };
    const b = this.banner;
    return {
      facility: this.facility,
      band: b ? { y1: b.top >> 8, y2: b.bottom >> 8 } : null,
      banner: this.bannerIndex,
      mugshot: this.mugshot ? { cell: cell(art.brains[this.facility].mugshot, 0), x: this.mugshot.x >> 8, y: MUGSHOT.y, dark: !this.lit } : null,
      vs: this.vs.flatMap((v, i) => (v.drawn ? [{ cell: cell(art.vs, i === 3 ? 0 : 1), ...VS_AT, scale: v.lerp.value / 4096 }] : [])),
      name: this.lit ? { text: name, ...NAME_AT } : null,
      roomDark: this.lit,
    };
  }
}
