// ---------------------------------------------------------------------------
// Email Composer Skill — Drafts professional emails from context
// ---------------------------------------------------------------------------

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'compose': {
      const context = (input.context as string) || '';
      const tone = (input.tone as string) || 'formal';
      const recipientName = (input.recipient_name as string) || '';
      const senderName = (input.sender_name as string) || '';
      const keyPoints = (input.key_points as string[]) || [];
      const format = (input.format as string) || 'plain';

      if (!context && keyPoints.length === 0) {
        return { error: 'Provide context or key_points to compose an email.' };
      }

      const greeting = buildGreeting(recipientName, tone);
      const body = buildBody(context, keyPoints, tone);
      const closing = buildClosing(senderName, tone);
      const subject = suggestSubjectFromContext(context, keyPoints);

      const plainText = [greeting, '', body, '', closing].join('\n');

      if (format === 'html') {
        const html = toHtml(greeting, body, closing);
        return {
          result: {
            subject,
            body_html: html,
            body_plain: plainText,
            tone,
            format: 'html',
            word_count: plainText.split(/\s+/).length,
          },
        };
      }

      return {
        result: {
          subject,
          body: plainText,
          tone,
          format: 'plain',
          word_count: plainText.split(/\s+/).length,
        },
      };
    }

    case 'suggest_subject': {
      const context = (input.context as string) || '';
      const keyPoints = (input.key_points as string[]) || [];
      const subjects = generateSubjectSuggestions(context, keyPoints);
      return { result: { suggestions: subjects } };
    }

    case 'format': {
      const body = (input.context as string) || '';
      const format = (input.format as string) || 'html';

      if (!body) return { error: 'Provide context (email body) to format.' };

      if (format === 'html') {
        const paragraphs = body.split(/\n\n+/).filter(Boolean);
        const html = paragraphs.map((p) => `<p>${escHtml(p).replace(/\n/g, '<br/>')}</p>`).join('\n');
        return { result: { body_html: `<div style="font-family:sans-serif;line-height:1.6">${html}</div>`, format: 'html' } };
      }

      let plain = body;
      let prev = '';
      while (plain !== prev) { prev = plain; plain = plain.replace(/<[^>]+>/g, ''); }
      return { result: { body: plain, format: 'plain' } };
    }

    default:
      return { error: `Unknown action "${action}". Available: compose, suggest_subject, format` };
  }
}

/* -------- Tone-Based Builders -------- */

const greetings: Record<string, (name: string) => string> = {
  formal: (n) => n ? `Dear ${n},` : 'Dear Sir/Madam,',
  casual: (n) => n ? `Hey ${n},` : 'Hey there,',
  friendly: (n) => n ? `Hi ${n}!` : 'Hi there!',
  urgent: (n) => n ? `Dear ${n},` : 'Dear Team,',
  apologetic: (n) => n ? `Dear ${n},` : 'Dear Sir/Madam,',
};

const closings: Record<string, (name: string) => string> = {
  formal: (n) => `Best regards,\n${n || '[Your Name]'}`,
  casual: (n) => `Cheers,\n${n || '[Your Name]'}`,
  friendly: (n) => `Warm regards,\n${n || '[Your Name]'}`,
  urgent: (n) => `Thank you for your immediate attention.\n\nBest regards,\n${n || '[Your Name]'}`,
  apologetic: (n) => `We sincerely apologize for any inconvenience.\n\nBest regards,\n${n || '[Your Name]'}`,
};

function buildGreeting(recipientName: string, tone: string): string {
  const fn = greetings[tone] || greetings.formal;
  return fn(recipientName);
}

function buildClosing(senderName: string, tone: string): string {
  const fn = closings[tone] || closings.formal;
  return fn(senderName);
}

function buildBody(context: string, keyPoints: string[], tone: string): string {
  const parts: string[] = [];

  if (tone === 'urgent') {
    parts.push('I am writing to bring an urgent matter to your attention.');
  } else if (tone === 'apologetic') {
    parts.push('I am writing to address a matter that requires your attention.');
  }

  if (context) parts.push(context);

  if (keyPoints.length > 0) {
    parts.push('Key points:');
    for (const point of keyPoints) {
      parts.push(`  • ${point}`);
    }
  }

  return parts.join('\n\n');
}

function suggestSubjectFromContext(context: string, keyPoints: string[]): string {
  const source = context || keyPoints.join(' ');
  if (!source) return 'No Subject';

  // Extract first meaningful clause (up to 60 chars)
  const firstLine = source.split(/[.\n]/)[0].trim();
  if (firstLine.length <= 60) return firstLine;
  return firstLine.slice(0, 57) + '...';
}

function generateSubjectSuggestions(context: string, keyPoints: string[]): string[] {
  const source = context || keyPoints.join('. ');
  if (!source) return ['Follow Up', 'Quick Note', 'Action Required'];

  const words = source.split(/\s+/).slice(0, 8).join(' ');
  return [
    words.length > 50 ? words.slice(0, 47) + '...' : words,
    `Re: ${words.split(' ').slice(0, 4).join(' ')}`,
    `Follow Up: ${words.split(' ').slice(0, 4).join(' ')}`,
  ];
}

/* -------- HTML Helpers -------- */

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toHtml(greeting: string, body: string, closing: string): string {
  const g = `<p>${escHtml(greeting)}</p>`;
  const b = body.split(/\n\n+/).map((p) => {
    if (p.includes('  •')) {
      const items = p.split('\n').filter((l) => l.trim().startsWith('•'));
      const header = p.split('\n')[0];
      return `<p>${escHtml(header)}</p><ul>${items.map((i) => `<li>${escHtml(i.replace(/^\s*•\s*/, ''))}</li>`).join('')}</ul>`;
    }
    return `<p>${escHtml(p).replace(/\n/g, '<br/>')}</p>`;
  }).join('\n');
  const c = `<p>${escHtml(closing).replace(/\n/g, '<br/>')}</p>`;

  return `<div style="font-family:sans-serif;line-height:1.6">\n${g}\n${b}\n${c}\n</div>`;
}
