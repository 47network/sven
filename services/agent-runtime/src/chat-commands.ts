import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createLogger } from '@sven/shared';
import type { InboundMessageEvent } from '@sven/shared';
import { v7 as uuidv7 } from 'uuid';
import { CanvasEmitter } from './canvas-emitter.js';
import { parseSettingValue } from './settings-utils.js';
import { fetchWebContent } from '@sven/shared/integrations/web.js';

const logger = createLogger('chat-commands');
const SESSION_RESET_MARKER = '[SVEN_SESSION_RESET]';
const COMPACTION_SUMMARY_PREFIX = '[SVEN_COMPACTION_SUMMARY]';
const DEFAULT_RELAY_TIMEOUT_MS = 25000;
const MIN_RELAY_TIMEOUT_MS = 5000;
const MAX_RELAY_TIMEOUT_MS = 120000;
const MAX_RELAY_IMAGE_BASE64_LENGTH = 5_000_000;
const NEXT_THINK_LEVEL = new Map<string, string>();
const MODEL_ALIASES: Record<string, string[]> = {
  gpt: ['gpt-4.1', 'gpt-4o', 'gpt-4', 'gpt'],
  'gpt-mini': ['gpt-4o-mini', 'gpt-mini'],
  opus: ['claude-3-opus', 'opus'],
  sonnet: ['claude-3.5-sonnet', 'claude-3-sonnet', 'sonnet'],
  gemini: ['gemini-1.5-pro', 'gemini-pro', 'gemini'],
  'gemini-flash': ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash', 'flash'],
};

interface AvailableModel {
  name: string;
  provider: string;
  modelId: string;
}

interface McpServerRow {
  id: string;
  name: string;
  transport: string;
  status: string;
  effectiveEnabled: boolean;
  scope: 'org-default' | 'chat-override';
}

interface McpToolRow {
  serverName: string;
  toolName: string;
}

interface CommandContext {
  pool: pg.Pool;
  canvasEmitter: CanvasEmitter;
  event: InboundMessageEvent;
  userId: string;
  publishInbound?: (event: InboundMessageEvent) => Promise<void> | void;
  publishWorkflowExecute?: (runId: string) => Promise<void> | void;
}

interface CommandParseResult {
  isCommand: boolean;
  command?: string;
  args?: string[];
  prefix?: string;
  viaDirective?: boolean;
}

type ProseAgentSpec = {
  name: string;
  model?: string;
  prompt?: string;
};

type ProseParallelSpec = {
  variable: string;
  agent: string;
  prompt: string;
};

type CompiledProseProgram = {
  title: string;
  description: string;
  steps: Array<Record<string, any>>;
  edges: Array<{ from: string; to: string }>;
};

export function getSessionResetMarker(): string {
  return SESSION_RESET_MARKER;
}

export function getCompactionSummaryPrefix(): string {
  return COMPACTION_SUMMARY_PREFIX;
}

