export function buildHaServicePayload(inputs: Record<string, unknown>): Record<string, unknown> {
  const payloadFromData =
    inputs.data && typeof inputs.data === 'object' && !Array.isArray(inputs.data)
      ? { ...(inputs.data as Record<string, unknown>) }
      : {};

  const payload: Record<string, unknown> = { ...payloadFromData };

  if (typeof inputs.entity_id === 'string' && inputs.entity_id.trim()) {
    payload.entity_id = inputs.entity_id.trim();
  }

  return payload;
}

