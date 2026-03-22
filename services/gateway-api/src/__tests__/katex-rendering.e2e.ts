import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from '@jest/globals';

const CANVAS_MARKDOWN_BLOCK = path.resolve(__dirname, '../../../../apps/canvas-ui/src/components/blocks/MarkdownBlock.tsx');
const CANVAS_GLOBALS = path.resolve(__dirname, '../../../../apps/canvas-ui/src/app/globals.css');
const CANVAS_LAYOUT = path.resolve(__dirname, '../../../../apps/canvas-ui/src/app/layout.tsx');
const ADMIN_LAYOUT = path.resolve(__dirname, '../../../../apps/admin-ui/src/app/layout.tsx');
const ADMIN_GLOBALS = path.resolve(__dirname, '../../../../apps/admin-ui/src/app/globals.css');
const MESSAGE_BUBBLE = path.resolve(__dirname, '../../../../apps/canvas-ui/src/components/chat/MessageBubble.tsx');

describe('A5 KaTeX Math Rendering', () => {
  it('Unit: Inline math `$E=mc^2$` rendering path is wired', async () => {
    const markdownBlock = await fs.readFile(CANVAS_MARKDOWN_BLOCK, 'utf8');
    expect(markdownBlock.includes('LATEX_PATTERN')).toBe(true);
    expect(markdownBlock.includes('remarkMath')).toBe(true);
    expect(markdownBlock.includes('rehypeKatex')).toBe(true);
    expect(markdownBlock.includes('throwOnError: false')).toBe(true);
  });

  it('Unit: Block math is styled with centered display', async () => {
    const globals = await fs.readFile(CANVAS_GLOBALS, 'utf8');
    expect(globals.includes('.canvas-prose .katex-display')).toBe(true);
    expect(globals.includes('text-center')).toBe(true);
  });

  it('Unit: Invalid LaTeX falls back as raw text without crash path', async () => {
    const markdownBlock = await fs.readFile(CANVAS_MARKDOWN_BLOCK, 'utf8');
    const globals = await fs.readFile(CANVAS_GLOBALS, 'utf8');
    expect(markdownBlock.includes('throwOnError: false')).toBe(true);
    expect(globals.includes('.canvas-prose .katex-error')).toBe(true);
  });

  it('E2E (optional): chat assistant messages route through MarkdownBlock renderer', async () => {
    const bubble = await fs.readFile(MESSAGE_BUBBLE, 'utf8');
    expect(bubble.includes('<MarkdownBlock content={message.text} />')).toBe(true);
  });

  it('Integration: KaTeX CSS loaded in Canvas and Admin layouts', async () => {
    const canvasLayout = await fs.readFile(CANVAS_LAYOUT, 'utf8');
    const adminLayout = await fs.readFile(ADMIN_LAYOUT, 'utf8');
    const adminGlobals = await fs.readFile(ADMIN_GLOBALS, 'utf8');
    expect(canvasLayout.includes("katex/dist/katex.min.css")).toBe(true);
    expect(adminLayout.includes("katex/dist/katex.min.css")).toBe(true);
    expect(adminGlobals.includes('.katex-display')).toBe(true);
  });
});
