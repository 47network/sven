import * as vscode from 'vscode';
import { SvenApiClient } from './api-client';
import { buildCodebaseContext } from './codebase-context';

const PARTICIPANT_ID = 'sven.chat';

interface SvenChatResult extends vscode.ChatResult {
  metadata?: {
    command?: string;
  };
}

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('Sven AI');
  outputChannel.appendLine('Sven AI extension activated');

  const api = new SvenApiClient(() => {
    const config = vscode.workspace.getConfiguration('sven');
    return {
      gatewayUrl: config.get<string>('gatewayUrl') || 'http://localhost:3000',
      apiKey: config.get<string>('extensionApiKey') || 'sven-ext-47-dev',
    };
  });

  const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, async (
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<SvenChatResult> => {
    const command = request.command;

    if (command === 'status') {
      return handleStatus(api, stream, token);
    }

    if (command === 'soul') {
      return handleSoul(api, stream, token);
    }

    if (command === 'heal') {
      return handleHeal(stream, token);
    }

    if (command === 'codebase') {
      return handleCodebase(request, stream, token);
    }

    if (command === 'deploy') {
      return handleDeploy(api, stream, token);
    }

    // Default: general chat with Sven — combine codebase awareness + live state
    return handleChat(api, request, context, stream, token);
  });

  participant.iconPath = vscode.Uri.joinPath(
    vscode.extensions.getExtension('47network.sven-copilot')?.extensionUri
      ?? vscode.Uri.file(''),
    'media',
    'sven-icon.png',
  );

  context.subscriptions.push(participant, outputChannel);
}

