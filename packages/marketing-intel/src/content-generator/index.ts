// ---------------------------------------------------------------------------
// Content Generation Pipeline
// ---------------------------------------------------------------------------
// Types and utilities for multi-format content creation: blogs, social posts,
// newsletters, product announcements, video scripts, case studies. Includes
// brief generation, content structure, and publishing pipeline.
// ---------------------------------------------------------------------------

/* ------------------------------------------------------------------ types */

export type ContentType =
  | 'blog_post'
  | 'social_post'
  | 'newsletter'
  | 'product_announcement'
  | 'video_script'
  | 'case_study'
  | 'documentation';

export type ContentStatus = 'draft' | 'review' | 'approved' | 'published' | 'archived';

export type Channel = 'blog' | 'twitter' | 'linkedin' | 'reddit' | 'email' | 'youtube' | 'tiktok' | 'docs';

export interface ContentBrief {
  id: string;
  contentType: ContentType;
  channel: Channel;
  title: string;
  targetAudience: string;
  keyPoints: string[];
  callToAction: string;
  tone: string;
  wordCountTarget: { min: number; max: number };
  keywords: string[];
  references: string[];
  createdAt: string;
}

export interface ContentPiece {
  id: string;
  briefId: string;
  title: string;
  contentType: ContentType;
  status: ContentStatus;
  channel: Channel;
  body: string;
  brief: ContentBrief;
  brandCheckScore: number | null;
  createdAt: string;
  publishedAt: string | null;
  scheduledFor: string | null;
  performance: ContentPerformance | null;
}

export interface ContentPerformance {
  views: number;
  clicks: number;
  shares: number;
  comments: number;
  conversions: number;
  engagementRate: number; // 0.0-1.0
  measuredAt: string;
}

export interface ContentCalendarEntry {
  date: string; // ISO-8601 date
  channel: Channel;
  contentType: ContentType;
  title: string;
  status: ContentStatus;
  contentId: string | null;
}

/* --------------------------------------------------- content type configs */

const CONTENT_CONFIGS: Record<ContentType, { minWords: number; maxWords: number; channels: Channel[] }> = {
  blog_post: { minWords: 800, maxWords: 2500, channels: ['blog'] },
  social_post: { minWords: 10, maxWords: 280, channels: ['twitter', 'linkedin', 'reddit'] },
  newsletter: { minWords: 400, maxWords: 1200, channels: ['email'] },
  product_announcement: { minWords: 200, maxWords: 800, channels: ['blog', 'twitter', 'linkedin', 'email'] },
  video_script: { minWords: 300, maxWords: 1500, channels: ['youtube', 'tiktok'] },
  case_study: { minWords: 1000, maxWords: 3000, channels: ['blog', 'docs'] },
  documentation: { minWords: 500, maxWords: 5000, channels: ['docs'] },
};

/* -------------------------------------------------------- brief generation */

export function createBrief(
  contentType: ContentType,
  channel: Channel,
  title: string,
  opts: Partial<Pick<ContentBrief, 'targetAudience' | 'keyPoints' | 'callToAction' | 'tone' | 'keywords' | 'references'>> = {},
): ContentBrief {
  const config = CONTENT_CONFIGS[contentType];
  return {
    id: crypto.randomUUID(),
    contentType,
    channel,
    title,
    targetAudience: opts.targetAudience ?? 'Engineering leaders and technical founders',
    keyPoints: opts.keyPoints ?? [],
    callToAction: opts.callToAction ?? 'Get started with Sven today',
    tone: opts.tone ?? 'professional, innovative, approachable',
    wordCountTarget: { min: config.minWords, max: config.maxWords },
    keywords: opts.keywords ?? [],
    references: opts.references ?? [],
    createdAt: new Date().toISOString(),
  };
}

export function createContentPiece(
  brief: ContentBrief,
  body: string,
): ContentPiece {
  return {
    id: crypto.randomUUID(),
    briefId: brief.id,
    title: brief.title,
    contentType: brief.contentType,
    status: 'draft',
    channel: brief.channel,
    body,
    brief,
    brandCheckScore: null,
    createdAt: new Date().toISOString(),
    publishedAt: null,
    scheduledFor: null,
    performance: null,
  };
}

/* ------------------------------------------------------- content analysis */

export interface ContentAnalysis {
  wordCount: number;
  readingTimeMinutes: number;
  headingCount: number;
  linkCount: number;
  imageRefs: number;
  codeBlockCount: number;
  withinWordTarget: boolean;
  readabilityGrade: 'easy' | 'moderate' | 'advanced';
  suggestions: string[];
}

