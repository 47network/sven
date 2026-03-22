'use client';

import { useMemo } from 'react';
import katex from 'katex';

type Segment =
  | { type: 'text'; value: string }
  | { type: 'math'; value: string; displayMode: boolean };

const MATH_PATTERN = /\$\$([\s\S]+?)\$\$|\$((?:\\.|[^$\n])+?)\$/g;

function splitMathSegments(input: string): Segment[] {
  const text = String(input || '');
  if (!text) return [{ type: 'text', value: '' }];

  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MATH_PATTERN.exec(text)) !== null) {
    const full = match[0] || '';
    const index = match.index;
    if (index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, index) });
    }
    const displayExpr = match[1];
    const inlineExpr = match[2];
    if (typeof displayExpr === 'string') {
      segments.push({ type: 'math', value: displayExpr.trim(), displayMode: true });
    } else if (typeof inlineExpr === 'string') {
      segments.push({ type: 'math', value: inlineExpr.trim(), displayMode: false });
    } else {
      segments.push({ type: 'text', value: full });
    }
    lastIndex = index + full.length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return segments;
}

export function KatexText({ text, className = '' }: { text: string; className?: string }) {
  const segments = useMemo(() => splitMathSegments(text), [text]);

  return (
    <div className={className}>
      {segments.map((segment, idx) => {
        if (segment.type === 'text') {
          return (
            <span key={`t-${idx}`} className="whitespace-pre-wrap">
              {segment.value}
            </span>
          );
        }

        const rendered = katex.renderToString(segment.value, {
          throwOnError: false,
          strict: 'ignore',
          displayMode: segment.displayMode,
        });

        if (segment.displayMode) {
          return (
            <div
              key={`m-${idx}`}
              className="my-2 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: rendered }}
            />
          );
        }

        return (
          <span
            key={`m-${idx}`}
            className="mx-0.5 inline-block align-middle"
            dangerouslySetInnerHTML={{ __html: rendered }}
          />
        );
      })}
    </div>
  );
}

