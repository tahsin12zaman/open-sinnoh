export interface FrontierServiceRuntimeSnapshot<
  Kind extends string,
> {
  kind: Kind;
  data: Record<string, unknown>;
}

const runtimeRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value);

export function validateFrontierServiceRuntimeSnapshot<
  Kind extends string,
>(
  value: unknown,
  kind: Kind,
): value is FrontierServiceRuntimeSnapshot<Kind> {
  return (
    runtimeRecord(value) &&
    value.kind === kind &&
    runtimeRecord(value.data)
  );
}

export function captureFrontierServiceRuntime<
  Kind extends string,
>(
  source: object,
  kind: Kind,
  excluded: readonly string[],
): FrontierServiceRuntimeSnapshot<Kind> {
  const omit = new Set(excluded);

  return {
    kind,
    data: structuredClone(
      Object.fromEntries(
        Object.entries(source).filter(
          ([key]) => !omit.has(key),
        ),
      ),
    ),
  };
}

export function restoreFrontierServiceRuntime<
  Service extends object,
  Kind extends string,
>(
  prototype: Service,
  dependencies: Record<string, unknown>,
  value: unknown,
  kind: Kind,
): Service {
  if (
    !validateFrontierServiceRuntimeSnapshot(
      value,
      kind,
    )
  ) {
    throw new Error(
      `Invalid ${kind} runtime snapshot.`,
    );
  }

  return Object.assign(
    Object.create(prototype) as Service,
    dependencies,
    structuredClone(value.data),
  );
}
