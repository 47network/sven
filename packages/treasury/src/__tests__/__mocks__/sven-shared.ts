/**
 * Test stub for @sven/shared. Avoids loading the ESM dist during Jest runs
 * while keeping production imports intact.
 */
export function createLogger(_service: string) {
  const noop = (..._args: unknown[]) => undefined;
  return {
    info: noop, warn: noop, error: noop, debug: noop, trace: noop, fatal: noop,
    child: () => createLogger(_service),
  };
}
export type Logger = ReturnType<typeof createLogger>;