async function handleStatus(
  api: SvenApiClient,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
): Promise<SvenChatResult> {
  stream.progress('Fetching Sven\'s live trading status...');

  try {
    const status = await api.getTradingStatus();
    if (token.isCancellationRequested) return { metadata: { command: 'status' } };

    stream.markdown('## Sven Trading Status\n\n');
    stream.markdown(`**Balance:** ${status.account?.balance?.toFixed(2) ?? 'N/A'} 47T\n\n`);
    stream.markdown(`**Daily P&L:** ${status.dailyPnl >= 0 ? '+' : ''}${status.dailyPnl?.toFixed(2) ?? '0.00'} 47T (${status.dailyTradeCount ?? 0} trades)\n\n`);
    stream.markdown(`**Total P&L:** ${status.totalPnl >= 0 ? '+' : ''}${status.totalPnl?.toFixed(2) ?? '0.00'} 47T\n\n`);
    stream.markdown(`**Loop:** ${status.loopRunning ? '🟢 ACTIVE' : '🔴 STOPPED'} — iteration #${status.loopIterations ?? 0}\n\n`);

    if (status.positions?.length > 0) {
      stream.markdown('### Open Positions\n\n');
      stream.markdown('| Symbol | Side | Entry | Unrealized P&L |\n|--------|------|-------|----------------|\n');
      for (const pos of status.positions) {
        stream.markdown(`| ${pos.symbol} | ${pos.side} | ${pos.entryPrice?.toFixed(4)} | ${pos.unrealizedPnl?.toFixed(2)} 47T |\n`);
      }
      stream.markdown('\n');
    } else {
      stream.markdown('**Positions:** None open\n\n');
    }

    if (status.goals?.length > 0) {
      stream.markdown('### Goal Milestones\n\n');
      for (const goal of status.goals) {
        const icon = goal.achieved ? '✅' : '⬜';
        stream.markdown(`${icon} **${goal.name}** — ${goal.achieved ? 'Achieved!' : `${goal.targetBalance?.toLocaleString()} 47T needed`}\n\n`);
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    stream.markdown(`⚠️ Could not fetch trading status: ${message}\n\nMake sure \`sven.gatewayUrl\` and \`sven.extensionApiKey\` are configured in settings.`);
  }

  return { metadata: { command: 'status' } };
}

async function handleSoul(
  api: SvenApiClient,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
): Promise<SvenChatResult> {
  stream.progress('Loading Sven\'s active soul...');

  try {
    const soul = await api.getActiveSoul();
    if (token.isCancellationRequested) return { metadata: { command: 'soul' } };

    stream.markdown('## Sven\'s Active Soul\n\n');
    stream.markdown(`**Slug:** ${soul.slug}\n**Version:** ${soul.version}\n\n`);
    stream.markdown('---\n\n');
    stream.markdown(soul.content || '_No content loaded_');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    stream.markdown(`⚠️ Could not load soul: ${message}`);
  }

  return { metadata: { command: 'soul' } };
}

async function handleHeal(
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
): Promise<SvenChatResult> {
  stream.progress('Running self-healing diagnostics...');

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    stream.markdown('⚠️ No workspace open. Open the Sven monorepo to run diagnostics.');
    return { metadata: { command: 'heal' } };
  }

  // Get all diagnostics from the workspace
  const allDiagnostics = vscode.languages.getDiagnostics();
  const errors: { file: string; line: number; message: string; severity: string }[] = [];
  const warnings: { file: string; line: number; message: string }[] = [];

  for (const [uri, diagnostics] of allDiagnostics) {
    if (token.isCancellationRequested) return { metadata: { command: 'heal' } };
    const relativePath = vscode.workspace.asRelativePath(uri);
    // Skip node_modules / dist
    if (relativePath.includes('node_modules') || relativePath.includes('/dist/')) continue;

    for (const diag of diagnostics) {
      if (diag.severity === vscode.DiagnosticSeverity.Error) {
        errors.push({
          file: relativePath,
          line: diag.range.start.line + 1,
          message: diag.message,
          severity: 'ERROR',
        });
      } else if (diag.severity === vscode.DiagnosticSeverity.Warning) {
        warnings.push({
          file: relativePath,
          line: diag.range.start.line + 1,
          message: diag.message,
        });
      }
    }
  }

  stream.markdown('## Self-Healing Diagnostics\n\n');

  if (errors.length === 0 && warnings.length === 0) {
    stream.markdown('✅ **All clear!** No errors or warnings detected in the workspace.\n\n');
    stream.markdown('Sven\'s codebase is healthy. The self-healing pipeline has nothing to fix.\n');
  } else {
    if (errors.length > 0) {
      stream.markdown(`### 🔴 Errors (${errors.length})\n\n`);
      const grouped = groupBy(errors, (e) => e.file);
      for (const [file, fileErrors] of Object.entries(grouped)) {
        stream.markdown(`**${file}**\n`);
        for (const e of fileErrors) {
          stream.markdown(`- Line ${e.line}: ${e.message}\n`);
        }
        stream.markdown('\n');
      }
    }

    if (warnings.length > 0) {
      stream.markdown(`### 🟡 Warnings (${warnings.length})\n\n`);
      const grouped = groupBy(warnings, (w) => w.file);
      for (const [file, fileWarnings] of Object.entries(grouped)) {
        stream.markdown(`**${file}**\n`);
        for (const w of fileWarnings) {
          stream.markdown(`- Line ${w.line}: ${w.message}\n`);
        }
        stream.markdown('\n');
      }
    }

    stream.markdown('---\n\n');
    stream.markdown('💡 **Sven can help fix these.** Ask me about any specific error and I\'ll propose a fix with full context of the codebase.\n');
  }

  return { metadata: { command: 'heal' } };
}

async function handleCodebase(
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
): Promise<SvenChatResult> {
  stream.progress('Building codebase context...');

  const context = await buildCodebaseContext();
  if (token.isCancellationRequested) return { metadata: { command: 'codebase' } };

  stream.markdown('## Sven Codebase Overview\n\n');
  stream.markdown(context);

  if (request.prompt) {
    stream.markdown('\n\n---\n\n');
    stream.markdown(`Regarding your question: **${request.prompt}**\n\n`);
    stream.markdown('I have full awareness of this codebase structure. Ask me anything about any service, route, or component.\n');
  }

  return { metadata: { command: 'codebase' } };
}

async function handleDeploy(
  api: SvenApiClient,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
): Promise<SvenChatResult> {
  stream.progress('Checking deployment status...');

  stream.markdown('## Deployment Guide\n\n');
  stream.markdown('### Gateway API\n');
  stream.markdown('```bash\n');
  stream.markdown('cd /srv/sven/prod/src\n');
  stream.markdown('docker compose up -d --build gateway-api\n');
  stream.markdown('docker network connect --alias sven-gateway-api --alias gateway-api multi-vm_platform src-gateway-api-1\n');
  stream.markdown('```\n\n');

  stream.markdown('### Flutter Companion App\n');
  stream.markdown('```bash\n');
  stream.markdown('cd apps/companion-user-flutter\n');
  stream.markdown('export PATH="$HOME/flutter/bin:$PATH"\n');
  stream.markdown('GRADLE_OPTS="-Xmx1536m -Dorg.gradle.workers.max=2 -Dorg.gradle.parallel=false" flutter build apk --release --target-platform android-arm64 --no-tree-shake-icons\n');
  stream.markdown('scp build/app/outputs/flutter-apk/app-prod-release.apk sven-platform:/srv/sven/prod/src/deploy/quickstart/download/sven-companion.apk\n');
  stream.markdown('```\n\n');

  stream.markdown('### Agent Runtime\n');
  stream.markdown('```bash\n');
  stream.markdown('cd /srv/sven/prod/src\n');
  stream.markdown('docker compose up -d --build agent-runtime\n');
  stream.markdown('```\n\n');

  try {
    const status = await api.getTradingStatus();
    if (token.isCancellationRequested) return { metadata: { command: 'deploy' } };
    stream.markdown(`### Current State\n- Loop: ${status.loopRunning ? '🟢 ACTIVE' : '🔴 STOPPED'}\n- Balance: ${status.account?.balance?.toFixed(2)} 47T\n`);
  } catch {
    stream.markdown('_Could not fetch live status — configure `sven.gatewayUrl` and `sven.extensionApiKey`._\n');
  }

  return { metadata: { command: 'deploy' } };
}

async function handleChat(
  api: SvenApiClient,
  request: vscode.ChatRequest,
  chatContext: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
): Promise<SvenChatResult> {
  // ── Step 1: Call the real Sven brain (GPU + soul) ──
  stream.progress('Connecting to Sven\'s brain...');

  // Build conversation history from chat context
  const history: Array<{ role: string; content: string }> = [];
  for (const turn of chatContext.history) {
    if (turn instanceof vscode.ChatRequestTurn) {
      history.push({ role: 'user', content: turn.prompt });
    } else if (turn instanceof vscode.ChatResponseTurn) {
      let responseText = '';
      for (const part of turn.response) {
        if (part instanceof vscode.ChatResponseMarkdownPart) {
          responseText += part.value.value;
        }
      }
      if (responseText) {
        history.push({ role: 'assistant', content: responseText });
      }
    }
  }

  let svenBrainResponse: string | null = null;
  let svenModel = '';
  let svenNode = '';

  try {
    const result = await api.chat(request.prompt, history);
    svenBrainResponse = result.response;
    svenModel = result.model;
    svenNode = result.node;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    stream.markdown(`> _Sven\'s brain is offline: ${message}_\n\n`);
  }

  if (token.isCancellationRequested) return {};

  // ── Step 2: Show Sven's brain response ──
  if (svenBrainResponse) {
    stream.markdown(`**🧠 Sven** _(${svenModel} on ${svenNode})_\n\n`);
    stream.markdown(svenBrainResponse);
    stream.markdown('\n\n');
  }

  // ── Step 3: Copilot follow-up — code-aware analysis ──
  const isCodeQuestion = /code|fix|bug|error|implement|refactor|function|class|import|route|endpoint|service|docker|build|test|deploy|file|line|type|schema|migration/i.test(request.prompt);

  if (isCodeQuestion) {
    stream.progress('Running code analysis...');

    const codebaseCtx = await buildCodebaseContext();

    let liveState = '';
    try {
      const ctx = await api.getContext();
      const s = ctx.status;
      liveState = `\n\n## Live State\n- State: ${s.state}\n- Balance: ${s.balance.toFixed(2)} 47T\n- Daily P&L: ${s.dailyPnl.toFixed(2)} 47T\n- Loop: ${s.loopRunning ? 'ACTIVE' : 'STOPPED'} (iteration #${s.loopIterations})\n- Symbol: ${s.activeSymbol || 'none'}\n- Auto-trade: ${s.autoTradeEnabled ? 'ON' : 'OFF'}\n- Trades executed: ${s.tradesExecuted}\n`;
    } catch {
      // no live state — ok
    }

    const systemContext = `You are Copilot, GitHub's AI coding assistant. You are working alongside Sven, the AI trading agent for 47Network. The user is Hantz, Sven's creator. Sven has already responded above — you provide complementary code-level analysis.

${codebaseCtx}
${liveState}

When helping with code:
- Reference specific files and line numbers
- Consider the self-healing pipeline implications
- Be direct and precise — no fluff`;

    const models = await vscode.lm.selectChatModels({ family: 'gpt-4o' });
    const model = models[0];

    if (model) {
      const messages = [
        vscode.LanguageModelChatMessage.User(systemContext),
      ];

      // Add previous turns for context
      for (const turn of chatContext.history) {
        if (turn instanceof vscode.ChatResponseTurn) {
          let responseText = '';
          for (const part of turn.response) {
            if (part instanceof vscode.ChatResponseMarkdownPart) {
              responseText += part.value.value;
            }
          }
          if (responseText) {
            messages.push(vscode.LanguageModelChatMessage.Assistant(responseText));
          }
        } else if (turn instanceof vscode.ChatRequestTurn) {
          messages.push(vscode.LanguageModelChatMessage.User(turn.prompt));
        }
      }

      messages.push(vscode.LanguageModelChatMessage.User(
        svenBrainResponse
          ? `The user asked: "${request.prompt}"\n\nSven's brain responded:\n${svenBrainResponse}\n\nProvide complementary code-level analysis if helpful. Be brief — Sven already answered.`
          : request.prompt
      ));

      if (svenBrainResponse) {
        stream.markdown('---\n\n**💻 Copilot** _(code analysis)_\n\n');
      }

      const response = await model.sendRequest(messages, {}, token);
      for await (const chunk of response.text) {
        if (token.isCancellationRequested) break;
        stream.markdown(chunk);
      }
    }
  }

  return {};
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

export function deactivate() {
  // cleanup
}
