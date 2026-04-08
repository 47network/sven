import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';

const VALID_PERSONA_TYPES = [
  'guide', 'inspector', 'curator', 'advocate', 'qa',
  'librarian', 'tester', 'imagination', 'moderator',
] as const;

type PersonaType = (typeof VALID_PERSONA_TYPES)[number];

const VALID_AGENT_STATUSES = ['active', 'inactive', 'suspended', 'observing'] as const;
type AgentStatus = (typeof VALID_AGENT_STATUSES)[number];

interface AgentPersona {
  id: string;
  organization_id: string;
  name: string;
  agent_persona_type: PersonaType;
  persona_display_name: string;
  persona_avatar_url: string | null;
  persona_bio: string | null;
  community_visible: boolean;
  agent_status: AgentStatus;
  system_prompt: string;
  model_name: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface CreateAgentPersonaInput {
  organization_id: string;
  name: string;
  agent_persona_type: string;
  persona_display_name: string;
  persona_avatar_url?: string;
  persona_bio?: string;
  system_prompt: string;
  model_name?: string;
  settings?: Record<string, unknown>;
}

export class AgentPersonaService {
  constructor(private pool: pg.Pool) {}

  async createPersona(input: CreateAgentPersonaInput): Promise<AgentPersona> {
    const personaType = input.agent_persona_type?.trim().toLowerCase();
    if (!VALID_PERSONA_TYPES.includes(personaType as PersonaType)) {
      throw new Error(`Invalid persona type: ${personaType}. Must be one of: ${VALID_PERSONA_TYPES.join(', ')}`);
    }
    if (!input.name?.trim()) throw new Error('Agent name is required');
    if (input.name.trim().length > 100) throw new Error('Agent name must be ≤100 characters');
    if (!input.persona_display_name?.trim()) throw new Error('Display name is required');
    if (input.persona_display_name.trim().length > 200) throw new Error('Display name must be ≤200 characters');
    if (!input.system_prompt?.trim()) throw new Error('System prompt is required');
    if (input.system_prompt.trim().length > 50000) throw new Error('System prompt must be ≤50000 characters');
    if (input.persona_bio && input.persona_bio.length > 2000) throw new Error('Bio must be ≤2000 characters');

    const id = uuidv7();
    const result = await this.pool.query(
      `INSERT INTO agent_personas (
        id, organization_id, name, is_agent, agent_persona_type,
        persona_display_name, persona_avatar_url, persona_bio,
        community_visible, agent_status, system_prompt, model_name,
        settings, created_at, updated_at
      ) VALUES ($1, $2, $3, TRUE, $4, $5, $6, $7, FALSE, 'inactive', $8, $9, $10, NOW(), NOW())
      RETURNING *`,
      [
        id,
        input.organization_id,
        input.name.trim().toLowerCase().replace(/\s+/g, '-'),
        personaType,
        input.persona_display_name.trim(),
        input.persona_avatar_url?.trim() || null,
        input.persona_bio?.trim() || null,
        input.system_prompt.trim(),
        input.model_name?.trim() || null,
        JSON.stringify(input.settings || {}),
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  async getPersona(id: string, organizationId: string): Promise<AgentPersona | null> {
    const result = await this.pool.query(
      `SELECT * FROM agent_personas WHERE id = $1 AND organization_id = $2 AND is_agent = TRUE`,
      [id, organizationId],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async listPersonas(
    organizationId: string,
    options?: { type?: string; status?: string; communityVisible?: boolean; limit?: number; offset?: number },
  ): Promise<{ personas: AgentPersona[]; total: number }> {
    const conditions = ['organization_id = $1', 'is_agent = TRUE'];
    const params: unknown[] = [organizationId];
    let paramIdx = 2;

    if (options?.type) {
      conditions.push(`agent_persona_type = $${paramIdx++}`);
      params.push(options.type.trim().toLowerCase());
    }
    if (options?.status) {
      conditions.push(`agent_status = $${paramIdx++}`);
      params.push(options.status.trim().toLowerCase());
    }
    if (options?.communityVisible !== undefined) {
      conditions.push(`community_visible = $${paramIdx++}`);
      params.push(options.communityVisible);
    }

    const where = conditions.join(' AND ');
    const limit = Math.min(Math.max(options?.limit || 50, 1), 200);
    const offset = Math.max(options?.offset || 0, 0);

    const [dataResult, countResult] = await Promise.all([
      this.pool.query(
        `SELECT * FROM agent_personas WHERE ${where} ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limit, offset],
      ),
      this.pool.query(
        `SELECT COUNT(*)::INTEGER AS total FROM agent_personas WHERE ${where}`,
        params,
      ),
    ]);

    return {
      personas: dataResult.rows.map((r: any) => this.mapRow(r)),
      total: countResult.rows[0]?.total || 0,
    };
  }

  async updatePersonaStatus(
    id: string,
    organizationId: string,
    status: string,
  ): Promise<AgentPersona | null> {
    if (!VALID_AGENT_STATUSES.includes(status as AgentStatus)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${VALID_AGENT_STATUSES.join(', ')}`);
    }
    const result = await this.pool.query(
      `UPDATE agent_personas
       SET agent_status = $3, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND is_agent = TRUE
       RETURNING *`,
      [id, organizationId, status],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async setCommunityVisibility(
    id: string,
    organizationId: string,
    visible: boolean,
  ): Promise<AgentPersona | null> {
    const result = await this.pool.query(
      `UPDATE agent_personas
       SET community_visible = $3, updated_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND is_agent = TRUE
       RETURNING *`,
      [id, organizationId, visible],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async updatePersona(
    id: string,
    organizationId: string,
    updates: Partial<Pick<CreateAgentPersonaInput, 'persona_display_name' | 'persona_avatar_url' | 'persona_bio' | 'system_prompt' | 'model_name' | 'settings'>>,
  ): Promise<AgentPersona | null> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [id, organizationId];
    let paramIdx = 3;

    if (updates.persona_display_name !== undefined) {
      if (!updates.persona_display_name?.trim()) throw new Error('Display name cannot be empty');
      setClauses.push(`persona_display_name = $${paramIdx++}`);
      params.push(updates.persona_display_name.trim());
    }
    if (updates.persona_avatar_url !== undefined) {
      setClauses.push(`persona_avatar_url = $${paramIdx++}`);
      params.push(updates.persona_avatar_url?.trim() || null);
    }
    if (updates.persona_bio !== undefined) {
      if (updates.persona_bio && updates.persona_bio.length > 2000) throw new Error('Bio must be ≤2000 characters');
      setClauses.push(`persona_bio = $${paramIdx++}`);
      params.push(updates.persona_bio?.trim() || null);
    }
    if (updates.system_prompt !== undefined) {
      if (!updates.system_prompt?.trim()) throw new Error('System prompt cannot be empty');
      setClauses.push(`system_prompt = $${paramIdx++}`);
      params.push(updates.system_prompt.trim());
    }
    if (updates.model_name !== undefined) {
      setClauses.push(`model_name = $${paramIdx++}`);
      params.push(updates.model_name?.trim() || null);
    }
    if (updates.settings !== undefined) {
      setClauses.push(`settings = $${paramIdx++}`);
      params.push(JSON.stringify(updates.settings));
    }

    if (setClauses.length === 1) return this.getPersona(id, organizationId);

    const result = await this.pool.query(
      `UPDATE agent_personas SET ${setClauses.join(', ')}
       WHERE id = $1 AND organization_id = $2 AND is_agent = TRUE
       RETURNING *`,
      params,
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  private mapRow(row: any): AgentPersona {
    return {
      id: row.id,
      organization_id: row.organization_id,
      name: row.name,
      agent_persona_type: row.agent_persona_type,
      persona_display_name: row.persona_display_name,
      persona_avatar_url: row.persona_avatar_url,
      persona_bio: row.persona_bio,
      community_visible: row.community_visible,
      agent_status: row.agent_status,
      system_prompt: row.system_prompt,
      model_name: row.model_name,
      settings: row.settings || {},
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
