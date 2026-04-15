// ---------------------------------------------------------------------------
// Email Automation Skill — Define & validate email workflows
// ---------------------------------------------------------------------------

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'create_workflow': {
      const workflow = input.workflow as WorkflowInput | undefined;
      if (!workflow || !workflow.name) {
        return { error: 'Provide a workflow with at least a name.' };
      }
      if (!workflow.steps || workflow.steps.length === 0) {
        return { error: 'Workflow must have at least one step.' };
      }

      const errors = validateWorkflow(workflow);
      if (errors.length > 0) {
        return { error: `Validation failed: ${errors.join('; ')}` };
      }

      const compiled: CompiledWorkflow = {
        id: generateId(),
        name: workflow.name,
        trigger: workflow.trigger || 'manual',
        steps: workflow.steps.map((step, i) => ({
          order: i + 1,
          action: step.action || 'send',
          delay_hours: step.delay_hours || 0,
          subject: step.subject || `Step ${i + 1}`,
          body_template: step.body_template || '',
          condition: step.condition || null,
        })),
        total_steps: workflow.steps.length,
        estimated_duration_hours: workflow.steps.reduce((sum, s) => sum + (s.delay_hours || 0), 0),
        status: 'draft',
        created_at: new Date().toISOString(),
      };

      return { result: { workflow: compiled } };
    }

    case 'list_templates': {
      return {
        result: {
          templates: [
            {
              name: 'welcome_drip',
              description: 'New user welcome sequence (3 emails over 7 days)',
              steps: [
                { action: 'send', delay_hours: 0, subject: 'Welcome to {company}!' },
                { action: 'send', delay_hours: 48, subject: 'Getting started with {product}' },
                { action: 'send', delay_hours: 168, subject: 'Your first week recap' },
              ],
            },
            {
              name: 'follow_up_sequence',
              description: 'Sales follow-up (4 touches over 14 days)',
              steps: [
                { action: 'send', delay_hours: 0, subject: 'Following up on our conversation' },
                { action: 'send', delay_hours: 72, subject: 'Quick question' },
                { action: 'send', delay_hours: 168, subject: 'Checking in' },
                { action: 'send', delay_hours: 336, subject: 'Last follow-up' },
              ],
            },
            {
              name: 'onboarding_checklist',
              description: 'Onboarding guide (5 emails over 30 days)',
              steps: [
                { action: 'send', delay_hours: 0, subject: 'Welcome! Here\'s your setup guide' },
                { action: 'send', delay_hours: 24, subject: 'Step 1: Configure your profile' },
                { action: 'send', delay_hours: 72, subject: 'Step 2: Connect your tools' },
                { action: 'send', delay_hours: 168, subject: 'Step 3: Invite your team' },
                { action: 'send', delay_hours: 720, subject: 'How\'s everything going?' },
              ],
            },
            {
              name: 're_engagement',
              description: 'Win-back inactive users (3 emails over 14 days)',
              steps: [
                { action: 'send', delay_hours: 0, subject: 'We miss you!' },
                { action: 'send', delay_hours: 168, subject: 'Here\'s what you\'ve been missing' },
                { action: 'send', delay_hours: 336, subject: 'Special offer just for you' },
              ],
            },
          ],
        },
      };
    }

    case 'validate_schedule': {
      const schedule = input.schedule as ScheduleInput | undefined;
      if (!schedule) {
        return { error: 'Provide a schedule object to validate.' };
      }

      const issues: string[] = [];

      if (schedule.send_at) {
        const sendDate = new Date(schedule.send_at);
        if (isNaN(sendDate.getTime())) {
          issues.push('send_at is not a valid ISO 8601 date');
        } else if (sendDate < new Date()) {
          issues.push('send_at is in the past');
        }
      }

      if (schedule.timezone) {
        try {
          Intl.DateTimeFormat('en', { timeZone: schedule.timezone });
        } catch {
          issues.push(`Invalid timezone: ${schedule.timezone}`);
        }
      }

      if (schedule.recurring) {
        const validIntervals = ['daily', 'weekly', 'biweekly', 'monthly'];
        if (!validIntervals.includes(schedule.recurring)) {
          issues.push(`Invalid recurring interval. Use one of: ${validIntervals.join(', ')}`);
        }
      }

      if (schedule.max_sends !== undefined && schedule.max_sends < 1) {
        issues.push('max_sends must be at least 1');
      }

      return {
        result: {
          valid: issues.length === 0,
          issues,
          normalized: {
            send_at: schedule.send_at || null,
            timezone: schedule.timezone || 'UTC',
            recurring: schedule.recurring || null,
            max_sends: schedule.max_sends || null,
          },
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Available: create_workflow, list_templates, validate_schedule` };
  }
}

/* -------- Types -------- */

interface WorkflowInput {
  name: string;
  trigger?: string;
  steps: WorkflowStepInput[];
}

interface WorkflowStepInput {
  action?: string;
  delay_hours?: number;
  subject?: string;
  body_template?: string;
  condition?: string;
}

interface CompiledWorkflow {
  id: string;
  name: string;
  trigger: string;
  steps: CompiledStep[];
  total_steps: number;
  estimated_duration_hours: number;
  status: string;
  created_at: string;
}

interface CompiledStep {
  order: number;
  action: string;
  delay_hours: number;
  subject: string;
  body_template: string;
  condition: string | null;
}

interface ScheduleInput {
  send_at?: string;
  timezone?: string;
  recurring?: string;
  max_sends?: number;
}

/* -------- Helpers -------- */

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `wf_${ts}_${rand}`;
}

function validateWorkflow(wf: WorkflowInput): string[] {
  const errors: string[] = [];

  if (!wf.name || wf.name.trim().length === 0) {
    errors.push('Workflow name is required');
  }

  if (wf.steps.length > 50) {
    errors.push('Workflow cannot exceed 50 steps');
  }

  for (let i = 0; i < wf.steps.length; i++) {
    const step = wf.steps[i];
    if (step.delay_hours !== undefined && step.delay_hours < 0) {
      errors.push(`Step ${i + 1}: delay_hours cannot be negative`);
    }
    if (step.action && !['send', 'wait', 'condition', 'webhook'].includes(step.action)) {
      errors.push(`Step ${i + 1}: invalid action "${step.action}". Use send, wait, condition, or webhook`);
    }
  }

  return errors;
}
