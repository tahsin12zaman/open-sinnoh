/**
 * The Battle Frontier's script VM (decomp overlay 104: battle_frontier.c's app loop, frontier_script_manager.c,
 * frontier_script_context.c, frscrcmd*.c). It runs inside the field VM (`Runner.frontier`) while a field script waits
 * on `launch_battle_frontier_scene`: the field's message box, menus and yes/no box are the frontier's too
 * (`Runner.ui`), and its battles go through the field host as the field's do.
 *
 * Execution model, as the decomp's:
 * - A script manager holds up to 8 contexts (FrontierScriptManager ctx[8]), run in order each frame; a context runs
 *   commands until one returns TRUE (yields), a wait resumes on a later frame without running a command that frame.
 * - Vars: 0x8000–0x8007 are the context's own, 0x8008–0x800F the manager's (kept across a ChangeScript), 0x8010–0x8013
 *   the context's data words (commands use them as scratch too); any other value read as a var is that value.
 * - ChangeScript ends the context and changes the scene on the next frames (the app's states 5 and 6), ExitFrontier
 *   ends the frontier; a battle (a sub-app) suspends the scripts until it is done.
 * - Unimplemented commands log once (`frontier:<op>`) and do nothing, as the field VM's.
 */
import type { Arg, Command, Id } from '@opensinnoh/core';
import { SplRandom } from '@opensinnoh/battle/particles';
import type { AppRequest, FrontierSceneData, FrontierTables, FrontierView, InputFrame, ParticleSystem, Ui2dAnimation } from '@opensinnoh/contracts';
import { newGameRecord } from '@opensinnoh/contracts';
import {
  TEXT_SPEED,
  TextPrinter,
  toPrintOps,
} from '@opensinnoh/text';
import {
  MENU_RESULT,
  NO_ALT_TEXT,
  type MenuKind,
} from '../menu.ts';
import {
  BattleArcade,
  BattleCastle,
  BattleFactory,
  BattleHall,
  type BattleArcadeRuntimeSnapshot,
  type BattleCastleRuntimeSnapshot,
  type BattleFactoryRuntimeSnapshot,
  type BattleHallRuntimeSnapshot,
  type BattleTower,
} from '@opensinnoh/services';
import type { Runner } from '../runner.ts';
import { FRONTIER_VARS } from './commands.ts';
import {
  FrontierScene,
  validateFrontierSceneRuntimeSnapshot,
  type FrontierSceneRuntimeSnapshot,
} from './scene.ts';
import { FrontierParticles } from './effects.ts';
import {
  BlockWipe,
  LineWipe,
} from './wipes.ts';
import { frontierHandlers } from './ops.ts';
import { towerFrontierHandlers } from './tower-ops.ts';
import { factoryFrontierHandlers } from './factory-ops.ts';
import { hallFrontierHandlers } from './hall-ops.ts';
import { castleFrontierHandlers } from './castle-ops.ts';
import { arcadeFrontierHandlers } from './arcade-ops.ts';

export type FrontierResult = 'continue' | 'yield';
export type FrontierWait =
  (input: InputFrame) => boolean;

export type FrontierAppContinuation =
  | { kind: 'hall-board' }
  | { kind: 'factory-rent' }
  | { kind: 'factory-swap' }
  | { kind: 'castle' }
  | { kind: 'arcade' };

export type FrontierRuntimeWait =
  | { kind: 'next-frame' }
  | { kind: 'time'; variable: number }
  | { kind: 'message' }
  | { kind: 'ab' }
  | { kind: 'ab-time' }
  | { kind: 'menu'; menuKind: MenuKind }
  | { kind: 'yes-no'; variable: number }
  | { kind: 'movement' }
  | { kind: 'sprite'; slot: number }
  | { kind: 'fade' }
  | { kind: 'audio-se'; sequence: Id }
  | { kind: 'fanfare' }
  | { kind: 'shake' }
  | { kind: 'window' }
  | { kind: 'particles' }
  | { kind: 'battle-return' }
  | {
      kind: 'app';
      continuation: FrontierAppContinuation;
    }
  | {
      kind: 'frontier-wipe';
      wipeType: number;
      flashIndex: number;
      phase: 'flash' | 'wipe' | 'end';
    }
  | { kind: 'brain-cut-in' };

