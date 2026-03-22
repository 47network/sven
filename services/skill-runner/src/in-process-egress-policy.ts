export function validateInProcessEgressPolicy(params: {
  toolName: string;
  permissions: string[];
  inputs: Record<string, unknown>;
}): { ok: true } | { ok: false; error: string } {
  const toolName = String(params.toolName || '').trim();
  const permissions = Array.isArray(params.permissions) ? params.permissions : [];
  const hasWebScope = permissions.some((permission) => String(permission || '').startsWith('web.'));
  if (hasWebScope) {
    return {
      ok: false,
      error: 'In-process execution is not permitted for web-scoped tools; use container/gvisor execution mode',
    };
  }

  if (toolName === 'analyze.media') {
    const url = String((params.inputs || {}).url || '').trim();
    if (url) {
      return {
        ok: false,
        error: 'analyze.media URL mode is not permitted in in-process execution; use approved containerized execution path',
      };
    }
  }

  return { ok: true };
}