export async function handleChatCommand(ctx: CommandContext): Promise<boolean> {
  const parsed = await parseCommand(ctx.pool, ctx.event.text || '');
  if (!parsed.isCommand || !parsed.command) {
    return false;
  }

  const command = parsed.command.toLowerCase();
  const args = parsed.args || [];

  switch (command) {
    case 'help': {
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: [
          'Available commands:',
          `${parsed.prefix}help`,
          `${parsed.prefix}status`,
          `${parsed.prefix}history`,
          `${parsed.prefix}session [status|export [limit]|import-base64 <payload>]`,
          `${parsed.prefix}whoami`,
          `${parsed.prefix}context`,
          `${parsed.prefix}debug`,
          `${parsed.prefix}export-session [limit]`,
          `${parsed.prefix}queue`,
          `${parsed.prefix}agent status|pause|resume|nudge`,
          `${parsed.prefix}pause`,
          `${parsed.prefix}resume`,
          `${parsed.prefix}nudge`,
          `${parsed.prefix}subagents`,
          `${parsed.prefix}prose list|prep <workflow_id|name> [goal]|show|run [workflow_id|name] [goal]`,
          `${parsed.prefix}relay <source> -> <target> [widthxheight] [timeout=ms]`,
          `${parsed.prefix}camrelay <source> -> <target> [widthxheight] [timeout=ms]`,
          `${parsed.prefix}handoff <target> [note...]`,
          `${parsed.prefix}mirrorpersona <target> [mood=idle|thinking|listening|speaking|happy] [state=...] [cue=...]`,
          `${parsed.prefix}selfchat on|off|status`,
          `${parsed.prefix}tell <agent_id> <message>`,
          `${parsed.prefix}steer <agent_id|all> <instruction>`,
          `${parsed.prefix}kill <agent_id>`,
          `${parsed.prefix}elevated on|off|status`,
          `${parsed.prefix}config [get <key> | set <key> <value>]`,
          `${parsed.prefix}version`,
          `${parsed.prefix}skills`,
          `${parsed.prefix}mcp list|tools [server_id|server_name]`,
          `${parsed.prefix}operator status|observability [limit]`,
          `${parsed.prefix}tool reliability [limit]`,
          `${parsed.prefix}research <topic> [quick|deep|exhaustive]`,
          `${parsed.prefix}think off|low|medium|high`,
          `${parsed.prefix}think set off|low|medium|high`,
          `${parsed.prefix}verbose on|off`,
          `${parsed.prefix}usage off|tokens|full`,
          `${parsed.prefix}model list`,
          `${parsed.prefix}model current`,
          `${parsed.prefix}model <number|alias|model_name>`,
          `${parsed.prefix}profile gaming|balanced|performance`,
          `${parsed.prefix}rag on|off`,
          `${parsed.prefix}buddy on|off`,
          `${parsed.prefix}activation mention|always`,
          `${parsed.prefix}mute <duration>`,
          `${parsed.prefix}unmute`,
          `${parsed.prefix}restart`,
          `${parsed.prefix}compact`,
          `${parsed.prefix}reset (alias: ${parsed.prefix}new)`,
          '',
          'Directives:',
          'sven: status',
          'sven think high',
          'sven: model list',
        ].join('\n'),
      });
      return true;
    }

    case 'status': {
      const status = await getStatus(ctx.pool, ctx.event.chat_id, ctx.userId);
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: [
          'Session status:',
          `chat_id: ${ctx.event.chat_id}`,
          `chat_type: ${status.chatType}`,
          `message_count: ${status.messageCount}`,
          `assistant_messages: ${status.assistantMessages}`,
          `performance_profile: ${status.profile}`,
          `incident_mode: ${status.incidentMode}`,
          `session_profile: ${status.sessionProfile || 'default'}`,
          `model_override: ${status.modelOverride || 'auto'}`,
          `think_level: ${status.thinkLevel || 'default'}`,
          `verbose: ${status.verbose ? 'on' : 'off'}`,
          `rag: ${status.ragEnabled ? 'on' : 'off'}`,
          `usage_mode: ${status.usageMode}`,
          `user_tokens_today: ${status.userTokensToday}`,
          `estimated_cost_usd_today: ${status.estimatedCostUsd !== null ? status.estimatedCostUsd.toFixed(6) : 'n/a'}`,
          `runtime_uptime_sec: ${Math.floor(process.uptime())}`,
        ].join('\n'),
      });
      return true;
    }

    case 'history': {
      const messageCount = await getMessageCount(ctx.pool, ctx.event.chat_id);
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: `History: ${messageCount} messages in this chat.`,
      });
      return true;
    }

    case 'session': {
      const sub = (args[0] || 'status').toLowerCase();
      if (!['status', 'export', 'import-base64'].includes(sub)) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Usage: ${parsed.prefix}session status | ${parsed.prefix}session export [limit] | ${parsed.prefix}session import-base64 <payload>`,
        });
        return true;
      }

      if (sub === 'export') {
        const parsedLimit = Number.parseInt(String(args[1] || '100'), 10);
        const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 100;
        await emitSessionExport(ctx, limit);
        return true;
      }

      if (sub === 'import-base64') {
        const encodedPayload = String(args[1] || '').trim();
        if (!encodedPayload) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: `Usage: ${parsed.prefix}session import-base64 <payload>`,
          });
          return true;
        }
        const decoded = decodeSessionImportPayload(encodedPayload);
        if (!decoded.ok) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: `Session import failed: ${decoded.message}`,
          });
          return true;
        }

        const imported = await importSessionPayload(ctx.pool, ctx.event.chat_id, decoded.payload);
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: [
            `Session import complete.`,
            `source_chat_id: ${decoded.payload.chat_id || 'unknown'}`,
            `messages_imported: ${imported.importedCount}`,
            `settings_applied: ${imported.appliedSettings.join(', ') || 'none'}`,
          ].join('\n'),
        });
        return true;
      }

      const meta = await getSessionMeta(ctx.pool, ctx.event.chat_id);
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: [
          'Session metadata:',
          `chat_id: ${ctx.event.chat_id}`,
          `chat_type: ${meta.chatType}`,
          `started_at: ${meta.startedAt || 'unknown'}`,
          `last_message_at: ${meta.lastMessageAt || 'unknown'}`,
          `message_count: ${meta.messageCount}`,
        ].join('\n'),
      });
      return true;
    }

    case 'whoami': {
      const userRes = await ctx.pool.query(
        `SELECT id, username, role FROM users WHERE id = $1 LIMIT 1`,
        [ctx.userId],
      );
      const row = userRes.rows[0] || {};
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: [
          'Identity:',
          `user_id: ${ctx.userId}`,
          `username: ${row.username || 'unknown'}`,
          `role: ${row.role || 'user'}`,
          `chat_id: ${ctx.event.chat_id}`,
          `channel: ${ctx.event.channel}`,
          `sender_identity_id: ${ctx.event.sender_identity_id || 'n/a'}`,
        ].join('\n'),
      });
      return true;
    }

    case 'context': {
      const [meta, status, boundary] = await Promise.all([
        getSessionMeta(ctx.pool, ctx.event.chat_id),
        getStatus(ctx.pool, ctx.event.chat_id, ctx.userId),
        getContextBoundaryTimestamp(ctx.pool, ctx.event.chat_id),
      ]);

      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: [
          'Context summary:',
          `chat_type: ${meta.chatType}`,
          `messages: ${meta.messageCount}`,
          `started_at: ${meta.startedAt || 'unknown'}`,
          `last_message_at: ${meta.lastMessageAt || 'unknown'}`,
          `context_boundary: ${boundary ? boundary.toISOString() : 'none'}`,
          `model_override: ${status.modelOverride || 'auto'}`,
          `think_level: ${status.thinkLevel || 'default'}`,
          `rag: ${status.ragEnabled ? 'on' : 'off'}`,
          `profile: ${status.sessionProfile || status.profile}`,
        ].join('\n'),
      });
      return true;
    }

    case 'version': {
      const version = process.env.SVEN_VERSION || process.env.npm_package_version || '0.1.0';
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: `Sven version: ${version}`,
      });
      return true;
    }

    case 'skills':
    case 'skill': {
      const skillSubcommand = (args[0] || '').toLowerCase();
      if (skillSubcommand === 'installed') {
        const orgId = await getChatOrganizationId(ctx.pool, ctx.event.chat_id);
        if (!orgId) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: 'Installed skills are unavailable because this chat is not bound to an organization.',
          });
          return true;
        }

        const installed = await listInstalledSkills(ctx.pool, orgId);
        if (installed.length === 0) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: 'No installed skills for this organization.',
          });
          return true;
        }

        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: [
            'Installed skills:',
            ...installed.map((row) => `- ${row.name} [${row.trustLevel}] id=${row.id} tool=${row.toolId}`),
          ].join('\n'),
        });
        return true;
      }

      if (['install', 'remove', 'block', 'quarantine'].includes(skillSubcommand)) {
        const isAdmin = await isAdminUser(ctx.pool, ctx.userId);
        if (!isAdmin) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: 'Only admins can install or manage skills.',
          });
          return true;
        }

        const orgId = await getChatOrganizationId(ctx.pool, ctx.event.chat_id);
        if (!orgId) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: 'Skill install/manage requires a chat bound to an organization.',
          });
          return true;
        }

        const incidentMode = await getIncidentModeSetting(ctx.pool);
        if (incidentMode === 'kill_switch' || incidentMode === 'lockdown' || incidentMode === 'forensics') {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: 'Skill install/manage is blocked while incident controls are active.',
          });
          return true;
        }

        if (skillSubcommand === 'install') {
          const query = args.slice(1).join(' ').trim();
          if (!query) {
            await ctx.canvasEmitter.emit({
              chat_id: ctx.event.chat_id,
              channel: ctx.event.channel,
              text: `Usage: ${parsed.prefix}skill install <catalog_name|catalog_id>`,
            });
            return true;
          }

          const installResult = await installSkillForChatCommand(ctx.pool, {
            organizationId: orgId,
            userId: ctx.userId,
            query,
          });
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: installResult.message,
          });
          return true;
        }

        const query = args.slice(1).join(' ').trim();
        if (!query) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: `Usage: ${parsed.prefix}skill ${skillSubcommand} <installed_id|tool_id|catalog_name>`,
          });
          return true;
        }

        const manageResult = await manageInstalledSkillForChatCommand(ctx.pool, {
          organizationId: orgId,
          query,
          action: skillSubcommand as 'remove' | 'block' | 'quarantine',
        });
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: manageResult.message,
        });
        return true;
      }

      const toolsRes = await ctx.pool.query(
        `SELECT name, trust_level
         FROM tools
         WHERE trust_level != 'blocked'
         ORDER BY name ASC
         LIMIT 50`,
      );
      if (toolsRes.rows.length === 0) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: 'No active skills.',
        });
        return true;
      }

      const lines = toolsRes.rows.map((r) => `- ${r.name} (${r.trust_level})`);
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: ['Active skills:', ...lines].join('\n'),
      });
      return true;
    }

    case 'mcp': {
      const sub = (args[0] || 'list').toLowerCase();
      if (!['list', 'tools'].includes(sub)) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Usage: ${parsed.prefix}mcp list | ${parsed.prefix}mcp tools [server_id|server_name]`,
        });
        return true;
      }

      const orgId = await getChatOrganizationId(ctx.pool, ctx.event.chat_id);
      if (!orgId) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: 'MCP discovery is unavailable because this chat is not bound to an organization.',
        });
        return true;
      }

      if (sub === 'list') {
        const servers = await listMcpServersForChatCommand(ctx.pool, orgId, ctx.event.chat_id);
        if (servers.length === 0) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: 'No MCP servers are registered for this organization.',
          });
          return true;
        }

        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: [
            'MCP servers:',
            ...servers.map((row) => (
              `- ${row.name} id=${row.id} transport=${row.transport} status=${row.effectiveEnabled ? 'enabled' : 'disabled'} scope=${row.scope}`
            )),
          ].join('\n'),
        });
        return true;
      }

      const serverRef = args.slice(1).join(' ').trim();
      const toolRows = await listMcpToolsForChatCommand(ctx.pool, orgId, serverRef);
      if (toolRows.length === 0) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: serverRef
            ? `No MCP tools found for "${serverRef}".`
            : 'No MCP tools discovered yet.',
        });
        return true;
      }

      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: [
          serverRef ? `MCP tools for ${serverRef}:` : 'MCP tools:',
          ...toolRows.map((row) => `- ${row.serverName}/${row.toolName}`),
        ].join('\n'),
      });
      return true;
    }

    case 'operator': {
      const sub = (args[0] || 'status').toLowerCase();
      if (!['status', 'observability'].includes(sub)) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Usage: ${parsed.prefix}operator status | ${parsed.prefix}operator observability [limit]`,
        });
        return true;
      }

      if (sub === 'observability') {
        const parsedLimit = Number.parseInt(String(args[1] || '5'), 10);
        const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 20) : 5;
        const snapshot = await getOperatorObservabilitySnapshot(ctx.pool, ctx.event.chat_id, limit);

        const queueLines = snapshot.queue.queues.length > 0
          ? snapshot.queue.queues.map((q) => (
            `- ${q.queue_type}: depth=${q.queue_depth}, fill=${q.depth_percentage !== null && Number.isFinite(q.depth_percentage) ? `${q.depth_percentage.toFixed(1)}%` : 'n/a'}`
          ))
          : ['- no queue metrics available'];
        const runLines = snapshot.recentWorkflowRuns.length > 0
          ? snapshot.recentWorkflowRuns.map((run) => (
            `- ${run.id}: ${run.status} workflow=${run.workflowId} updated_at=${run.updatedAt}`
          ))
          : ['- no recent workflow runs for this chat'];

        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: [
            'Operator observability:',
            `agent_paused: ${snapshot.agent.paused ? 'yes' : 'no'}`,
            `agent_last_nudged_at: ${snapshot.agent.lastNudgedAt || 'never'}`,
            `queue_backpressure: ${snapshot.queue.backpressureActive ? 'active' : 'inactive'}`,
            '',
            'Queue metrics:',
            ...queueLines,
            '',
            'Recent workflow runs:',
            ...runLines,
          ].join('\n'),
        });
        return true;
      }

      const admin = await isAdminUser(ctx.pool, ctx.userId);
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: [
          'Operator controls:',
          `role: ${admin ? 'admin' : 'user'}`,
          `model_switch: ${admin ? 'allowed' : 'blocked'}`,
          `skill_manage: ${admin ? 'allowed' : 'blocked'}`,
          `subagent_control: ${admin ? 'allowed' : 'blocked'}`,
          `elevated_mode: ${admin ? 'allowed' : 'blocked'}`,
          '',
          'Admin-gated commands:',
          `${parsed.prefix}model <...>`,
          `${parsed.prefix}skill install|remove|block|quarantine <...>`,
          `${parsed.prefix}selfchat on|off`,
          `${parsed.prefix}tell|steer|kill ...`,
          `${parsed.prefix}elevated on|off`,
        ].join('\n'),
      });
      return true;
    }

    case 'tool':
    case 'tools': {
      const sub = (args[0] || 'reliability').toLowerCase();
      if (!['reliability'].includes(sub)) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Usage: ${parsed.prefix}tool reliability [limit]`,
        });
        return true;
      }

      const parsedLimit = Number.parseInt(String(args[1] || '5'), 10);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 20) : 5;
      const snapshot = await getToolReliabilitySnapshot(ctx.pool, ctx.event.chat_id, limit);

      const failureLines = snapshot.recentFailures.length > 0
        ? snapshot.recentFailures.map((row) => `- ${row.toolName}: ${row.status} @ ${row.createdAt}${row.error ? ` | ${row.error}` : ''}`)
        : ['- no recent failed tool runs in this chat'];
      const retryLines = snapshot.retryBreakdown.length > 0
        ? snapshot.retryBreakdown.map((row) => `- ${row.classification}/${row.outcome}: ${row.count}`)
        : ['- no retry audit rows for this chat'];

      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: [
          'Tool reliability:',
          `self_correction_enabled: ${snapshot.policy.enabled ? 'true' : 'false'}`,
          `max_retries: ${snapshot.policy.maxRetries}`,
          `require_approval_after: ${snapshot.policy.requireApprovalAfter}`,
          '',
          'Recent failures:',
          ...failureLines,
          '',
          'Retry outcomes:',
          ...retryLines,
          '',
          'Policy is bounded and fail-closed by runtime guards.',
        ].join('\n'),
      });
      return true;
    }

    case 'research': {
      const settings = await getResearchSettings(ctx.pool);
      if (!settings.enabled) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: 'Research mode is disabled by admin setting (agent.research.enabled=false).',
        });
        return true;
      }

      const parsedResearch = parseResearchArgs(args);
      if (!parsedResearch.topic) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Usage: ${parsed.prefix}research <topic> [quick|deep|exhaustive]`,
        });
        return true;
      }

      const maxSteps = Math.max(1, settings.maxSteps);
      const requestedSteps = depthToSteps(parsedResearch.depth);
      const totalSteps = Math.max(1, Math.min(maxSteps, requestedSteps));
      const depth = parsedResearch.depth;
      const topic = parsedResearch.topic;

      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: `Research started: "${topic}" (depth=${depth}, steps=${totalSteps}).`,
      });

      try {
        const report = await runResearchPipeline(ctx.pool, ctx.event.chat_id, topic, depth, totalSteps, async (status) => {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: status,
          });
        });

        await saveResearchMemory(ctx.pool, {
          userId: ctx.userId,
          chatId: ctx.event.chat_id,
          topic,
          depth,
          report,
        });

        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: report,
        });
      } catch (err) {
        logger.error('Research command failed', { err: String(err), chat_id: ctx.event.chat_id });
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Research failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      return true;
    }

    case 'reasoning': {
      const level = (args[0] || '').toLowerCase();
      if (!level) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Usage: ${parsed.prefix}reasoning off|low|medium|high`,
        });
        return true;
      }
      if (!['off', 'low', 'medium', 'high'].includes(level)) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Invalid reasoning level "${level}". Use off|low|medium|high.`,
        });
        return true;
      }
      NEXT_THINK_LEVEL.set(ctx.event.chat_id, level);
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: `Reasoning level set to ${level} for your next reply.`,
      });
      return true;
    }

    case 'debug': {
      const [settingsRes, nowRes] = await Promise.all([
        ctx.pool.query(
          `SELECT key, value
           FROM settings_global
           WHERE key IN ('performance.profile', 'incident.mode', 'llm.litellm.enabled', 'llm.litellm.url')
           ORDER BY key ASC`,
        ),
        ctx.pool.query(`SELECT NOW() AS now_utc`),
      ]);
      const settingMap = new Map<string, string>();
      for (const row of settingsRes.rows) {
        settingMap.set(String(row.key), String(parseSettingValue(row.value)));
      }
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: [
          'Runtime debug:',
          `node: ${process.version}`,
          `uptime_sec: ${Math.floor(process.uptime())}`,
          `server_time_utc: ${String(nowRes.rows[0]?.now_utc || new Date().toISOString())}`,
          `performance.profile: ${settingMap.get('performance.profile') || 'balanced'}`,
          `incident.mode: ${settingMap.get('incident.mode') || 'normal'}`,
          `llm.litellm.enabled: ${settingMap.get('llm.litellm.enabled') || 'false'}`,
          `llm.litellm.url: ${settingMap.get('llm.litellm.url') || process.env.LITELLM_URL || 'http://litellm:4000'}`,
        ].join('\n'),
      });
      return true;
    }

    case 'think': {
      const mode = (args[0] || '').toLowerCase();
      const level = (mode === 'set' ? args[1] : mode || '').toLowerCase();
      const valid = new Set(['off', 'low', 'medium', 'high']);
      if (!valid.has(level)) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Usage: ${parsed.prefix}think off|low|medium|high (next reply)\n${parsed.prefix}think set off|low|medium|high (persist)`,
        });
        return true;
      }
      if (mode === 'set') {
        const ok = await setSessionSettingThinkLevel(ctx.pool, ctx.event.chat_id, level);
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: ok
            ? `Thinking level set to ${level}.`
            : 'Could not persist thinking level yet (pending migration).',
        });
      } else {
        NEXT_THINK_LEVEL.set(ctx.event.chat_id, level);
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Thinking level set to ${level} for your next reply. Use ${parsed.prefix}think set ${level} to persist.`,
        });
      }
      return true;
    }

    case 'verbose': {
      const mode = (args[0] || '').toLowerCase();
      if (mode !== 'on' && mode !== 'off') {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Usage: ${parsed.prefix}verbose on|off`,
        });
        return true;
      }
      const ok = await setSessionSettingVerbose(ctx.pool, ctx.event.chat_id, mode === 'on');
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: ok
          ? `Verbose mode ${mode}.`
          : 'Could not persist verbose mode yet (pending migration).',
      });
      return true;
    }

    case 'usage': {
      const mode = (args[0] || '').toLowerCase();
      const valid = new Set(['off', 'tokens', 'full']);
      if (!valid.has(mode)) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Usage: ${parsed.prefix}usage off|tokens|full`,
        });
        return true;
      }
      const ok = await setSessionSettingUsageMode(ctx.pool, ctx.event.chat_id, mode);
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: ok
          ? `Usage footer set to ${mode}.`
          : 'Could not persist usage mode yet (pending migration).',
      });
      return true;
    }

    case 'model': {
      const modelArg = args.join(' ').trim();
      const modelPickerEnabled = await getBooleanSetting(ctx.pool, 'chat.modelPicker.enabled', true);
      if (!modelPickerEnabled) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: 'Model picker is disabled by admin.',
        });
        return true;
      }
      const availableModels = await listAvailableModels(ctx.pool);
      if (modelArg.toLowerCase() === 'current') {
        const settings = await getSessionSettingsSafe(ctx.pool, ctx.event.chat_id);
        const currentModel = String(settings.model_name || '').trim() || 'auto';
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Current model override: ${currentModel}.`,
        });
        return true;
      }

      if (!modelArg || modelArg.toLowerCase() === 'list') {
        if (availableModels.length === 0) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: `No models available in registry yet.\nUsage: ${parsed.prefix}model <model_name>`,
          });
          return true;
        }

        const lines = availableModels.slice(0, 15).map((m, i) => (
          `${i + 1}. ${m.provider}/${m.modelId} (${m.name})`
        ));
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: [
            'Available models:',
            ...lines,
            '',
            `Pick by number: ${parsed.prefix}model 1`,
            `Or set directly: ${parsed.prefix}model <provider/model_id>`,
            `Aliases: ${Object.keys(MODEL_ALIASES).join(', ')}`,
          ].join('\n'),
        });
        return true;
        }

        const resolved = resolveModelSelection(modelArg, availableModels);
        if (!resolved.ok) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: resolved.message,
        });
        return true;
        }

        const isAdmin = await isAdminUser(ctx.pool, ctx.userId);
        if (!isAdmin) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: 'Only admins can change the active model.',
          });
          return true;
        }

        const ok = await setSessionSettingModelName(ctx.pool, ctx.event.chat_id, resolved.modelName);
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: ok
            ? `Switched to model: ${resolved.modelName}.`
            : 'Could not persist model override yet (pending migration).',
        });
        return true;
      }

    case 'profile': {
      const profileName = (args[0] || '').toLowerCase();
      const valid = new Set(['gaming', 'balanced', 'performance']);
      if (!valid.has(profileName)) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Usage: ${parsed.prefix}profile gaming|balanced|performance`,
        });
        return true;
      }
      const ok = await setSessionSettingProfileName(ctx.pool, ctx.event.chat_id, profileName);
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: ok
          ? `Session profile set to ${profileName}.`
          : 'Could not persist session profile yet (pending migration).',
      });
      return true;
    }

    case 'rag': {
      const mode = (args[0] || '').toLowerCase();
      if (mode !== 'on' && mode !== 'off') {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Usage: ${parsed.prefix}rag on|off`,
        });
        return true;
      }
      const ok = await setSessionSettingRagEnabled(ctx.pool, ctx.event.chat_id, mode === 'on');
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: ok
          ? `RAG ${mode}.`
          : 'Could not persist RAG mode yet (pending migration).',
      });
      return true;
    }

    case 'buddy': {
      const mode = (args[0] || '').toLowerCase();
      if (mode !== 'on' && mode !== 'off') {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Usage: ${parsed.prefix}buddy on|off`,
        });
        return true;
      }

      const chatTypeRes = await ctx.pool.query(`SELECT type FROM chats WHERE id = $1`, [ctx.event.chat_id]);
      const chatType = chatTypeRes.rows[0]?.type || 'group';
      if (chatType !== 'hq') {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: 'Buddy mode can only be changed in HQ chat.',
        });
        return true;
      }

      await ctx.pool.query(
        `INSERT INTO settings_global (key, value, updated_at, updated_by)
         VALUES ('buddy.enabled', $1, NOW(), 'system')
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = 'system'`,
        [JSON.stringify(mode === 'on')],
      );
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: `Buddy mode ${mode}.`,
      });
      return true;
    }

    case 'activation': {
      const mode = (args[0] || '').toLowerCase();
      if (mode !== 'mention' && mode !== 'always') {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Usage: ${parsed.prefix}activation mention|always`,
        });
        return true;
      }
      const isAdmin = await isAdminUser(ctx.pool, ctx.userId);
      if (!isAdmin) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: 'Only admins can change activation mode.',
        });
        return true;
      }

      await ctx.pool.query(
        `INSERT INTO settings_global (key, value, updated_at, updated_by)
         VALUES ($1, $2, NOW(), 'system')
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = 'system'`,
        [`chat.activation.${ctx.event.chat_id}`, JSON.stringify(mode)],
      );
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: `Activation mode set to ${mode}.`,
      });
      return true;
    }

    case 'mute': {
      const isAdmin = await isAdminUser(ctx.pool, ctx.userId);
      if (!isAdmin) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: 'Only admins can mute this chat.',
        });
        return true;
      }
      const durationRaw = (args[0] || '15m').toLowerCase();
      const durationMs = parseDurationMs(durationRaw);
      if (!durationMs) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Usage: ${parsed.prefix}mute <duration>, e.g. 10m, 1h, 1d`,
        });
        return true;
      }
      const until = new Date(Date.now() + durationMs).toISOString();
      await ctx.pool.query(
        `INSERT INTO settings_global (key, value, updated_at, updated_by)
         VALUES ($1, $2, NOW(), 'system')
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = 'system'`,
        [`chat.mute_until.${ctx.event.chat_id}`, JSON.stringify(until)],
      );
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: `Muted until ${until}.`,
      });
      return true;
    }

    case 'unmute': {
      const isAdmin = await isAdminUser(ctx.pool, ctx.userId);
      if (!isAdmin) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: 'Only admins can unmute this chat.',
        });
        return true;
      }
      await ctx.pool.query(
        `DELETE FROM settings_global WHERE key = $1`,
        [`chat.mute_until.${ctx.event.chat_id}`],
      );
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: 'Chat unmuted.',
      });
      return true;
    }

    case 'restart': {
      const isAdmin = await isAdminUser(ctx.pool, ctx.userId);
      if (!isAdmin) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: 'Only admins can request gateway restart.',
        });
        return true;
      }

      const requestedAt = new Date().toISOString();
      await ctx.pool.query(
        `INSERT INTO settings_global (key, value, updated_at, updated_by)
         VALUES ('gateway.restart.requested_at', $1, NOW(), 'system')
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW(), updated_by = 'system'`,
        [JSON.stringify(requestedAt)],
      );
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: 'Gateway restart requested. Operator should execute `sven gateway restart`.',
      });
      return true;
    }

    case 'compact': {
      const result = await compactChatContext(ctx.pool, ctx.event.chat_id, ctx.userId);
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: result.compacted
          ? `Compaction complete. Estimated context tokens: ${result.beforeTokens} -> ${result.afterTokens}.`
          : `Compaction skipped: ${result.reason}`,
      });
      return true;
    }

    case 'reset':
    case 'new': {
      const resetMessageId = uuidv7();
      await ctx.pool.query(
        `INSERT INTO messages (id, chat_id, role, content_type, text, created_at)
         VALUES ($1, $2, 'system', 'text', $3, NOW())`,
        [resetMessageId, ctx.event.chat_id, SESSION_RESET_MARKER],
      );
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: 'Session context reset. Starting fresh from your next message.',
      });
      return true;
    }

    case 'export-session': {
      const parsedLimit = Number.parseInt(String(args[0] || '100'), 10);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 100;
      await emitSessionExport(ctx, limit);
      return true;
    }

    case 'queue': {
      const summary = await getQueueStatusSummary(ctx.pool);
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: formatQueueStatus(summary),
      });
      return true;
    }

    case 'agent': {
      const sub = (args[0] || 'status').toLowerCase();
      if (!['status', 'pause', 'resume', 'nudge', 'unstick'].includes(sub)) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Usage: ${parsed.prefix}agent status|pause|resume|nudge`,
        });
        return true;
      }
      if (sub === 'status') {
        const state = await getAgentChatState(ctx.pool, ctx.event.chat_id);
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: [
            'Agent state:',
            `paused: ${state.paused ? 'yes' : 'no'}`,
            `nudge_nonce: ${state.nudgeNonce}`,
            `last_nudged_at: ${state.lastNudgedAt || 'never'}`,
          ].join('\n'),
        });
        return true;
      }
      if (sub === 'pause') {
        await setAgentPausedSetting(ctx.pool, ctx.event.chat_id, true, ctx.userId);
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: 'Agent paused for this chat.',
        });
        return true;
      }
      if (sub === 'resume') {
        await setAgentPausedSetting(ctx.pool, ctx.event.chat_id, false, ctx.userId);
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: 'Agent resumed for this chat.',
        });
        return true;
      }

      const nudged = await executeAgentNudge(ctx);
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: nudged,
      });
      return true;
    }

    case 'pause': {
      await setAgentPausedSetting(ctx.pool, ctx.event.chat_id, true, ctx.userId);
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: 'Agent paused for this chat.',
      });
      return true;
    }

    case 'resume': {
      await setAgentPausedSetting(ctx.pool, ctx.event.chat_id, false, ctx.userId);
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: 'Agent resumed for this chat.',
      });
      return true;
    }

    case 'nudge':
    case 'unstick': {
      const nudged = await executeAgentNudge(ctx);
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: nudged,
      });
      return true;
    }

    case 'subagents': {
      const subagents = await getSubagentStatus(ctx.pool, ctx.event.chat_id);
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: formatSubagentStatus(subagents),
      });
      return true;
    }

    case 'prose': {
      const sub = (args[0] || 'help').toLowerCase();
      if (!['help', 'list', 'prep', 'show', 'run', 'compile', 'issuefix', 'resume', 'rollback'].includes(sub)) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Usage: ${parsed.prefix}prose list | ${parsed.prefix}prose prep <workflow_id|name> [goal] | ${parsed.prefix}prose show | ${parsed.prefix}prose compile <file.prose|url|handle/slug> | ${parsed.prefix}prose run [workflow_id|name|file.prose|url|handle/slug] [goal] | ${parsed.prefix}prose issuefix <issue summary> | ${parsed.prefix}prose resume <run_id> | ${parsed.prefix}prose rollback <run_id> [reason]`,
        });
        return true;
      }

      if (sub === 'help') {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: [
            'OpenProse-style workflow coordination:',
            `${parsed.prefix}prose list`,
            `${parsed.prefix}prose prep <workflow_id|name> [goal]`,
            `${parsed.prefix}prose show`,
            `${parsed.prefix}prose compile <file.prose|url|handle/slug>`,
            `${parsed.prefix}prose run [workflow_id|name] [goal]`,
            `${parsed.prefix}prose issuefix <issue summary>`,
            `${parsed.prefix}prose resume <run_id>`,
            `${parsed.prefix}prose rollback <run_id> [reason]`,
          ].join('\n'),
        });
        return true;
      }

      if (sub === 'list') {
        const workflows = await listChatWorkflows(ctx.pool, ctx.event.chat_id, 15);
        if (workflows.length === 0) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: 'No workflows found for this chat.',
          });
          return true;
        }
        const lines = workflows.map((wf, idx) => (
          `${idx + 1}. ${wf.name} (${wf.id}) enabled=${wf.enabled ? 'yes' : 'no'} v${wf.version}`
        ));
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: ['Workflows:', ...lines].join('\n'),
        });
        return true;
      }

      if (sub === 'prep') {
        const workflowRef = String(args[1] || '').trim();
        const goal = args.slice(2).join(' ').trim();
        if (!workflowRef) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: `Usage: ${parsed.prefix}prose prep <workflow_id|name> [goal]`,
          });
          return true;
        }

        const workflow = await resolveChatWorkflow(ctx.pool, ctx.event.chat_id, workflowRef);
        if (!workflow) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: `Workflow "${workflowRef}" not found in this chat.`,
          });
          return true;
        }

        const preparedBy = String(ctx.event.sender_identity_id || ctx.userId);
        const prepared = {
          workflow_id: workflow.id,
          workflow_name: workflow.name,
          goal: goal || '',
          prepared_by: preparedBy,
          prepared_at: new Date().toISOString(),
        };
        await setChatProsePlan(ctx.pool, ctx.event.chat_id, prepared);
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: [
            `Prose plan prepared for workflow "${workflow.name}" (${workflow.id}).`,
            `Goal: ${goal || 'none'}`,
            `Next: ${parsed.prefix}prose run`,
          ].join('\n'),
        });
        return true;
      }

      if (sub === 'show') {
        const plan = await getChatProsePlan(ctx.pool, ctx.event.chat_id);
        if (!plan) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: `No prose plan prepared. Use ${parsed.prefix}prose prep <workflow_id|name> [goal].`,
          });
          return true;
        }
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: [
            'Current prose plan:',
            `workflow_id: ${String(plan.workflow_id || 'n/a')}`,
            `workflow_name: ${String(plan.workflow_name || 'n/a')}`,
            `goal: ${String(plan.goal || '') || 'none'}`,
            `prepared_by: ${String(plan.prepared_by || 'n/a')}`,
            `prepared_at: ${String(plan.prepared_at || 'n/a')}`,
          ].join('\n'),
        });
        return true;
      }

      if (sub === 'compile') {
        const programRef = String(args[1] || '').trim();
        if (!programRef) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: `Usage: ${parsed.prefix}prose compile <file.prose|url|handle/slug>`,
          });
          return true;
        }
        const loaded = await loadProseProgram(programRef);
        if (!loaded.ok) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: `OpenProse compile failed: ${loaded.message}`,
          });
          return true;
        }
        const compiled = compileProseProgram(loaded.source);
        if (!compiled.ok) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: `OpenProse compile failed: ${compiled.message}`,
          });
          return true;
        }
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: [
            `OpenProse compiled: ${compiled.program.title}`,
            `source: ${loaded.sourceLabel}`,
            `steps: ${compiled.program.steps.length}`,
            `edges: ${compiled.program.edges.length}`,
          ].join('\n'),
        });
        return true;
      }

      if (sub === 'issuefix') {
        const issueSummary = args.slice(1).join(' ').trim();
        if (!issueSummary) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: `Usage: ${parsed.prefix}prose issuefix <issue summary>`,
          });
          return true;
        }
        if (!ctx.publishWorkflowExecute) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: 'Workflow execution is unavailable: dispatch publisher is not configured.',
          });
          return true;
        }

        const actorId = String(ctx.event.sender_identity_id || ctx.userId);
        const compiledIssueFix = compileIssueFixProgram(issueSummary);
        const workflow = await createCompiledProseWorkflow(
          ctx.pool,
          ctx.event.chat_id,
          actorId,
          compiledIssueFix,
          'chat.prose.issuefix',
        );
        const run = await createProseWorkflowRun(
          ctx.pool,
          ctx.event.chat_id,
          workflow,
          actorId,
          issueSummary,
          String(ctx.event.channel_message_id || ''),
          ctx.publishWorkflowExecute,
          {
            lane: 'OH-W02',
            task: issueSummary,
            traceSteps: ['issue_received', 'workflow_compiled', 'run_dispatched'],
            planActions: [
              { kind: 'issue', action: 'triage_issue' },
              { kind: 'patch', action: 'prepare_patch' },
              { kind: 'tests', action: 'execute_tests' },
              { kind: 'summary', action: 'emit_patch_summary' },
            ],
          },
        );
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: [
            `Issue-fix run queued: ${run.runId}`,
            `workflow: ${workflow.name} (${workflow.id})`,
            `plan_id: ${run.planId}`,
            `issue: ${issueSummary}`,
            `trace: ${run.traceSteps.join(' -> ')}`,
            'Flow: issue -> patch -> tests -> summary.',
          ].join('\n'),
        });
        return true;
      }

      if (sub === 'resume') {
        const runId = String(args[1] || '').trim();
        if (!runId) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: `Usage: ${parsed.prefix}prose resume <run_id>`,
          });
          return true;
        }
        if (!ctx.publishWorkflowExecute) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: 'Workflow execution is unavailable: dispatch publisher is not configured.',
          });
          return true;
        }

        const resumed = await resumeProseWorkflowRun(
          ctx.pool,
          ctx.event.chat_id,
          runId,
          String(ctx.event.sender_identity_id || ctx.userId),
          ctx.publishWorkflowExecute,
        );
        if (!resumed.ok) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: resumed.message,
          });
          return true;
        }
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: [
            `Workflow resume queued: ${resumed.runId}`,
            `resume_token: ${resumed.resumeToken}`,
            `previous_status: ${resumed.previousStatus}`,
            `trace: ${resumed.traceSteps.join(' -> ')}`,
            'Flow: interruption detected -> state restored -> dispatch resumed.',
          ].join('\n'),
        });
        return true;
      }

      if (sub === 'rollback') {
        const runId = String(args[1] || '').trim();
        const reason = args.slice(2).join(' ').trim();
        if (!runId) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: `Usage: ${parsed.prefix}prose rollback <run_id> [reason]`,
          });
          return true;
        }
        const rolledBack = await rollbackProseWorkflowRun(
          ctx.pool,
          ctx.event.chat_id,
          runId,
          String(ctx.event.sender_identity_id || ctx.userId),
          reason,
        );
        if (!rolledBack.ok) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: rolledBack.message,
          });
          return true;
        }
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: [
            `Workflow rollback complete: ${rolledBack.runId}`,
            `rollback_token: ${rolledBack.rollbackToken}`,
            `previous_status: ${rolledBack.previousStatus}`,
            `reason: ${rolledBack.reason || 'none'}`,
            `trace: ${rolledBack.traceSteps.join(' -> ')}`,
            'Flow: failure/risk detected -> rollback prepared -> rollback applied.',
          ].join('\n'),
        });
        return true;
      }

      const workflowRef = String(args[1] || '').trim();
      const runGoal = args.slice(2).join(' ').trim();
      const existingPlan = await getChatProsePlan(ctx.pool, ctx.event.chat_id);
      const fallbackWorkflowRef = workflowRef || String(existingPlan?.workflow_id || existingPlan?.workflow_name || '');
      if (!fallbackWorkflowRef) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Specify workflow: ${parsed.prefix}prose run <workflow_id|name> [goal], or prepare first with ${parsed.prefix}prose prep ...`,
        });
        return true;
      }
      let workflow = await resolveChatWorkflow(ctx.pool, ctx.event.chat_id, fallbackWorkflowRef);
      if (!workflow && looksLikeProseProgramRef(fallbackWorkflowRef)) {
        const loaded = await loadProseProgram(fallbackWorkflowRef);
        if (!loaded.ok) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: `OpenProse run failed: ${loaded.message}`,
          });
          return true;
        }
        const compiled = compileProseProgram(loaded.source);
        if (!compiled.ok) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: `OpenProse run failed: ${compiled.message}`,
          });
          return true;
        }
        workflow = await createCompiledProseWorkflow(
          ctx.pool,
          ctx.event.chat_id,
          String(ctx.event.sender_identity_id || ctx.userId),
          compiled.program,
          loaded.sourceLabel,
        );
      }
      if (!workflow) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Workflow "${fallbackWorkflowRef}" not found in this chat.`,
        });
        return true;
      }
      if (!workflow.enabled) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Workflow "${workflow.name}" is disabled.`,
        });
        return true;
      }

      const goal = runGoal || String(existingPlan?.goal || '');
      if (!ctx.publishWorkflowExecute) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: 'Workflow execution is unavailable: dispatch publisher is not configured.',
        });
        return true;
      }
      const run = await createProseWorkflowRun(
        ctx.pool,
        ctx.event.chat_id,
        workflow,
        String(ctx.event.sender_identity_id || ctx.userId),
        goal,
        String(ctx.event.channel_message_id || ''),
        ctx.publishWorkflowExecute,
      );
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: [
          `Prose run queued: ${run.runId}`,
          `workflow: ${workflow.name} (${workflow.id})`,
          `plan_id: ${run.planId}`,
          `goal: ${goal || 'none'}`,
          `trace: ${run.traceSteps.join(' -> ')}`,
          'Status is visible in workflow runs.',
        ].join('\n'),
      });
      return true;
    }

    case 'relay':
    case 'camrelay': {
      const relay = parseRelayCommandArgs(args);
      if (!relay.ok) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: relay.message || `Usage: ${parsed.prefix}relay <source> -> <target> [widthxheight] [timeout=ms]`,
        });
        return true;
      }

      const orgId = await getChatOrganizationId(ctx.pool, ctx.event.chat_id);
      if (!orgId) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: 'Relay unavailable: this chat is not bound to an organization.',
        });
        return true;
      }

      const sourceDevice = await resolveRelayDevice(ctx.pool, orgId, relay.sourceRef);
      if (!sourceDevice) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Source device not found in organization: ${relay.sourceRef}`,
        });
        return true;
      }

      const targetDevice = await resolveRelayDevice(ctx.pool, orgId, relay.targetRef);
      if (!targetDevice) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Target device not found in organization: ${relay.targetRef}`,
        });
        return true;
      }

      const snapshotInsert = await ctx.pool.query(
        `INSERT INTO device_commands (device_id, command, payload)
         VALUES ($1, 'camera_snapshot', $2)
         RETURNING id, status, created_at`,
        [sourceDevice.id, JSON.stringify({ width: relay.width, height: relay.height })],
      );
      const snapshotCommandId = String(snapshotInsert.rows[0]?.id || '');
      if (!snapshotCommandId) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: 'Failed to queue snapshot command.',
        });
        return true;
      }

      const snapshotResult = await waitForRelaySnapshotResult(
        ctx.pool,
        snapshotCommandId,
        sourceDevice.id,
        relay.timeoutMs,
      );
      if (!snapshotResult.ok) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Relay failed: ${snapshotResult.message}`,
        });
        return true;
      }

      const imageBase64 = snapshotResult.imageBase64;
      if (imageBase64.length > MAX_RELAY_IMAGE_BASE64_LENGTH) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Relay failed: snapshot image too large (max base64 length ${MAX_RELAY_IMAGE_BASE64_LENGTH}).`,
        });
        return true;
      }

      const html = renderRelaySnapshotHtml(imageBase64);
      const displayInsert = await ctx.pool.query(
        `INSERT INTO device_commands (device_id, command, payload)
         VALUES ($1, 'display', $2)
         RETURNING id, status, created_at`,
        [targetDevice.id, JSON.stringify({ type: 'html', content: html })],
      );

      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: [
          `Relay complete: ${sourceDevice.name} -> ${targetDevice.name}`,
          `snapshot_command_id: ${snapshotCommandId}`,
          `display_command_id: ${String(displayInsert.rows[0]?.id || 'n/a')}`,
          `resolution: ${relay.width}x${relay.height}`,
          `timeout_ms: ${relay.timeoutMs}`,
        ].join('\n'),
      });
      return true;
    }

    case 'handoff': {
      const handoff = parseHandoffCommandArgs(args);
      if (!handoff.ok) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: handoff.message || `Usage: ${parsed.prefix}handoff <target> [note...]`,
        });
        return true;
      }

      const orgId = await getChatOrganizationId(ctx.pool, ctx.event.chat_id);
      if (!orgId) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: 'Handoff unavailable: this chat is not bound to an organization.',
        });
        return true;
      }

      const targetDevice = await resolveRelayDevice(ctx.pool, orgId, handoff.targetRef);
      if (!targetDevice) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Target device not found in organization: ${handoff.targetRef}`,
        });
        return true;
      }

      const continuity = await buildChatHandoffContinuity(ctx.pool, ctx.event.chat_id, handoff.note);
      const displayInsert = await ctx.pool.query(
        `INSERT INTO device_commands (device_id, command, payload)
         VALUES ($1, 'display', $2)
         RETURNING id, status, created_at`,
        [
          targetDevice.id,
          JSON.stringify({
            type: 'scene',
            scene: 'ops_dashboard',
            title: 'Sven Handoff',
            set_as_active: true,
            slots: continuity,
          }),
        ],
      );

      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: [
          `Handoff pushed to ${targetDevice.name}.`,
          `display_command_id: ${String(displayInsert.rows[0]?.id || 'n/a')}`,
          `chat_id: ${ctx.event.chat_id}`,
          handoff.note ? `note: ${handoff.note}` : 'note: none',
        ].join('\n'),
      });
      return true;
    }

    case 'mirrorpersona': {
      const persona = parseMirrorPersonaCommandArgs(args);
      if (!persona.ok) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: persona.message || `Usage: ${parsed.prefix}mirrorpersona <target> [mood=idle|thinking|listening|speaking|happy] [state=...] [cue=...]`,
        });
        return true;
      }

      const orgId = await getChatOrganizationId(ctx.pool, ctx.event.chat_id);
      if (!orgId) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: 'Mirror persona sync unavailable: this chat is not bound to an organization.',
        });
        return true;
      }

      const targetDevice = await resolveRelayDevice(ctx.pool, orgId, persona.targetRef);
      if (!targetDevice) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Target device not found in organization: ${persona.targetRef}`,
        });
        return true;
      }

      const payload = {
        type: 'scene',
        scene: 'ops_dashboard',
        title: 'Sven Persona Sync',
        set_as_active: true,
        scene_profile: {
          layout: 'grid-2x2',
          modules: [
            { slot: 'clock', type: 'clock', title: 'Time' },
            { slot: 'persona', type: 'cards', title: 'Persona' },
            { slot: 'summary', type: 'cards', title: 'Session' },
            { slot: 'alerts', type: 'cards', title: 'Live Cues' },
          ],
        },
        slots: {
          clock: { timezone: 'Local' },
          persona: {
            items: [
              `Mood: ${persona.mood}`,
              `State: ${persona.state}`,
              `Cue: ${persona.cue}`,
            ],
            text: `${persona.state} (${persona.mood})`,
          },
          summary: {
            items: [
              `Chat: ${ctx.event.chat_id}`,
              `Channel: ${ctx.event.channel}`,
              `Synced: ${new Date().toISOString()}`,
            ],
          },
          alerts: {
            items: [persona.cue],
          },
        },
        metadata: {
          sync_type: 'persona',
          mood: persona.mood,
          source_chat_id: ctx.event.chat_id,
          source_channel: ctx.event.channel,
          source_sender_identity_id: ctx.event.sender_identity_id || null,
        },
      };

      const displayInsert = await ctx.pool.query(
        `INSERT INTO device_commands (device_id, command, payload)
         VALUES ($1, 'display', $2)
         RETURNING id, status, created_at`,
        [targetDevice.id, JSON.stringify(payload)],
      );

      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: [
          `Mirror persona synced to ${targetDevice.name}.`,
          `display_command_id: ${String(displayInsert.rows[0]?.id || 'n/a')}`,
          `mood: ${persona.mood}`,
          `state: ${persona.state}`,
          `cue: ${persona.cue}`,
        ].join('\n'),
      });
      return true;
    }

    case 'selfchat': {
      const mode = (args[0] || 'status').toLowerCase();
      if (!['on', 'off', 'status'].includes(mode)) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Usage: ${parsed.prefix}selfchat on|off|status`,
        });
        return true;
      }
      if (mode === 'status') {
        const enabled = await getChatSelfChatEnabled(ctx.pool, ctx.event.chat_id);
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Self-chat mode is ${enabled ? 'on' : 'off'} for this chat.`,
        });
        return true;
      }

      const admin = await isAdminUser(ctx.pool, ctx.userId);
      if (!admin) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: 'Only admins can toggle self-chat mode.',
        });
        return true;
      }

      const enabled = mode === 'on';
      const ok = await setChatSelfChatEnabled(ctx.pool, ctx.event.chat_id, enabled);
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: ok
          ? `Self-chat mode turned ${enabled ? 'on' : 'off'} for this chat.`
          : 'Failed to update self-chat mode.',
      });
      return true;
    }

    case 'tell': {
      const targetAgentId = String(args[0] || '').trim();
      const message = args.slice(1).join(' ').trim();
      if (!targetAgentId || !message) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Usage: ${parsed.prefix}tell <agent_id> <message>`,
        });
        return true;
      }
      const admin = await isAdminUser(ctx.pool, ctx.userId);
      if (!admin) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: 'Only admins can message subagents.',
        });
        return true;
      }
      const result = await queueInterAgentMessage(ctx.pool, ctx.event.chat_id, ctx.userId, targetAgentId, message);
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: result.message,
      });
      return true;
    }

    case 'steer': {
      const target = String(args[0] || '').trim();
      const instruction = args.slice(1).join(' ').trim();
      if (!target || !instruction) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Usage: ${parsed.prefix}steer <agent_id|all> <instruction>`,
        });
        return true;
      }
      const admin = await isAdminUser(ctx.pool, ctx.userId);
      if (!admin) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: 'Only admins can steer subagents.',
        });
        return true;
      }
      const result = await setSubagentSteerInstruction(ctx.pool, ctx.event.chat_id, target, instruction, ctx.userId);
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: result.message,
      });
      return true;
    }

    case 'kill': {
      const targetAgentId = String(args[0] || '').trim();
      if (!targetAgentId) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Usage: ${parsed.prefix}kill <agent_id>`,
        });
        return true;
      }
      const admin = await isAdminUser(ctx.pool, ctx.userId);
      if (!admin) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: 'Only admins can kill subagents.',
        });
        return true;
      }
      const result = await killSubagentForChat(ctx.pool, ctx.event.chat_id, targetAgentId);
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: result.message,
      });
      return true;
    }

    case 'elevated': {
      const mode = (args[0] || 'status').toLowerCase();
      if (!['on', 'off', 'status'].includes(mode)) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Usage: ${parsed.prefix}elevated on|off|status`,
        });
        return true;
      }
      if (mode === 'status') {
        const enabled = await getChatElevatedFlag(ctx.pool, ctx.event.chat_id);
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `Elevated mode is ${enabled ? 'on' : 'off'} for this chat.`,
        });
        return true;
      }

      const admin = await isAdminUser(ctx.pool, ctx.userId);
      if (!admin) {
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: 'Only admins can toggle elevated mode.',
        });
        return true;
      }

      const enabled = mode === 'on';
      const ok = await setChatElevatedFlag(ctx.pool, ctx.event.chat_id, enabled);
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: ok
          ? `Elevated mode turned ${enabled ? 'on' : 'off'} for this chat.`
          : 'Failed to update elevated mode.',
      });
      return true;
    }

    case 'config': {
      const sub = (args[0] || 'show').toLowerCase();
      if (sub === 'show') {
        const settings = await getSessionSettingsSafe(ctx.pool, ctx.event.chat_id);
        const elevated = await getChatElevatedFlag(ctx.pool, ctx.event.chat_id);
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: [
            'Config (session scope):',
            `think_level: ${settings.think_level || 'default'}`,
            `verbose: ${Boolean(settings.verbose)}`,
            `usage_mode: ${settings.usage_mode || 'off'}`,
            `model_name: ${settings.model_name || 'auto'}`,
            `profile_name: ${settings.profile_name || 'default'}`,
            `rag_enabled: ${settings.rag_enabled !== false}`,
            `elevated: ${elevated}`,
            `Usage: ${parsed.prefix}config get <key> | ${parsed.prefix}config set <key> <value>`,
          ].join('\n'),
        });
        return true;
      }

      if (sub === 'get') {
        const key = String(args[1] || '').toLowerCase();
        const value = await getConfigValueForCommand(ctx.pool, ctx.event.chat_id, key);
        if (value === undefined) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: `Unknown key "${key}".`,
          });
          return true;
        }
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: `${key}: ${String(value)}`,
        });
        return true;
      }

      if (sub === 'set') {
        const key = String(args[1] || '').toLowerCase();
        const rawValue = args.slice(2).join(' ').trim();
        if (!key || !rawValue) {
          await ctx.canvasEmitter.emit({
            chat_id: ctx.event.chat_id,
            channel: ctx.event.channel,
            text: `Usage: ${parsed.prefix}config set <key> <value>`,
          });
          return true;
        }
        const result = await setConfigValueFromCommand(ctx.pool, ctx.event.chat_id, ctx.userId, key, rawValue);
        await ctx.canvasEmitter.emit({
          chat_id: ctx.event.chat_id,
          channel: ctx.event.channel,
          text: result.message,
        });
        return true;
      }

      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: `Usage: ${parsed.prefix}config get <key> | ${parsed.prefix}config set <key> <value>`,
      });
      return true;
    }

    default: {
      logger.info('Unknown command', { command, chat_id: ctx.event.chat_id });
      await ctx.canvasEmitter.emit({
        chat_id: ctx.event.chat_id,
        channel: ctx.event.channel,
        text: `Unknown command "${parsed.prefix}${command}". Use ${parsed.prefix}help.`,
      });
      return true;
    }
  }
}

