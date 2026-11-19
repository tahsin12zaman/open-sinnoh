import type {
  GameState,
  Registries,
} from '@opensinnoh/contracts';
import {
  PLATINUM_FLAGS_COUNT,
  PLATINUM_VARS_END,
  PLATINUM_VARS_START,
  readPlatinumVarsFlags,
  type PlatinumVarsFlags,
} from '@opensinnoh/nds';

export type PlatinumProgressRegistries = Pick<
  Registries,
  'flags' | 'vars'
>;

export function applyPlatinumProgressData(
  state: GameState,
  progress: PlatinumVarsFlags,
  registries: PlatinumProgressRegistries,
): GameState {
  const flags = {
    ...state.flags,
  };

  const setFlags = new Set(progress.flags);

  for (const record of registries.flags.values()) {
    const sourceIndex = record.sourceIndex;

    if (
      sourceIndex === undefined ||
      sourceIndex <= 0 ||
      sourceIndex >= PLATINUM_FLAGS_COUNT
    ) {
      continue;
    }

    const value = setFlags.has(sourceIndex);

    if (value === record.initial) {
      delete flags[record.id];
    } else {
      flags[record.id] = value;
    }
  }

  const vars = {
    ...state.vars,
  };

  for (const record of registries.vars.values()) {
    const sourceIndex = record.sourceIndex;

    if (
      sourceIndex === undefined ||
      sourceIndex < PLATINUM_VARS_START ||
      sourceIndex >= PLATINUM_VARS_END
    ) {
      continue;
    }

    const value =
      progress.vars[sourceIndex - PLATINUM_VARS_START]!;

    if (value === record.initial) {
      delete vars[record.id];
    } else {
      vars[record.id] = value;
    }
  }

  return {
    ...state,
    flags,
    vars,
  };
}

export function applyPlatinumProgress(
  state: GameState,
  save: Uint8Array,
  registries: PlatinumProgressRegistries,
): GameState {
  return applyPlatinumProgressData(
    state,
    readPlatinumVarsFlags(save),
    registries,
  );
}