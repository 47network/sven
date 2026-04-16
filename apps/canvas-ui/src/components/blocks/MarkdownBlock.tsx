'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface MarkdownBlockProps {
  content: string;
}

const LATEX_PATTERN = /\$\$[\s\S]+?\$\$|\$(?!\s)(?:\\.|[^$\n\\])+\$/;

export function MarkdownBlock({ content }: MarkdownBlockProps) {
  const text = typeof content === 'string' ? content : String(content);
  const hasMath = LATEX_PATTERN.test(text);

  return (
    <div className="canvas-prose">
      <ReactMarkdown
        remarkPlugins={hasMath ? [remarkGfm, remarkMath] : [remarkGfm]}
        rehypePlugins={
          hasMath
            ? [
              [
                rehypeKatex,
                {
                  throwOnError: false,
                  strict: 'ignore',
                  output: 'html',
                },
              ],
            ]
            : []
        }
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