async function setAgentPausedSetting(
  pool: pg.Pool,
  chatId: string,
  paused: boolean,
  userId: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO session_settings (session_id, agent_paused, updated_at, updated_by)
     VALUES ($1, $2, NOW(), $3)
     ON CONFLICT (session_id) DO UPDATE
     SET agent_paused = EXCLUDED.agent_paused,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
    [chatId, paused, userId],
  );
}

async function getAgentChatState(
  pool: pg.Pool,
  chatId: string,
): Promise<{ paused: boolean; nudgeNonce: number; lastNudgedAt: string | null }> {
  const res = await pool.query(
    `SELECT agent_paused, nudge_nonce, last_nudged_at
     FROM session_settings
     WHERE session_id = $1
     LIMIT 1`,
    [chatId],
  );
  const row = res.rows[0] || {};
  return {
    paused: Boolean(row.agent_paused),
    nudgeNonce: Number(row.nudge_nonce || 0),
    lastNudgedAt: row.last_nudged_at ? new Date(row.last_nudged_at).toISOString() : null,
  };
}

async function bumpNudgeNonce(
  pool: pg.Pool,
  chatId: string,
  userId: string,
): Promise<{ nudgeNonce: number; lastNudgedAt: string | null }> {
  const res = await pool.query(
    `INSERT INTO session_settings (session_id, nudge_nonce, last_nudged_at, updated_at, updated_by)
     VALUES ($1, 1, NOW(), NOW(), $2)
     ON CONFLICT (session_id) DO UPDATE
     SET nudge_nonce = COALESCE(session_settings.nudge_nonce, 0) + 1,
         last_nudged_at = NOW(),
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by
     RETURNING nudge_nonce, last_nudged_at`,
    [chatId, userId],
  );
  return {
    nudgeNonce: Number(res.rows[0]?.nudge_nonce || 1),
    lastNudgedAt: res.rows[0]?.last_nudged_at ? new Date(res.rows[0].last_nudged_at).toISOString() : null,
  };
}

async function findLatestNudgeCandidateText(pool: pg.Pool, chatId: string): Promise<string | null> {
  const res = await pool.query(
    `SELECT text
     FROM messages
     WHERE chat_id = $1
       AND role = 'user'
       AND COALESCE(text, '') <> ''
       AND COALESCE(text, '') !~ '^[[:space:]]*/'
       AND LOWER(COALESCE(text, '')) NOT LIKE 'sven:%'
     ORDER BY created_at DESC
     LIMIT 1`,
    [chatId],
  );
  const text = String(res.rows[0]?.text || '').trim();
  return text || null;
}

async function executeAgentNudge(ctx: CommandContext): Promise<string> {
  const state = await bumpNudgeNonce(ctx.pool, ctx.event.chat_id, ctx.userId);
  const candidate = await findLatestNudgeCandidateText(ctx.pool, ctx.event.chat_id);
  if (candidate && ctx.publishInbound) {
    await ctx.publishInbound({
      channel: ctx.event.channel,
      channel_message_id: `nudge-${Date.now()}`,
      chat_id: ctx.event.chat_id,
      sender_identity_id: ctx.event.sender_identity_id,
      content_type: 'text',
      text: candidate,
      metadata: {
        ...(ctx.event.metadata || {}),
        nudge: true,
        nudge_nonce: state.nudgeNonce,
        nudge_original_text_hash: candidate.slice(0, 128),
        nudged_by_user_id: ctx.userId,
      },
    } as InboundMessageEvent);
    return `Agent nudged (nonce=${state.nudgeNonce}); replaying latest task message now.`;
  }
  return `Agent nudged (nonce=${state.nudgeNonce}); no replayable user message found.`;
}

