/**
 * Stealth commit — clean autonomous commits for self-healing agents.
 *
 * When an autonomous agent fixes bugs, deploys patches, or updates config,
 * commits should look professional — no "AI-generated" noise, no model
 * fingerprints, no attribution markers that leak implementation details.
 *
 * Features:
 * - Conventional Commit message formatting & validation
 * - AI marker detection and removal
 * - Configurable author identity (from env/config)
 * - Commit plan builder for multi-file changes
 * - Message template system for consistent messaging
 *
 * Prior art: Git's own commit formatting, Conventional Commits spec,
 * .mailmap author mapping, Husky commit-msg hooks, commitlint,
 * enterprise CLA-bot commit rewriting.
 */

import { createLogger } from './logger.js';

const log = createLogger('stealth-commit');

// ── AI markers to strip ───────────────────────────────────────────

const AI_MARKER_PATTERNS: RegExp[] = [
  /\b(?:ai[- ]?generated|auto[- ]?generated|machine[- ]?generated)\b/gi,
  /\b(?:co[- ]?authored[- ]?by|assisted[- ]?by):?\s*(?:ai|gpt|claude|copilot|llm|model)\b/gi,
  /\bgenerated\s+(?:by|using|with|via)\s+(?:ai|gpt|claude|copilot|llm|chatgpt)\b/gi,
  /\[(?:ai|bot|auto|generated)\]/gi,
  /<!--\s*(?:ai|generated|auto)[\s\S]*?-->/gi,
  /\b(?:claude|gpt-?\d|chatgpt|copilot|gemini|llama)\s+(?:wrote|generated|created|authored|produced)\b/gi,
  /🤖\s*/g,
  /\bautomatic(?:ally)?\s+(?:generated|created|fixed|patched)\b/gi,
];

// ── Conventional Commit types ─────────────────────────────────────

const VALID_CC_TYPES = new Set([
  'feat', 'fix', 'perf', 'refactor', 'test', 'docs',
  'chore', 'ci', 'build', 'revert', 'style',
]);

const CC_PATTERN = /^(\w+)(?:\(([^)]+)\))?(!)?:\s+(.+)$/;

// ── Types ─────────────────────────────────────────────────────────

export interface StealthCommitConfig {
  /** Git author name for autonomous commits. */
  authorName: string;
  /** Git author email for autonomous commits. */
  authorEmail: string;
  /** Enforce Conventional Commit format. Default true. */
  conventionalCommit: boolean;
  /** Strip known AI attribution markers. Default true. */
  stripAiMarkers: boolean;
  /** Max subject line length. Default 72. */
  maxSubjectLength: number;
  /** Additional custom marker patterns to strip. */
  customMarkerPatterns?: RegExp[];
}

export interface CommitPlan {
  /** Conventional Commit type. */
  type: 'feat' | 'fix' | 'perf' | 'refactor' | 'test' | 'docs' | 'chore' | 'ci' | 'build' | 'revert' | 'style';
  /** Scope (module/service name). */
  scope?: string;
  /** Short imperative description. */
  description: string;
  /** Extended body (what and why). */
  body?: string;
  /** Breaking change description. */
  breaking?: string;
  /** Issue/PR reference (e.g. "Closes #123"). */
  references?: string[];
  /** Files to include in the commit. */
  files: string[];
}

export interface CommitMessage {
  /** Full formatted message. */
  full: string;
  /** Subject line only. */
  subject: string;
  /** Body portion only. */
  body: string;
  /** Footer portion only. */
  footer: string;
}

export interface CommitArgs {
  /** Git commit CLI arguments. */
  args: string[];
  /** Environment variables to set. */
  env: Record<string, string>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ── Default config ────────────────────────────────────────────────

const DEFAULT_CONFIG: StealthCommitConfig = {
  authorName: 'Sven',
  authorEmail: 'sven@sven.systems',
  conventionalCommit: true,
  stripAiMarkers: true,
  maxSubjectLength: 72,
};

// ── StealthCommitter ──────────────────────────────────────────────

export class StealthCommitter {
  private readonly config: StealthCommitConfig;

