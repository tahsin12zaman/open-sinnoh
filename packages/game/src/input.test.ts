import { describe, expect, it } from 'vitest';
import { InputState } from './input.ts';

describe('runtime input snapshots', () => {
  it('restores held buttons and press-edge history', () => {
    const input = new InputState();

    input.press('a');
    input.sample();
    input.press('b');
    input.touch(31, 47);
    input.tap('menu:2');

    const snapshot = input.capture();
    const restored = new InputState();

    restored.restore(snapshot);

    expect(restored.sample()).toEqual({
      held: ['a', 'b'],
      pressed: ['b'],
      touch: {
        x: 31,
        y: 47,
      },
      tap: 'menu:2',
    });

    expect(restored.sample()).toEqual({
      held: ['a', 'b'],
      pressed: [],
      touch: {
        x: 31,
        y: 47,
      },
    });
  });

  it('does not retain references to snapshot data', () => {
    const input = new InputState();

    input.press('left');
    input.touch(10, 20);

    const snapshot = input.capture();
    const restored = new InputState();

    restored.restore(snapshot);

    snapshot.held.length = 0;

    if (snapshot.touch) {
      snapshot.touch.x = 99;
    }

    expect(restored.capture()).toEqual({
      held: ['left'],
      previous: [],
      touch: {
        x: 10,
        y: 20,
      },
      tap: null,
    });
  });
});
