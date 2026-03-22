const UNAVAILABLE_PATTERNS = [
  'not found',
  'already',
  'expired',
];

export function mapApprovalVoteErrorToUserMessage(err: unknown): string {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : String(err || '');
  const normalized = message.toLowerCase();

  if (normalized.includes('requester cannot vote')) {
    return 'Vote rejected. Requesters cannot vote on their own approvals.';
  }

  if (UNAVAILABLE_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return 'Approval unavailable. It may be expired, resolved, or invalid.';
  }

  return 'Approval vote rejected.';
}

