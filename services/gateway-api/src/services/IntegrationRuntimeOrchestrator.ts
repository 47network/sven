import { spawn } from 'node:child_process';

export type IntegrationRuntimeAction = 'deploy' | 'stop';
export type IntegrationRuntimeProbeAction = 'status';

export type IntegrationRuntimeExecuteParams = {
  action: IntegrationRuntimeAction | IntegrationRuntimeProbeAction;
  integrationType: string;
  organizationId: string;
  runtimeMode: 'container' | 'local_worker';
  imageRef?: string | null;
  storagePath?: string | null;
  networkScope?: string | null;
};

export type IntegrationRuntimeExecuteResult = {
  executed: boolean;
  ok: boolean;
  configured?: boolean;
  command?: string;
  output?: string;
  error?: string;
};

export type IntegrationRuntimeHookReadiness = {
  executionEnabled: boolean;
  deployConfigured: boolean;
  stopConfigured: boolean;
  statusConfigured: boolean;
};

function normalizeTypeEnvKey(integrationType: string): string {
  return integrationType.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    const token = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    out = out.replace(token, value);
  }
  return out;
}

function parseCommandArgs(command: string): { commandPath: string; args: string[]; error?: string } {
  const source = String(command || '').trim();
  if (!source) {
    return { commandPath: '', args: [], error: 'Runtime command template is empty' };
  }
  if (source.includes('\n') || source.includes('\r')) {
    return { commandPath: '', args: [], error: 'Runtime command template must be single-line' };
  }
  if (/\{\{[^}]+\}\}/.test(source)) {
    return { commandPath: '', args: [], error: 'Runtime command template contains unresolved placeholders' };
  }

  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaping = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (escaping) {
      current += ch;
      escaping = false;
      continue;
    }
    if (ch === '\\') {
      escaping = true;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }

  if (escaping) {
    current += '\\';
  }
  if (quote) {
    return { commandPath: '', args: [], error: 'Runtime command template contains unbalanced quotes' };
  }
  if (current) tokens.push(current);
  if (tokens.length === 0) {
    return { commandPath: '', args: [], error: 'Runtime command template is empty' };
  }
  return {
    commandPath: tokens[0],
    args: tokens.slice(1),
  };
}

function runCommand(
  commandPath: string,
  args: string[],
  timeoutMs: number,
  killGraceMs: number,
): Promise<{ ok: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn(commandPath, args, {
      shell: false,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let hardKillTimer: ReturnType<typeof setTimeout> | null = null;
    let forceSettleTimer: ReturnType<typeof setTimeout> | null = null;

    const finalize = (result: { ok: boolean; output: string; error?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (hardKillTimer) clearTimeout(hardKillTimer);
      if (forceSettleTimer) clearTimeout(forceSettleTimer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGTERM');
      } catch {
        // best effort
      }
      hardKillTimer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          try {
            child.kill();
          } catch {
            // best effort
          }
        }
      }, killGraceMs);
      forceSettleTimer = setTimeout(() => {
        const output = `${stdout}\n${stderr}`.trim();
        finalize({
          ok: false,
          output,
          error: `RUNTIME_CMD_TIMEOUT: command exceeded ${String(timeoutMs)}ms`,
        });
      }, killGraceMs + 1_000);
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (err) => {
      const output = `${stdout}\n${stderr}`.trim();
      if (timedOut) {
        finalize({
          ok: false,
          output,
          error: `RUNTIME_CMD_TIMEOUT: command exceeded ${String(timeoutMs)}ms`,
        });
        return;
      }
      finalize({
        ok: false,
        output,
        error: String(err),
      });
    });
    child.on('close', (code, signal) => {
      const output = `${stdout}\n${stderr}`.trim();
      if (timedOut) {
        finalize({
          ok: false,
          output,
          error: `RUNTIME_CMD_TIMEOUT: command exceeded ${String(timeoutMs)}ms (code=${String(code)}, signal=${String(signal)})`,
        });
        return;
      }
      if (code === 0) {
        finalize({ ok: true, output });
        return;
      }
      finalize({
        ok: false,
        output,
        error: `Command exited with code ${String(code)}`,
      });
    });
  });
}

export class IntegrationRuntimeOrchestrator {
  private readonly executionEnabled = String(process.env.SVEN_INTEGRATION_RUNTIME_EXEC_ENABLED || '').toLowerCase() === 'true';
  private readonly timeoutMs = Math.max(5_000, Number(process.env.SVEN_INTEGRATION_RUNTIME_EXEC_TIMEOUT_MS || 120_000));
  private readonly killGraceMs = Math.max(500, Number(process.env.SVEN_INTEGRATION_RUNTIME_EXEC_KILL_GRACE_MS || 3_000));

  async execute(params: IntegrationRuntimeExecuteParams): Promise<IntegrationRuntimeExecuteResult> {
    if (!this.executionEnabled) {
      return {
        executed: false,
        ok: true,
      };
    }

    const vars: Record<string, string> = {
      action: params.action,
      integration_type: params.integrationType,
      organization_id: params.organizationId,
      runtime_mode: params.runtimeMode,
      image_ref: String(params.imageRef || ''),
      storage_path: String(params.storagePath || ''),
      network_scope: String(params.networkScope || ''),
    };

    const selected = this.resolveCommand(params.action, params.integrationType);
    if (!selected) {
      return {
        executed: false,
        ok: false,
        configured: false,
        error: `No runtime command configured for ${params.action}:${params.integrationType}`,
      };
    }

    const command = renderTemplate(selected, vars);
    const parsed = parseCommandArgs(command);
    if (parsed.error) {
      return {
        executed: false,
        ok: false,
        configured: true,
        command,
        error: parsed.error,
      };
    }
    const result = await runCommand(parsed.commandPath, parsed.args, this.timeoutMs, this.killGraceMs);
    return {
      executed: true,
      ok: result.ok,
      configured: true,
      command,
      output: result.output,
      error: result.error,
    };
  }

  getHookReadiness(integrationType: string): IntegrationRuntimeHookReadiness {
    return {
      executionEnabled: this.executionEnabled,
      deployConfigured: this.resolveCommand('deploy', integrationType).length > 0,
      stopConfigured: this.resolveCommand('stop', integrationType).length > 0,
      statusConfigured: this.resolveCommand('status', integrationType).length > 0,
    };
  }

  private resolveCommand(
    action: IntegrationRuntimeAction | IntegrationRuntimeProbeAction,
    integrationType: string,
  ): string {
    const envKey = normalizeTypeEnvKey(integrationType);
    const explicitTypeCmd =
      action === 'deploy'
        ? process.env[`SVEN_INTEGRATION_DEPLOY_CMD_${envKey}`]
        : action === 'stop'
          ? process.env[`SVEN_INTEGRATION_STOP_CMD_${envKey}`]
          : process.env[`SVEN_INTEGRATION_STATUS_CMD_${envKey}`];
    const template =
      action === 'deploy'
        ? process.env.SVEN_INTEGRATION_DEPLOY_CMD_TEMPLATE
        : action === 'stop'
          ? process.env.SVEN_INTEGRATION_STOP_CMD_TEMPLATE
          : process.env.SVEN_INTEGRATION_STATUS_CMD_TEMPLATE;
    return String(explicitTypeCmd || template || '').trim();
  }
}
