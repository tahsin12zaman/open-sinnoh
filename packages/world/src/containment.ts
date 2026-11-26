/** The prop manager's two independent channels; task checks precede animation advancement. */
export interface ContainmentUnitsRuntimeSnapshot {
  loopFrames: number;
  openingFrames: number;
  loop: number;
  opening: number;
  paused: boolean;
  openRunning: boolean;
  phase: 'loop' | 'start' | 'open' | null;
}

export class ContainmentUnits {
  loop = 0;
  opening = 0;
  private paused: boolean;
  private openRunning = false;
  private phase: 'loop' | 'start' | 'open' | null = null;

  constructor(
    readonly loopFrames: number,
    readonly openingFrames: number,
    freed: boolean,
  ) {
    this.paused = freed;
    if (freed) this.opening = openingFrames - 1;
  }

  capture(): ContainmentUnitsRuntimeSnapshot {
    return {
      loopFrames: this.loopFrames,
      openingFrames: this.openingFrames,
      loop: this.loop,
      opening: this.opening,
      paused: this.paused,
      openRunning: this.openRunning,
      phase: this.phase,
    };
  }

  static restore(
    snapshot: ContainmentUnitsRuntimeSnapshot,
  ): ContainmentUnits {
    const units = new ContainmentUnits(
      snapshot.loopFrames,
      snapshot.openingFrames,
      false,
    );
    units.loop = snapshot.loop;
    units.opening = snapshot.opening;
    units.paused = snapshot.paused;
    units.openRunning = snapshot.openRunning;
    units.phase = snapshot.phase;
    return units;
  }

  deactivate(): void {
    if (this.phase) throw new Error('containment: shutdown already running');
    this.phase = 'loop';
  }
  done(): boolean {
    return this.phase === null;
  }
  step(): void {
    switch (this.phase) {
      case 'loop':
        if (this.loop === this.loopFrames - 1) {
          this.paused = true;
          this.phase = 'start';
        }
        break;
      case 'start':
        this.openRunning = true;
        this.phase = 'open';
        break;
      case 'open':
        if (!this.openRunning) this.phase = null;
        break;
    }
    if (!this.paused) this.loop = (this.loop + 1) % this.loopFrames;
    if (this.openRunning && ++this.opening >= this.openingFrames - 1) {
      this.opening = this.openingFrames - 1;
      this.openRunning = false;
    }
  }
}
