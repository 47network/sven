import { NatsConnection, JSONCodec } from 'nats';
import { NATS_SUBJECTS } from '@sven/shared';

const jc = JSONCodec();

export class MarketingPublisher {
  constructor(private readonly nc: NatsConnection) {}

  publishCompetitorAdded(competitorId: string, orgId: string, name: string): void {
    this.nc.publish(NATS_SUBJECTS.MARKETING_COMPETITOR_ADDED, jc.encode({ competitorId, orgId, name, ts: Date.now() }));
  }

  publishSignalDetected(signalId: string, orgId: string, competitorId: string, signalType: string, impactLevel: number): void {
    this.nc.publish(NATS_SUBJECTS.MARKETING_SIGNAL_DETECTED, jc.encode({ signalId, orgId, competitorId, signalType, impactLevel, ts: Date.now() }));
  }

  publishReportGenerated(reportId: string, orgId: string, reportType: string, competitorCount: number): void {
    this.nc.publish(NATS_SUBJECTS.MARKETING_REPORT_GENERATED, jc.encode({ reportId, orgId, reportType, competitorCount, ts: Date.now() }));
  }

  publishBrandCheckComplete(checkId: string, orgId: string, score: number, grade: string, violationCount: number): void {
    this.nc.publish(NATS_SUBJECTS.MARKETING_BRAND_CHECK_COMPLETE, jc.encode({ checkId, orgId, score, grade, violationCount, ts: Date.now() }));
  }

  publishContentCreated(contentId: string, orgId: string, contentType: string, channel: string): void {
    this.nc.publish(NATS_SUBJECTS.MARKETING_CONTENT_CREATED, jc.encode({ contentId, orgId, contentType, channel, ts: Date.now() }));
  }

  publishCampaignCreated(campaignId: string, orgId: string, name: string, channelCount: number): void {
    this.nc.publish(NATS_SUBJECTS.MARKETING_CAMPAIGN_CREATED, jc.encode({ campaignId, orgId, name, channelCount, ts: Date.now() }));
  }

  publishCampaignScored(campaignId: string, orgId: string, overall: number, grade: string): void {
    this.nc.publish(NATS_SUBJECTS.MARKETING_CAMPAIGN_SCORED, jc.encode({ campaignId, orgId, overall, grade, ts: Date.now() }));
  }

  publishCoachingDebrief(sessionId: string, orgId: string, scenarioId: string, overallScore: number): void {
    this.nc.publish(NATS_SUBJECTS.MARKETING_COACHING_DEBRIEF, jc.encode({ sessionId, orgId, scenarioId, overallScore, ts: Date.now() }));
  }

  publishAnalyticsReport(reportId: string, orgId: string, period: string, direction: string): void {
    this.nc.publish(NATS_SUBJECTS.MARKETING_ANALYTICS_REPORT, jc.encode({ reportId, orgId, period, direction, ts: Date.now() }));
  }

  publishThreatMatrixBuilt(orgId: string, competitorCount: number, criticalCount: number): void {
    this.nc.publish(NATS_SUBJECTS.MARKETING_THREAT_MATRIX_BUILT, jc.encode({ orgId, competitorCount, criticalCount, ts: Date.now() }));
  }
}
