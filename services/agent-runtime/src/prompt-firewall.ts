import pg from 'pg';
import { createLogger, sha256 } from '@sven/shared';
import { parseSettingValue } from './settings-utils.js';
import type { InboundMessageEvent } from '@sven/shared';

const logger = createLogger('prompt-firewall');

interface ToolCallValidation {
  allowed: boolean;
  reason: string;
}

/**
 * Prompt Firewall – ensures tool calls are explicitly justified.
 * Tool calls blocked unless:
 *  - user explicitly requested OR
 *  - policy-approved plan OR
 *  - trusted read-only skill
 *
 * Also detects system prompt hash drift.
 */
export class PromptFirewall {
  private expectedSystemPromptHash: string | null = null;

  constructor(private pool: pg.Pool) {}

  async validate(
    toolCall: any,
    event: InboundMessageEvent,
    requesterUserId: string,
  ): Promise<ToolCallValidation> {
    // 1. Check justification – must reference user messages or RAG citations
    const justification = toolCall.justification;
    if (!justification) {
      // Check if it's a trusted read-only skill
      const toolRes = await this.pool.query(
        `SELECT is_first_party, trust_level, permissions_required FROM tools WHERE name = $1`,
        [toolCall.name],
      );

      if (toolRes.rows.length > 0) {
        const tool = toolRes.rows[0];
        const isReadOnly = !tool.permissions_required?.some(
          (p: string) => p.includes('write') || p.includes('delete'),
        );

        if (tool.is_first_party && tool.trust_level === 'trusted' && isReadOnly) {
          return { allowed: true, reason: 'Trusted read-only first-party skill' };
        }
      }

      return {
        allowed: false,
        reason: 'Tool call has no justification (user_message_ids or rag_citations required)',
      };
    }

    const planIds: string[] = [];
    if (typeof justification.plan_id === 'string' && justification.plan_id.trim().length > 0) {
      planIds.push(justification.plan_id.trim());
    }
    if (Array.isArray(justification.plan_ids)) {
      for (const planId of justification.plan_ids) {
        if (typeof planId === 'string' && planId.trim().length > 0) {
          planIds.push(planId.trim());
        }
      }
    }

    if (planIds.length > 0) {
      const approved = await this.hasApprovedPlan(planIds, event.chat_id, requesterUserId);
      if (approved) {
        return { allowed: true, reason: 'Policy-approved plan' };
      }
    }

    const userMessageIds = this.normalizeUserMessageIds(justification.user_message_ids);
    const hasUserRef = userMessageIds.length > 0;
    const hasRagRef =
      justification.rag_citations && justification.rag_citations.length > 0;

    if (!hasUserRef) {
      return {
        allowed: false,
        reason: 'Tool calls must be authorized by user requests; RAG citations are supportive only',
      };
    }

    const userRefsValid = await this.validateUserMessageReferences(
      userMessageIds,
      event.chat_id,
      requesterUserId,
      String(event.sender_identity_id || '').trim(),
    );
    if (!userRefsValid) {
      return {
        allowed: false,
        reason: 'Tool call user_message_ids failed provenance verification for this chat/user context',
      };
    }

    if (!hasUserRef && !hasRagRef) {
      return {
        allowed: false,
        reason: 'Tool call justification must include user_message_ids or rag_citations',
      };
    }

    return { allowed: true, reason: hasRagRef ? 'Justified tool call with RAG support' : 'Justified tool call' };
  }

  private normalizeUserMessageIds(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return Array.from(
      new Set(
        raw
          .map((value) => String(value || '').trim())
          .filter(Boolean),
      ),
    );
  }

  private async validateUserMessageReferences(
    userMessageIds: string[],
    chatId: string,
    requesterUserId: string,
    senderIdentityId: string,
  ): Promise<boolean> {
    if (userMessageIds.length === 0) return false;
    const res = await this.pool.query(
      `SELECT id, channel_message_id
       FROM messages
       WHERE chat_id = $1
         AND role = 'user'
         AND (
           sender_user_id = $2
           OR ($3 <> '' AND sender_identity_id = $3)
         )
         AND (id = ANY($4::text[]) OR channel_message_id = ANY($4::text[]))`,
      [chatId, requesterUserId, senderIdentityId, userMessageIds],
    );

    const matched = new Set<string>();
    for (const row of res.rows) {
      const id = String(row.id || '').trim();
      const channelMessageId = String(row.channel_message_id || '').trim();
      if (id && userMessageIds.includes(id)) matched.add(id);
      if (channelMessageId && userMessageIds.includes(channelMessageId)) matched.add(channelMessageId);
    }
    return matched.size === userMessageIds.length;
  }

  private async hasApprovedPlan(
    planIds: string[],
    chatId: string,
    requesterUserId: string,
  ): Promise<boolean> {
    const res = await this.pool.query(
      `SELECT 1 FROM approvals
       WHERE scope = 'plan.approved'
         AND status = 'approved'
         AND expires_at > NOW()
         AND chat_id = $2
         AND requester_user_id = $3
         AND (details->>'plan_id') = ANY($1::text[])
       LIMIT 1`,
      [planIds, chatId, requesterUserId],
    );

    return res.rows.length > 0;
  }

  /**
   * System prompt hashing + drift detection.
   */
  async checkSystemPromptDrift(currentPrompt: string): Promise<boolean> {
    const currentHash = sha256(currentPrompt);

    if (this.expectedSystemPromptHash === null) {
      // Load from DB
      const res = await this.pool.query(
        `SELECT value FROM settings_global WHERE key = 'system_prompt_hash'`,
      );
      if (res.rows.length > 0) {
        this.expectedSystemPromptHash = String(parseSettingValue(res.rows[0].value));
      } else {
        // First run; store current hash
        this.expectedSystemPromptHash = currentHash;
        await this.pool.query(
          `INSERT INTO settings_global (key, value, updated_at, updated_by)
           VALUES ('system_prompt_hash', $1, NOW(), 'system')
           ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
          [JSON.stringify(currentHash)],
        );
        return false;
      }
    }

    if (currentHash !== this.expectedSystemPromptHash) {
      logger.error('SYSTEM PROMPT DRIFT DETECTED', {
        expected: this.expectedSystemPromptHash,
        actual: currentHash,
      });
      return true; // drift detected
    }

    return false;
  }
}