export type FrontierHandler = (
  f: FrontierRunner,
  c: FrontierContext,
  args: Arg[],
) => FrontierResult;

/** Decomp FrontierScriptContext. */
export interface FrontierContext {
  label: Id;
  cmds: Command[];
  pc: number;
  /** Decomp stack[20]: a push onto 19 entries is dropped, as the field's. */
  stack: { label: Id; cmds: Command[]; pc: number }[];
  state: 'running' | 'waiting' | 'stopped';
  wait: FrontierWait | null;
  waitState: FrontierRuntimeWait | null;
  cmp: number;
  /** Decomp unk_08[8]: vars 0x8000–0x8007. */
  locals: number[];
  /** Decomp data[4]: vars 0x8010–0x8013, also the commands' scratch. */
  data: number[];
  /** The text bank its messages and local menus read (decomp ctx->msgLoader: its scene's FR_SCENE_BANK_ID). */
  textBank: Id;
}

export interface FrontierContextRuntimeSnapshot {
  label: Id;
  pc: number;
  stack: {
    label: Id;
    pc: number;
  }[];
  state: FrontierContext['state'];
  waitState: FrontierRuntimeWait | null;
  cmp: number;
  locals: number[];
  data: number[];
  textBank: Id;
}

export interface FrontierRunnerRuntimeSnapshot {
  kind: 'frontier-runner';
  scene: FrontierSceneRuntimeSnapshot;
  entry: Id;
  textBank: Id;
  contexts: (
    | FrontierContextRuntimeSnapshot
    | null
  )[];
  managerVars: number[];
  slots: (string | null)[];
  exited: boolean;
  abWaits: number;
  change: {
    scene: number;
    entry: Id | null;
    frames: number;
  } | null;
  splRandom: number;
  factory:
    | BattleFactoryRuntimeSnapshot
    | null;
  hall: BattleHallRuntimeSnapshot | null;
  castle:
    | BattleCastleRuntimeSnapshot
    | null;
  arcade:
    | BattleArcadeRuntimeSnapshot
    | null;
}

const frontierRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value);

export function validateFrontierRunnerRuntimeSnapshot(
  value: unknown,
): value is FrontierRunnerRuntimeSnapshot {
  if (
    !frontierRecord(value) ||
    value.kind !== 'frontier-runner' ||
    !validateFrontierSceneRuntimeSnapshot(
      value.scene,
    ) ||
    typeof value.entry !== 'string' ||
    typeof value.textBank !== 'string' ||
    !Array.isArray(value.contexts) ||
    value.contexts.length !== CONTEXTS ||
    !value.contexts.every(
      (context) =>
        context === null ||
        frontierRecord(context),
    ) ||
    !Array.isArray(value.managerVars) ||
    value.managerVars.length !==
      MANAGER_VARS ||
    !value.managerVars.every(
      Number.isSafeInteger,
    ) ||
    !Array.isArray(value.slots) ||
    !value.slots.every(
      (slot) =>
        slot === null ||
        typeof slot === 'string',
    ) ||
    typeof value.exited !== 'boolean' ||
    !Number.isSafeInteger(value.abWaits) ||
    (value.abWaits as number) < 0 ||
    !Number.isSafeInteger(value.splRandom) ||
    (value.splRandom as number) < 0 ||
    (value.splRandom as number) > 0xffffffff
  ) {
    return false;
  }

  return true;
}

const CONTEXTS = 8;
const STACK_SLOTS = 20;
const MANAGER_VARS = 8;
/** Commands per context per frame before we call it a loop. */
const MAX_COMMANDS = 100_000;
/** Decomp NO_NEW_ENTRY_POINT (ChangeSceneWithinScript). */
export const NO_NEW_ENTRY_POINT = 0xffff;
/** Decomp FRONTIER_SCENE_FACTORY_CORRIDOR, _FACTORY_BATTLE_ROOM, _HALL_BATTLE_ROOM: the scenes whose setup runs here. */
const SCENE = { factoryCorridor: 3, factoryBattleRoom: 4, hallBattleRoom: 10, castleBattleRoom: 12, arcadeCorridor: 15, arcadeBattleRoom: 16 } as const;

