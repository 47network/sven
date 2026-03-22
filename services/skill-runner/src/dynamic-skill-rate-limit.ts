export type DynamicSkillRateLimitResolution = {
  value: number;
  usedDefault: boolean;
};

export function resolveDynamicSkillCreationHourlyLimit(rawValue: unknown): DynamicSkillRateLimitResolution {
  const DEFAULT_VALUE = 5;
  const MIN_VALUE = 1;
  const MAX_VALUE = 100;

  if (rawValue === null || rawValue === undefined) {
    return { value: DEFAULT_VALUE, usedDefault: false };
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { value: DEFAULT_VALUE, usedDefault: true };
  }

  const normalized = Math.floor(parsed);
  return {
    value: Math.max(MIN_VALUE, Math.min(MAX_VALUE, normalized)),
    usedDefault: false,
  };
}
