import pg from 'pg';
import { NatsConnection, StringCodec } from 'nats';
import { v7 as uuidv7 } from 'uuid';

const sc = StringCodec();

const VALID_MESSAGE_TYPES = ['message', 'mention', 'delegation', 'reply', 'observation', 'report'] as const;
type MessageType = (typeof VALID_MESSAGE_TYPES)[number];

interface AgentMessage {
  id: string;
  organization_id: string;
  from_agent_id: string;
  to_agent_id: string | null;
  thread_id: string | null;
  subject: string;
  message_type: MessageType;
  content: string;
  metadata: Record<string, unknown>;
  status: string;
  created_at: string;
}

interface SendMessageInput {
  organization_id: string;
  from_agent_id: string;
  to_agent_id?: string;
  thread_id?: string;
  subject?: string;
  message_type?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Agent-to-agent protocol service.
 * Agents communicate via NATS subject routing with persistent storage for auditability.
 * Subject format: agent.msg.<org_id>.<to_agent_id>
 * Broadcast: agent.msg.<org_id>.broadcast.<subject>
 */
export class AgentProtocolService {
  constructor(
    private pool: pg.Pool,
    private nc: NatsConnection,
  ) {}

  async sendMessage(input: SendMessageInput): Promise<AgentMessage> {
    if (!input.content?.trim()) throw new Error('Message content is required');
    if (input.content.length > 10000) throw new Error('Message content must be ≤10000 characters');
    if (input.subject && input.subject.length > 200) throw new Error('Subject must be ≤200 characters');

    const messageType = (input.message_type || 'message').trim().toLowerCase();
    if (!VALID_MESSAGE_TYPES.includes(messageType as MessageType)) {
      throw new Error(`Invalid message type: ${messageType}`);
    }

    // Verify sender exists and is an agent
    const senderCheck = await this.pool.query(
      `SELECT id, agent_status FROM agent_personas WHERE id = $1 AND organization_id = $2 AND is_agent = TRUE`,
      [input.from_agent_id, input.organization_id],
    );
    if (!senderCheck.rows[0]) throw new Error('Sender agent not found');
    if (senderCheck.rows[0].agent_status === 'suspended') throw new Error('Sender agent is suspended');

    // Verify recipient if specified
    if (input.to_agent_id) {
      const recipientCheck = await this.pool.query(
        `SELECT id FROM agent_personas WHERE id = $1 AND organization_id = $2 AND is_agent = TRUE`,
        [input.to_agent_id, input.organization_id],
      );
      if (!recipientCheck.rows[0]) throw new Error('Recipient agent not found');
    }

    const id = uuidv7();
    const threadId = input.thread_id || uuidv7();
    const subject = input.subject?.trim() || 'general';

    const result = await this.pool.query(
      `INSERT INTO agent_messages (
        id, organization_id, from_agent_id, to_agent_id, thread_id,
        subject, message_type, content, metadata, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW())
      RETURNING *`,
      [
        id,
        input.organization_id,
        input.from_agent_id,
        input.to_agent_id || null,
        threadId,
        subject,
        messageType,
        input.content.trim(),
        JSON.stringify(input.metadata || {}),
      ],
    );

    const message = this.mapRow(result.rows[0]);

    // Publish to NATS for real-time delivery
    try {
      const natsSubject = input.to_agent_id
        ? `agent.msg.${input.organization_id}.${input.to_agent_id}`
        : `agent.msg.${input.organization_id}.broadcast.${subject}`;

      this.nc.publish(natsSubject, sc.encode(JSON.stringify({
        id: message.id,
        from_agent_id: message.from_agent_id,
        to_agent_id: message.to_agent_id,
        thread_id: message.thread_id,
        subject: message.subject,
        message_type: message.message_type,
        content: message.content,
        metadata: message.metadata,
      })));

      // Mark as delivered
      await this.pool.query(
        `UPDATE agent_messages SET status = 'delivered', delivered_at = NOW() WHERE id = $1`,
        [id],
      );
    } catch {
      // NATS delivery failure is non-blocking — message persisted in DB
    }

    return message;
  }

  async getThread(
    organizationId: string,
    threadId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ messages: AgentMessage[]; total: number }> {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const safeOffset = Math.max(offset, 0);

    const [dataResult, countResult] = await Promise.all([
      this.pool.query(
        `SELECT * FROM agent_messages
         WHERE organization_id = $1 AND thread_id = $2
         ORDER BY created_at ASC
         LIMIT $3 OFFSET $4`,
        [organizationId, threadId, safeLimit, safeOffset],
      ),
      this.pool.query(
        `SELECT COUNT(*)::INTEGER AS total FROM agent_messages
         WHERE organization_id = $1 AND thread_id = $2`,
        [organizationId, threadId],
      ),
    ]);

    return {
      messages: dataResult.rows.map((r: any) => this.mapRow(r)),
      total: countResult.rows[0]?.total || 0,
    };
  }

  async getAgentInbox(
    organizationId: string,
    agentId: string,
    options?: { status?: string; limit?: number; offset?: number },
  ): Promise<{ messages: AgentMessage[]; total: number }> {
    const limit = Math.min(Math.max(options?.limit || 50, 1), 200);
    const offset = Math.max(options?.offset || 0, 0);

    const conditions = ['organization_id = $1', 'to_agent_id = $2'];
    const params: unknown[] = [organizationId, agentId];
    let paramIdx = 3;

    if (options?.status) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(options.status);
    }

    const where = conditions.join(' AND ');

    const [dataResult, countResult] = await Promise.all([
      this.pool.query(
        `SELECT * FROM agent_messages WHERE ${where} ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limit, offset],
      ),
      this.pool.query(
        `SELECT COUNT(*)::INTEGER AS total FROM agent_messages WHERE ${where}`,
        params,
      ),
    ]);

    return {
      messages: dataResult.rows.map((r: any) => this.mapRow(r)),
      total: countResult.rows[0]?.total || 0,
    };
  }

  async markRead(organizationId: string, messageId: string, agentId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE agent_messages
       SET status = 'read', read_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND to_agent_id = $3 AND status != 'read'`,
      [messageId, organizationId, agentId],
    );
    return (result.rowCount || 0) > 0;
  }

  private mapRow(row: any): AgentMessage {
    return {
      id: row.id,
      organization_id: row.organization_id,
      from_agent_id: row.from_agent_id,
      to_agent_id: row.to_agent_id,
      thread_id: row.thread_id,
      subject: row.subject,
      message_type: row.message_type,
      content: row.content,
      metadata: row.metadata || {},
      status: row.status,
      created_at: row.created_at,
    };
  }
}
