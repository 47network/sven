import * as vscode from 'vscode';
import { SvenApiClient } from './api-client';
import { buildCodebaseContext } from './codebase-context';

const PARTICIPANT_ID = 'sven.chat';

interface SvenChatResult extends vscode.ChatResult {
  metadata?: {
    command?: string;
  };
}

interface DiagnosticError {
  file: string;
  line: number;
  message: string;
  severity: string;
}

interface DiagnosticWarning {
  file: string;
  line: number;
  message: string;
}

function createApiClient(): SvenApiClient {
  return new SvenApiClient(() => {
    const config = vscode.workspace.getConfiguration('sven');
    return {
      gatewayUrl: config.get<string>('gatewayUrl') || 'http://127.0.0.1:3000',
      apiKey: config.get<string>('extensionApiKey') || 'sven-ext-47-dev',
    };
  });
}

async function handleChatRequest(
  api: SvenApiClient,
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
): Promise<SvenChatResult> {
  const command = request.command;

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

  if (command === 'improve') {
    return handleImprove(api, request, stream, token);
  }

  // Default: general chat with Sven — combine codebase awareness + live state
  return handleChat(api, request, context, stream, token);
}

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('Sven AI');
  outputChannel.appendLine('Sven AI extension activated');

  const api = createApiClient();

  const participant = vscode.chat.createChatParticipant(
    PARTICIPANT_ID,
    (request, ctx, stream, token) => handleChatRequest(api, request, ctx, stream, token)
  );

  participant.iconPath = vscode.Uri.joinPath(
    vscode.extensions.getExtension('47network.sven-copilot')?.extensionUri
      ?? vscode.Uri.file(''),
    'media',
    'sven-icon.png',
  );

  context.subscriptions.push(participant, outputChannel);
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

