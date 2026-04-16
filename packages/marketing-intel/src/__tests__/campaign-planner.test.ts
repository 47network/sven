import { scoreCampaign, type Campaign, createCampaign } from '../campaign-planner/index.ts';
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('scoreCampaign', () => {
  it('should handle campaign with no goals or budget', () => {
    const campaign = createCampaign('Test Campaign', {
      goals: [],
      budget: null,
      performance: null,
    });

    const score = scoreCampaign(campaign);

    assert.strictEqual(score.goalCompletion, 0);
    assert.strictEqual(score.budgetEfficiency, 50);
    assert.strictEqual(score.roiScore, 50);
    // overall = 0*0.5 + 50*0.2 + 50*0.3 = 10 + 15 = 25 -> F
    assert.strictEqual(score.overall, 25);
    assert.strictEqual(score.grade, 'F');
  });

  it('should score goal completion correctly when met or exceeded', () => {
    const campaign = createCampaign('Test Campaign', {
      goals: [
        { metric: 'clicks', target: 100, current: 120, unit: 'clicks' },
        { metric: 'views', target: 1000, current: 1000, unit: 'views' },
      ],
    });

    const score = scoreCampaign(campaign);
    assert.strictEqual(score.goalCompletion, 100);
    assert.ok(score.insights.includes('All campaign goals met or exceeded'));
  });

  it('should score goal completion correctly when missed', () => {
    const campaign = createCampaign('Test Campaign', {
      goals: [
        { metric: 'clicks', target: 100, current: 50, unit: 'clicks' },
        { metric: 'views', target: 1000, current: 1000, unit: 'views' },
      ],
    });

    const score = scoreCampaign(campaign);
    assert.strictEqual(score.goalCompletion, 75); // (50 + 100) / 2
    assert.ok(score.insights.includes('1 goal(s) below target: clicks'));
  });

  it('should calculate budget efficiency correctly - over budget', () => {
    const campaign = createCampaign('Test Campaign', {
      budget: { total: 1000, currency: 'USD', allocated: {}, spent: 960 }, // 96%
    });

    const score = scoreCampaign(campaign);
    assert.strictEqual(score.budgetEfficiency, 40);
    assert.ok(score.insights.includes('Budget nearly exhausted — consider reallocation for next campaign'));
  });

  it('should calculate budget efficiency correctly - ideal spend', () => {
    const campaign = createCampaign('Test Campaign', {
      budget: { total: 1000, currency: 'USD', allocated: {}, spent: 800 }, // 80%
    });

    const score = scoreCampaign(campaign);
    assert.strictEqual(score.budgetEfficiency, 80);
  });

  it('should calculate budget efficiency correctly - under spend active', () => {
    const campaign = createCampaign('Test Campaign', {
      status: 'active',
      budget: { total: 1000, currency: 'USD', allocated: {}, spent: 200 }, // 20%
    });

    const score = scoreCampaign(campaign);
    assert.strictEqual(score.budgetEfficiency, 60);
    assert.ok(score.insights.includes('Under-utilising budget — consider increasing channel spend'));
  });

  it('should calculate ROI correctly', () => {
    const campaign = createCampaign('Test Campaign', {
      performance: {
        totalReach: 100,
        totalEngagement: 10,
        totalConversions: 1,
        costPerConversion: 10,
        roi: 150, // > 100
        channelBreakdown: {},
        measuredAt: '',
      },
    });

    const score = scoreCampaign(campaign);
    assert.strictEqual(score.roiScore, 75);
    assert.ok(score.insights.includes('Campaign ROI: 150%'));
  });

  it('should assign correct grades', () => {
    // We want overall to be >= 90
    // overall = goal * 0.5 + budget * 0.2 + roi * 0.3
    // To get 90: goal=100 (50), budget 80% (80*0.2=16), roi=150 (75*0.3=22.5) -> 50 + 16 + 22.5 = 88.5
    // Let's bump ROI
    const campaignA = createCampaign('Test Campaign', {
      goals: [{ metric: 'clicks', target: 100, current: 100, unit: 'clicks' }],
      budget: { total: 1000, currency: 'USD', allocated: {}, spent: 800 },
      performance: {
        totalReach: 100,
        totalEngagement: 10,
        totalConversions: 1,
        costPerConversion: 10,
        roi: 350, // 100
        channelBreakdown: {},
        measuredAt: '',
      },
    });
    // goal=100 (50), budget=80 (16), roi=100 (30) -> 96
    const scoreA = scoreCampaign(campaignA);
    assert.strictEqual(scoreA.grade, 'A');
  });
});