export class FrontierRunner {
  readonly tables: FrontierTables;
  readonly handlers: Record<string, FrontierHandler>;
  scene!: FrontierScene;
  /** The scene's text bank (decomp scriptMan->msgLoader), for contexts that load with it. */
  textBank!: Id;
  readonly contexts: (FrontierContext | null)[] = Array(CONTEXTS).fill(null);
  /** Decomp unk_24: vars 0x8008–0x800F. */
  readonly managerVars: number[] = Array(MANAGER_VARS).fill(0);
  /** Decomp scriptMan->strTemplate (8 slots). */
  readonly slots: (string | undefined)[] = [];
  /** Decomp exitBattleFrontier. */
  exited = false;
  /** Contexts waiting in FrontierScrCmd_WaitABPress (`FrontierView.waitsForAB`). */
  abWaits = 0;
  /** The facility the scripts run (decomp BattleFrontier_SetFacilityStruct): the Factory's or the Hall's challenge. */
  factory: BattleFactory | null = null;
  hall: BattleHall | null = null;
  castle: BattleCastle | null = null;
  arcade: BattleArcade | null = null;
  /** Decomp changeScript and the app's states 5–6: the scene to load and its entry label (null: keep the scripts). */
  private change: { scene: number; entry: Id | null; frames: number } | null = null;
  /** The SPL random state (decomp gSPLRandomState: one stream, never seeded, so 0 at boot). */
  private readonly splRandom = new SplRandom(0);
  /** The Battle Tower the challenge runs (decomp FieldFrontierDTO facilityData), shared with the field VM. */
  constructor(
    readonly r: Runner,
    sceneId: number,
    readonly entry: Id,
    readonly tower: () => BattleTower | null,
  ) {
    const tables = newGameRecord(r.registries).frontier;
    if (!tables) throw new Error('launch_battle_frontier_scene: the packs have no Battle Frontier (NewGame.frontier)');
    this.tables = tables;
    this.handlers = { ...frontierHandlers(), ...towerFrontierHandlers(), ...factoryFrontierHandlers(), ...hallFrontierHandlers(), ...castleFrontierHandlers(), ...arcadeFrontierHandlers() };
    // The field faded out before the scene (decomp: the frontier app starts on a black screen).
    this.loadScene(sceneId, { color: 'black', alpha: 1 });
    this.load(entry);
  }

  captureRuntimeSnapshot(): FrontierRunnerRuntimeSnapshot {
    const contexts = this.contexts.map(
      (context) => {
        if (!context) return null;

        if (
          context.state === 'waiting' &&
          !context.waitState
        ) {
          throw new Error(
            `Frontier context ${context.label} has a closure-backed wait.`,
          );
        }

        return {
          label: context.label,
          pc: context.pc,
          stack: context.stack.map(
            (frame) => ({
              label: frame.label,
              pc: frame.pc,
            }),
          ),
          state: context.state,
          waitState: context.waitState
            ? structuredClone(
                context.waitState,
              )
            : null,
          cmp: context.cmp,
          locals: [...context.locals],
          data: [...context.data],
          textBank: context.textBank,
        };
      },
    );

    return {
      kind: 'frontier-runner',
      scene:
        this.scene.captureRuntimeSnapshot(),
      entry: this.entry,
      textBank: this.textBank,
      contexts,
      managerVars: [...this.managerVars],
      slots: this.slots.map(
        (slot) => slot ?? null,
      ),
      exited: this.exited,
      abWaits: this.abWaits,
      change: this.change
        ? { ...this.change }
        : null,
      splRandom: this.splRandom.state,
      factory:
        this.factory?.captureRuntimeSnapshot() ??
        null,
      hall:
        this.hall?.captureRuntimeSnapshot() ??
        null,
      castle:
        this.castle?.captureRuntimeSnapshot() ??
        null,
      arcade:
        this.arcade?.captureRuntimeSnapshot() ??
        null,
    };
  }

