import type { GameState } from '@opensinnoh/contracts';
import type { Id } from '@opensinnoh/core';
import {
  PLATINUM_VARS_COUNT,
  type PlatinumVarsFlags,
} from '@opensinnoh/nds';
import { describe, expect, it } from 'vitest';
import {
  applyPlatinumProgressData,
  convertOpenSinnohProgress,
  type PlatinumProgressRegistries,
} from './platinum-progress.ts';

const id = (value: string): Id => value as Id;

function makeState(): GameState {
  return {
    flags: {
      [id('test:FLAG_FALSE_DEFAULT')]: true,
      [id('test:FLAG_TRUE_DEFAULT_SET')]: false,
      [id('mod:FLAG_KEEP')]: true,
    },
    vars: {
      [id('test:VAR_ZERO_DEFAULT')]: 99,
      [id('test:VAR_FIVE_DEFAULT')]: 99,
      [id('mod:VAR_KEEP')]: 42,
    },
  } as unknown as GameState;
}

function makeProgress(): PlatinumVarsFlags {
  const vars = new Array<number>(
    PLATINUM_VARS_COUNT,
  ).fill(0);

  vars[1] = 7;
  vars[2] = 5;
  vars[3] = 0;

  return {
    vars,
    flags: [2, 4],
  };
}

function makeRegistries(): PlatinumProgressRegistries {
  return {
    flags: new Map([
      [
        id('test:FLAG_FALSE_DEFAULT'),
        {
          id: id('test:FLAG_FALSE_DEFAULT'),
          sourceIndex: 1,
          initial: false,
          scope: 'saved' as const,
        },
      ],
      [
        id('test:FLAG_FALSE_DEFAULT_SET'),
        {
          id: id('test:FLAG_FALSE_DEFAULT_SET'),
          sourceIndex: 2,
          initial: false,
          scope: 'saved' as const,
        },
      ],
      [
        id('test:FLAG_TRUE_DEFAULT'),
        {
          id: id('test:FLAG_TRUE_DEFAULT'),
          sourceIndex: 3,
          initial: true,
          scope: 'saved' as const,
        },
      ],
      [
        id('test:FLAG_TRUE_DEFAULT_SET'),
        {
          id: id('test:FLAG_TRUE_DEFAULT_SET'),
          sourceIndex: 4,
          initial: true,
          scope: 'saved' as const,
        },
      ],
    ]),

    vars: new Map([
      [
        id('test:VAR_ZERO_DEFAULT'),
        {
          id: id('test:VAR_ZERO_DEFAULT'),
          sourceIndex: 0x4000,
          initial: 0,
          scope: 'saved' as const,
        },
      ],
      [
        id('test:VAR_ZERO_CHANGED'),
        {
          id: id('test:VAR_ZERO_CHANGED'),
          sourceIndex: 0x4001,
          initial: 0,
          scope: 'saved' as const,
        },
      ],
      [
        id('test:VAR_FIVE_DEFAULT'),
        {
          id: id('test:VAR_FIVE_DEFAULT'),
          sourceIndex: 0x4002,
          initial: 5,
          scope: 'saved' as const,
        },
      ],
      [
        id('test:VAR_FIVE_CHANGED'),
        {
          id: id('test:VAR_FIVE_CHANGED'),
          sourceIndex: 0x4003,
          initial: 5,
          scope: 'saved' as const,
        },
      ],
    ]),
  };
}

describe('Platinum progress import', () => {
  it('stores only native values differing from registry defaults', () => {
    const base = makeState();

    const imported = applyPlatinumProgressData(
      base,
      makeProgress(),
      makeRegistries(),
    );

    expect(imported.flags).toEqual({
      [id('test:FLAG_FALSE_DEFAULT_SET')]: true,
      [id('test:FLAG_TRUE_DEFAULT')]: false,
      [id('mod:FLAG_KEEP')]: true,
    });

    expect(imported.vars).toEqual({
      [id('test:VAR_ZERO_CHANGED')]: 7,
      [id('test:VAR_FIVE_CHANGED')]: 0,
      [id('mod:VAR_KEEP')]: 42,
    });

    expect(base.flags).toEqual({
      [id('test:FLAG_FALSE_DEFAULT')]: true,
      [id('test:FLAG_TRUE_DEFAULT_SET')]: false,
      [id('mod:FLAG_KEEP')]: true,
    });

    expect(base.vars).toEqual({
      [id('test:VAR_ZERO_DEFAULT')]: 99,
      [id('test:VAR_FIVE_DEFAULT')]: 99,
      [id('mod:VAR_KEEP')]: 42,
    });
  });
});

describe('Platinum progress export', () => {
  it('reconstructs registry-backed native values', () => {
    const exported = convertOpenSinnohProgress(
      makeState(),
      makeProgress(),
      makeRegistries(),
    );

    expect(exported.flags).toEqual([1, 3]);

    expect(exported.vars[0]).toBe(99);
    expect(exported.vars[1]).toBe(0);
    expect(exported.vars[2]).toBe(99);
    expect(exported.vars[3]).toBe(5);
  });

  it('preserves native values without registry records', () => {
    const base = makeProgress();

    base.flags.push(100);
    base.vars[10] = 321;

    const exported = convertOpenSinnohProgress(
      makeState(),
      base,
      makeRegistries(),
    );

    expect(exported.flags).toContain(100);
    expect(exported.vars[10]).toBe(321);
    expect(base.flags).toEqual([2, 4, 100]);
    expect(base.vars[10]).toBe(321);
  });

  it('restores registry defaults when overrides are absent', () => {
    const exported = convertOpenSinnohProgress(
      {
        flags: {},
        vars: {},
      },
      makeProgress(),
      makeRegistries(),
    );

    expect(exported.flags).toEqual([3, 4]);

    expect(exported.vars[0]).toBe(0);
    expect(exported.vars[1]).toBe(0);
    expect(exported.vars[2]).toBe(5);
    expect(exported.vars[3]).toBe(5);
  });
});
