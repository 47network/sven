// ---------------------------------------------------------------------------
// Social Scheduler Skill — Plan & schedule social media content
// ---------------------------------------------------------------------------

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'create_calendar': {
      const posts = (input.posts as PostInput[]) || [];
      const timezone = (input.timezone as string) || 'UTC';

      if (posts.length === 0) {
        return { error: 'Provide at least one post to schedule.' };
      }

      const calendar = posts.map((post, i) => {
        const platform = post.platform || 'twitter';
        const limits = platformLimits[platform] || platformLimits.twitter;
        const truncated = post.content && post.content.length > limits.maxChars
          ? post.content.slice(0, limits.maxChars - 3) + '...'
          : post.content || '';

        return {
          id: `post_${i + 1}`,
          platform,
          content: truncated,
          char_count: truncated.length,
          max_chars: limits.maxChars,
          scheduled_at: post.date || null,
          timezone,
          hashtags: post.hashtags || [],
          status: 'draft',
          warnings: truncated !== post.content ? ['Content truncated to fit platform limit'] : [],
        };
      });

      return {
        result: {
          calendar,
          total_posts: calendar.length,
          platforms: [...new Set(calendar.map((p) => p.platform))],
          timezone,
        },
      };
    }

    case 'suggest_hashtags': {
      const content = (input.content as string) || '';
      const platform = (input.platform as string) || 'twitter';

      if (!content) return { error: 'content is required for hashtag suggestions.' };

      const words = content.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const wordFreq = new Map<string, number>();
      for (const w of words) {
        const clean = w.replace(/[^a-z0-9]/g, '');
        if (clean.length > 3) wordFreq.set(clean, (wordFreq.get(clean) || 0) + 1);
      }

      const sorted = [...wordFreq.entries()].sort((a, b) => b[1] - a[1]);
      const topWords = sorted.slice(0, 8).map(([w]) => `#${w}`);

      const limits = platformLimits[platform] || platformLimits.twitter;
      const recommended = topWords.slice(0, limits.maxHashtags);

      return {
        result: {
          platform,
          suggested: recommended,
          all_candidates: topWords,
          max_recommended: limits.maxHashtags,
          tip: platform === 'instagram'
            ? 'Instagram allows up to 30 hashtags; 8-15 is optimal for reach'
            : platform === 'linkedin'
              ? 'LinkedIn recommends 3-5 hashtags maximum'
              : 'Twitter/X performs best with 1-3 hashtags',
        },
      };
    }

    case 'optimal_times': {
      const platform = (input.platform as string) || 'twitter';
      const timezone = (input.timezone as string) || 'UTC';

      const times: Record<string, OptimalTimes> = {
        twitter: {
          best_days: ['Tuesday', 'Wednesday', 'Thursday'],
          best_hours: ['9:00', '12:00', '17:00'],
          worst_times: ['Late night (23:00-5:00)', 'Weekend mornings'],
          frequency: '3-5 posts per day',
        },
        linkedin: {
          best_days: ['Tuesday', 'Wednesday', 'Thursday'],
          best_hours: ['7:30', '12:00', '17:30'],
          worst_times: ['Weekends', 'Late evenings'],
          frequency: '1-2 posts per day',
        },
        instagram: {
          best_days: ['Monday', 'Tuesday', 'Wednesday'],
          best_hours: ['11:00', '13:00', '19:00'],
          worst_times: ['Late night', 'Early morning (before 7:00)'],
          frequency: '1-2 posts per day, 3-7 stories',
        },
        facebook: {
          best_days: ['Wednesday', 'Thursday', 'Friday'],
          best_hours: ['9:00', '13:00', '16:00'],
          worst_times: ['Late night', 'Very early morning'],
          frequency: '1-2 posts per day',
        },
        threads: {
          best_days: ['Tuesday', 'Wednesday', 'Thursday'],
          best_hours: ['10:00', '13:00', '19:00'],
          worst_times: ['Late night'],
          frequency: '2-4 posts per day',
        },
      };

      return {
        result: {
          platform,
          timezone,
          ...(times[platform] || times.twitter),
          note: 'Times are general recommendations. Analyze your audience insights for best results.',
        },
      };
    }

    case 'format_post': {
      const content = (input.content as string) || '';
      const platform = (input.platform as string) || 'twitter';

      if (!content) return { error: 'content is required.' };

      const limits = platformLimits[platform] || platformLimits.twitter;
      const formatted = formatForPlatform(content, platform, limits);

      return {
        result: {
          platform,
          formatted: formatted.text,
          char_count: formatted.text.length,
          max_chars: limits.maxChars,
          within_limit: formatted.text.length <= limits.maxChars,
          suggestions: formatted.suggestions,
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Available: create_calendar, suggest_hashtags, optimal_times, format_post` };
  }
}

/* -------- Types -------- */

interface PostInput {
  content?: string;
  platform?: string;
  date?: string;
  hashtags?: string[];
}

interface PlatformLimits {
  maxChars: number;
  maxHashtags: number;
  supportsMedia: boolean;
}

interface OptimalTimes {
  best_days: string[];
  best_hours: string[];
  worst_times: string[];
  frequency: string;
}

/* -------- Platform Data -------- */

const platformLimits: Record<string, PlatformLimits> = {
  twitter: { maxChars: 280, maxHashtags: 3, supportsMedia: true },
  linkedin: { maxChars: 3000, maxHashtags: 5, supportsMedia: true },
  instagram: { maxChars: 2200, maxHashtags: 30, supportsMedia: true },
  facebook: { maxChars: 63206, maxHashtags: 10, supportsMedia: true },
  threads: { maxChars: 500, maxHashtags: 5, supportsMedia: true },
};

/* -------- Formatting -------- */

function formatForPlatform(content: string, platform: string, limits: PlatformLimits): { text: string; suggestions: string[] } {
  const suggestions: string[] = [];
  let text = content;

  if (text.length > limits.maxChars) {
    text = text.slice(0, limits.maxChars - 3) + '...';
    suggestions.push(`Content truncated from ${content.length} to ${limits.maxChars} chars`);
  }

  if (platform === 'twitter' && text.length > 250) {
    suggestions.push('Consider shortening for better engagement — tweets < 100 chars get more retweets');
  }

  if (platform === 'linkedin') {
    if (!text.includes('\n')) {
      suggestions.push('Break into shorter paragraphs for LinkedIn readability');
    }
    if (text.length < 100) {
      suggestions.push('LinkedIn posts perform better at 150-300 words');
    }
  }

  if (platform === 'instagram' && !text.includes('#')) {
    suggestions.push('Add 8-15 relevant hashtags for Instagram reach');
  }

  return { text, suggestions };
}