  restoreRuntimeSnapshot(
    value: unknown,
  ): void {
    if (
      !validateFrontierRunnerRuntimeSnapshot(
        value,
      )
    ) {
      throw new Error(
        'Invalid Frontier runner runtime snapshot.',
      );
    }

    if (value.scene.id !== this.scene.id) {
      throw new Error(
        `Frontier runner snapshot is for scene ${value.scene.id}, not ${this.scene.id}.`,
      );
    }

    const rand = () => this.r.rng() >>> 16;

    this.textBank = value.textBank;
    this.managerVars.splice(
      0,
      this.managerVars.length,
      ...value.managerVars,
    );
    this.slots.splice(
      0,
      this.slots.length,
      ...value.slots.map(
        (slot) => slot ?? undefined,
      ),
    );
    this.exited = value.exited;
    this.abWaits = value.abWaits;
    this.change = value.change
      ? { ...value.change }
      : null;
    this.splRandom.state = value.splRandom;

    value.contexts.forEach(
      (snapshot, index) => {
        if (!snapshot) {
          this.contexts[index] = null;
          return;
        }

        this.contexts[index] = {
          label: snapshot.label,
          cmds: this.commands(snapshot.label),
          pc: snapshot.pc,
          stack: snapshot.stack.map(
            (frame) => ({
              label: frame.label,
              cmds: this.commands(
                frame.label,
              ),
              pc: frame.pc,
            }),
          ),
          state: snapshot.state,
          wait: null,
          waitState: snapshot.waitState
            ? structuredClone(
                snapshot.waitState,
              )
            : null,
          cmp: snapshot.cmp,
          locals: [...snapshot.locals],
          data: [...snapshot.data],
          textBank: snapshot.textBank,
        };
      },
    );

    this.factory = value.factory
      ? BattleFactory.restoreRuntimeSnapshot(
          this.r.state,
          this.r.registries,
          rand,
          value.factory,
        )
      : null;

    this.hall = value.hall
      ? BattleHall.restoreRuntimeSnapshot(
          this.r.state,
          this.r.registries,
          rand,
          value.hall,
        )
      : null;

    this.castle = value.castle
      ? BattleCastle.restoreRuntimeSnapshot(
          this.r.state,
          this.r.registries,
          rand,
          value.castle,
        )
      : null;

    this.arcade = value.arcade
      ? BattleArcade.restoreRuntimeSnapshot(
          this.r.state,
          this.r.registries,
          rand,
          value.arcade,
        )
      : null;

    this.scene.restoreRuntimeSnapshot(
      value.scene,
    );
    this.splRandom.state = value.splRandom;
  }

  /** Decomp FrontierGraphics_New: the scene's room and music (the scene BGM plays again after a battle too). */
  loadScene(sceneId: number, screen: { color: 'black' | 'white'; alpha: number }): void {
    const data = this.sceneData(sceneId);
    // Decomp BattleFrontier unk_24: the loaded 2D characters outlive the scene (FrontierGraphics is rebuilt).
    const particles = new FrontierParticles(this.splRandom, (n) => this.particleSystem(n));
    this.scene = new FrontierScene(sceneId, data, this.tables, (sheet) => this.animations(sheet), screen, particles, this.scene?.loaded);
    this.textBank = data.textBank;
    if (data.setup) this.setupScene(sceneId);
    if (data.bgm) this.r.audio.playBgm(data.bgm);
  }

  /**
   * Decomp sFrontierScenes' setupFunc: the Factory corridor's BG2 under BG3 (BattleFactoryCorridorSceneSetup); the Hall
   * battle room's BG2 off and blended 8:9 over the room (G2_SetBlendAlpha) and its light animation (ov104_0223D9E4: BG3's
   * two frames; its palette task swaps BG palette 6, which no layer here reads: BG3 and BG2 use extended palettes); the
   * Arcade battle room's BG2 off until an effect shows; the Castle battle room's BG2 and particles under the characters. The
   * BG0 blends of the Factory, Castle and Arcade battle rooms (G2_SetBlendAlpha with BG0 first) are the particles' own
   * translucency. The Arcade corridor's setup is empty; the Wi-Fi facility selector's effects are not built (no Wi-Fi).
   */
  private setupScene(sceneId: number): void {
    switch (sceneId) {
      case SCENE.factoryCorridor:
        this.scene.fgBelow = true;
        return;
      case SCENE.hallBattleRoom: {
        this.scene.fgHidden = true;
        this.scene.fgBlend = { a: 8, b: 9 };
        const lights = this.tables.effects?.hallLights;
        if (lights) this.scene.startHallLights(lights);
        else this.r.log.stub('frontier:hall-lights', 'the pack has no Hall battle room light frames (FrontierTables.effects)');
        return;
      }
      case SCENE.arcadeBattleRoom:
        this.scene.fgHidden = true;
        return;
      case SCENE.castleBattleRoom:
        this.scene.spritesOnTop = true;
        return;
      case SCENE.factoryBattleRoom:
      case SCENE.arcadeCorridor:
        return;
      default:
        this.r.log.stub(`frontier:scene-setup:${sceneId}`, `frontier scene ${sceneId}'s setup effects are not built`);
    }
  }

