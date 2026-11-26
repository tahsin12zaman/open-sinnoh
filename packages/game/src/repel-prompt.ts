/**
 * The repeat-Repel prompt (OpenSinnoh, `DeviceOptions.repelPrompt`; the classic-remake behaviour of HGSS, not
 * Platinum's): when the last Repel step has started CommonScript_RepelsEffectWoreOff and that script has ended, the
 * field asks "Use another …?" if the Bag still holds the kind used last (`GameState.repelItem`). YES uses one as the
 * Bag's USE does (TryUseRepel, then Bag_Text_UsedRepel); NO closes the box. The question follows the script in the
 * same tick, so no save can fall between them.
 */
import { itemCount, type GameState, type Registries, type ScriptRunner } from '@opensinnoh/contracts';
import type { Id } from '@opensinnoh/core';

export interface RepelPromptDeps {
  registries: Registries;
  state: () => GameState;
  scripts: () => ScriptRunner;
  /** The base pack's namespace (the texts are its `Bag_Text_*` and `Lantern_*` records). */
  ns: string;
  on(): boolean;
}

export function repelPrompt(d: RepelPromptDeps) {
  let pending = false;
  return {
    captureRuntimeSnapshot: () => ({
      pending,
    }),
    restoreRuntimeSnapshot(value: unknown): void {
      if (
        typeof value !== 'object' ||
        value === null ||
        Array.isArray(value) ||
        typeof (
          value as { pending?: unknown }
        ).pending !== 'boolean'
      ) {
        throw new Error(
          'invalid repeat-Repel runtime snapshot',
        );
      }

      pending = (
        value as { pending: boolean }
      ).pending;
    },
    /** Before the field's tick: the Repel's steps left. */
    before: () => d.state().repel,
    /** After the field's tick: whether the Repel wore off in it, and the question once its script has ended. */
    after(before: number): void {
      const state = d.state();
      const scripts = d.scripts();
      if (before > 0 && state.repel === 0 && d.on()) pending = true;
      if (!pending || scripts.running()) return;
      pending = false;
      const item = state.repelItem;
      if (!item || itemCount(state, item) < 1) return;
      const name = d.registries.items.get(item)?.name;
      if (name === undefined) throw new Error(`repel prompt: no item ${item}`);
      scripts.ask(
        `${d.ns}:Lantern_Repel_UseAnother` as Id,
        [name],
        {
          kind: 'repel',
          item,
          usedText:
            `${d.ns}:Bag_Text_UsedRepel` as Id,
          itemName: name,
        },
      );
    },
  };
}
