// ---------------------------------------------------------------------------
// Email Reply Skill — Generates contextual email replies
// ---------------------------------------------------------------------------

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'reply': {
      const original = (input.original_email as OriginalEmail) || {};
      const tone = (input.tone as string) || 'formal';
      const intent = (input.intent as string) || '';
      const includeOriginal = input.include_original !== false;

      if (!original.body && !original.subject) {
        return { error: 'Provide original_email with at least a body or subject.' };
      }

      const senderName = extractName(original.from || '');
      const greeting = buildGreeting(senderName, tone);
      const opening = buildOpening(original, tone);
      const body = intent || 'Thank you for your email. I will review and get back to you shortly.';
      const closing = buildClosing(tone);

      const parts = [greeting, '', opening, '', body, '', closing];
      if (includeOriginal) {
        parts.push('', `--- Original Message ---`);
        parts.push(`From: ${original.from || 'Unknown'}`);
        if (original.date) parts.push(`Date: ${original.date}`);
        parts.push(`Subject: ${original.subject || '(no subject)'}`);
        parts.push('', original.body || '');
      }

      const replySubject = original.subject
        ? (original.subject.startsWith('Re:') ? original.subject : `Re: ${original.subject}`)
        : 'Re: Your Email';

      return {
        result: {
          subject: replySubject,
          body: parts.join('\n'),
          to: original.from || '',
          tone,
          includes_original: includeOriginal,
        },
      };
    }

    case 'follow_up': {
      const original = (input.original_email as OriginalEmail) || {};
      const tone = (input.tone as string) || 'formal';
      const intent = (input.intent as string) || 'checking in on the status';

      const senderName = extractName(original.from || '');
      const greeting = buildGreeting(senderName, tone);

      const body = [
        greeting,
        '',
        `I wanted to follow up on ${original.subject ? `the topic of "${original.subject}"` : 'our previous conversation'}.`,
        '',
        intent,
        '',
        'Please let me know if you need any additional information.',
        '',
        buildClosing(tone),
      ].join('\n');

      const subject = original.subject
        ? `Follow Up: ${original.subject.replace(/^(Re:\s*|Follow Up:\s*)/i, '')}`
        : 'Follow Up';

      return {
        result: { subject, body, to: original.from || '', tone, type: 'follow_up' },
      };
    }

    case 'acknowledge': {
      const original = (input.original_email as OriginalEmail) || {};
      const tone = (input.tone as string) || 'formal';

      const senderName = extractName(original.from || '');
      const greeting = buildGreeting(senderName, tone);

      const body = [
        greeting,
        '',
        `Thank you for your email${original.subject ? ` regarding "${original.subject}"` : ''}.`,
        'I have received it and will review it shortly.',
        '',
        buildClosing(tone),
      ].join('\n');

      const subject = original.subject
        ? (original.subject.startsWith('Re:') ? original.subject : `Re: ${original.subject}`)
        : 'Re: Your Email';

      return {
        result: { subject, body, to: original.from || '', tone, type: 'acknowledgement' },
      };
    }

    default:
      return { error: `Unknown action "${action}". Available: reply, follow_up, acknowledge` };
  }
}

/* -------- Types -------- */

interface OriginalEmail {
  from?: string;
  subject?: string;
  body?: string;
  date?: string;
}

/* -------- Helpers -------- */

function extractName(from: string): string {
  // Handle "Name <email>" format
  const match = from.match(/^([^<]+)</);
  if (match) return match[1].trim();
  // Handle bare email
  if (from.includes('@')) return from.split('@')[0];
  return from;
}

function buildGreeting(name: string, tone: string): string {
  if (tone === 'casual') return name ? `Hey ${name},` : 'Hey,';
  if (tone === 'friendly') return name ? `Hi ${name},` : 'Hi,';
  return name ? `Dear ${name},` : 'Hello,';
}

function buildOpening(original: OriginalEmail, tone: string): string {
  if (tone === 'concise') return '';
  if (original.subject) {
    return `Thank you for your email regarding "${original.subject}".`;
  }
  return 'Thank you for your email.';
}

function buildClosing(tone: string): string {
  if (tone === 'casual') return 'Cheers';
  if (tone === 'friendly') return 'Warm regards';
  if (tone === 'concise') return 'Best';
  return 'Best regards';
}