  /** A frontier_particle.narc particle system (decomp FrontierScrCmd_InitParticleSystem's narcIdx). */
  private particleSystem(narcIdx: number): ParticleSystem {
    for (const p of this.r.registries.particleSystems.values()) if (p.archive === 'frontier' && p.sourceIndex === narcIdx) return p;
    throw new Error(`frontier: no frontier particle system ${narcIdx} in the packs`);
  }

  /** Decomp BattleFrontier_RunSubApp with an application (the Factory's and the Hall's apps): the script waits for it. */
  openApp(
    c: FrontierContext,
    request: AppRequest,
    continuation: FrontierAppContinuation,
  ): FrontierResult {
    if (this.r.app) {
      throw new Error(
        `frontier: open ${request.app} while ${this.r.app.request.app} is open`,
      );
    }

    this.r.app = {
      request,
      result: null,
      continuation: { kind: 'none' },
      done: null,
    };

    return this.pause(
      c,
      () => false,
      {
        kind: 'app',
        continuation,
      },
    );
  }

  /** Decomp BattleFrontier_RunSubApp's return: the scene's music again (the room and its characters are kept). */
  afterSubApp(): void {
    const bgm = this.sceneData(this.scene.id).bgm;
    if (bgm) this.r.audio.playBgm(bgm);
  }

  sceneData(sceneId: number): FrontierSceneData {
    const data = this.tables.scenes[sceneId];
    if (!data) throw new Error(`frontier: no scene ${sceneId}`);
    return data;
  }

  private animations(sheet: Id): readonly Ui2dAnimation[] {
    const s = this.r.registries.ui2d.get(sheet);
    if (!s?.animations) throw new Error(`frontier: sheet ${sheet} has no animations`);
    return s.animations;
  }

  /** Decomp FrontierScriptManager_Load: a new context at `label`, with the scene's text bank. */
  load(label: Id): void {
    const i = this.contexts.findIndex((c) => !c);
    if (i < 0) throw new Error(`frontier: no free script context for ${label}`);
    this.contexts[i] = {
      label,
      cmds: this.commands(label),
      pc: 0,
      stack: [],
      state: 'running',
      wait: null,
      waitState: null,
      cmp: 0,
      locals: Array(8).fill(0),
      data: Array(4).fill(0),
      textBank: this.textBank,
    };
  }

  commands(label: Id): Command[] {
    const l = this.r.labels.get(label);
    if (!l) throw new Error(`frontier: script label ${label} does not exist`);
    return l.commands;
  }

  /** Decomp FrontierScrCmd_ChangeScript / ChangeSceneWithinScript (BattleFrontier_ChangeScene). */
  changeScene(scene: number, entry: Id | null): void {
    this.change = { scene, entry, frames: 0 };
  }

  get done(): boolean {
    return this.exited;
  }

  /** One frame of BattleFrontier_Main (state 1, or a scene change's states 5–6), then the room's tasks. */
  step(input: InputFrame): void {
    if (this.exited) return;
    if (this.change) {
      // State 5 frees the graphics; state 6 builds the new scene (and its script manager, unless the scripts stay).
      if (++this.change.frames < 2) return;
      const { scene, entry } = this.change;
      this.change = null;
      this.loadScene(scene, this.scene.screen);
      if (entry !== null) {
        // ov104_0222E8C8/E8E8: the manager's vars survive the new script manager; its contexts are gone.
        this.contexts.fill(null);
        this.abWaits = 0;
        this.slots.length = 0;
        this.load(entry);
      } else for (const c of this.contexts) if (c) c.textBank = this.textBank;
      this.scene.step();
      return;
    }
    for (let i = 0; i < this.contexts.length; i++) {
      const c = this.contexts[i];
      if (c && !this.run(c, input)) this.contexts[i] = null;
      if (this.exited || this.change) break;
    }
    this.scene.step();
  }