function calculateReadabilityGrade(words: string[], wordCount: number, body: string): ContentAnalysis['readabilityGrade'] {
  if (wordCount === 0) return 'moderate';
  const avgWordLen = words.reduce((s, w) => s + w.length, 0) / words.length;
  const sentenceCount = (body.match(/[.!?]+/g) ?? []).length || 1;
  const avgSentLen = wordCount / sentenceCount;
  if (avgWordLen < 5 && avgSentLen < 15) return 'easy';
  if (avgWordLen > 6 || avgSentLen > 25) return 'advanced';
  return 'moderate';
}

function generateSuggestions(
  brief: ContentBrief,
  metrics: { wordCount: number; withinWordTarget: boolean; headingCount: number; imageRefs: number; readabilityGrade: ContentAnalysis['readabilityGrade'] }
): string[] {
  const suggestions: string[] = [];
  if (!metrics.withinWordTarget) {
    if (metrics.wordCount < brief.wordCountTarget.min) {
      suggestions.push(
        `Content is ${brief.wordCountTarget.min - metrics.wordCount} words short of minimum target`,
      );
    } else {
      suggestions.push(
        `Content exceeds max target by ${metrics.wordCount - brief.wordCountTarget.max} words`,
      );
    }
  }
  if (brief.contentType === 'blog_post' && metrics.headingCount < 3) {
    suggestions.push('Add more headings for better scannability');
  }
  if (brief.contentType === 'blog_post' && metrics.imageRefs === 0) {
    suggestions.push('Consider adding images or diagrams');
  }
  if (metrics.readabilityGrade === 'advanced' && brief.contentType !== 'documentation') {
    suggestions.push('Simplify language for broader audience reach');
  }
  return suggestions;
}

export function analyzeContent(
  body: string,
  brief: ContentBrief,
): ContentAnalysis {
  const words = body.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;
  const readingTimeMinutes = Math.ceil(wordCount / 230);
  const headingCount = (body.match(/^#{1,6} /gm) ?? []).length;
  const linkCount = (body.match(/\[[^\]]{0,1000}\]\([^)]{0,2000}\)/g) ?? []).length;
  const imageRefs = (body.match(/!\[[^\]]{0,1000}\]\([^)]{0,2000}\)/g) ?? []).length;
  const codeBlockCount = (body.match(/```/g) ?? []).length / 2;

  const withinWordTarget =
    wordCount >= brief.wordCountTarget.min && wordCount <= brief.wordCountTarget.max;

  const readabilityGrade = calculateReadabilityGrade(words, wordCount, body);

  const suggestions = generateSuggestions(brief, {
    wordCount,
    withinWordTarget,
    headingCount,
    imageRefs,
    readabilityGrade,
  });

  return {
    wordCount,
    readingTimeMinutes,
    headingCount,
    linkCount,
    imageRefs,
    codeBlockCount: Math.floor(codeBlockCount),
    withinWordTarget,
    readabilityGrade,
    suggestions,
  };
}

/* --------------------------------------------------------- content calendar */

export function generateCalendar(
  startDate: string,
  weeks: number,
  channels: Channel[],
): ContentCalendarEntry[] {
  const entries: ContentCalendarEntry[] = [];
  const start = new Date(startDate);

  const channelSchedule: Record<Channel, { dayOfWeek: number; contentType: ContentType; frequency: 'daily' | 'weekly' | 'biweekly' }[]> = {
    blog: [{ dayOfWeek: 2, contentType: 'blog_post', frequency: 'weekly' }],
    twitter: [
      { dayOfWeek: 1, contentType: 'social_post', frequency: 'daily' },
      { dayOfWeek: 3, contentType: 'social_post', frequency: 'daily' },
      { dayOfWeek: 5, contentType: 'social_post', frequency: 'daily' },
    ],
    linkedin: [{ dayOfWeek: 2, contentType: 'social_post', frequency: 'weekly' }],
    reddit: [{ dayOfWeek: 4, contentType: 'social_post', frequency: 'weekly' }],
    email: [{ dayOfWeek: 3, contentType: 'newsletter', frequency: 'biweekly' }],
    youtube: [{ dayOfWeek: 5, contentType: 'video_script', frequency: 'biweekly' }],
    tiktok: [{ dayOfWeek: 1, contentType: 'video_script', frequency: 'weekly' }],
    docs: [],
  };

  for (let w = 0; w < weeks; w++) {
    for (const channel of channels) {
      const schedule = channelSchedule[channel] ?? [];
      for (const slot of schedule) {
        if (slot.frequency === 'biweekly' && w % 2 !== 0) continue;

        const date = new Date(start);
        date.setDate(date.getDate() + w * 7 + slot.dayOfWeek);

        entries.push({
          date: date.toISOString().slice(0, 10),
          channel,
          contentType: slot.contentType,
          title: `[Planned] ${slot.contentType.replace(/_/g, ' ')} for ${channel}`,
          status: 'draft',
          contentId: null,
        });
      }
    }
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}