export async function isCommandMessage(pool: pg.Pool, text: string): Promise<boolean> {
  const parsed = await parseCommand(pool, text);
  return parsed.isCommand;
}

export function consumeNextThinkLevel(chatId: string): string | null {
  const level = NEXT_THINK_LEVEL.get(chatId);
  if (!level) return null;
  NEXT_THINK_LEVEL.delete(chatId);
  return level;
}

type ResearchDepth = 'quick' | 'deep' | 'exhaustive';

type ResearchResult = {
  query: string;
  title: string;
  url: string;
  snippet: string;
  excerpt: string;
};

function parseResearchArgs(args: string[]): { topic: string; depth: ResearchDepth } {
  const allowedDepths = new Set<ResearchDepth>(['quick', 'deep', 'exhaustive']);
  let depth: ResearchDepth = 'quick';
  const topicParts: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const part = String(args[i] || '').trim();
    if (!part) continue;
    const lower = part.toLowerCase();
    if (allowedDepths.has(lower as ResearchDepth)) {
      depth = lower as ResearchDepth;
      continue;
    }
    if (lower === '--depth' && i + 1 < args.length) {
      const next = String(args[i + 1] || '').toLowerCase();
      if (allowedDepths.has(next as ResearchDepth)) {
        depth = next as ResearchDepth;
        i += 1;
        continue;
      }
    }
    topicParts.push(part);
  }

  return {
    topic: topicParts.join(' ').trim(),
    depth,
  };
}

function depthToSteps(depth: ResearchDepth): number {
  if (depth === 'quick') return 2;
  if (depth === 'deep') return 5;
  return 10;
}

async function getResearchSettings(pool: pg.Pool): Promise<{ enabled: boolean; maxSteps: number }> {
  const [enabled, maxSteps] = await Promise.all([
    getBooleanSetting(pool, 'agent.research.enabled', true),
    getNumberGlobalSetting(pool, 'agent.research.maxSteps', 10),
  ]);
  return {
    enabled,
    maxSteps: Number.isFinite(maxSteps) ? Math.max(1, Math.min(50, Math.trunc(maxSteps))) : 10,
  };
}

