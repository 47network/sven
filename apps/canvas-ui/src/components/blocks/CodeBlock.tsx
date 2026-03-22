'use client';

import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  content: {
    code?: string;
    language?: string;
    filename?: string;
  } | string;
  metadata?: Record<string, unknown>;
}

export function CodeBlock({ content }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  let code: string;
  let language: string;
  let filename: string | undefined;

  if (typeof content === 'string') {
    code = content;
    language = 'text';
  } else {
    code = content?.code || '';
    language = content?.language || 'text';
    filename = content?.filename;
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-slate-800 px-4 py-1.5 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          {filename && <span className="text-slate-300">{filename}</span>}
          <span className="uppercase">{language}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: '0.8125rem',
          lineHeight: '1.5',
        }}
        showLineNumbers
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
