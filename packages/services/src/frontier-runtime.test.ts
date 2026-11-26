import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  captureFrontierServiceRuntime,
  restoreFrontierServiceRuntime,
} from './frontier-runtime.ts';

class FixtureService {
  constructor(
    readonly dependency: () => number,
    readonly state: { external: number },
  ) {}

  value = 7;
  nested = { rows: [1, 2, 3] };

  capture() {
    return captureFrontierServiceRuntime(
      this,
      'fixture-service',
      ['dependency', 'state'],
    );
  }

  static restore(
    dependency: () => number,
    state: { external: number },
    value: unknown,
  ): FixtureService {
    return restoreFrontierServiceRuntime(
      FixtureService.prototype,
      { dependency, state },
      value,
      'fixture-service',
    );
  }

  result(): number {
    return (
      this.dependency() +
      this.state.external +
      this.value +
      this.nested.rows[0]!
    );
  }
}

describe('Frontier facility runtime snapshots', () => {
  it('restores data without constructors or retained references', () => {
    const source = new FixtureService(
      () => 5,
      { external: 11 },
    );

    source.value = 13;
    source.nested.rows[0] = 17;

    const snapshot = source.capture();
    const restored = FixtureService.restore(
      () => 19,
      { external: 23 },
      snapshot,
    );

    expect(restored).toBeInstanceOf(
      FixtureService,
    );
    expect(restored.result()).toBe(72);

    snapshot.data.value = 999;
    (
      snapshot.data.nested as {
        rows: number[];
      }
    ).rows[0] = 999;

    expect(restored.result()).toBe(72);
  });

  it('rejects malformed facility snapshots', () => {
    expect(() =>
      FixtureService.restore(
        () => 0,
        { external: 0 },
        {
          kind: 'wrong-service',
          data: {},
        },
      ),
    ).toThrow(
      'Invalid fixture-service runtime snapshot.',
    );
  });
});
