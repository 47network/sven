import pg from 'pg';
import type { ConversationTurn, ConversationDebrief } from '@sven/marketing-intel/communication-coach';

export interface CoachingSessionRow {
  id: string;
  org_id: string;
  user_id: string;
  scenario_id: string;
  scenario_title: string;
  turns: ConversationTurn[];
  debrief: ConversationDebrief | null;
  overall_score: number | null;
  created_at: string;
  completed_at: string | null;
}

export class PgCoachingStore {
  constructor(private readonly pool: pg.Pool) {}

  async createSession(orgId: string, userId: string, scenarioId: string, scenarioTitle: string): Promise<string> {
    const id = crypto.randomUUID();
    await this.pool.query(
      `INSERT INTO marketing_coaching_sessions (id, org_id, user_id, scenario_id, scenario_title)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, orgId, userId, scenarioId, scenarioTitle],
    );
    return id;
  }

  async addTurn(sessionId: string, turn: ConversationTurn): Promise<void> {
    await this.pool.query(
      `UPDATE marketing_coaching_sessions SET turns = turns || $2::jsonb WHERE id = $1`,
      [sessionId, JSON.stringify([turn])],
    );
  }

  async completeSession(sessionId: string, debrief: ConversationDebrief): Promise<void> {
    await this.pool.query(
      `UPDATE marketing_coaching_sessions SET debrief = $2, overall_score = $3, completed_at = NOW() WHERE id = $1`,
      [sessionId, JSON.stringify(debrief), debrief.overallScore],
    );
  }

  async getById(id: string): Promise<CoachingSessionRow | null> {
    const { rows } = await this.pool.query(`SELECT * FROM marketing_coaching_sessions WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  async listByUser(orgId: string, userId: string, limit = 20): Promise<CoachingSessionRow[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM marketing_coaching_sessions WHERE org_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT $3`,
      [orgId, userId, limit],
    );
    return rows;
  }

  async listByOrg(orgId: string, limit = 50): Promise<CoachingSessionRow[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM marketing_coaching_sessions WHERE org_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [orgId, limit],
    );
    return rows;
  }
}