async function getNumberGlobalSetting(pool: pg.Pool, key: string, fallback: number): Promise<number> {
  const res = await pool.query(`SELECT value FROM settings_global WHERE key = $1 LIMIT 1`, [key]);
  if (!res.rows.length) return fallback;
  const value = parseSettingValue(res.rows[0].value);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

async function runResearchPipeline(
  pool: pg.Pool,
  chatId: string,
  topic: string,
  depth: ResearchDepth,
  totalSteps: number,
  emitProgress: (status: string) => Promise<void>,
): Promise<string> {
  const searchConfig = await getResearchSearchConfig(pool);
  const allowlist = await getWebAllowlist(pool, chatId);
  const queries: string[] = [topic];
  const collected: ResearchResult[] = [];
  const seenUrls = new Set<string>();

  for (let step = 1; step <= totalSteps; step += 1) {
    const query = queries[step - 1] || buildFollowUpQuery(topic, collected, step);
    await emitProgress(`Step ${step}/${totalSteps}: searching for "${query}"...`);

    const searchResults = await querySearxng(searchConfig, query, Math.min(6, step >= 6 ? 8 : 6));
    if (!searchResults.length) {
      await emitProgress(`Step ${step}/${totalSteps}: no search results, moving to follow-up query.`);
      queries.push(buildFollowUpQuery(topic, collected, step + 1));
      continue;
    }

    await emitProgress(`Step ${step}/${totalSteps}: reading top sources...`);
    const ranked = searchResults.filter((r) => r.url && !seenUrls.has(r.url)).slice(0, 3);

    for (const item of ranked) {
      seenUrls.add(item.url);
      const excerpt = await readResearchSource(item.url, item.snippet, allowlist);
      collected.push({
        query,
        title: item.title || item.url,
        url: item.url,
        snippet: item.snippet || '',
        excerpt,
      });
    }

    await emitProgress(`Step ${step}/${totalSteps}: synthesizing intermediate findings...`);
    queries.push(buildFollowUpQuery(topic, collected, step + 1));
  }

  return renderResearchReport(topic, depth, collected, totalSteps);
}

async function getResearchSearchConfig(pool: pg.Pool): Promise<{
  searxngUrl: string;
  safeSearch: '0' | '1' | '2';
  engines: string[];
  language: string;
}> {
  const result = await pool.query(
    `SELECT key, value
     FROM settings_global
     WHERE key = ANY($1::text[])`,
    [['search.searxng_url', 'search.safeSearch', 'search.engines', 'search.default_language']],
  );
  const settings = new Map<string, unknown>();
  for (const row of result.rows) settings.set(String(row.key), row.value);

  const rawSafeSearch = String(parseSettingValue(settings.get('search.safeSearch')) || 'moderate').toLowerCase();
  const safeSearch: '0' | '1' | '2' =
    rawSafeSearch === 'off' ? '0' : rawSafeSearch === 'strict' ? '2' : '1';
  const engines = Array.isArray(parseSettingValue(settings.get('search.engines')))
    ? (parseSettingValue(settings.get('search.engines')) as string[]).map((v) => String(v || '').trim()).filter(Boolean)
    : [];
  const configuredSearxngUrl = String(parseSettingValue(settings.get('search.searxng_url')) || '').trim();
  const legacyDefault =
    configuredSearxngUrl === 'http://searxng:8080' || configuredSearxngUrl === 'http://searxng:8080/';
  const effectiveSearxngUrl =
    configuredSearxngUrl && (!legacyDefault || !process.env.SEARXNG_URL)
      ? configuredSearxngUrl
      : String(process.env.SEARXNG_URL || configuredSearxngUrl || 'http://searxng:8080').trim();

  return {
    searxngUrl: effectiveSearxngUrl,
    safeSearch,
    engines,
    language: String(parseSettingValue(settings.get('search.default_language')) || 'auto').trim() || 'auto',
  };
}

async function querySearxng(
  cfg: { searxngUrl: string; safeSearch: '0' | '1' | '2'; engines: string[]; language: string },
  rawQuery: string,
  maxResults: number,
): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const query = normalizeResearchQuery(rawQuery);
  if (!query) return [];

  const searchUrl = new URL('/search', cfg.searxngUrl);
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('format', 'json');
  searchUrl.searchParams.set('categories', 'general');
  searchUrl.searchParams.set('language', cfg.language);
  searchUrl.searchParams.set('safesearch', cfg.safeSearch);
  if (cfg.engines.length > 0) searchUrl.searchParams.set('engines', cfg.engines.join(','));

  const response = await fetch(searchUrl.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Search upstream returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  return (payload.results || [])
    .map((row) => ({
      title: String(row.title || ''),
      url: String(row.url || ''),
      snippet: String(row.content || ''),
    }))
    .filter((row) => row.url.startsWith('http://') || row.url.startsWith('https://'))
    .slice(0, Math.max(1, maxResults));
}

function normalizeResearchQuery(raw: string): string {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

async function getWebAllowlist(pool: pg.Pool, chatId: string): Promise<string[]> {
  try {
    const orgRes = await pool.query(`SELECT organization_id FROM chats WHERE id = $1 LIMIT 1`, [chatId]);
    const orgId = String(orgRes.rows[0]?.organization_id || '').trim() || null;
    const res = await pool.query(
      `SELECT pattern
       FROM allowlists
       WHERE (organization_id = $1 OR organization_id IS NULL)
         AND type = 'web_domain'
         AND enabled = TRUE`,
      [orgId],
    );
    return res.rows.map((r) => String(r.pattern || '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

async function readResearchSource(url: string, fallbackSnippet: string, allowlist: string[]): Promise<string> {
  try {
    const fetched = await fetchWebContent(url, {
      allowlist: allowlist.length > 0 ? allowlist : undefined,
      timeout: 12000,
      maxContentLength: 1_500_000,
      cacheTtlSeconds: 0,
    });
    const raw = String(fetched.textContent || '').replace(/\s+/g, ' ').trim();
    if (raw) return raw.slice(0, 700);
  } catch {
    // Fall back to search snippet when full-page read fails.
  }
  return String(fallbackSnippet || '').replace(/\s+/g, ' ').trim().slice(0, 700);
}

function buildFollowUpQuery(topic: string, findings: ResearchResult[], step: number): string {
  if (findings.length === 0) return `${topic} latest updates`;
  const latest = findings[findings.length - 1];
  const seed = (latest.title || latest.snippet || topic)
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 3)
    .slice(0, 3)
    .join(' ');
  const suffix = step > 6 ? 'risks and limitations' : step > 3 ? 'comparison and alternatives' : 'recent developments';
  return `${topic} ${seed || ''} ${suffix}`.replace(/\s+/g, ' ').trim();
}

function renderResearchReport(
  topic: string,
  depth: ResearchDepth,
  findings: ResearchResult[],
  totalSteps: number,
): string {
  const dedup = dedupeFindings(findings).slice(0, 12);
  const summaryBullets = dedup.slice(0, 4).map((f) => summarizeFinding(f));
  const detailLines = dedup.slice(0, 8).map((f, i) => {
    return `${i + 1}. ${f.title}\n   ${summarizeFinding(f)}\n   Source: ${f.url}`;
  });
  const sourceLines = dedup.map((f, i) => `${i + 1}. ${f.url}`);

  return [
    `Research report: ${topic}`,
    `Depth: ${depth} | Steps executed: ${totalSteps}`,
    '',
    'Executive summary',
    ...(summaryBullets.length > 0 ? summaryBullets.map((line) => `- ${line}`) : ['- No conclusive sources were retrieved.']),
    '',
    'Detailed findings',
    ...(detailLines.length > 0 ? detailLines : ['1. No detailed findings available from this run.']),
    '',
    'Sources',
    ...(sourceLines.length > 0 ? sourceLines : ['1. (none)']),
  ].join('\n');
}

function dedupeFindings(findings: ResearchResult[]): ResearchResult[] {
  const seen = new Set<string>();
  const out: ResearchResult[] = [];
  for (const item of findings) {
    const key = `${item.url}|${item.title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function summarizeFinding(finding: ResearchResult): string {
  const text = (finding.excerpt || finding.snippet || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return `Related to query "${finding.query}".`;
  return text.slice(0, 220);
}

async function saveResearchMemory(
  pool: pg.Pool,
  args: { userId: string; chatId: string; topic: string; depth: ResearchDepth; report: string },
): Promise<void> {
  const keyTopic = args.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48) || 'topic';
  const memoryId = uuidv7();
  const memoryKey = `research:${keyTopic}:${new Date().toISOString().slice(0, 10)}`;
  try {
    await pool.query(
      `INSERT INTO memories (id, user_id, chat_id, visibility, key, value, source, importance, created_at, updated_at)
       VALUES ($1, $2, $3, 'chat_shared', $4, $5, 'research', 0.7, NOW(), NOW())`,
      [memoryId, args.userId, args.chatId, memoryKey, args.report],
    );
  } catch {
    await pool.query(
      `INSERT INTO memories (id, user_id, chat_id, visibility, key, value, created_at, updated_at)
       VALUES ($1, $2, $3, 'chat_shared', $4, $5, NOW(), NOW())`,
      [memoryId, args.userId, args.chatId, memoryKey, args.report],
    );
  }
}

async function parseCommand(pool: pg.Pool, rawText: string): Promise<CommandParseResult> {
  const text = rawText.trim();
  if (!text) return { isCommand: false };

  const prefix = await getCommandPrefix(pool);
  if (!text.startsWith(prefix)) {
    const directive = parseDirective(text);
    if (directive) return directive;
    const relayDirective = parseNaturalRelayDirective(text);
    if (relayDirective) return relayDirective;
    return { isCommand: false };
  }

  const withoutPrefix = text.slice(prefix.length).trim();
  if (!withoutPrefix) return { isCommand: true, command: 'help', args: [], prefix };

  // Preserve existing group trigger behavior for `/sven ...`
  if (withoutPrefix.toLowerCase().startsWith('sven')) {
    return { isCommand: false };
  }

  // Approval commands are handled by the dedicated approval command path.
  if (/^(approve|deny)\b/i.test(withoutPrefix)) {
    return { isCommand: false };
  }

  const [command, ...args] = withoutPrefix.split(/\s+/);
  return { isCommand: true, command, args, prefix };
}

async function getBooleanSetting(pool: pg.Pool, key: string, fallback: boolean): Promise<boolean> {
  const res = await pool.query(
    `SELECT value FROM settings_global WHERE key = $1 LIMIT 1`,
    [key],
  );
  if (res.rows.length === 0) return fallback;
  const value = parseSettingValue(res.rows[0].value);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

function parseDirective(text: string): CommandParseResult | null {
  const match = text.match(/^\s*sven(?::|\s+)(.+)$/i);
  if (!match) return null;

  const body = String(match[1] || '').trim();
  if (!body) return null;

  if (/^(approve|deny)\b/i.test(body)) return null;

  const [command, ...args] = body.split(/\s+/);
  return { isCommand: true, command, args, prefix: 'sven: ', viaDirective: true };
}

function parseNaturalRelayDirective(text: string): CommandParseResult | null {
  const raw = String(text || '').trim();
  if (!raw) return null;
  if (!/\b(cam|camera|snapshot|feed)\b/i.test(raw)) return null;

  const politeStripped = raw
    .replace(/^\s*(please\s+)?(can|could|would)\s+you\s+/i, '')
    .replace(/^\s*sven[,:]?\s+/i, '')
    .trim();

  const match = politeStripped.match(/^(?:show|display|relay)\s+(.+?)\s+(?:on|to)\s+(.+)$/i);
  const fromToMatch = politeStripped.match(/^(?:show|display|relay)\s+(?:the\s+)?(?:camera|cam|snapshot|feed)?\s*from\s+(.+?)\s+to\s+(.+)$/i);
  const resolved = fromToMatch || match;
  if (!resolved) return null;

  let sourceRef = String(resolved[1] || '')
    .replace(/\b(the|camera|cam|snapshot|feed|from)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!sourceRef) return null;

  const remainder = String(resolved[2] || '').trim();
  if (!remainder) return null;
  const rawParts = remainder.split(/\s+/).filter(Boolean);
  const optionParts: string[] = [];
  const targetParts: string[] = [];
  for (const part of rawParts) {
    if (/^\d{2,4}x\d{2,4}$/i.test(part) || /^timeout=\d{3,7}$/i.test(part)) {
      optionParts.push(part);
      continue;
    }
    targetParts.push(part);
  }

  let targetRef = targetParts.join(' ').replace(/\b(screen|display|monitor|tv)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  if (!targetRef) return null;

  sourceRef = sourceRef.replace(/^"(.*)"$/, '$1').trim();
  targetRef = targetRef.replace(/^"(.*)"$/, '$1').trim();
  if (!sourceRef || !targetRef) return null;

  return {
    isCommand: true,
    command: 'relay',
    args: [sourceRef, '->', targetRef, ...optionParts],
    prefix: '/',
    viaDirective: true,
  };
}

async function getCommandPrefix(pool: pg.Pool): Promise<string> {
  const res = await pool.query(
    `SELECT value FROM settings_global WHERE key = 'chat.commands.prefix' LIMIT 1`,
  );
  if (res.rows.length === 0) return '/';

  const value = parseSettingValue(res.rows[0].value);
  if (typeof value !== 'string' || value.trim().length === 0) return '/';
  return value;
}

async function getStatus(pool: pg.Pool, chatId: string, userId: string): Promise<{
  chatType: string;
  messageCount: number;
  assistantMessages: number;
  profile: string;
  incidentMode: string;
  userTokensToday: number;
  sessionProfile: string | null;
  modelOverride: string | null;
  usageMode: string;
  thinkLevel: string | null;
  verbose: boolean;
  ragEnabled: boolean;
  estimatedCostUsd: number | null;
}> {
  const [chatTypeRes, countRes, profileRes, incidentRes] = await Promise.all([
    pool.query(`SELECT type FROM chats WHERE id = $1`, [chatId]),
    pool.query(
      `SELECT
         COUNT(*)::int AS message_count,
         COUNT(*) FILTER (WHERE role = 'assistant')::int AS assistant_messages
       FROM messages WHERE chat_id = $1`,
      [chatId],
    ),
    pool.query(`SELECT value FROM settings_global WHERE key = 'performance.profile'`),
    pool.query(`SELECT value FROM settings_global WHERE key = 'incident.mode'`),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const usageRes = await pool.query(
    `SELECT value FROM settings_global WHERE key = $1`,
    [`usage.${today}.user.${userId}`],
  );

  const sessionSettings = await getSessionSettingsSafe(pool, chatId);
  const modelOverride = sessionSettings.model_name || null;
  const estimatedCostUsd = await estimateSessionCostUsd(pool, modelOverride, Number(usageRes.rows[0] ? parseSettingValue(usageRes.rows[0].value) || 0 : 0));

  return {
    chatType: chatTypeRes.rows[0]?.type || 'group',
    messageCount: countRes.rows[0]?.message_count || 0,
    assistantMessages: countRes.rows[0]?.assistant_messages || 0,
    profile: profileRes.rows[0] ? String(parseSettingValue(profileRes.rows[0].value)) : 'balanced',
    incidentMode: incidentRes.rows[0] ? String(parseSettingValue(incidentRes.rows[0].value)) : 'normal',
    userTokensToday: usageRes.rows[0] ? Number(parseSettingValue(usageRes.rows[0].value) || 0) : 0,
    sessionProfile: sessionSettings.profile_name || null,
    modelOverride,
    usageMode: sessionSettings.usage_mode || 'off',
    thinkLevel: sessionSettings.think_level || null,
    verbose: Boolean(sessionSettings.verbose || false),
    ragEnabled: sessionSettings.rag_enabled !== false,
    estimatedCostUsd,
  };
}

async function compactChatContext(pool: pg.Pool, chatId: string, userId: string): Promise<{
  compacted: boolean;
  beforeTokens: number;
  afterTokens: number;
  reason?: string;
}> {
  const keepRecent = 10;
  const boundary = await getContextBoundaryTimestamp(pool, chatId);

  const historyRes = boundary
    ? await pool.query(
      `SELECT id, role, text, created_at
       FROM messages
       WHERE chat_id = $1 AND created_at > $2
       ORDER BY created_at ASC`,
      [chatId, boundary],
    )
    : await pool.query(
      `SELECT id, role, text, created_at
       FROM messages
       WHERE chat_id = $1
       ORDER BY created_at ASC`,
      [chatId],
    );

  const rows = historyRes.rows.filter((r) => r.role === 'user' || r.role === 'assistant');
  const beforeTokens = estimateRowsTokens(rows);

  if (rows.length <= keepRecent) {
    return {
      compacted: false,
      beforeTokens,
      afterTokens: beforeTokens,
      reason: 'not enough messages',
    };
  }

  const older = rows.slice(0, Math.max(0, rows.length - keepRecent));
  const recent = rows.slice(Math.max(0, rows.length - keepRecent));
  const summaryText = await composeCompactionSummary(pool, chatId, userId, older);
  const summaryMessageId = uuidv7();
  await pool.query(
    `INSERT INTO messages (id, chat_id, role, content_type, text, created_at)
     VALUES ($1, $2, 'system', 'text', $3, NOW())`,
    [summaryMessageId, chatId, summaryText],
  );

  const afterTokens = estimateRowsTokens(recent) + estimateTextTokens(summaryText);

  // Best effort until migration is applied everywhere.
  try {
    await pool.query(
      `INSERT INTO compaction_events (id, session_id, before_tokens, after_tokens, summary_text, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [uuidv7(), chatId, beforeTokens, afterTokens, summaryText],
    );
  } catch (err) {
    logger.warn('Compaction event not recorded', { err: String(err) });
  }

  return { compacted: true, beforeTokens, afterTokens };
}

async function composeCompactionSummary(
  pool: pg.Pool,
  chatId: string,
  userId: string,
  olderRows: Array<{ role?: string; text?: string }>,
): Promise<string> {
  const conversation = olderRows
    .slice(-20)
    .map((r) => {
      const text = String(r.text || '').replace(/\s+/g, ' ').trim().slice(0, 160);
      return `- ${r.role}: ${text}`;
    })
    .join('\n');

  const memoryRes = await pool.query(
    `SELECT key, value
     FROM memories
     WHERE (
          visibility = 'global'
       OR (visibility = 'chat_shared' AND chat_id = $1)
       OR (visibility = 'user_private' AND user_id = $2)
     )
       AND archived_at IS NULL
       AND merged_into IS NULL
     ORDER BY updated_at DESC
     LIMIT 40`,
    [chatId, userId],
  );
  const pinnedFacts = memoryRes.rows
    .filter((r) => /pinned|profile|preference/i.test(String(r.key || '')))
    .slice(0, 10)
    .map((r) => `- ${String(r.key)}: ${String(r.value || '').replace(/\s+/g, ' ').trim().slice(0, 200)}`)
    .join('\n');

  const toolRes = await pool.query(
    `SELECT tool_name, outputs
     FROM tool_runs
     WHERE chat_id = $1
       AND status = 'success'
     ORDER BY created_at DESC
     LIMIT 5`,
    [chatId],
  );
  const recentTools = toolRes.rows
    .map((r) => {
      const output = r.outputs ? JSON.stringify(r.outputs) : '';
      const trimmed = output.replace(/\s+/g, ' ').slice(0, 220);
      return `- ${String(r.tool_name)}: ${trimmed || '(no output)'}`;
    })
    .join('\n');

  return [
    COMPACTION_SUMMARY_PREFIX,
    'conversation_summary:',
    conversation || '- (no summary content)',
    '',
    'preserved_facts:',
    pinnedFacts || '- (no pinned/profile facts found)',
    '',
    'recent_tool_results:',
    recentTools || '- (no recent successful tool runs)',
  ].join('\n');
}

function estimateRowsTokens(rows: Array<{ text?: string }>): number {
  return rows.reduce((sum, r) => sum + estimateTextTokens(String(r.text || '')), 0);
}

function estimateTextTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

async function getContextBoundaryTimestamp(pool: pg.Pool, chatId: string): Promise<Date | null> {
  const res = await pool.query(
    `SELECT created_at
     FROM messages
     WHERE chat_id = $1
       AND role = 'system'
       AND (text = $2 OR text LIKE $3)
     ORDER BY created_at DESC
     LIMIT 1`,
    [chatId, SESSION_RESET_MARKER, `${COMPACTION_SUMMARY_PREFIX}%`],
  );
  return res.rows[0]?.created_at || null;
}

async function ensureSessionSettingsRow(pool: pg.Pool, sessionId: string): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO session_settings (session_id, updated_at, updated_by)
       VALUES ($1, NOW(), 'system')
       ON CONFLICT (session_id) DO NOTHING`,
      [sessionId],
    );
  } catch {
    // session_settings may not exist before migration 033
  }
}

async function setSessionSettingThinkLevel(
  pool: pg.Pool,
  sessionId: string,
  thinkLevel: string,
): Promise<boolean> {
  return setSessionSetting(pool, sessionId, 'think_level', thinkLevel);
}

async function setSessionSettingVerbose(
  pool: pg.Pool,
  sessionId: string,
  verbose: boolean,
): Promise<boolean> {
  return setSessionSetting(pool, sessionId, 'verbose', verbose);
}

async function setSessionSettingUsageMode(
  pool: pg.Pool,
  sessionId: string,
  usageMode: string,
): Promise<boolean> {
  return setSessionSetting(pool, sessionId, 'usage_mode', usageMode);
}

async function setSessionSettingModelName(
  pool: pg.Pool,
  sessionId: string,
  modelName: string,
): Promise<boolean> {
  return setSessionSetting(pool, sessionId, 'model_name', modelName);
}

async function setSessionSettingRagEnabled(
  pool: pg.Pool,
  sessionId: string,
  ragEnabled: boolean,
): Promise<boolean> {
  return setSessionSetting(pool, sessionId, 'rag_enabled', ragEnabled);
}

async function setSessionSettingProfileName(
  pool: pg.Pool,
  sessionId: string,
  profileName: string,
): Promise<boolean> {
  return setSessionSetting(pool, sessionId, 'profile_name', profileName);
}

async function setSessionSetting(
  pool: pg.Pool,
  sessionId: string,
  field: 'think_level' | 'verbose' | 'usage_mode' | 'model_name' | 'profile_name' | 'rag_enabled',
  value: string | boolean,
): Promise<boolean> {
  await ensureSessionSettingsRow(pool, sessionId);
  try {
    await pool.query(
      `UPDATE session_settings
       SET ${field} = $2, updated_at = NOW(), updated_by = 'system'
       WHERE session_id = $1`,
      [sessionId, value],
    );
    return true;
  } catch {
    return false;
  }
}

async function getSessionSettingsSafe(pool: pg.Pool, sessionId: string): Promise<{
  think_level?: string | null;
  verbose?: boolean;
  usage_mode?: string;
  model_name?: string | null;
  profile_name?: string | null;
  rag_enabled?: boolean;
}> {
  try {
    const res = await pool.query(
      `SELECT think_level, verbose, usage_mode, model_name, profile_name, rag_enabled
       FROM session_settings
       WHERE session_id = $1
       LIMIT 1`,
      [sessionId],
    );
    return res.rows[0] || {};
  } catch {
    return {};
  }
}

async function estimateSessionCostUsd(
  pool: pg.Pool,
  modelOverride: string | null,
  tokenCount: number,
): Promise<number | null> {
  if (!modelOverride || tokenCount <= 0) return null;
  try {
    const res = await pool.query(
      `SELECT cost_per_1k_tokens
       FROM model_registry
       WHERE name = $1 OR model_id = $1
       LIMIT 1`,
      [modelOverride],
    );
    if (res.rows.length === 0) return null;
    const costPer1k = Number(res.rows[0].cost_per_1k_tokens || 0);
    if (!Number.isFinite(costPer1k) || costPer1k <= 0) return null;
    return (tokenCount / 1000) * costPer1k;
  } catch {
    return null;
  }
}

async function isAdminUser(pool: pg.Pool, userId: string): Promise<boolean> {
  const roleRes = await pool.query(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [userId]);
  return roleRes.rows[0]?.role === 'admin';
}

async function getChatOrganizationId(pool: pg.Pool, chatId: string): Promise<string | null> {
  const res = await pool.query(`SELECT organization_id FROM chats WHERE id = $1 LIMIT 1`, [chatId]);
  const orgId = String(res.rows[0]?.organization_id || '').trim();
  return orgId || null;
}

function parseRelayCommandArgs(args: string[]): {
  ok: true;
  sourceRef: string;
  targetRef: string;
  width: number;
  height: number;
  timeoutMs: number;
} | {
  ok: false;
  message: string;
} {
  const raw = args.join(' ').trim();
  if (!raw) {
    return { ok: false, message: 'Usage: /relay <source> -> <target> [widthxheight] [timeout=ms]' };
  }

  const arrowIndex = raw.indexOf('->');
  if (arrowIndex <= 0) {
    return { ok: false, message: 'Usage: /relay <source> -> <target> [widthxheight] [timeout=ms]' };
  }

  const sourceRef = raw.slice(0, arrowIndex).trim().replace(/^"(.*)"$/, '$1');
  const rest = raw.slice(arrowIndex + 2).trim();
  if (!sourceRef || !rest) {
    return { ok: false, message: 'Usage: /relay <source> -> <target> [widthxheight] [timeout=ms]' };
  }

  const parts = rest.split(/\s+/).filter(Boolean);
  const targetRef = String(parts.shift() || '').trim().replace(/^"(.*)"$/, '$1');
  if (!targetRef) {
    return { ok: false, message: 'Usage: /relay <source> -> <target> [widthxheight] [timeout=ms]' };
  }

  let width = 320;
  let height = 180;
  let timeoutMs = DEFAULT_RELAY_TIMEOUT_MS;
  for (const part of parts) {
    const sizeMatch = /^(\d{2,4})x(\d{2,4})$/i.exec(part);
    if (sizeMatch) {
      width = Math.max(64, Math.min(1920, Number.parseInt(sizeMatch[1], 10)));
      height = Math.max(64, Math.min(1080, Number.parseInt(sizeMatch[2], 10)));
      continue;
    }
    const timeoutMatch = /^timeout=(\d{3,7})$/i.exec(part);
    if (timeoutMatch) {
      timeoutMs = Number.parseInt(timeoutMatch[1], 10);
      continue;
    }
    return { ok: false, message: `Unknown relay option "${part}". Use [widthxheight] [timeout=ms].` };
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs < MIN_RELAY_TIMEOUT_MS || timeoutMs > MAX_RELAY_TIMEOUT_MS) {
    return {
      ok: false,
      message: `timeout must be between ${MIN_RELAY_TIMEOUT_MS} and ${MAX_RELAY_TIMEOUT_MS} ms.`,
    };
  }

  return { ok: true, sourceRef, targetRef, width, height, timeoutMs };
}

function parseHandoffCommandArgs(args: string[]): {
  ok: true;
  targetRef: string;
  note: string;
} | {
  ok: false;
  message: string;
} {
  const raw = args.join(' ').trim();
  if (!raw) {
    return { ok: false, message: 'Usage: /handoff <target> [note...]' };
  }

  const [targetRaw, ...noteParts] = raw.split(/\s+/).filter(Boolean);
  const targetRef = String(targetRaw || '').trim().replace(/^"(.*)"$/, '$1');
  if (!targetRef) {
    return { ok: false, message: 'Usage: /handoff <target> [note...]' };
  }
  const note = noteParts.join(' ').trim();
  return { ok: true, targetRef, note };
}

function parseMirrorPersonaCommandArgs(args: string[]): {
  ok: true;
  targetRef: string;
  mood: 'idle' | 'thinking' | 'listening' | 'speaking' | 'happy';
  state: string;
  cue: string;
} | {
  ok: false;
  message: string;
} {
  const raw = args.join(' ').trim();
  if (!raw) {
    return { ok: false, message: 'Usage: /mirrorpersona <target> [mood=idle|thinking|listening|speaking|happy] [state=...] [cue=...]' };
  }

  const parts = raw.split(/\s+/).filter(Boolean);
  const targetRef = String(parts.shift() || '').trim().replace(/^"(.*)"$/, '$1');
  if (!targetRef) {
    return { ok: false, message: 'Usage: /mirrorpersona <target> [mood=idle|thinking|listening|speaking|happy] [state=...] [cue=...]' };
  }

  let mood: 'idle' | 'thinking' | 'listening' | 'speaking' | 'happy' = 'idle';
  let state = 'idle';
  let cue = 'Standing by.';
  let cueExplicit = false;
  const freeText: string[] = [];

  for (const part of parts) {
    const moodMatch = /^mood=(.+)$/i.exec(part);
    if (moodMatch) {
      const candidate = String(moodMatch[1] || '').trim().toLowerCase();
      if (!['idle', 'thinking', 'listening', 'speaking', 'happy'].includes(candidate)) {
        return { ok: false, message: `Invalid mood "${candidate}". Use idle|thinking|listening|speaking|happy.` };
      }
      mood = candidate as typeof mood;
      continue;
    }

    const stateMatch = /^state=(.+)$/i.exec(part);
    if (stateMatch) {
      state = truncateForHandoff(String(stateMatch[1] || '').trim() || state, 60);
      continue;
    }

    const cueMatch = /^cue=(.+)$/i.exec(part);
    if (cueMatch) {
      cue = truncateForHandoff(String(cueMatch[1] || '').trim() || cue, 140);
      cueExplicit = true;
      continue;
    }

    freeText.push(part);
  }

  if (freeText.length > 0) {
    if (cueExplicit) {
      cue = truncateForHandoff(`${cue} ${freeText.join(' ')}`.trim(), 140);
    } else {
      cue = truncateForHandoff(freeText.join(' '), 140);
    }
  }

  if (state === 'idle' && mood !== 'idle') {
    state = mood;
  }
  return { ok: true, targetRef, mood, state, cue };
}

async function buildChatHandoffContinuity(
  pool: pg.Pool,
  chatId: string,
  note: string,
): Promise<Record<string, unknown>> {
  const messageRes = await pool.query(
    `SELECT role, text, created_at
     FROM messages
     WHERE chat_id = $1
     ORDER BY created_at DESC
     LIMIT 6`,
    [chatId],
  );

  const messages = [...messageRes.rows].reverse();
  const timeline: string[] = [];
  for (const row of messages) {
    const role = String(row.role || 'unknown').toLowerCase();
    const text = String(row.text || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const label = role === 'assistant' ? 'Sven' : role === 'user' ? 'User' : role;
    timeline.push(`${label}: ${truncateForHandoff(text, 140)}`);
  }

  const nowIso = new Date().toISOString();
  return {
    clock: { timezone: 'Local' },
    summary: {
      items: [
        `Chat: ${chatId}`,
        `Captured: ${nowIso}`,
        note ? `Note: ${truncateForHandoff(note, 120)}` : 'Note: none',
      ],
      text: note || 'Session handoff context from mobile chat.',
    },
    alerts: {
      items: timeline.length > 0 ? timeline : ['No recent messages found for this chat.'],
    },
  };
}

function truncateForHandoff(value: string, max: number): string {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}...`;
}

async function resolveRelayDevice(
  pool: pg.Pool,
  organizationId: string,
  ref: string,
): Promise<{ id: string; name: string } | null> {
  const normalizedRef = String(ref || '').trim();
  if (!normalizedRef) return null;
  const res = await pool.query(
    `SELECT id, name
     FROM devices
     WHERE organization_id = $1
       AND (id = $2 OR LOWER(name) = LOWER($2))
     LIMIT 1`,
    [organizationId, normalizedRef],
  );
  if (res.rows.length === 0) return null;
  return {
    id: String(res.rows[0].id || '').trim(),
    name: String(res.rows[0].name || normalizedRef).trim() || normalizedRef,
  };
}

async function waitForRelaySnapshotResult(
  pool: pg.Pool,
  commandId: string,
  sourceDeviceId: string,
  timeoutMs: number,
): Promise<{ ok: true; imageBase64: string } | { ok: false; message: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const poll = await pool.query(
      `SELECT status, result_payload, error_message
       FROM device_commands
       WHERE id = $1 AND device_id = $2
       LIMIT 1`,
      [commandId, sourceDeviceId],
    );
    if (poll.rows.length > 0) {
      const status = String(poll.rows[0].status || '').toLowerCase();
      const payload =
        (poll.rows[0].result_payload && typeof poll.rows[0].result_payload === 'object')
          ? (poll.rows[0].result_payload as Record<string, unknown>)
          : {};
      const errorMessage = String(poll.rows[0].error_message || '').trim();

      if (status === 'failed') {
        return { ok: false, message: errorMessage || 'snapshot command failed' };
      }
      if (status === 'acknowledged') {
        const imageBase64 = String(payload.image_base64 || '').trim();
        if (!imageBase64) return { ok: false, message: 'snapshot succeeded but no image was returned' };
        return { ok: true, imageBase64 };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  return { ok: false, message: `snapshot timed out after ${timeoutMs}ms` };
}

function renderRelaySnapshotHtml(imageBase64: string): string {
  return '<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;">'
    + `<img style="max-width:100vw;max-height:100vh;object-fit:contain;" src="data:image/jpeg;base64,${imageBase64}"/>`
    + '</body></html>';
}

async function getIncidentModeSetting(pool: pg.Pool): Promise<string> {
  try {
    const res = await pool.query(`SELECT value FROM settings_global WHERE key = 'incident.mode' LIMIT 1`);
    return String(parseSettingValue(res.rows[0]?.value) || 'normal').trim().toLowerCase() || 'normal';
  } catch {
    return 'normal';
  }
}

function getSkillQuarantineScanConfig() {
  const strict = String(process.env.SVEN_SKILL_QUARANTINE_SCAN_STRICT || '').trim().toLowerCase();
  return {
    strict: strict === '1' || strict === 'true' || strict === 'yes' || strict === 'on',
    sbomConfigured: Boolean(String(process.env.SVEN_SKILL_QUARANTINE_SBOM_COMMAND || '').trim()),
    vulnConfigured: Boolean(String(process.env.SVEN_SKILL_QUARANTINE_VULN_COMMAND || '').trim()),
  };
}

type InstalledSkillSummary = {
  id: string;
  name: string;
  toolId: string;
  trustLevel: string;
};

async function listInstalledSkills(pool: pg.Pool, organizationId: string): Promise<InstalledSkillSummary[]> {
  const res = await pool.query(
    `SELECT
       si.id,
       COALESCE(c.name, si.tool_id) AS name,
       si.tool_id,
       si.trust_level
     FROM skills_installed si
     LEFT JOIN skills_catalog c ON c.id = si.catalog_entry_id
     WHERE si.organization_id = $1
     ORDER BY COALESCE(c.name, si.tool_id) ASC
     LIMIT 50`,
    [organizationId],
  );
  return res.rows.map((row) => ({
    id: String(row.id || '').trim(),
    name: String(row.name || '').trim(),
    toolId: String(row.tool_id || '').trim(),
    trustLevel: String(row.trust_level || '').trim(),
  }));
}

async function resolveCatalogEntryForSkillInstall(
  pool: pg.Pool,
  organizationId: string,
  query: string,
): Promise<{ id: string; name: string; manifest: Record<string, unknown> } | null> {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) return null;
  const res = await pool.query(
    `SELECT id, name, manifest
     FROM skills_catalog
     WHERE organization_id = $1
       AND (id = $2 OR lower(name) = $3)
     ORDER BY name ASC
     LIMIT 2`,
    [organizationId, query, normalized],
  );
  if (res.rows.length !== 1) return null;
  return {
    id: String(res.rows[0].id || '').trim(),
    name: String(res.rows[0].name || '').trim(),
    manifest: (res.rows[0].manifest || {}) as Record<string, unknown>,
  };
}

async function installSkillForChatCommand(
  pool: pg.Pool,
  opts: { organizationId: string; userId: string; query: string },
): Promise<{ message: string }> {
  const catalog = await resolveCatalogEntryForSkillInstall(pool, opts.organizationId, opts.query);
  if (!catalog) {
    return { message: `Catalog entry not found for "${opts.query}".` };
  }

  const toolId = typeof catalog.manifest.tool_id === 'string' ? catalog.manifest.tool_id.trim() : '';
  if (!toolId) {
    return { message: `Catalog entry "${catalog.name}" is missing manifest.tool_id mapping.` };
  }

  const toolExists = await pool.query(`SELECT id FROM tools WHERE id = $1`, [toolId]);
  if (toolExists.rows.length === 0) {
    return { message: `Tool "${toolId}" does not exist.` };
  }

  const trustLevel = catalog.manifest.first_party === true ? 'trusted' : 'quarantined';
  const scanConfig = getSkillQuarantineScanConfig();
  if (trustLevel === 'quarantined' && scanConfig.strict && (!scanConfig.sbomConfigured || !scanConfig.vulnConfigured)) {
    return { message: 'Skill install blocked: strict quarantine scan mode requires SBOM and vulnerability scan commands.' };
  }

  const attemptedInstallId = uuidv7();
  const inserted = await pool.query(
    `INSERT INTO skills_installed (id, organization_id, catalog_entry_id, tool_id, trust_level, installed_by, installed_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT DO NOTHING
     RETURNING id, catalog_entry_id, tool_id, trust_level`,
    [attemptedInstallId, opts.organizationId, catalog.id, toolId, trustLevel, opts.userId],
  );

  const installRow = inserted.rows.length > 0
    ? inserted.rows[0]
    : (
        await pool.query(
          `SELECT id, catalog_entry_id, tool_id, trust_level
           FROM skills_installed
           WHERE organization_id = $1 AND (catalog_entry_id = $2 OR tool_id = $3)
           ORDER BY installed_at DESC
           LIMIT 1`,
          [opts.organizationId, catalog.id, toolId],
        )
      ).rows[0];

  if (!installRow) {
    return { message: `Install failed for "${catalog.name}".` };
  }

  if (inserted.rows.length > 0 && trustLevel === 'quarantined') {
    const staticChecks = { status: 'pending', checks: [] };
    const sbom = {
      status: 'pending',
      tool: 'syft',
      configured: scanConfig.sbomConfigured,
      ...(scanConfig.sbomConfigured ? { command: String(process.env.SVEN_SKILL_QUARANTINE_SBOM_COMMAND || '').trim() } : {}),
    };
    const vulnScan = {
      status: 'pending',
      tool: 'grype',
      configured: scanConfig.vulnConfigured,
      ...(scanConfig.vulnConfigured ? { command: String(process.env.SVEN_SKILL_QUARANTINE_VULN_COMMAND || '').trim() } : {}),
    };
    await pool.query(
      `INSERT INTO skill_quarantine_reports (id, skill_id, organization_id, static_checks, sbom, vuln_scan, overall_risk, reviewed_by, reviewed_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [uuidv7(), String(installRow.id), opts.organizationId, JSON.stringify(staticChecks), JSON.stringify(sbom), JSON.stringify(vulnScan), 'unknown', null, null],
    );
  }

  if (inserted.rows.length === 0) {
    return {
      message: `Skill "${catalog.name}" already installed [${String(installRow.trust_level)}] id=${String(installRow.id)}.`,
    };
  }

  return {
    message: `Installed skill "${catalog.name}" as ${trustLevel} id=${String(installRow.id)} tool=${toolId}.`,
  };
}

async function resolveInstalledSkillForChatCommand(
  pool: pg.Pool,
  organizationId: string,
  query: string,
): Promise<{ id: string; name: string; toolId: string } | null> {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) return null;
  const res = await pool.query(
    `SELECT
       si.id,
       COALESCE(c.name, si.tool_id) AS name,
       si.tool_id
     FROM skills_installed si
     LEFT JOIN skills_catalog c ON c.id = si.catalog_entry_id
     WHERE si.organization_id = $1
       AND (si.id = $2 OR si.tool_id = $2 OR lower(COALESCE(c.name, '')) = $3)
     ORDER BY si.installed_at DESC
     LIMIT 2`,
    [organizationId, query, normalized],
  );
  if (res.rows.length !== 1) return null;
  return {
    id: String(res.rows[0].id || '').trim(),
    name: String(res.rows[0].name || '').trim(),
    toolId: String(res.rows[0].tool_id || '').trim(),
  };
}

async function manageInstalledSkillForChatCommand(
  pool: pg.Pool,
  opts: { organizationId: string; query: string; action: 'remove' | 'block' | 'quarantine' },
): Promise<{ message: string }> {
  const target = await resolveInstalledSkillForChatCommand(pool, opts.organizationId, opts.query);
  if (!target) {
    return { message: `Installed skill not found for "${opts.query}".` };
  }

  if (opts.action === 'remove') {
    const deleted = await pool.query(
      `DELETE FROM skill_quarantine_reports WHERE skill_id = $1 AND organization_id = $2`,
      [target.id, opts.organizationId],
    );
    void deleted;
    const res = await pool.query(
      `DELETE FROM skills_installed WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [target.id, opts.organizationId],
    );
    if (res.rows.length === 0) return { message: `Installed skill "${target.name}" could not be removed.` };
    return { message: `Removed skill "${target.name}" id=${target.id}.` };
  }

  const res = await pool.query(
    `UPDATE skills_installed
     SET trust_level = $1
     WHERE id = $2 AND organization_id = $3
     RETURNING id`,
    [opts.action, target.id, opts.organizationId],
  );
  if (res.rows.length === 0) {
    return { message: `Installed skill "${target.name}" could not be updated.` };
  }
  return { message: `Set skill "${target.name}" to ${opts.action}.` };
}

function parseDurationMs(raw: string): number | null {
  const m = raw.match(/^(\d+)(m|h|d)?$/i);
  if (!m) return null;
  const amount = Number(m[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = (m[2] || 'm').toLowerCase();
  if (unit === 'm') return amount * 60 * 1000;
  if (unit === 'h') return amount * 60 * 60 * 1000;
  if (unit === 'd') return amount * 24 * 60 * 60 * 1000;
  return null;
}

async function getMessageCount(pool: pg.Pool, chatId: string): Promise<number> {
  const res = await pool.query(`SELECT COUNT(*)::int AS c FROM messages WHERE chat_id = $1`, [chatId]);
  return res.rows[0]?.c || 0;
}

async function listAvailableModels(pool: pg.Pool): Promise<AvailableModel[]> {
  try {
    const res = await pool.query(
      `SELECT name, provider, model_id
       FROM model_registry
       ORDER BY is_local DESC, created_at DESC
       LIMIT 50`,
    );
    return res.rows.map((row) => ({
      name: String(row.name || ''),
      provider: String(row.provider || ''),
      modelId: String(row.model_id || ''),
    })).filter((row) => row.modelId.length > 0);
  } catch (err: unknown) {
    const code = String((err as { code?: string })?.code || '');
    if (code === '42P01' || code === '42703') return [];
    logger.warn('Failed to list model registry for /model command', { err: String(err) });
    return [];
  }
}

async function listMcpServersForChatCommand(
  pool: pg.Pool,
  organizationId: string,
  chatId: string,
): Promise<McpServerRow[]> {
  let serverRows: Array<{ id: string; name: string; transport: string; status: string }> = [];
  try {
    const res = await pool.query(
      `SELECT id, name, transport, status
       FROM mcp_servers
       WHERE organization_id = $1
       ORDER BY name ASC
       LIMIT 50`,
      [organizationId],
    );
    serverRows = res.rows.map((row) => ({
      id: String(row.id || ''),
      name: String(row.name || ''),
      transport: String(row.transport || 'unknown'),
      status: String(row.status || 'disconnected'),
    }));
  } catch (err: unknown) {
    const code = String((err as { code?: string })?.code || '');
    if (code !== '42703') throw err;
    const legacy = await pool.query(
      `SELECT id, name, transport, status
       FROM mcp_servers
       ORDER BY name ASC
       LIMIT 50`,
    );
    serverRows = legacy.rows.map((row) => ({
      id: String(row.id || ''),
      name: String(row.name || ''),
      transport: String(row.transport || 'unknown'),
      status: String(row.status || 'disconnected'),
    }));
  }
  if (serverRows.length === 0) return [];

  let overrides = new Map<string, boolean>();
  try {
    const overrideRes = await pool.query(
      `SELECT server_id, enabled
       FROM mcp_chat_overrides
       WHERE organization_id = $1 AND chat_id = $2`,
      [organizationId, chatId],
    );
    overrides = new Map(
      overrideRes.rows.map((row) => [String(row.server_id || ''), Boolean(row.enabled)]),
    );
  } catch (err: unknown) {
    const code = String((err as { code?: string })?.code || '');
    if (code !== '42703') throw err;
    const legacyOverrideRes = await pool.query(
      `SELECT server_id, enabled
       FROM mcp_chat_overrides
       WHERE chat_id = $1`,
      [chatId],
    );
    overrides = new Map(
      legacyOverrideRes.rows.map((row) => [String(row.server_id || ''), Boolean(row.enabled)]),
    );
  }

  return serverRows.map((row) => {
    const hasOverride = overrides.has(row.id);
    const effectiveEnabled = hasOverride ? Boolean(overrides.get(row.id)) : row.status !== 'error';
    return {
      ...row,
      effectiveEnabled,
      scope: hasOverride ? 'chat-override' : 'org-default',
    };
  });
}

async function listMcpToolsForChatCommand(
  pool: pg.Pool,
  organizationId: string,
  serverRef: string,
): Promise<McpToolRow[]> {
  const hasServerRef = serverRef.trim().length > 0;
  const params: unknown[] = [organizationId];
  let sql = `
    SELECT s.name AS server_name, t.tool_name
    FROM mcp_server_tools t
    JOIN mcp_servers s ON s.id = t.server_id
    WHERE t.organization_id = $1
  `;
  if (hasServerRef) {
    params.push(serverRef, serverRef.toLowerCase());
    sql += ' AND (s.id = $2 OR LOWER(s.name) = $3)';
  }
  sql += ' ORDER BY s.name ASC, t.tool_name ASC LIMIT 100';

  try {
    const res = await pool.query(sql, params);
    return res.rows.map((row) => ({
      serverName: String(row.server_name || 'unknown'),
      toolName: String(row.tool_name || ''),
    })).filter((row) => row.toolName.length > 0);
  } catch (err: unknown) {
    const code = String((err as { code?: string })?.code || '');
    if (code !== '42703') throw err;
    const legacyParams: unknown[] = [];
    let legacySql = `
      SELECT s.name AS server_name, t.tool_name
      FROM mcp_server_tools t
      JOIN mcp_servers s ON s.id = t.server_id
      WHERE 1=1
    `;
    if (hasServerRef) {
      legacyParams.push(serverRef, serverRef.toLowerCase());
      legacySql += ' AND (s.id = $1 OR LOWER(s.name) = $2)';
    }
    legacySql += ' ORDER BY s.name ASC, t.tool_name ASC LIMIT 100';
    const legacyRes = await pool.query(legacySql, legacyParams);
    return legacyRes.rows.map((row) => ({
      serverName: String(row.server_name || 'unknown'),
      toolName: String(row.tool_name || ''),
    })).filter((row) => row.toolName.length > 0);
  }
}

function resolveModelSelection(
  modelArg: string,
  availableModels: AvailableModel[],
): { ok: true; modelName: string } | { ok: false; message: string } {
  const arg = modelArg.trim();
  if (!arg) {
    return { ok: false, message: 'Usage: /model current|list|<number|alias|model_name>' };
  }

  if (/^\d+$/.test(arg)) {
    const index = Number(arg) - 1;
    if (index < 0 || index >= availableModels.length) {
      return { ok: false, message: `Invalid model number "${arg}". Run /model list.` };
    }
    return { ok: true, modelName: availableModels[index].modelId };
  }

  const key = arg.toLowerCase();
  const aliasHints = MODEL_ALIASES[key];
  if (aliasHints) {
    const aliasMatch = availableModels.find((model) => {
      const haystack = `${model.name} ${model.provider}/${model.modelId}`.toLowerCase();
      return aliasHints.some((hint) => haystack.includes(hint));
    });
    if (!aliasMatch) {
      return { ok: false, message: `Alias "${arg}" did not match any available model. Run /model list.` };
    }
    return { ok: true, modelName: aliasMatch.modelId };
  }

  const exactMatch = availableModels.find((model) => {
    const fq = `${model.provider}/${model.modelId}`.toLowerCase();
    return (
      model.modelId.toLowerCase() === key
      || model.name.toLowerCase() === key
      || fq === key
    );
  });
  if (exactMatch) return { ok: true, modelName: exactMatch.modelId };

  return { ok: true, modelName: arg };
}

async function getSessionMeta(pool: pg.Pool, chatId: string): Promise<{
  chatType: string;
  startedAt: string | null;
  lastMessageAt: string | null;
  messageCount: number;
}> {
  const [chatRes, historyRes] = await Promise.all([
    pool.query(`SELECT type FROM chats WHERE id = $1`, [chatId]),
    pool.query(
      `SELECT
         MIN(created_at) AS started_at,
         MAX(created_at) AS last_message_at,
         COUNT(*)::int AS message_count
       FROM messages WHERE chat_id = $1`,
      [chatId],
    ),
  ]);

  return {
    chatType: chatRes.rows[0]?.type || 'group',
    startedAt: historyRes.rows[0]?.started_at ? String(historyRes.rows[0].started_at) : null,
    lastMessageAt: historyRes.rows[0]?.last_message_at ? String(historyRes.rows[0].last_message_at) : null,
    messageCount: historyRes.rows[0]?.message_count || 0,
  };
}

async function buildSessionExport(pool: pg.Pool, chatId: string, limit: number): Promise<{
  exported_at: string;
  chat_id: string;
  meta: {
    chat_type: string;
    started_at: string | null;
    last_message_at: string | null;
    message_count: number;
  };
  settings: {
    think_level?: string | null;
    verbose?: boolean;
    usage_mode?: string;
    model_name?: string | null;
    profile_name?: string | null;
    rag_enabled?: boolean;
  };
  messages: Array<{ id: string; role: string; content_type: string; text: string; created_at: string }>;
}> {
  const [meta, settings, messagesRes] = await Promise.all([
    getSessionMeta(pool, chatId),
    getSessionSettingsSafe(pool, chatId),
    pool.query(
      `SELECT id, role, content_type, text, created_at
       FROM messages
       WHERE chat_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [chatId, limit],
    ),
  ]);

  const messages = messagesRes.rows
    .slice()
    .reverse()
    .map((row) => ({
      id: String(row.id || ''),
      role: String(row.role || 'unknown'),
      content_type: String(row.content_type || 'text'),
      text: String(row.text || ''),
      created_at: String(row.created_at || ''),
    }));

  return {
    exported_at: new Date().toISOString(),
    chat_id: chatId,
    meta: {
      chat_type: meta.chatType,
      started_at: meta.startedAt,
      last_message_at: meta.lastMessageAt,
      message_count: meta.messageCount,
    },
    settings,
    messages,
  };
}

async function emitSessionExport(ctx: CommandContext, limit: number): Promise<void> {
  const payload = await buildSessionExport(ctx.pool, ctx.event.chat_id, limit);
  const json = JSON.stringify(payload, null, 2);
  const maxChars = 12000;
  const truncated = json.length > maxChars;
  const body = truncated ? `${json.slice(0, maxChars)}\n...` : json;
  const base64Payload = Buffer.from(json, 'utf8').toString('base64');
  const base64Preview = base64Payload.length > 4000
    ? `${base64Payload.slice(0, 4000)}...`
    : base64Payload;

  await ctx.canvasEmitter.emit({
    chat_id: ctx.event.chat_id,
    channel: ctx.event.channel,
    text: [
      `Session export (${payload.messages.length} messages):`,
      '```json',
      body,
      '```',
      truncated ? 'Note: export JSON was truncated for channel size safety.' : '',
      '',
      'Session import payload (base64):',
      '```text',
      base64Preview,
      '```',
      base64Payload.length > base64Preview.length
        ? 'Note: base64 payload preview is truncated in chat output. Use a file for full payload.'
        : '',
      `Import command: /session import-base64 <payload>`,
    ].filter(Boolean).join('\n'),
  });
}

type SessionImportPayload = {
  chat_id?: string;
  settings?: {
    think_level?: string | null;
    verbose?: boolean;
    usage_mode?: string;
    model_name?: string | null;
    profile_name?: string | null;
    rag_enabled?: boolean;
  };
  messages?: Array<{
    role?: string;
    content_type?: string;
    text?: string;
  }>;
};

function decodeSessionImportPayload(encodedPayload: string):
{ ok: true; payload: SessionImportPayload } | { ok: false; message: string } {
  let raw = '';
  try {
    raw = Buffer.from(encodedPayload, 'base64').toString('utf8');
  } catch {
    return { ok: false, message: 'payload is not valid base64.' };
  }
  if (!raw || raw.trim().length === 0) {
    return { ok: false, message: 'payload decoded to empty content.' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: 'decoded payload is not valid JSON.' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, message: 'decoded payload must be a JSON object.' };
  }
  return { ok: true, payload: parsed as SessionImportPayload };
}

async function importSessionPayload(
  pool: pg.Pool,
  chatId: string,
  payload: SessionImportPayload,
): Promise<{ importedCount: number; appliedSettings: string[] }> {
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const allowedRoles = new Set(['user', 'assistant', 'system', 'tool']);
  const toImport = messages
    .map((row) => ({
      role: String(row?.role || 'user').toLowerCase(),
      contentType: String(row?.content_type || 'text').toLowerCase(),
      text: String(row?.text || ''),
    }))
    .filter((row) => allowedRoles.has(row.role) && row.text.trim().length > 0)
    .slice(0, 200);

  for (const row of toImport) {
    await pool.query(
      `INSERT INTO messages (id, chat_id, role, content_type, text, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [uuidv7(), chatId, row.role, row.contentType, row.text],
    );
  }

  const appliedSettings: string[] = [];
  const settings = payload.settings || {};
  if (typeof settings.think_level === 'string' && ['off', 'low', 'medium', 'high'].includes(settings.think_level.toLowerCase())) {
    if (await setSessionSettingThinkLevel(pool, chatId, settings.think_level.toLowerCase())) {
      appliedSettings.push('think_level');
    }
  }
  if (typeof settings.verbose === 'boolean') {
    if (await setSessionSettingVerbose(pool, chatId, settings.verbose)) {
      appliedSettings.push('verbose');
    }
  }
  if (typeof settings.usage_mode === 'string' && ['off', 'tokens', 'full'].includes(settings.usage_mode.toLowerCase())) {
    if (await setSessionSettingUsageMode(pool, chatId, settings.usage_mode.toLowerCase())) {
      appliedSettings.push('usage_mode');
    }
  }
  if (typeof settings.model_name === 'string' && settings.model_name.trim().length > 0) {
    if (await setSessionSettingModelName(pool, chatId, settings.model_name.trim())) {
      appliedSettings.push('model_name');
    }
  }
  if (typeof settings.profile_name === 'string' && settings.profile_name.trim().length > 0) {
    if (await setSessionSettingProfileName(pool, chatId, settings.profile_name.trim())) {
      appliedSettings.push('profile_name');
    }
  }
  if (typeof settings.rag_enabled === 'boolean') {
    if (await setSessionSettingRagEnabled(pool, chatId, settings.rag_enabled)) {
      appliedSettings.push('rag_enabled');
    }
  }

  return {
    importedCount: toImport.length,
    appliedSettings,
  };
}

type QueueStatusSummary = {
  backpressureActive: boolean;
  queues: Array<{
    queue_type: string;
    queue_depth: number;
    depth_percentage: number | null;
    sampled_at: string;
  }>;
};

type ToolReliabilitySnapshot = {
  policy: {
    enabled: boolean;
    maxRetries: number;
    requireApprovalAfter: number;
  };
  recentFailures: Array<{
    toolName: string;
    status: string;
    error: string;
    createdAt: string;
  }>;
  retryBreakdown: Array<{
    classification: string;
    outcome: string;
    count: number;
  }>;
};

type OperatorObservabilitySnapshot = {
  agent: {
    paused: boolean;
    nudgeNonce: number;
    lastNudgedAt: string | null;
  };
  queue: QueueStatusSummary;
  recentWorkflowRuns: Array<{
    id: string;
    workflowId: string;
    status: string;
    updatedAt: string;
  }>;
};

async function getToolReliabilitySnapshot(
  pool: pg.Pool,
  chatId: string,
  limit: number,
): Promise<ToolReliabilitySnapshot> {
  const DEFAULT_MAX_RETRIES = 3;
  const DEFAULT_REQUIRE_APPROVAL_AFTER = 2;
  const MAX_SELF_CORRECTION_RETRIES = 12;

  const policy = {
    enabled: true,
    maxRetries: DEFAULT_MAX_RETRIES,
    requireApprovalAfter: DEFAULT_REQUIRE_APPROVAL_AFTER,
  };

  try {
    const res = await pool.query(
      `SELECT key, value
       FROM settings_global
       WHERE key = ANY($1::text[])`,
      [[
        'agent.selfCorrection.enabled',
        'agent.selfCorrection.maxRetries',
        'agent.selfCorrection.requireApprovalAfter',
      ]],
    );
    const map = new Map<string, unknown>();
    for (const row of res.rows) {
      map.set(String(row.key || ''), parseSettingValue(row.value));
    }
    if (map.has('agent.selfCorrection.enabled')) {
      const enabledRaw = map.get('agent.selfCorrection.enabled');
      if (typeof enabledRaw === 'boolean') {
        policy.enabled = enabledRaw;
      } else if (typeof enabledRaw === 'number') {
        policy.enabled = enabledRaw !== 0;
      } else if (typeof enabledRaw === 'string') {
        const normalized = enabledRaw.trim().toLowerCase();
        policy.enabled = ['true', '1', 'on', 'yes'].includes(normalized);
      } else {
        policy.enabled = false;
      }
    }
    const parsedMaxRetries = Number(map.get('agent.selfCorrection.maxRetries'));
    if (Number.isFinite(parsedMaxRetries)) {
      policy.maxRetries = Math.min(MAX_SELF_CORRECTION_RETRIES, Math.max(1, Math.floor(parsedMaxRetries)));
    }
    const parsedRequireApprovalAfter = Number(map.get('agent.selfCorrection.requireApprovalAfter'));
    if (Number.isFinite(parsedRequireApprovalAfter)) {
      policy.requireApprovalAfter = Math.min(
        policy.maxRetries,
        Math.max(1, Math.floor(parsedRequireApprovalAfter)),
      );
    } else {
      policy.requireApprovalAfter = Math.min(policy.maxRetries, policy.requireApprovalAfter);
    }
  } catch {
    // Keep safe defaults if settings are unavailable.
  }

  let recentFailures: ToolReliabilitySnapshot['recentFailures'] = [];
  try {
    const failuresRes = await pool.query(
      `SELECT tool_name, status, error, created_at
       FROM tool_runs
       WHERE chat_id = $1
         AND status IN ('error', 'timeout', 'denied')
       ORDER BY created_at DESC
       LIMIT $2`,
      [chatId, limit],
    );
    recentFailures = failuresRes.rows.map((row) => ({
      toolName: String(row.tool_name || 'unknown'),
      status: String(row.status || 'unknown'),
      error: String(row.error || '').trim().slice(0, 220),
      createdAt: String(row.created_at || ''),
    }));
  } catch {
    recentFailures = [];
  }

  let retryBreakdown: ToolReliabilitySnapshot['retryBreakdown'] = [];
  try {
    const retryRes = await pool.query(
      `SELECT r.error_classification, r.outcome, COUNT(*)::int AS c
       FROM tool_retries r
       JOIN tool_runs tr
         ON tr.id::text = r.tool_call_id
       WHERE tr.chat_id = $1
       GROUP BY r.error_classification, r.outcome
       ORDER BY c DESC, r.error_classification ASC, r.outcome ASC`,
      [chatId],
    );
    retryBreakdown = retryRes.rows.map((row) => ({
      classification: String(row.error_classification || 'unknown'),
      outcome: String(row.outcome || 'unknown'),
      count: Number(row.c || 0),
    }));
  } catch {
    retryBreakdown = [];
  }

  return {
    policy,
    recentFailures,
    retryBreakdown,
  };
}

async function getOperatorObservabilitySnapshot(
  pool: pg.Pool,
  chatId: string,
  limit: number,
): Promise<OperatorObservabilitySnapshot> {
  const [agent, queue] = await Promise.all([
    getAgentChatState(pool, chatId),
    getQueueStatusSummary(pool),
  ]);

  let recentWorkflowRuns: OperatorObservabilitySnapshot['recentWorkflowRuns'] = [];
  try {
    const runsRes = await pool.query(
      `SELECT wr.id, wr.workflow_id, wr.status, wr.updated_at
       FROM workflow_runs wr
       JOIN workflows w ON w.id = wr.workflow_id
       WHERE w.chat_id = $1
       ORDER BY wr.updated_at DESC
       LIMIT $2`,
      [chatId, limit],
    );
    recentWorkflowRuns = runsRes.rows.map((row) => ({
      id: String(row.id || ''),
      workflowId: String(row.workflow_id || ''),
      status: String(row.status || 'unknown'),
      updatedAt: String(row.updated_at || ''),
    }));
  } catch {
    recentWorkflowRuns = [];
  }

  return {
    agent,
    queue,
    recentWorkflowRuns,
  };
}

async function getQueueStatusSummary(pool: pg.Pool): Promise<QueueStatusSummary> {
  let backpressureActive = false;
  try {
    const stateRes = await pool.query(
      `SELECT is_active
       FROM backpressure_state
       ORDER BY updated_at DESC
       LIMIT 1`,
    );
    backpressureActive = Boolean(stateRes.rows[0]?.is_active);
  } catch {
    backpressureActive = false;
  }

  try {
    const queueRes = await pool.query(
      `SELECT DISTINCT ON (queue_type)
         queue_type, queue_depth, depth_percentage, sampled_at
       FROM queue_metrics
       ORDER BY queue_type, sampled_at DESC`,
    );
    return {
      backpressureActive,
      queues: queueRes.rows.map((row) => ({
        queue_type: String(row.queue_type || 'unknown'),
        queue_depth: Number(row.queue_depth || 0),
        depth_percentage: row.depth_percentage !== null && row.depth_percentage !== undefined
          ? Number(row.depth_percentage)
          : null,
        sampled_at: String(row.sampled_at || ''),
      })),
    };
  } catch {
    return { backpressureActive, queues: [] };
  }
}

function formatQueueStatus(summary: QueueStatusSummary): string {
  if (summary.queues.length === 0) {
    return [
      'Queue status:',
      `backpressure: ${summary.backpressureActive ? 'active' : 'inactive'}`,
      'No queue metrics available yet.',
    ].join('\n');
  }

  const lines = summary.queues.map((q) => {
    const pct = q.depth_percentage !== null && Number.isFinite(q.depth_percentage)
      ? `${q.depth_percentage.toFixed(1)}%`
      : 'n/a';
    return `- ${q.queue_type}: depth=${q.queue_depth}, fill=${pct}, sampled_at=${q.sampled_at}`;
  });
  return [
    'Queue status:',
    `backpressure: ${summary.backpressureActive ? 'active' : 'inactive'}`,
    ...lines,
  ].join('\n');
}

type SubagentStatusRow = {
  agent_id: string;
  name: string;
  status: string;
  queued_count: number;
  delivered_count: number;
  responded_count: number;
  failed_count: number;
};

async function getSubagentStatus(pool: pg.Pool, chatId: string): Promise<SubagentStatusRow[]> {
  try {
    const res = await pool.query(
      `SELECT
         a.id AS agent_id,
         a.name,
         a.status,
         COUNT(iam.id) FILTER (WHERE iam.status = 'queued')::int AS queued_count,
         COUNT(iam.id) FILTER (WHERE iam.status = 'delivered')::int AS delivered_count,
         COUNT(iam.id) FILTER (WHERE iam.status = 'responded')::int AS responded_count,
         COUNT(iam.id) FILTER (WHERE iam.status = 'failed')::int AS failed_count
       FROM agent_sessions asn
       JOIN agents a ON a.id = asn.agent_id
       LEFT JOIN inter_agent_messages iam
         ON iam.session_id = asn.session_id
         AND (iam.from_agent = asn.agent_id OR iam.to_agent = asn.agent_id)
       WHERE asn.session_id = $1
       GROUP BY a.id, a.name, a.status
       ORDER BY a.name ASC`,
      [chatId],
    );
    return res.rows.map((row) => ({
      agent_id: String(row.agent_id || ''),
      name: String(row.name || 'agent'),
      status: String(row.status || 'unknown'),
      queued_count: Number(row.queued_count || 0),
      delivered_count: Number(row.delivered_count || 0),
      responded_count: Number(row.responded_count || 0),
      failed_count: Number(row.failed_count || 0),
    }));
  } catch {
    return [];
  }
}

function formatSubagentStatus(rows: SubagentStatusRow[]): string {
  if (rows.length === 0) {
    return 'Subagents: none mapped to this chat.';
  }
  const lines = rows.map((row) =>
    `- ${row.name} (${row.agent_id}) status=${row.status} queued=${row.queued_count} delivered=${row.delivered_count} responded=${row.responded_count} failed=${row.failed_count}`,
  );
  return ['Subagents:', ...lines].join('\n');
}

type ProseWorkflowRow = {
  id: string;
  name: string;
  version: number;
  enabled: boolean;
};

type ProsePlan = {
  workflow_id?: string;
  workflow_name?: string;
  goal?: string;
  prepared_by?: string;
  prepared_at?: string;
};

function looksLikeProseProgramRef(value: string): boolean {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  return normalized.endsWith('.prose')
    || /^https?:\/\//i.test(normalized)
    || /^[^/\s]+\/[^/\s]+$/.test(normalized);
}

async function loadProseProgram(
  programRef: string,
): Promise<{ ok: true; source: string; sourceLabel: string } | { ok: false; message: string }> {
  const normalized = String(programRef || '').trim();
  if (!normalized) {
    return { ok: false, message: 'program reference is required' };
  }
  try {
    if (/^https?:\/\//i.test(normalized)) {
      const response = await fetch(normalized);
      if (!response.ok) {
        return { ok: false, message: `remote fetch failed (${response.status})` };
      }
      return { ok: true, source: await response.text(), sourceLabel: normalized };
    }
    if (/^[^/\s]+\/[^/\s]+$/.test(normalized) && !normalized.endsWith('.prose')) {
      const remoteUrl = `https://p.prose.md/${normalized}`;
      const response = await fetch(remoteUrl);
      if (!response.ok) {
        return { ok: false, message: `handle fetch failed (${response.status})` };
      }
      return { ok: true, source: await response.text(), sourceLabel: remoteUrl };
    }
    const resolvedPath = path.isAbsolute(normalized)
      ? normalized
      : path.resolve(process.cwd(), normalized);
    return { ok: true, source: await fs.readFile(resolvedPath, 'utf8'), sourceLabel: resolvedPath };
  } catch (err) {
    return { ok: false, message: String((err as Error)?.message || err || 'failed to load program') };
  }
}

function extractQuotedValue(raw: string): string {
  const trimmed = String(raw || '').trim();
  const quote = trimmed.startsWith('"') ? '"' : trimmed.startsWith("'") ? "'" : '';
  if (quote && trimmed.endsWith(quote) && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function compileProseProgram(source: string): { ok: true; program: CompiledProseProgram } | { ok: false; message: string } {
  const lines = String(source || '').replace(/\r/g, '').split('\n');
  const title = lines.find((line) => line.trim().startsWith('# '))?.trim().replace(/^#\s+/, '') || 'OpenProse Program';
  const description = lines.find((line) => line.trim() && !line.trim().startsWith('#'))?.trim() || 'Compiled from .prose program';

  const agents = new Map<string, ProseAgentSpec>();
  const inputs = new Map<string, string>();
  const parallels: ProseParallelSpec[] = [];
  let finalSessionPrompt = '';
  let finalContextKeys: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    const inputMatch = trimmed.match(/^input\s+([A-Za-z0-9_]+)\s*:\s*(.+)$/);
    if (inputMatch) {
      inputs.set(inputMatch[1], extractQuotedValue(inputMatch[2]));
      continue;
    }

    const agentMatch = trimmed.match(/^agent\s+([A-Za-z0-9_]+)\s*:\s*$/);
    if (agentMatch) {
      const agent: ProseAgentSpec = { name: agentMatch[1] };
      for (let j = i + 1; j < lines.length; j += 1) {
        const next = lines[j];
        if (!next.startsWith('  ')) break;
        const nextTrimmed = next.trim();
        if (nextTrimmed.startsWith('model:')) agent.model = extractQuotedValue(nextTrimmed.slice('model:'.length));
        if (nextTrimmed.startsWith('prompt:')) agent.prompt = extractQuotedValue(nextTrimmed.slice('prompt:'.length));
        i = j;
      }
      agents.set(agent.name, agent);
      continue;
    }

    if (trimmed === 'parallel:') {
      for (let j = i + 1; j < lines.length; j += 1) {
        const next = lines[j];
        if (!next.startsWith('  ')) break;
        const taskMatch = next.trim().match(/^([A-Za-z0-9_]+)\s*=\s*session:\s*([A-Za-z0-9_]+)\s*$/);
        if (!taskMatch) {
          i = j;
          continue;
        }
        let prompt = '';
        for (let k = j + 1; k < lines.length; k += 1) {
          const nested = lines[k];
          if (!nested.startsWith('    ')) break;
          const nestedTrimmed = nested.trim();
          if (nestedTrimmed.startsWith('prompt:')) {
            prompt = extractQuotedValue(nestedTrimmed.slice('prompt:'.length));
          }
          j = k;
        }
        parallels.push({ variable: taskMatch[1], agent: taskMatch[2], prompt });
        i = j;
      }
      continue;
    }

    const sessionMatch = trimmed.match(/^session\s+(.+)$/);
    if (sessionMatch && !finalSessionPrompt) {
      finalSessionPrompt = extractQuotedValue(sessionMatch[1]);
      if (lines[i + 1]?.trim().startsWith('context:')) {
        const contextRaw = lines[i + 1].trim().slice('context:'.length).trim();
        finalContextKeys = contextRaw.replace(/[{}]/g, '').split(',').map((value) => value.trim()).filter(Boolean);
        i += 1;
      }
    }
  }

  if (parallels.length === 0 || !finalSessionPrompt) {
    return { ok: false, message: 'program must define at least one parallel session and one final session block' };
  }

  const steps: Array<Record<string, any>> = [];
  const edges: Array<{ from: string; to: string }> = [];
  for (const parallel of parallels) {
    const agent = agents.get(parallel.agent);
    const stepId = `prose_${parallel.variable}`;
    steps.push({
      id: stepId,
      type: 'llm_task',
      config: {
        prompt: renderProseTemplate(parallel.prompt, inputs),
        system_prompt: agent?.prompt || `OpenProse agent ${parallel.agent}`,
        ...(agent?.model ? { model: agent.model } : {}),
        output_key: parallel.variable,
      },
      outputs: {
        [parallel.variable]: parallel.variable,
      },
    });
  }

  const finalPrompt = [
    finalSessionPrompt,
    finalContextKeys.length > 0
      ? `\n\nContext:\n${finalContextKeys.map((key) => `${key}: \${${key}}`).join('\n')}`
      : '',
  ].join('');
  steps.push({
    id: 'prose_final',
    type: 'llm_task',
    config: {
      prompt: renderProseTemplate(finalPrompt, inputs),
      output_key: 'final_answer',
    },
    outputs: {
      final_answer: 'final_answer',
    },
  });

  for (const parallel of parallels) {
    edges.push({ from: `prose_${parallel.variable}`, to: 'prose_final' });
  }

  return {
    ok: true,
    program: {
      title,
      description,
      steps,
      edges,
    },
  };
}

function renderProseTemplate(template: string, inputs: Map<string, string>): string {
  let rendered = String(template || '');
  for (const [key, value] of inputs.entries()) {
    rendered = rendered.replaceAll(`{${key}}`, value);
  }
  return rendered;
}

function compileIssueFixProgram(issueSummary: string): CompiledProseProgram {
  const issue = String(issueSummary || '').trim();
  const patchToolName = String(process.env.SVEN_OPENHANDS_PATCH_TOOL || 'shell.exec').trim() || 'shell.exec';
  const testToolName = String(process.env.SVEN_OPENHANDS_TEST_TOOL || patchToolName).trim() || patchToolName;
  return {
    title: `Issue Fix: ${issue.slice(0, 64)}`,
    description: 'Deterministic OpenHands-style issue-to-patch loop (issue -> patch -> tests -> summary).',
    steps: [
      {
        id: 'issue_triage',
        type: 'llm_task',
        config: {
          prompt: `Analyze this issue and produce a concise patch strategy with acceptance checks:\n${issue}`,
          output_key: 'issue_plan',
        },
        outputs: {
          issue_plan: 'issue_plan',
        },
      },
      {
        id: 'patch_apply',
        type: 'tool_call',
        config: {
          tool_name: patchToolName,
          params: {
            command: "echo '[SVEN_OPENHANDS_W02_PATCH_PLACEHOLDER]'",
          },
        },
        outputs: {
          patch_result: 'patch_result',
        },
      },
      {
        id: 'test_run',
        type: 'tool_call',
        config: {
          tool_name: testToolName,
          params: {
            command: "echo '[SVEN_OPENHANDS_W02_TEST_PLACEHOLDER]'",
          },
        },
        outputs: {
          test_result: 'test_result',
        },
      },
      {
        id: 'patch_summary',
        type: 'llm_task',
        config: {
          prompt: [
            'Summarize patch + test outcomes for operators.',
            'Issue:',
            issue,
            '',
            'Patch result:',
            '${patch_result}',
            '',
            'Test result:',
            '${test_result}',
            '',
            'Issue plan:',
            '${issue_plan}',
          ].join('\n'),
          output_key: 'final_answer',
        },
        outputs: {
          final_answer: 'final_answer',
        },
      },
    ],
    edges: [
      { from: 'issue_triage', to: 'patch_apply' },
      { from: 'patch_apply', to: 'test_run' },
      { from: 'test_run', to: 'patch_summary' },
    ],
  };
}

async function createCompiledProseWorkflow(
  pool: pg.Pool,
  chatId: string,
  actorIdentityId: string,
  compiled: CompiledProseProgram,
  sourceLabel: string,
): Promise<ProseWorkflowRow> {
  const now = new Date().toISOString();
  const workflowId = `wf_${uuidv7().replace(/-/g, '').slice(0, 16)}`;
  const versionId = `wfv_${uuidv7().replace(/-/g, '').slice(0, 16)}`;
  const auditId = `wfa_${uuidv7().replace(/-/g, '').slice(0, 16)}`;
  const name = `${compiled.title} [OpenProse]`;
  await pool.query(
    `INSERT INTO workflows (id, chat_id, name, description, version, steps, edges, created_by, is_draft, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 1, $5::jsonb, $6::jsonb, $7, FALSE, $8, $8)`,
    [workflowId, chatId, name, `${compiled.description}\nsource: ${sourceLabel}`, JSON.stringify(compiled.steps), JSON.stringify(compiled.edges), actorIdentityId, now],
  );
  await pool.query(
    `INSERT INTO workflow_versions (id, workflow_id, version, steps, edges, change_summary, created_by, created_at)
     VALUES ($1, $2, 1, $3::jsonb, $4::jsonb, $5, $6, $7)`,
    [versionId, workflowId, JSON.stringify(compiled.steps), JSON.stringify(compiled.edges), `Compiled from OpenProse source: ${sourceLabel}`, actorIdentityId, now],
  );
  await pool.query(
    `INSERT INTO workflow_audit_log (id, workflow_id, action, actor_id, details, created_at)
     VALUES ($1, $2, 'created', $3, $4::jsonb, $5)`,
    [auditId, workflowId, actorIdentityId, JSON.stringify({ source: 'chat.prose.compile', prose_source: sourceLabel }), now],
  );
  return {
    id: workflowId,
    name,
    version: 1,
    enabled: true,
  };
}

async function listChatWorkflows(pool: pg.Pool, chatId: string, limit: number): Promise<ProseWorkflowRow[]> {
  try {
    const res = await pool.query(
      `SELECT id, name, version, enabled
       FROM workflows
       WHERE chat_id = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      [chatId, limit],
    );
    return res.rows.map((row) => ({
      id: String(row.id || ''),
      name: String(row.name || ''),
      version: Number(row.version || 1),
      enabled: Boolean(row.enabled),
    })).filter((row) => row.id.length > 0);
  } catch {
    return [];
  }
}

async function resolveChatWorkflow(pool: pg.Pool, chatId: string, ref: string): Promise<ProseWorkflowRow | null> {
  const normalized = String(ref || '').trim();
  if (!normalized) return null;
  try {
    const exactById = await pool.query(
      `SELECT id, name, version, enabled
       FROM workflows
       WHERE chat_id = $1 AND id = $2
       LIMIT 1`,
      [chatId, normalized],
    );
    if (exactById.rows.length > 0) {
      return {
        id: String(exactById.rows[0].id || ''),
        name: String(exactById.rows[0].name || ''),
        version: Number(exactById.rows[0].version || 1),
        enabled: Boolean(exactById.rows[0].enabled),
      };
    }

    const exactByName = await pool.query(
      `SELECT id, name, version, enabled
       FROM workflows
       WHERE chat_id = $1 AND LOWER(name) = LOWER($2)
       ORDER BY updated_at DESC
       LIMIT 1`,
      [chatId, normalized],
    );
    if (exactByName.rows.length > 0) {
      return {
        id: String(exactByName.rows[0].id || ''),
        name: String(exactByName.rows[0].name || ''),
        version: Number(exactByName.rows[0].version || 1),
        enabled: Boolean(exactByName.rows[0].enabled),
      };
    }

    const partialByName = await pool.query(
      `SELECT id, name, version, enabled
       FROM workflows
       WHERE chat_id = $1 AND LOWER(name) LIKE LOWER($2)
       ORDER BY updated_at DESC
       LIMIT 1`,
      [chatId, `%${normalized}%`],
    );
    if (partialByName.rows.length > 0) {
      return {
        id: String(partialByName.rows[0].id || ''),
        name: String(partialByName.rows[0].name || ''),
        version: Number(partialByName.rows[0].version || 1),
        enabled: Boolean(partialByName.rows[0].enabled),
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function setChatProsePlan(pool: pg.Pool, chatId: string, plan: ProsePlan): Promise<void> {
  await pool.query(
    `INSERT INTO settings_global (key, value, updated_at, updated_by)
     VALUES ($1, $2::jsonb, NOW(), 'system')
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = 'system'`,
    [`chat.prose.plan.${chatId}`, JSON.stringify(plan)],
  );
}

async function getChatProsePlan(pool: pg.Pool, chatId: string): Promise<ProsePlan | null> {
  try {
    const res = await pool.query(
      `SELECT value FROM settings_global WHERE key = $1 LIMIT 1`,
      [`chat.prose.plan.${chatId}`],
    );
    if (res.rows.length === 0) return null;
    const parsed = parseSettingValue(res.rows[0].value);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as ProsePlan;
  } catch {
    return null;
  }
}

type ProseExecutionRun = {
  runId: string;
  planId: string;
  traceSteps: string[];
};

type ParityRunContext = {
  lane: 'OH-W01' | 'OH-W02';
  task: string;
  traceSteps: string[];
  planActions: Array<{ kind: string; action: string }>;
};

type ProseResumeResult =
  | { ok: true; runId: string; resumeToken: string; previousStatus: string; traceSteps: string[] }
  | { ok: false; message: string };

type ProseRollbackResult =
  | { ok: true; runId: string; rollbackToken: string; previousStatus: string; reason: string; traceSteps: string[] }
  | { ok: false; message: string };

async function createProseWorkflowRun(
  pool: pg.Pool,
  chatId: string,
  workflow: ProseWorkflowRow,
  actorIdentityId: string,
  goal: string,
  triggerMessageId: string,
  publishWorkflowExecute?: (runId: string) => Promise<void> | void,
  parityContext?: ParityRunContext,
): Promise<ProseExecutionRun> {
  if (!publishWorkflowExecute) {
    throw new Error('workflow execute publisher is not configured');
  }
  const runId = `wfr_${uuidv7().replace(/-/g, '').slice(0, 16)}`;
  const planId = `plan_${uuidv7().replace(/-/g, '').slice(0, 16)}`;
  const auditId = `wfa_${uuidv7().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();
  const laneContext = parityContext || {
    lane: 'OH-W01' as const,
    task: goal.trim().length > 0 ? goal.trim() : `Run workflow ${workflow.name}`,
    traceSteps: ['task_received', 'plan_resolved', 'dispatch_published'],
    planActions: [
      { kind: 'task', action: 'capture_task' },
      { kind: 'plan', action: 'resolve_execution_plan' },
      { kind: 'execute', action: 'publish_workflow_dispatch' },
      { kind: 'summarize', action: 'emit_operator_summary' },
    ],
  };
  const traceSteps = laneContext.traceSteps;
  const executionTrace = traceSteps.map((step, index) => ({
    order: index + 1,
    step,
    status: 'completed',
    at: now,
  }));
  const taskText = laneContext.task.trim().length > 0
    ? laneContext.task.trim()
    : (goal.trim().length > 0 ? goal.trim() : `Run workflow ${workflow.name}`);
  const openhandsPlan = {
    lane: laneContext.lane,
    plan_id: planId,
    task: taskText,
    trace_mode: 'deterministic',
    steps: laneContext.planActions.map((planStep, index) => ({
      order: index + 1,
      kind: planStep.kind,
      action: planStep.action,
      status: 'planned',
    })),
    execution_trace: executionTrace,
  };
  const inputVariables = {
    prose_goal: goal,
    prose_chat_id: chatId,
    prose_started_at: now,
    [laneContext.lane === 'OH-W02' ? 'openhands_w02' : 'openhands_w01']: openhandsPlan,
  };
  await pool.query(
    `INSERT INTO workflow_runs
       (id, workflow_id, workflow_version, status, started_at, triggered_by, trigger_message_id, input_variables, created_at, updated_at)
     VALUES ($1, $2, $3, 'running', $4, $5, $6, $7::jsonb, $4, $4)`,
    [runId, workflow.id, workflow.version, now, actorIdentityId || null, triggerMessageId || null, JSON.stringify(inputVariables)],
  );
  await pool.query(
    `INSERT INTO workflow_audit_log (id, workflow_id, run_id, action, actor_id, details, created_at)
     VALUES ($1, $2, $3, 'executed', $4, $5::jsonb, $6)`,
    [
      auditId,
      workflow.id,
      runId,
      actorIdentityId,
      JSON.stringify({
        source: 'chat.prose',
        goal,
        [laneContext.lane === 'OH-W02' ? 'openhands_w02' : 'openhands_w01']: {
          plan_id: planId,
          task: taskText,
          trace_mode: 'deterministic',
          trace_steps: traceSteps,
        },
      }),
      now,
    ],
  );
  await publishWorkflowExecute(runId);
  return {
    runId,
    planId,
    traceSteps,
  };
}

async function resumeProseWorkflowRun(
  pool: pg.Pool,
  chatId: string,
  runId: string,
  actorIdentityId: string,
  publishWorkflowExecute?: (runId: string) => Promise<void> | void,
): Promise<ProseResumeResult> {
  if (!publishWorkflowExecute) {
    return { ok: false, message: 'Workflow execution is unavailable: dispatch publisher is not configured.' };
  }

  const runRes = await pool.query(
    `SELECT wr.id, wr.workflow_id, wr.status
       FROM workflow_runs wr
       JOIN workflows w ON w.id = wr.workflow_id
      WHERE wr.id = $1
        AND w.chat_id = $2
      LIMIT 1`,
    [runId, chatId],
  );
  if (runRes.rows.length === 0) {
    return { ok: false, message: `Workflow run "${runId}" not found in this chat.` };
  }
  const row = runRes.rows[0];
  const previousStatus = String(row.status || 'unknown');
  const resumableStatuses = new Set(['paused', 'failed', 'error']);
  if (!resumableStatuses.has(previousStatus)) {
    return {
      ok: false,
      message: `Workflow run "${runId}" is not resumable from status "${previousStatus}".`,
    };
  }

  const now = new Date().toISOString();
  const resumeToken = `resume_${uuidv7().replace(/-/g, '').slice(0, 16)}`;
  const traceSteps = ['interruption_detected', 'state_restored', 'dispatch_resumed'];
  const executionTrace = traceSteps.map((step, index) => ({
    order: index + 1,
    step,
    status: 'completed',
    at: now,
  }));

  await pool.query(
    `UPDATE workflow_runs
        SET status = 'pending',
            error_message = NULL,
            input_variables = COALESCE(input_variables, '{}'::jsonb) || $2::jsonb,
            updated_at = $3
      WHERE id = $1`,
    [
      runId,
      JSON.stringify({
        openhands_w04: {
          lane: 'OH-W04',
          resume_token: resumeToken,
          previous_status: previousStatus,
          trace_mode: 'deterministic',
          trace_steps: traceSteps,
          execution_trace: executionTrace,
        },
      }),
      now,
    ],
  );

  await pool.query(
    `INSERT INTO workflow_audit_log (id, workflow_id, run_id, action, actor_id, details, created_at)
     VALUES ($1, $2, $3, 'resumed', $4, $5::jsonb, $6)`,
    [
      `wfa_${uuidv7().replace(/-/g, '').slice(0, 16)}`,
      String(row.workflow_id),
      runId,
      actorIdentityId,
      JSON.stringify({
        source: 'chat.prose.resume',
        openhands_w04: {
          lane: 'OH-W04',
          resume_token: resumeToken,
          previous_status: previousStatus,
          trace_steps: traceSteps,
        },
      }),
      now,
    ],
  );

  await publishWorkflowExecute(runId);
  return {
    ok: true,
    runId,
    resumeToken,
    previousStatus,
    traceSteps,
  };
}

async function rollbackProseWorkflowRun(
  pool: pg.Pool,
  chatId: string,
  runId: string,
  actorIdentityId: string,
  reason: string,
): Promise<ProseRollbackResult> {
  const runRes = await pool.query(
    `SELECT wr.id, wr.workflow_id, wr.status
       FROM workflow_runs wr
       JOIN workflows w ON w.id = wr.workflow_id
      WHERE wr.id = $1
        AND w.chat_id = $2
      LIMIT 1`,
    [runId, chatId],
  );
  if (runRes.rows.length === 0) {
    return { ok: false, message: `Workflow run "${runId}" not found in this chat.` };
  }

  const row = runRes.rows[0];
  const previousStatus = String(row.status || 'unknown');
  const rollbackAllowedStatuses = new Set(['running', 'pending', 'paused', 'failed', 'error']);
  if (!rollbackAllowedStatuses.has(previousStatus)) {
    return {
      ok: false,
      message: `Workflow run "${runId}" cannot be rolled back from status "${previousStatus}".`,
    };
  }

  const now = new Date().toISOString();
  const rollbackToken = `rollback_${uuidv7().replace(/-/g, '').slice(0, 16)}`;
  const normalizedReason = reason.trim();
  const traceSteps = ['failure_or_risk_detected', 'rollback_prepared', 'rollback_applied'];
  const executionTrace = traceSteps.map((step, index) => ({
    order: index + 1,
    step,
    status: 'completed',
    at: now,
  }));

  await pool.query(
    `UPDATE workflow_runs
        SET status = 'cancelled',
            error_message = COALESCE(error_message, 'rollback_requested'),
            input_variables = COALESCE(input_variables, '{}'::jsonb) || $2::jsonb,
            updated_at = $3
      WHERE id = $1`,
    [
      runId,
      JSON.stringify({
        openhands_w03: {
          lane: 'OH-W03',
          rollback_token: rollbackToken,
          previous_status: previousStatus,
          reason: normalizedReason,
          trace_mode: 'deterministic',
          trace_steps: traceSteps,
          execution_trace: executionTrace,
        },
      }),
      now,
    ],
  );

  await pool.query(
    `INSERT INTO workflow_audit_log (id, workflow_id, run_id, action, actor_id, details, created_at)
     VALUES ($1, $2, $3, 'rollback', $4, $5::jsonb, $6)`,
    [
      `wfa_${uuidv7().replace(/-/g, '').slice(0, 16)}`,
      String(row.workflow_id),
      runId,
      actorIdentityId,
      JSON.stringify({
        source: 'chat.prose.rollback',
        openhands_w03: {
          lane: 'OH-W03',
          rollback_token: rollbackToken,
          previous_status: previousStatus,
          reason: normalizedReason,
          trace_steps: traceSteps,
        },
      }),
      now,
    ],
  );

  return {
    ok: true,
    runId,
    rollbackToken,
    previousStatus,
    reason: normalizedReason,
    traceSteps,
  };
}

async function getChatElevatedFlag(pool: pg.Pool, chatId: string): Promise<boolean> {
  try {
    const res = await pool.query(
      `SELECT value FROM settings_global WHERE key = $1 LIMIT 1`,
      [`chat.elevated.${chatId}`],
    );
    if (res.rows.length === 0) return false;
    return Boolean(parseSettingValue(res.rows[0].value));
  } catch {
    return false;
  }
}

async function setChatElevatedFlag(pool: pg.Pool, chatId: string, enabled: boolean): Promise<boolean> {
  try {
    await pool.query(
      `INSERT INTO settings_global (key, value, updated_at, updated_by)
       VALUES ($1, $2::jsonb, NOW(), 'system')
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = 'system'`,
      [`chat.elevated.${chatId}`, JSON.stringify(enabled)],
    );
    return true;
  } catch {
    return false;
  }
}

async function getChatSelfChatEnabled(pool: pg.Pool, chatId: string): Promise<boolean> {
  try {
    const res = await pool.query(
      `SELECT value FROM settings_global WHERE key = $1 LIMIT 1`,
      [`chat.selfchat.${chatId}`],
    );
    if (res.rows.length === 0) return false;
    return Boolean(parseSettingValue(res.rows[0].value));
  } catch {
    return false;
  }
}

async function setChatSelfChatEnabled(pool: pg.Pool, chatId: string, enabled: boolean): Promise<boolean> {
  try {
    await pool.query(
      `INSERT INTO settings_global (key, value, updated_at, updated_by)
       VALUES ($1, $2::jsonb, NOW(), 'system')
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = 'system'`,
      [`chat.selfchat.${chatId}`, JSON.stringify(enabled)],
    );
    return true;
  } catch {
    return false;
  }
}

async function getConfigValueForCommand(
  pool: pg.Pool,
  chatId: string,
  key: string,
): Promise<string | boolean | undefined> {
  const settings = await getSessionSettingsSafe(pool, chatId);
  switch (key) {
    case 'think_level':
      return settings.think_level || 'default';
    case 'verbose':
      return Boolean(settings.verbose);
    case 'usage_mode':
      return settings.usage_mode || 'off';
    case 'model_name':
      return settings.model_name || 'auto';
    case 'profile_name':
      return settings.profile_name || 'default';
    case 'rag_enabled':
      return settings.rag_enabled !== false;
    case 'elevated':
      return getChatElevatedFlag(pool, chatId);
    default:
      return undefined;
  }
}

async function setConfigValueFromCommand(
  pool: pg.Pool,
  chatId: string,
  userId: string,
  key: string,
  rawValue: string,
): Promise<{ ok: boolean; message: string }> {
  switch (key) {
    case 'think_level': {
      const value = rawValue.toLowerCase();
      if (!['off', 'low', 'medium', 'high'].includes(value)) {
        return { ok: false, message: 'think_level must be one of: off, low, medium, high' };
      }
      const ok = await setSessionSettingThinkLevel(pool, chatId, value);
      return { ok, message: ok ? `think_level set to ${value}` : 'Failed to set think_level' };
    }
    case 'verbose': {
      const parsed = parseBooleanArg(rawValue);
      if (parsed === null) return { ok: false, message: 'verbose must be true/false' };
      const ok = await setSessionSettingVerbose(pool, chatId, parsed);
      return { ok, message: ok ? `verbose set to ${parsed}` : 'Failed to set verbose' };
    }
    case 'usage_mode': {
      const value = rawValue.toLowerCase();
      if (!['off', 'tokens', 'full'].includes(value)) {
        return { ok: false, message: 'usage_mode must be one of: off, tokens, full' };
      }
      const ok = await setSessionSettingUsageMode(pool, chatId, value);
      return { ok, message: ok ? `usage_mode set to ${value}` : 'Failed to set usage_mode' };
    }
    case 'model_name': {
      const ok = await setSessionSettingModelName(pool, chatId, rawValue);
      return { ok, message: ok ? `model_name set to ${rawValue}` : 'Failed to set model_name' };
    }
    case 'profile_name': {
      const value = rawValue.toLowerCase();
      if (!['gaming', 'balanced', 'performance'].includes(value)) {
        return { ok: false, message: 'profile_name must be one of: gaming, balanced, performance' };
      }
      const ok = await setSessionSettingProfileName(pool, chatId, value);
      return { ok, message: ok ? `profile_name set to ${value}` : 'Failed to set profile_name' };
    }
    case 'rag_enabled': {
      const parsed = parseBooleanArg(rawValue);
      if (parsed === null) return { ok: false, message: 'rag_enabled must be true/false' };
      const ok = await setSessionSettingRagEnabled(pool, chatId, parsed);
      return { ok, message: ok ? `rag_enabled set to ${parsed}` : 'Failed to set rag_enabled' };
    }
    case 'elevated': {
      const parsed = parseBooleanArg(rawValue);
      if (parsed === null) return { ok: false, message: 'elevated must be true/false' };
      const admin = await isAdminUser(pool, userId);
      if (!admin) return { ok: false, message: 'Only admins can change elevated mode.' };
      const ok = await setChatElevatedFlag(pool, chatId, parsed);
      return { ok, message: ok ? `elevated set to ${parsed}` : 'Failed to set elevated' };
    }
    default:
      return { ok: false, message: `Unsupported key "${key}"` };
  }
}

function parseBooleanArg(raw: string): boolean | null {
  const value = String(raw || '').trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(value)) return true;
  if (['false', '0', 'no', 'off'].includes(value)) return false;
  return null;
}

async function listSessionAgentIds(pool: pg.Pool, chatId: string): Promise<string[]> {
  try {
    const res = await pool.query(
      `SELECT agent_id
       FROM agent_sessions
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [chatId],
    );
    return res.rows.map((row) => String(row.agent_id || '')).filter(Boolean);
  } catch {
    return [];
  }
}

async function queueInterAgentMessage(
  pool: pg.Pool,
  chatId: string,
  userId: string,
  targetAgentId: string,
  message: string,
): Promise<{ ok: boolean; message: string }> {
  const agentIds = await listSessionAgentIds(pool, chatId);
  if (agentIds.length === 0) {
    return { ok: false, message: 'No subagents are mapped to this chat.' };
  }
  if (!agentIds.includes(targetAgentId)) {
    return { ok: false, message: `Agent "${targetAgentId}" is not mapped to this chat.` };
  }

  const fromAgent = agentIds.find((id) => id !== targetAgentId) || targetAgentId;
  try {
    const id = uuidv7();
    await pool.query(
      `INSERT INTO inter_agent_messages
       (id, from_agent, to_agent, session_id, message, status, control_flags, created_at)
       VALUES ($1, $2, $3, $4, $5, 'queued', $6::jsonb, NOW())`,
      [id, fromAgent, targetAgentId, chatId, message, JSON.stringify({ initiator_user_id: userId })],
    );
    return { ok: true, message: `Message queued to ${targetAgentId} (from ${fromAgent}).` };
  } catch {
    return { ok: false, message: 'Failed to queue inter-agent message (agent schema unavailable).' };
  }
}

async function setSubagentSteerInstruction(
  pool: pg.Pool,
  chatId: string,
  target: string,
  instruction: string,
  userId: string,
): Promise<{ ok: boolean; message: string }> {
  const ids = await listSessionAgentIds(pool, chatId);
  if (ids.length === 0) {
    return { ok: false, message: 'No subagents are mapped to this chat.' };
  }

  const targetIds = target.toLowerCase() === 'all' ? ids : ids.filter((id) => id === target);
  if (targetIds.length === 0) {
    return { ok: false, message: `Agent "${target}" is not mapped to this chat.` };
  }

  try {
    await pool.query(
      `UPDATE agent_sessions
       SET routing_rules = COALESCE(routing_rules, '{}'::jsonb) || $3::jsonb
       WHERE session_id = $1
         AND agent_id = ANY($2::text[])`,
      [
        chatId,
        targetIds,
        JSON.stringify({
          steer_instruction: instruction,
          steer_updated_by: userId,
          steer_updated_at: new Date().toISOString(),
        }),
      ],
    );
    return { ok: true, message: `Steering instruction applied to ${targetIds.length} subagent(s).` };
  } catch {
    return { ok: false, message: 'Failed to apply steering instruction (agent schema unavailable).' };
  }
}

async function killSubagentForChat(
  pool: pg.Pool,
  chatId: string,
  targetAgentId: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await pool.query(
      `DELETE FROM agent_sessions
       WHERE session_id = $1
         AND agent_id = $2
       RETURNING agent_id`,
      [chatId, targetAgentId],
    );
    if (res.rows.length === 0) {
      return { ok: false, message: `Agent "${targetAgentId}" not found in this chat.` };
    }
    return { ok: true, message: `Subagent ${targetAgentId} removed from this chat.` };
  } catch {
    return { ok: false, message: 'Failed to kill subagent (agent schema unavailable).' };
  }
}