  /** Decomp FrontierScriptContext_Run: false once the context has stopped. */
  private run(c: FrontierContext, input: InputFrame): boolean {
    if (c.state === 'stopped') return false;
    if (c.state === 'waiting') {
      const done = c.waitState
        ? this.resumeRuntimeWait(
            c,
            c.waitState,
            input,
          )
        : c.wait!(input);

      if (done) {
        c.state = 'running';
        c.wait = null;
        c.waitState = null;
      }

      return true;
    }
    for (let n = 0; n < MAX_COMMANDS; n++) {
      const cmd = c.cmds[c.pc];
      if (!cmd) throw new Error(`frontier script ${c.label} ran past its last command`);
      c.pc++;
      this.r.seen.add(cmd.op);
      const h = this.handlers[cmd.op];
      let result: FrontierResult;
      if (!h) {
        this.r.log.stub(`frontier:${cmd.op}`, `unimplemented frontier command ${cmd.op} (no-op)`);
        result = 'continue';
      } else {
        try {
          result = h(this, c, cmd.args);
        } catch (e) {
          throw new Error(`frontier script ${c.label}[${c.pc - 1}] ${cmd.op}: ${(e as Error).message}`, { cause: e });
        }
      }
      if ((c.state as FrontierContext['state']) === 'stopped') return false;
      if (result === 'yield') return true;
    }
    throw new Error(`frontier script ${c.label}: more than ${MAX_COMMANDS} commands without yielding`);
  }

  pause(
    c: FrontierContext,
    wait: FrontierWait,
    waitState: FrontierRuntimeWait | null = null,
  ): FrontierResult {
    c.state = 'waiting';
    c.wait = wait;
    c.waitState = waitState;
    return 'yield';
  }

