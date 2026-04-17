import { TRADING_NATS_SUBJECTS } from '@sven/trading-platform/news';

interface WorkflowStep {
  skill: string;
  action: string;
  inputMapping?: Record<string, string>;
  condition?: string;
}

interface Workflow {
  name: string;
  description: string;
  steps: WorkflowStep[];
  createdAt: Date;
}

const AVAILABLE_SKILLS = [
  { skill: 'place-order', actions: ['create', 'cancel', 'status', 'list', 'fill_simulate'] },
  { skill: 'market-data-query', actions: ['candles', 'instruments', 'orderbook', 'validate', 'gap_detect', 'sentiment'] },
  { skill: 'risk-assessment', actions: ['check_signal', 'position_size', 'circuit_breakers', 'exposure', 'drawdown', 'full_assessment'] },
  { skill: 'predictions', actions: ['predict', 'tokenize', 'multi_horizon', 'ensemble', 'evaluate', 'accuracy'] },
  { skill: 'news-analysis', actions: ['analyze', 'classify', 'sentiment', 'entities', 'llm_analysis'] },
  { skill: 'portfolio-manager', actions: ['status', 'positions', 'performance', 'token_balance', 'freeze_funds', 'release_funds'] },
  { skill: 'backtest', actions: ['run', 'list_strategies', 'config', 'summary'] },
  { skill: 'chart-analysis', actions: ['indicators', 'patterns', 'support_resistance', 'trend', 'full_analysis'] },
  { skill: 'strategy-manager', actions: ['list', 'details', 'enable', 'disable', 'add_custom', 'set_weights', 'loop_config'] },
] as const;

const PRESET_WORKFLOWS: Workflow[] = [
  {
    name: 'pre-trade-check',
    description: 'Full pre-trade analysis: chart → risk → predictions → order',
    steps: [
      { skill: 'chart-analysis', action: 'full_analysis' },
      { skill: 'predictions', action: 'predict' },
      { skill: 'risk-assessment', action: 'full_assessment' },
      { skill: 'place-order', action: 'create', condition: 'risk_assessment.verdict === "APPROVED"' },
    ],
    createdAt: new Date(),
  },
  {
    name: 'morning-briefing',
    description: 'Daily morning briefing: portfolio → market data → news → predictions',
    steps: [
      { skill: 'portfolio-manager', action: 'status' },
      { skill: 'market-data-query', action: 'candles' },
      { skill: 'chart-analysis', action: 'trend' },
      { skill: 'news-analysis', action: 'analyze' },
      { skill: 'predictions', action: 'multi_horizon' },
    ],
    createdAt: new Date(),
  },
  {
    name: 'risk-dashboard',
    description: 'Risk status: circuit breakers → exposure → drawdown → portfolio',
    steps: [
      { skill: 'risk-assessment', action: 'circuit_breakers' },
      { skill: 'risk-assessment', action: 'exposure' },
      { skill: 'risk-assessment', action: 'drawdown' },
      { skill: 'portfolio-manager', action: 'status' },
    ],
    createdAt: new Date(),
  },
];

function validateWorkflow(steps: WorkflowStep[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const skillDef = AVAILABLE_SKILLS.find((s) => s.skill === step.skill);
    if (!skillDef) {
      errors.push(`Step ${i + 1}: Unknown skill "${step.skill}"`);
      continue;
    }
    if (!skillDef.actions.includes(step.action as never)) {
      errors.push(`Step ${i + 1}: Unknown action "${step.action}" for skill "${step.skill}"`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'list_subjects': {
      return {
        result: {
          natsSubjects: TRADING_NATS_SUBJECTS,
          note: 'Use these NATS subjects to tap into the real-time trading pipeline',
        },
      };
    }

    case 'describe_pipeline': {
      return {
        result: {
          pipeline: {
            dataIngestion: 'Exchange WebSocket → Candle/Tick normalization → TimescaleDB + NATS publish',
            prediction: 'Candles → BSQ tokenization → Kronos model → Multi-horizon predictions → NATS',
            simulation: 'Market state → MiroFish agent simulation → Consensus extraction → NATS',
            news: 'RSS/API feed → Impact classification → Sentiment scoring → Entity extraction → NATS',
            signals: 'Predictions + Technical + News + MiroFish → Weighted ensemble → Signal aggregation',
            risk: 'Signal → Risk check cascade → Circuit breakers → Position sizing → Trade decision',
            execution: 'Trade decision → OMS order creation → 47Token freeze → Exchange submission → Fill tracking',
            portfolio: 'Fills → Position update → P&L calculation → Equity curve → Performance metrics',
          },
          availableSkills: AVAILABLE_SKILLS.map((s) => ({ skill: s.skill, actions: s.actions })),
          presetWorkflows: PRESET_WORKFLOWS.map((w) => ({ name: w.name, description: w.description, stepCount: w.steps.length })),
        },
      };
    }

    case 'compose_workflow': {
      const name = input.workflow_name as string;
      const steps = input.steps as WorkflowStep[] | undefined;

      if (!name) return { error: 'Missing workflow_name' };

      // Check preset first
      const preset = PRESET_WORKFLOWS.find((w) => w.name === name);
      if (preset) {
        return {
          result: {
            workflow: {
              name: preset.name,
              description: preset.description,
              steps: preset.steps.map((s, i) => ({ step: i + 1, skill: s.skill, action: s.action, condition: s.condition })),
            },
            isPreset: true,
          },
        };
      }

      if (!steps || steps.length === 0) return { error: 'Custom workflow requires steps array' };

      const validation = validateWorkflow(steps);
      if (!validation.valid) {
        return { error: 'Invalid workflow', details: validation.errors };
      }

      return {
        result: {
          workflow: { name, steps: steps.map((s, i) => ({ step: i + 1, ...s })) },
          isPreset: false,
          valid: true,
        },
      };
    }

    case 'validate': {
      const steps = input.steps as WorkflowStep[] | undefined;
      if (!steps) return { error: 'Missing steps array' };
      const validation = validateWorkflow(steps);
      return { result: validation };
    }

    default:
      return { error: `Unknown action "${action}". Use: list_subjects, describe_pipeline, compose_workflow, validate` };
  }
}
