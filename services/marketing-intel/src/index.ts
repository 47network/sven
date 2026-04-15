// ---------------------------------------------------------------------------
// Marketing Intelligence Service — Entry Point
// ---------------------------------------------------------------------------
// Standalone service for marketing intelligence: competitive analysis, brand
// voice enforcement, content generation, campaign planning, communication
// coaching, and analytics with Postgres persistence and NATS events.
//
// Port: 9474 (configurable via MARKETING_PORT)
// Dependencies: Postgres, NATS
// ---------------------------------------------------------------------------

import Fastify from 'fastify';
import pg from 'pg';
import { connect } from 'nats';
import { createLogger } from '@sven/shared';

// Library — Competitive Intel
import {
  createProfile, createSignal, classifyImpact, diffSignals,
  generateWeeklyReport, buildThreatMatrix,
  type CompetitorProfile, type CompetitorSignal, type SignalType,
} from '@sven/marketing-intel/competitive-intel';

// Library — Brand Voice
import {
  checkBrandVoice, DEFAULT_47NETWORK_BRAND,
  type BrandProfile,
} from '@sven/marketing-intel/brand-voice';

// Library — Content Generator
import {
  createBrief, createContentPiece, analyzeContent, generateCalendar,
  type ContentType, type Channel, type ContentBrief,
} from '@sven/marketing-intel/content-generator';

// Library — Campaign Planner
import {
  createCampaign, scoreCampaign, generateTimeline, campaignToMarkdown,
} from '@sven/marketing-intel/campaign-planner';

// Library — Communication Coach
import {
  listConversationScenarios, getScenario, createCustomScenario,
  analyzeConversationTurn, generateDebrief,
  analyzeLanguageLevel, auditCommunication,
  type ConversationTurn,
} from '@sven/marketing-intel/communication-coach';

// Library — Analytics
import {
  calculateChannelMetrics, aggregateMetrics, generateMarketingReport,
  type ChannelMetrics, type MetricPeriod,
} from '@sven/marketing-intel/analytics';

// Stores
import { PgCompetitorStore } from './store/pg-competitor-store.js';
import { PgBrandCheckStore } from './store/pg-brand-check-store.js';
import { PgContentStore } from './store/pg-content-store.js';
import { PgCampaignStore } from './store/pg-campaign-store.js';
import { PgCoachingStore } from './store/pg-coaching-store.js';
import { PgAnalyticsStore } from './store/pg-analytics-store.js';

// NATS
import { MarketingPublisher } from './nats/publisher.js';

const logger = createLogger('marketing-intel-service');

/* ─── Configuration ──────────────────────────────────────────────────── */

const PORT = parseInt(process.env.MARKETING_PORT || '9474', 10);
const HOST = process.env.MARKETING_HOST || '0.0.0.0';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sven:sven@localhost:5432/sven';
const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const DEFAULT_ORG_ID = process.env.MARKETING_DEFAULT_ORG_ID || 'default';