function collectWorkspaceDiagnostics(token: vscode.CancellationToken): { errors: DiagnosticError[]; warnings: DiagnosticWarning[]; cancelled: boolean } {
  const allDiagnostics = vscode.languages.getDiagnostics();
  const errors: DiagnosticError[] = [];
  const warnings: DiagnosticWarning[] = [];

  for (const [uri, diagnostics] of allDiagnostics) {
    if (token.isCancellationRequested) return { errors, warnings, cancelled: true };
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

  return { errors, warnings, cancelled: false };
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

  const { errors, warnings, cancelled } = collectWorkspaceDiagnostics(token);
  if (cancelled) return { metadata: { command: 'heal' } };

  renderDiagnostics(stream, errors, warnings);

  return { metadata: { command: 'heal' } };
}

function renderDiagnostics(
  stream: vscode.ChatResponseStream,
  errors: DiagnosticError[],
  warnings: DiagnosticWarning[]
) {
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

  return { metadata: { command: 'deploy' } };
}

async function handleImprove(
  api: SvenApiClient,
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
): Promise<SvenChatResult> {
  const focus = request.prompt.trim() || undefined;

  stream.progress(focus
    ? `Sven is analyzing "${focus}" for improvements...`
    : 'Sven is analyzing his own code for improvements...');

  // If user has selected code in editor, include it
  let codeSnippet: string | undefined;
  const editor = vscode.window.activeTextEditor;
  if (editor && !editor.selection.isEmpty) {
    codeSnippet = editor.document.getText(editor.selection);
  }

  try {
    const result = await api.analyzeForImprovement(focus, codeSnippet);
    if (token.isCancellationRequested) return { metadata: { command: 'improve' } };

    const m = result.metrics;
    stream.markdown('## 🧠 Sven Self-Improvement Analysis\n\n');
    stream.markdown(`_Analyzed by ${result.model} on ${result.node}_\n\n`);

    stream.markdown('### Current Performance Metrics\n\n');
    stream.markdown(`| Metric | Value |\n|--------|-------|\n`);
    stream.markdown(`| Loop Iterations | ${m.loopIterations} |\n`);
    stream.markdown(`| Learning Iterations | ${m.learningIterations} |\n`);
    stream.markdown(`| Learned Patterns | ${m.learnedPatterns} |\n\n`);

    stream.markdown('### Proposed Improvements\n\n');
    stream.markdown(result.analysis);
    stream.markdown('\n\n---\n');
    stream.markdown('_Use `/improve signal accuracy` or `/improve risk management` to focus analysis._\n');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    stream.markdown(`⚠️ Self-improvement analysis failed: ${message}`);
  }

  return { metadata: { command: 'improve' } };
}

async function handleChat(
  api: SvenApiClient,
  request: vscode.ChatRequest,
  chatContext: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
): Promise<SvenChatResult> {
  // ── Step 1: Stream the real Sven brain (GPU + soul) ──
  stream.progress('Connecting to Sven\'s brain...');

  const history = buildConversationHistory(chatContext);

  const streamResult = await streamSvenBrain(api, request.prompt, history, stream, token);
  const svenBrainResponse = streamResult?.response || '';

  if (token.isCancellationRequested) return {};

  // ── Step 3: Copilot follow-up — code-aware analysis ──
  await performCopilotCodeAnalysis(api, request, chatContext, svenBrainResponse, stream, token);

  return {};
}

function buildConversationHistory(chatContext: vscode.ChatContext): Array<{ role: string; content: string }> {
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
  return history;
}

async function streamSvenBrain(
  api: SvenApiClient,
  prompt: string,
  history: Array<{ role: string; content: string }>,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<{ response: string; model: string; node: string } | null> {
  try {
    const streamResult = await new Promise<{ response: string; model: string; node: string }>((resolve, reject) => {
      let headerSent = false;
      let collected = '';
      let meta = { model: '', node: '' };

      const handle = api.chatStream(
        prompt,
        (tkn) => {
          if (token.isCancellationRequested) {
            handle.abort();
            return;
          }
          if (!headerSent) {
            // Send header on first token
            headerSent = true;
            stream.markdown(`**🧠 Sven** _(streaming...)_\n\n`);
          }
          stream.markdown(tkn);
          collected += tkn;
        },
        (doneMeta) => {
          meta = doneMeta;
          resolve({ response: collected, model: meta.model, node: meta.node });
        },
        (err) => {
          // If we already got some tokens, resolve with what we have
          if (collected.length > 0) {
            resolve({ response: collected, model: meta.model || 'unknown', node: meta.node || 'unknown' });
          } else {
            reject(err);
          }
        },
        history,
      );

      // Respect cancellation
      token.onCancellationRequested(() => { handle.abort(); });
    });

    // Add model/node info after stream completes
    stream.markdown(`\n\n_— ${streamResult.model} on ${streamResult.node}_\n\n`);
    return streamResult;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    stream.markdown(`> _Sven\'s brain is offline: ${message}_\n\n`);
    return null;
  }
}

async function performCopilotCodeAnalysis(
  api: SvenApiClient,
  request: vscode.ChatRequest,
  chatContext: vscode.ChatContext,
  svenBrainResponse: string,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
) {
  const isCodeQuestion = /code|fix|bug|error|implement|refactor|function|class|import|route|endpoint|service|docker|build|test|deploy|file|line|type|schema|migration/i.test(request.prompt);

  if (!isCodeQuestion) {
    return;
  }

  stream.progress('Running code analysis...');

  const codebaseCtx = await buildCodebaseContext();

  let liveState = '';
  try {
    const ctx = await api.getContext();
    const s = ctx.status;
    liveState = `\n\n## Live State\n- State: ${s.state}\n- Loop: ${s.loopRunning ? 'ACTIVE' : 'STOPPED'} (iteration #${s.loopIterations})\n`;
  } catch {
    // no live state — ok
  }

  const systemContext = `You are Copilot, GitHub's AI coding assistant. You are working alongside Sven, the AI assistant for 47Network. The user is Hantz, Sven's creator. Sven has already responded above — you provide complementary code-level analysis.

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
