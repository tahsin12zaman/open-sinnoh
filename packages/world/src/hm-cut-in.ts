import type {
  AudioHost,
  FlySceneView,
  RuntimeHmCutInSnapshot,
} from '@opensinnoh/contracts';
import type { Pokemon } from '@opensinnoh/core';
import { FlyCutIn } from './fly.ts';

/**
 * hm_cut_in.c sCutInTaskFuncs (`FlyCutIn` without Fly's states): HMCutIn_Done on the 59th tick, the cry on the 36th
 * (HMCutIn_SlideMonToCenter); the field move's task sees it finished on that tick.
 */
export const HM_CUT_IN_TICKS = 59;

const flyOnly = (name: string) => () => {
  throw new Error(`the HM cut-in called Fly's ${name}`);
};

export class HmCutIn {
  private readonly scene: FlyCutIn;
  private elapsed = 0;
  private quiet = false;
  constructor(
    readonly mon: Pokemon,
    private readonly audio: AudioHost,
  ) {
    this.scene = new FlyCutIn(
      {
        cry: () => {
          if (!this.quiet) {
            audio.playCry(mon.species, mon.form);
          }
        },
        se: flyOnly('se'),
        fadeOut: flyOnly('fadeOut'),
        fadeIn: flyOnly('fadeIn'),
        fadeDone: flyOnly('fadeDone'),
        hidePlayer: flyOnly('hidePlayer'),
      },
      false,
    );
  }

  capture(): RuntimeHmCutInSnapshot {
    return {
      kind: 'hm-cut-in',
      elapsed: this.elapsed,
    };
  }

  static restore(
    mon: Pokemon,
    audio: AudioHost,
    snapshot: RuntimeHmCutInSnapshot,
  ): HmCutIn {
    if (
      !Number.isInteger(snapshot.elapsed) ||
      snapshot.elapsed < 0 ||
      snapshot.elapsed > HM_CUT_IN_TICKS
    ) {
      throw new Error(
        `invalid HM cut-in elapsed ${snapshot.elapsed}`,
      );
    }

    const cutIn = new HmCutIn(mon, audio);

    cutIn.quiet = true;

    for (
      let tick = 0;
      tick < snapshot.elapsed;
      tick++
    ) {
      cutIn.step();
    }

    cutIn.quiet = false;

    return cutIn;
  }

  restoreRuntimeSnapshot(
    snapshot: RuntimeHmCutInSnapshot,
  ): void {
    Object.assign(
      this,
      HmCutIn.restore(
        this.mon,
        this.audio,
        snapshot,
      ),
    );
  }

  /** One 30 Hz tick; true once the cut-in has finished. */
  step(): boolean {
    this.scene.tick();
    this.elapsed++;
    return this.scene.finished;
  }

  view(gender: 'male' | 'female', mon: Pick<NonNullable<FlySceneView['mon']>, 'species' | 'form' | 'shiny' | 'female'>): FlySceneView | null {
    return this.scene.finished ? null : this.scene.view(gender, mon);
  }
}