/* ─── Bootstrap ──────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  // ── Postgres ──
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    max: 15,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  pool.on('error', (err) => {
    logger.error('Postgres pool error', { error: err.message });
  });

  const client = await pool.connect();
  client.release();
  logger.info('Postgres connected');

  // ── NATS ──
  const nc = await connect({ servers: NATS_URL });
  logger.info('NATS connected', { server: NATS_URL });

  // ── Stores & Publisher ──
  const competitorStore = new PgCompetitorStore(pool);
  const brandCheckStore = new PgBrandCheckStore(pool);
  const contentStore = new PgContentStore(pool);
  const campaignStore = new PgCampaignStore(pool);
  const coachingStore = new PgCoachingStore(pool);
  const analyticsStore = new PgAnalyticsStore(pool);
  const publisher = new MarketingPublisher(nc);

  // ── Fastify ──
  const app = Fastify({ logger: false });

  // ── Health Endpoints ──────────────────────────────────────────────────

  app.get('/healthz', async () => ({ status: 'ok', service: 'marketing-intel', uptime: process.uptime() }));

  app.get('/readyz', async (_req, reply) => {
    try {
      const pgCheck = await pool.query('SELECT 1');
      const natsOk = nc.isClosed() ? 'fail' : 'ok';
      const status = pgCheck.rows.length > 0 && natsOk === 'ok' ? 'ok' : 'degraded';
      return { status, checks: { postgres: pgCheck.rows.length > 0 ? 'ok' : 'fail', nats: natsOk } };
    } catch {
      return reply.status(503).send({ status: 'down', checks: { postgres: 'fail', nats: 'unknown' } });
    }
  });

  // ── Competitive Intelligence Routes ───────────────────────────────────

  app.post('/v1/competitors', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const name = body.name as string;

    if (!name || typeof name !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'name string required' } });
    }

    const profile = createProfile(name, {
      website: (body.website as string) ?? undefined,
      linkedinUrl: (body.linkedin_url as string) ?? undefined,
      githubOrg: (body.github_org as string) ?? undefined,
      industry: (body.industry as string) ?? undefined,
      description: (body.description as string) ?? undefined,
    });

    await competitorStore.createCompetitor(orgId, profile);
    publisher.publishCompetitorAdded(profile.id, orgId, name);

    return { success: true, data: profile };
  });

  app.get('/v1/competitors', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const limit = Math.min(parseInt(query.limit || '50', 10), 200);
    const competitors = await competitorStore.listByOrg(orgId, limit);
    return { success: true, data: competitors };
  });

  app.get<{ Params: { id: string } }>('/v1/competitors/:id', async (request, reply) => {
    const competitor = await competitorStore.getById(request.params.id);
    if (!competitor) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Competitor not found' } });
    return { success: true, data: competitor };
  });

  app.delete<{ Params: { id: string } }>('/v1/competitors/:id', async (request) => {
    await competitorStore.deactivate(request.params.id);
    return { success: true };
  });

  app.post('/v1/competitors/signals', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const competitorId = body.competitor_id as string;
    const signalType = body.signal_type as SignalType;
    const title = body.title as string;
    const content = (body.content as string) || '';

    if (!competitorId || !signalType || !title) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'competitor_id, signal_type, and title required' } });
    }

    const signal = createSignal(competitorId, signalType, title, content, (body.source_url as string) ?? null);
    await competitorStore.saveSignal(orgId, signal);
    publisher.publishSignalDetected(signal.id, orgId, competitorId, signalType, signal.impactLevel);

    return { success: true, data: signal };
  });

  app.get('/v1/competitors/signals', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const competitorId = query.competitor_id;
    const limit = Math.min(parseInt(query.limit || '100', 10), 500);

    if (competitorId) {
      const signals = await competitorStore.listSignals(competitorId, limit);
      return { success: true, data: signals };
    }
    const signals = await competitorStore.listSignalsByOrg(orgId, limit);
    return { success: true, data: signals };
  });

  app.post('/v1/competitors/report', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const profiles = body.competitors as CompetitorProfile[];
    const signals = body.signals as CompetitorSignal[];

    if (!Array.isArray(profiles) || profiles.length === 0) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'competitors array required' } });
    }

    const report = generateWeeklyReport(profiles, signals || []);
    await competitorStore.saveReport(orgId, report);
    publisher.publishReportGenerated(report.id, orgId, report.reportType, profiles.length);

    return { success: true, data: report };
  });

  app.get('/v1/competitors/reports', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const reports = await competitorStore.listReports(orgId);
    return { success: true, data: reports };
  });

  app.post('/v1/competitors/threat-matrix', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const profiles = body.competitors as CompetitorProfile[];
    const currentSignals = (body.current_signals as CompetitorSignal[]) || [];
    const previousSignals = (body.previous_signals as CompetitorSignal[]) || [];

    if (!Array.isArray(profiles) || profiles.length === 0) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'competitors array required' } });
    }

    const matrix = buildThreatMatrix(profiles, currentSignals, previousSignals);
    const criticalCount = matrix.filter((e) => e.threatLevel === 'critical').length;
    publisher.publishThreatMatrixBuilt(orgId, profiles.length, criticalCount);

    return { success: true, data: matrix };
  });

  app.post('/v1/competitors/diff-signals', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const previous = body.previous as CompetitorSignal[];
    const current = body.current as CompetitorSignal[];

    if (!Array.isArray(previous) || !Array.isArray(current)) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'previous and current signal arrays required' } });
    }

    const diff = diffSignals(previous, current);
    return { success: true, data: diff };
  });

  // ── Brand Voice Routes ────────────────────────────────────────────────

  app.post('/v1/brand/check', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const content = body.content as string;
    const profile = (body.profile as BrandProfile) || undefined;

    if (!content || typeof content !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'content string required' } });
    }

    const result = checkBrandVoice(content, profile ?? DEFAULT_47NETWORK_BRAND);
    const checkId = await brandCheckStore.save(orgId, content, result, profile?.name ?? '47Network');
    publisher.publishBrandCheckComplete(checkId, orgId, result.score, result.grade, result.violations.length);

    return { success: true, data: { id: checkId, ...result } };
  });

  app.get('/v1/brand/checks', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const checks = await brandCheckStore.listByOrg(orgId);
    return { success: true, data: checks };
  });

  app.get('/v1/brand/avg-score', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const avg = await brandCheckStore.getAvgScore(orgId);
    return { success: true, data: { org_id: orgId, avg_score: Math.round(avg * 10) / 10 } };
  });

  // ── Content Generator Routes ──────────────────────────────────────────

  app.post('/v1/content/brief', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const contentType = body.content_type as ContentType;
    const channel = body.channel as Channel;
    const title = body.title as string;

    if (!contentType || !channel || !title) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'content_type, channel, and title required' } });
    }

    const brief = createBrief(contentType, channel, title, {
      targetAudience: (body.target_audience as string) ?? undefined,
      keyPoints: (body.key_points as string[]) ?? undefined,
      callToAction: (body.call_to_action as string) ?? undefined,
      tone: (body.tone as string) ?? undefined,
      keywords: (body.keywords as string[]) ?? undefined,
      references: (body.references as string[]) ?? undefined,
    });

    return { success: true, data: brief };
  });

  app.post('/v1/content/create', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const brief = body.brief as ContentBrief;
    const contentBody = body.body as string;

    if (!brief || !contentBody || typeof contentBody !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'brief object and body string required' } });
    }

    const piece = createContentPiece(brief, contentBody);

    // Auto brand-check
    const brandResult = checkBrandVoice(contentBody);
    piece.brandCheckScore = brandResult.score;

    await contentStore.save(orgId, piece);
    publisher.publishContentCreated(piece.id, orgId, piece.contentType, piece.channel);

    return { success: true, data: { piece, brand_check: brandResult } };
  });

  app.post('/v1/content/analyze', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const contentBody = body.body as string;
    const brief = body.brief as ContentBrief;

    if (!contentBody || typeof contentBody !== 'string' || !brief) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'body string and brief object required' } });
    }

    const analysis = analyzeContent(contentBody, brief);
    return { success: true, data: analysis };
  });

  app.post('/v1/content/calendar', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const channels = body.channels as Channel[];
    const startDate = body.start_date as string;
    const weeks = (body.weeks as number) || 4;

    if (!Array.isArray(channels) || !startDate) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'channels array and start_date required' } });
    }

    const calendar = generateCalendar(startDate, weeks, channels);
    return { success: true, data: calendar };
  });

  app.get('/v1/content', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const channel = query.channel;
    const limit = Math.min(parseInt(query.limit || '50', 10), 200);

    if (channel) {
      const content = await contentStore.listByChannel(orgId, channel, limit);
      return { success: true, data: content };
    }
    const content = await contentStore.listByOrg(orgId, limit);
    return { success: true, data: content };
  });

  app.get<{ Params: { id: string } }>('/v1/content/:id', async (request, reply) => {
    const piece = await contentStore.getById(request.params.id);
    if (!piece) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Content not found' } });
    return { success: true, data: piece };
  });

  // ── Campaign Routes ───────────────────────────────────────────────────

  app.post('/v1/campaigns', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const name = body.name as string;

    if (!name || typeof name !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'name string required' } });
    }

    const campaign = createCampaign(name, {
      description: (body.description as string) ?? undefined,
      goals: (body.goals as []) ?? undefined,
      budget: (body.budget as any) ?? undefined,
      channels: (body.channels as string[]) ?? undefined,
      targetAudience: (body.target_audience as string) ?? undefined,
      startDate: (body.start_date as string) ?? undefined,
      endDate: (body.end_date as string) ?? undefined,
    });

    const score = scoreCampaign(campaign);
    await campaignStore.save(orgId, campaign, score.overall);
    publisher.publishCampaignCreated(campaign.id, orgId, name, campaign.channels.length);
    publisher.publishCampaignScored(campaign.id, orgId, score.overall, score.grade);

    return { success: true, data: { campaign, score } };
  });

  app.get('/v1/campaigns', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const limit = Math.min(parseInt(query.limit || '50', 10), 200);
    const campaigns = await campaignStore.listByOrg(orgId, limit);
    return { success: true, data: campaigns };
  });

  app.get<{ Params: { id: string } }>('/v1/campaigns/:id', async (request, reply) => {
    const campaign = await campaignStore.getById(request.params.id);
    if (!campaign) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    return { success: true, data: campaign };
  });

  app.get('/v1/campaigns/active', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const campaigns = await campaignStore.listActive(orgId);
    return { success: true, data: campaigns };
  });

  app.post('/v1/campaigns/timeline', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const weeks = (body.weeks as number) || 4;
    const timeline = generateTimeline(weeks);
    return { success: true, data: timeline };
  });

  app.post('/v1/campaigns/markdown', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const campaign = body.campaign as any;
    const score = body.score as any;

    if (!campaign) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'campaign object required' } });
    }

    const md = campaignToMarkdown(campaign, score ?? undefined);
    return { success: true, data: { markdown: md } };
  });

  // ── Communication Coach Routes ────────────────────────────────────────

  app.get('/v1/coaching/scenarios', async () => {
    const scenarios = listConversationScenarios();
    return { success: true, data: scenarios };
  });

  app.get<{ Params: { id: string } }>('/v1/coaching/scenarios/:id', async (request, reply) => {
    const scenario = getScenario(request.params.id);
    if (!scenario) return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Scenario not found' } });
    return { success: true, data: scenario };
  });

  app.post('/v1/coaching/scenarios/custom', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const title = body.title as string;
    const context = body.context as string;
    const otherParty = body.other_party as string;
    const objectives = body.objectives as string[];

    if (!title || !context || !otherParty || !Array.isArray(objectives)) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'title, context, other_party, and objectives required' } });
    }

    const scenario = createCustomScenario(title, context, otherParty, objectives, (body.difficulty as any) ?? 'intermediate');
    return { success: true, data: scenario };
  });

  app.post('/v1/coaching/sessions', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const userId = body.user_id as string;
    const scenarioId = body.scenario_id as string;

    if (!userId || !scenarioId) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'user_id and scenario_id required' } });
    }

    const scenario = getScenario(scenarioId);
    const scenarioTitle = scenario?.title ?? scenarioId;
    const sessionId = await coachingStore.createSession(orgId, userId, scenarioId, scenarioTitle);

    return { success: true, data: { session_id: sessionId, scenario_id: scenarioId, title: scenarioTitle } };
  });

  app.post('/v1/coaching/analyze-turn', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const message = body.message as string;
    const scenarioId = body.scenario_id as string;
    const sessionId = body.session_id as string;

    if (!message || typeof message !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'message string required' } });
    }

    const scenario = getScenario(scenarioId || '') ?? {
      id: 'adhoc', role: 'custom' as const, title: 'Ad-hoc Analysis',
      context: '', otherParty: '', objectives: [], difficulty: 'intermediate' as const,
    };

    const analysis = analyzeConversationTurn(message, scenario);
    const turn: ConversationTurn = { speaker: 'user', message, analysis };

    if (sessionId) {
      await coachingStore.addTurn(sessionId, turn);
    }

    return { success: true, data: analysis };
  });

  app.post('/v1/coaching/debrief', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const sessionId = body.session_id as string;
    const scenarioId = body.scenario_id as string;
    const turns = body.turns as ConversationTurn[];

    if (!scenarioId || !Array.isArray(turns)) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'scenario_id and turns array required' } });
    }

    const scenario = getScenario(scenarioId) ?? {
      id: scenarioId, role: 'custom' as const, title: 'Custom Scenario',
      context: '', otherParty: '', objectives: [], difficulty: 'intermediate' as const,
    };

    const debrief = generateDebrief(scenario, turns);

    if (sessionId) {
      await coachingStore.completeSession(sessionId, debrief);
    }

    publisher.publishCoachingDebrief(sessionId || 'standalone', orgId, scenarioId, debrief.overallScore);

    return { success: true, data: debrief };
  });

  app.get('/v1/coaching/sessions', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const userId = query.user_id;
    const limit = Math.min(parseInt(query.limit || '20', 10), 100);

    if (userId) {
      const sessions = await coachingStore.listByUser(orgId, userId, limit);
      return { success: true, data: sessions };
    }
    const sessions = await coachingStore.listByOrg(orgId, limit);
    return { success: true, data: sessions };
  });

  app.post('/v1/coaching/analyze-language', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const content = body.content as string;
    const currentLevel = (body.current_level as string) || 'mid-level';
    const targetLevel = (body.target_level as string) || 'senior leader';

    if (!content || typeof content !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'content string required' } });
    }

    const analysis = analyzeLanguageLevel(content, currentLevel, targetLevel);
    return { success: true, data: analysis };
  });

  app.post('/v1/coaching/audit', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const content = body.content as string;
    const role = (body.role as string) || 'engineer';

    if (!content || typeof content !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'content string required' } });
    }

    const audit = auditCommunication(content, role);
    return { success: true, data: audit };
  });

  // ── Analytics Routes ──────────────────────────────────────────────────

  app.post('/v1/analytics/channel', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const channel = body.channel as string;
    const data = body.data as { reach: number; impressions: number; engagement: number; clicks: number; conversions: number; spend: number };

    if (!channel || !data) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'channel and data required' } });
    }

    const metrics = calculateChannelMetrics(channel, data);
    return { success: true, data: metrics };
  });

  app.post('/v1/analytics/aggregate', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const channelData = body.channel_data as ChannelMetrics[];
    const period = (body.period as MetricPeriod) || 'monthly';
    const startDate = body.start_date as string;
    const endDate = body.end_date as string;

    if (!Array.isArray(channelData) || !startDate || !endDate) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'channel_data array, start_date, and end_date required' } });
    }

    // Fetch previous totals for trend calculation
    const prevReport = await analyticsStore.getLatest(orgId, period);
    const previousTotals = prevReport?.totals ?? undefined;

    const metrics = aggregateMetrics(channelData, period, startDate, endDate, previousTotals as any);
    return { success: true, data: metrics };
  });

  app.post('/v1/analytics/report', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const orgId = (body.org_id as string) || DEFAULT_ORG_ID;
    const channelData = body.channel_data as ChannelMetrics[];
    const period = (body.period as MetricPeriod) || 'monthly';
    const startDate = body.start_date as string;
    const endDate = body.end_date as string;
    const topContent = (body.top_content as []) || [];

    if (!Array.isArray(channelData) || !startDate || !endDate) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'channel_data array, start_date, and end_date required' } });
    }

    const metrics = aggregateMetrics(channelData, period, startDate, endDate);
    const report = generateMarketingReport(metrics, topContent);

    await analyticsStore.saveReport(orgId, report);
    publisher.publishAnalyticsReport(report.id, orgId, period, metrics.trends.direction);

    return { success: true, data: report };
  });

  app.get('/v1/analytics/reports', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const reports = await analyticsStore.listByOrg(orgId);
    return { success: true, data: reports };
  });

  app.get('/v1/analytics/trend', async (request) => {
    const query = request.query as Record<string, string>;
    const orgId = query.org_id || DEFAULT_ORG_ID;
    const period = (query.period || 'monthly') as string;
    const count = Math.min(parseInt(query.count || '6', 10), 24);
    const trendData = await analyticsStore.getTrendData(orgId, period, count);
    return { success: true, data: trendData };
  });

  // ── Start Server ──────────────────────────────────────────────────────

  await app.listen({ host: HOST, port: PORT });
  logger.info(`Marketing intel service listening on ${HOST}:${PORT}`);

  // ── Graceful Shutdown ─────────────────────────────────────────────────

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down`);
    await app.close();
    await nc.drain();
    await pool.end();
    logger.info('Marketing intel service stopped');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

/* ─── Run ────────────────────────────────────────────────────────────── */

main().catch((err) => {
  logger.error('Fatal startup error', { error: (err as Error).message, stack: (err as Error).stack });
  process.exit(1);
});