  private resumeRuntimeWait(
    c: FrontierContext,
    wait: FrontierRuntimeWait,
    input: InputFrame,
  ): boolean {
    switch (wait.kind) {
      case 'next-frame':
        return true;

      case 'time': {
        const left =
          (this.getVar(c, wait.variable) - 1) &
          0xffff;

        this.setVar(c, wait.variable, left);
        return left === 0;
      }

      case 'message':
        return (
          this.r.ui.message?.printer.done ??
          true
        );

      case 'ab': {
        const done =
          input.pressed.includes('a') ||
          input.pressed.includes('b');

        if (done) this.abWaits--;
        return done;
      }

      case 'ab-time':
        if (
          input.pressed.includes('a') ||
          input.pressed.includes('b')
        ) {
          return true;
        }

        c.data[0] =
          (c.data[0]! - 1) & 0xffff;

        return c.data[0] === 0;

      case 'menu': {
        const menu = this.r.ui.menu;

        if (!menu) {
          throw new Error(
            'Frontier menu wait has no menu',
          );
        }

        const touch =
          input.touch?.screen === 'main' &&
          !this.r.lastTouch
            ? input.touch
            : null;

        const before = menu.current;
        const result = menu.step(input, touch);
        const moved = menu.current !== before;

        if (moved || result !== null) {
          this.r.playFieldSe(1500);
        }

        if (result === null) {
          if (
            wait.menuKind === 'list' &&
            moved
          ) {
            const alt = menu.current.altText;

            if (
              alt !== undefined &&
              alt !== NO_ALT_TEXT
            ) {
              this.r.ui.message = {
                printer: new TextPrinter(
                  toPrintOps(
                    this.r.textOf(
                      this.r.bankText(
                        menu.bank,
                        alt,
                      ),
                    ),
                    this.slots,
                  ),
                  {
                    speed:
                      TEXT_SPEED.instant,
                  },
                ),
              };
            }
          }

          return false;
        }

        this.setVar(
          c,
          c.data[0]!,
          result === MENU_RESULT.cancel
            ? 0xfffe
            : result,
        );

        this.r.ui.menu = null;
        return true;
      }

      case 'yes-no': {
        const box = this.r.ui.yesNo;

        if (!box) {
          throw new Error(
            'Frontier yes/no wait has no box',
          );
        }

        const before = box.cursor;
        let result: number | null = null;

        if (input.pressed.includes('a')) {
          result = box.cursor === 0 ? 0 : 1;
        } else if (input.pressed.includes('b')) {
          result = 1;
        } else if (input.pressed.includes('up')) {
          box.cursor = 0;
        } else if (
          input.pressed.includes('down')
        ) {
          box.cursor = 1;
        }

        if (
          result !== null ||
          box.cursor !== before
        ) {
          this.r.playFieldSe(1500);
        }

        if (result === null) return false;

        this.setVar(c, wait.variable, result);
        this.r.ui.yesNo = null;
        return true;
      }

      case 'movement':
        return this.scene.movements === 0;

      case 'sprite':
        return this.scene.spriteDone(wait.slot);

      case 'fade':
        return this.scene.fadeDone();

      case 'audio-se':
        return !this.r.audio.sePlaying(
          wait.sequence,
        );

      case 'fanfare':
        return !this.r.audio.waitFanfare();

      case 'shake':
        return this.scene.shakeDone();

      case 'window':
        return this.scene.windowDone();

      case 'particles':
        return this.scene.particles.idle();

      case 'battle-return':
        if (!this.r.field.battleDone()) {
          return false;
        }

        this.afterSubApp();
        return true;

      case 'app': {
        const result = this.r.app?.result;

        if (!result) return false;

        this.r.app = null;

        switch (wait.continuation.kind) {
          case 'hall-board':
            if (
              result.app !== 'hall-board'
            ) {
              throw new Error(
                `Frontier Hall expected hall-board, got ${result.app}`,
              );
            }

            if (!this.hall) {
              throw new Error(
                'Frontier Hall app has no challenge',
              );
            }

            this.hall.setCell(result.cell);
            break;

          case 'factory-rent':
            if (
              result.app !== 'factory' ||
              !('picks' in result)
            ) {
              throw new Error(
                'Frontier Factory expected a rental result',
              );
            }

            if (!this.factory) {
              throw new Error(
                'Frontier Factory app has no challenge',
              );
            }

            this.factory.setAppResult(
              result.picks,
            );
            break;

          case 'factory-swap':
            if (
              result.app !== 'factory' ||
              !('swap' in result)
            ) {
              throw new Error(
                'Frontier Factory expected a trade result',
              );
            }

            if (!this.factory) {
              throw new Error(
                'Frontier Factory app has no challenge',
              );
            }

            this.factory.setAppResult(
              result.swap
                ? [...result.swap]
                : [0xff, 0],
            );
            break;

          case 'castle':
            if (result.app !== 'castle') {
              throw new Error(
                `Frontier Castle expected castle, got ${result.app}`,
              );
            }

            if (!this.castle) {
              throw new Error(
                'Frontier Castle app has no challenge',
              );
            }

            this.castle.setAppResult(result);
            break;

          case 'arcade':
            if (result.app !== 'arcade') {
              throw new Error(
                `Frontier Arcade expected arcade, got ${result.app}`,
              );
            }

            if (!this.arcade) {
              throw new Error(
                'Frontier Arcade app has no challenge',
              );
            }

            this.arcade.setAppResult(
              result.effect,
              result.cursor,
              result.random,
            );
            break;
        }

        this.afterSubApp();
        return true;
      }

      case 'frontier-wipe': {
        const scene = this.scene;

        if (wait.phase === 'flash') {
          if (!scene.fadeDone()) return false;

          const flashes:
            [boolean, number][] = [
              [true, 3],
              [false, 3],
              [true, 3],
              [false, 3],
            ];

          if (
            wait.flashIndex <
            flashes.length
          ) {
            const [out, ticks] =
              flashes[wait.flashIndex]!;

            wait.flashIndex++;
            scene.startFade(
              out,
              ticks,
              'white',
            );
            return false;
          }

          wait.phase = 'wipe';

          if (wait.wipeType === 0) {
            scene.startFade(
              true,
              12,
              'black',
            );
          } else if (
            wait.wipeType === 1 ||
            wait.wipeType === 2
          ) {
            scene.wipe = new BlockWipe(
              wait.wipeType === 1
                ? 'rows'
                : 'columns',
            );

            return false;
          } else {
            scene.wipe = new LineWipe(
              wait.wipeType === 3 ? 1 : 2,
              scene.lineLayers(),
            );

            scene.startFade(
              true,
              40,
              'black',
            );
          }
        }

        const wipe = scene.wipe;

        if (wait.phase === 'wipe') {
          if (wait.wipeType === 0) {
            return scene.fadeDone();
          }

          if (wipe instanceof BlockWipe) {
            if (wipe.step()) {
              wait.phase = 'end';
            }

            return false;
          }

          if (wipe instanceof LineWipe) {
            wipe.step();

            if (!scene.fadeDone()) {
              return false;
            }

            wipe.bgHidden = true;
            wait.phase = 'end';
            return false;
          }

          throw new Error(
            'Frontier wipe is missing',
          );
        }

        scene.blackOut();
        scene.wipe = null;
        return true;
      }

      case 'brain-cut-in': {
        const cutIn = this.scene.brainCutIn;

        if (!cutIn) {
          throw new Error(
            'Frontier Brain wait has no cut-in',
          );
        }

        if (!cutIn.effect.finished) {
          return false;
        }

        this.scene.brainCutIn = null;
        return true;
      }
    }
  }