  constructor(config?: Partial<StealthCommitConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Format a commit plan into a clean commit message.
   */
  formatMessage(plan: CommitPlan): CommitMessage {
    // Subject line
    const breakingMark = plan.breaking ? '!' : '';
    const scopePart = plan.scope ? `(${plan.scope})` : '';
    let subject = `${plan.type}${scopePart}${breakingMark}: ${plan.description}`;

    if (subject.length > this.config.maxSubjectLength) {
      subject = subject.slice(0, this.config.maxSubjectLength - 3) + '...';
    }

    // Body
    let body = '';
    if (plan.body) {
      body = plan.body;
    }

    // Footer
    const footerParts: string[] = [];
    if (plan.breaking) {
      footerParts.push(`BREAKING CHANGE: ${plan.breaking}`);
    }
    if (plan.references?.length) {
      footerParts.push(...plan.references);
    }
    const footer = footerParts.join('\n');

    // Full message
    const parts = [subject];
    if (body) parts.push('', body);
    if (footer) parts.push('', footer);
    let full = parts.join('\n');

    // Sanitize
    if (this.config.stripAiMarkers) {
      full = this.sanitizeMessage(full);
    }

    return { full, subject, body, footer };
  }

  /**
   * Strip all AI attribution markers from a message.
   */
  sanitizeMessage(raw: string): string {
    let result = raw;
    const allPatterns = [
      ...AI_MARKER_PATTERNS,
      ...(this.config.customMarkerPatterns ?? []),
    ];

    for (const pattern of allPatterns) {
      result = result.replace(pattern, '');
    }

    // Clean up double spaces and blank lines left by removal
    while (result.includes('  ')) result = result.replace('  ', ' ');
    result = result.replace(/\n{3,}/g, '\n\n');
    result = result.trim();

    return result;
  }

  /**
   * Build git commit CLI arguments from a commit plan.
   */
  buildCommitArgs(plan: CommitPlan): CommitArgs {
    const message = this.formatMessage(plan);
    const args: string[] = ['commit'];

    // Author
    args.push('--author', `${this.config.authorName} <${this.config.authorEmail}>`);

    // Message
    args.push('-m', message.full);

    // Specific files (no -a to avoid unintended staging)
    if (plan.files.length > 0) {
      args.push('--', ...plan.files);
    }

    const env: Record<string, string> = {
      GIT_AUTHOR_NAME: this.config.authorName,
      GIT_AUTHOR_EMAIL: this.config.authorEmail,
      GIT_COMMITTER_NAME: this.config.authorName,
      GIT_COMMITTER_EMAIL: this.config.authorEmail,
    };

    log.info('Commit args built', {
      type: plan.type,
      scope: plan.scope,
      fileCount: plan.files.length,
    });

    return { args, env };
  }

  /**
   * Validate a commit message against Conventional Commit format.
   */
  validateConventionalCommit(message: string): ValidationResult {
    const errors: string[] = [];
    const lines = message.split('\n');
    const subject = lines[0] ?? '';

    if (!subject) {
      errors.push('Empty commit message');
      return { valid: false, errors };
    }

    if (this.config.conventionalCommit) {
      const match = CC_PATTERN.exec(subject);
      if (!match) {
        errors.push('Subject does not match Conventional Commit format: type(scope): description');
      } else {
        const [, type] = match;
        if (!VALID_CC_TYPES.has(type!)) {
          errors.push(`Invalid type "${type}". Allowed: ${[...VALID_CC_TYPES].join(', ')}`);
        }
      }
    }

    if (subject.length > this.config.maxSubjectLength) {
      errors.push(`Subject too long (${subject.length} > ${this.config.maxSubjectLength})`);
    }

    if (subject.endsWith('.')) {
      errors.push('Subject should not end with a period');
    }

    // Check for AI markers
    if (this.config.stripAiMarkers) {
      for (const pattern of AI_MARKER_PATTERNS) {
        // Reset lastIndex for global patterns
        pattern.lastIndex = 0;
        if (pattern.test(message)) {
          errors.push(`Contains AI marker matching ${pattern.source}`);
          pattern.lastIndex = 0;
        }
      }
    }

    // Second line should be blank (if body exists)
    if (lines.length > 1 && lines[1]!.trim() !== '') {
      errors.push('Second line should be blank (separating subject from body)');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Detect if a string contains AI attribution markers.
   */
  hasAiMarkers(text: string): boolean {
    for (const pattern of AI_MARKER_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        pattern.lastIndex = 0;
        return true;
      }
    }
    return false;
  }

  /**
   * Create a commit plan from a simple description of what was fixed.
   */
  quickFix(description: string, files: string[], scope?: string): CommitPlan {
    return {
      type: 'fix',
      scope,
      description: description.toLowerCase().replace(/^fix(?:ed|es|ing)?[:\s]*/i, ''),
      files,
    };
  }

  /**
   * Load config from environment variables.
   */
  static fromEnv(): StealthCommitter {
    return new StealthCommitter({
      authorName: process.env['SVEN_COMMIT_AUTHOR_NAME'] ?? 'Sven',
      authorEmail: process.env['SVEN_COMMIT_AUTHOR_EMAIL'] ?? 'sven@sven.systems',
      conventionalCommit: process.env['SVEN_COMMIT_CONVENTIONAL'] !== 'false',
      stripAiMarkers: process.env['SVEN_COMMIT_STRIP_AI'] !== 'false',
      maxSubjectLength: parseInt(process.env['SVEN_COMMIT_MAX_SUBJECT'] ?? '72', 10) || 72,
    });
  }
}