  stop(c: FrontierContext): void {
    c.state = 'stopped';
  }

  jump(c: FrontierContext, label: Id): void {
    c.label = label;
    c.cmds = this.commands(label);
    c.pc = 0;
  }

  call(c: FrontierContext, label: Id): void {
    if (c.stack.length + 1 < STACK_SLOTS) c.stack.push({ label: c.label, cmds: c.cmds, pc: c.pc });
    else this.r.log.stub('frontier:call-stack-overflow', `frontier call to ${label} from ${c.label}: the return frame is dropped, as on the DS`);
    this.jump(c, label);
  }

  /** Decomp FrontierScriptContext_Return: an empty stack stops the context (scriptPtr NULL). */
  ret(c: FrontierContext): void {
    const top = c.stack.pop();
    if (!top) {
      this.stop(c);
      return;
    }
    c.label = top.label;
    c.cmds = top.cmds;
    c.pc = top.pc;
  }

  // ---------------------------------------------------------------- vars (decomp FrontierScriptContext_GetVarPointer)

  private cell(c: FrontierContext, id: number): { get(): number; set(v: number): void } | null {
    if (id < FRONTIER_VARS.first || id > FRONTIER_VARS.last) return null;
    const i = id - FRONTIER_VARS.first;
    if (i < 8) return { get: () => c.locals[i]!, set: (v) => void (c.locals[i] = v & 0xffff) };
    if (i < 16) return { get: () => this.managerVars[i - 8]!, set: (v) => void (this.managerVars[i - 8] = v & 0xffff) };
    return { get: () => c.data[i - 16]!, set: (v) => void (c.data[i - 16] = v & 0xffff) };
  }

  /** Decomp FrontierScriptContext_GetVar: a var's value, or the operand itself. */
  val(c: FrontierContext, a: Arg | undefined): number {
    const raw = this.int(a);
    return this.cell(c, raw)?.get() ?? raw;
  }

  /** Decomp FrontierScriptContext_TryGetVarPointer's write. */
  set(c: FrontierContext, a: Arg | undefined, value: number): void {
    const raw = this.int(a);
    const v = this.cell(c, raw);
    if (!v) throw new Error(`0x${raw.toString(16)} is not a frontier var`);
    v.set(value);
  }

  /** A var's value by its id, which must be a var (a pointer the command keeps, as in ctx->data[0]). */
  getVar(c: FrontierContext, id: number): number {
    const v = this.cell(c, id);
    if (!v) throw new Error(`0x${id.toString(16)} is not a frontier var`);
    return v.get();
  }

  setVar(c: FrontierContext, id: number, value: number): void {
    const v = this.cell(c, id);
    if (!v) throw new Error(`0x${id.toString(16)} is not a frontier var`);
    v.set(value);
  }

  int(a: Arg | undefined): number {
    if (a?.kind === 'int') return a.value;
    throw new Error(`expected an int operand, got ${JSON.stringify(a)}`);
  }

  ref(a: Arg | undefined, kind: Arg['kind']): Id {
    if (a && a.kind === kind && 'id' in a) return a.id;
    throw new Error(`expected a ${kind}(...) operand, got ${JSON.stringify(a)}`);
  }

  view(): FrontierView {
    return { ...this.scene.view(), ...(this.abWaits ? { waitsForAB: true as const } : {}) };
  }
}
