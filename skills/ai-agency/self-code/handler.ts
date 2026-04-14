export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'skill_authoring_guide': {
      return {
        result: {
          title: 'How to Create a New Sven Skill',
          overview: 'Skills are self-contained capability packages that Sven can invoke. Each skill has a manifest (SKILL.md) and a handler implementation.',
          directoryStructure: {
            pattern: 'skills/<category>/<skill-name>/',
            files: [
              'SKILL.md — YAML frontmatter (metadata + schemas) + Markdown body (prompt template)',
              'handler.ts — export default async function handler(input): Promise<Record<string, unknown>>',
              'README.md — (optional) developer documentation',
            ],
            existingCategories: ['ai-agency', 'security', 'quantum', 'compute-mesh', 'design', 'marketing', 'notifications', 'ocr', 'trading'],
          },
          steps: [
            '1. Choose the right category (or create a new one if no existing category fits)',
            '2. Create the directory: skills/<category>/<skill-name>/',
            '3. Write SKILL.md with proper YAML frontmatter (see skill_manifest_template action)',
            '4. Write handler.ts following the handler pattern (see handler_template action)',
            '5. Skills in the skills/ directory are auto-discovered by skill-runner on restart via loadAllSkills()',
            '6. For runtime creation without restart, use the skill.author tool (see dynamic_skill_workflow action)',
          ],
          registration: {
            staticSkills: 'Auto-discovered from skills/ directory at skill-runner startup. No DB registration needed.',
            dynamicSkills: 'Created via skill.author tool. Stored in ~/.sven/workspace/skills/. Registered in DB (tools, skills_catalog, skills_installed). Start quarantined — require admin review.',
            priority: 'system > organization > workspace > adapter > plugin (highest wins in dedup)',
          },
        },
      };
    }

    case 'handler_template': {
      const language = (input.language as string) || 'typescript';
      const purpose = (input.skill_purpose as string) || 'a new capability';

      if (language === 'typescript') {
        return {
          result: {
            language: 'typescript',
            template: [
              '// handler.ts — Skill handler for: ' + purpose,
              'export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {',
              '  const action = input.action as string;',
              '',
              '  switch (action) {',
              '    case \'example_action\': {',
              '      // Implement the action here',
              '      // Access inputs via: input.param_name as Type',
              '      // Return structured result:',
              '      return {',
              '        result: {',
              '          message: \'Action completed\',',
              '          data: {},',
              '        },',
              '      };',
              '    }',
              '',
              '    default:',
              '      return { error: `Unknown action "${action}". Use: example_action` };',
              '  }',
              '}',
            ].join('\n'),
            conventions: [
              'Export a single default async function named handler',
              'Input is always Record<string, unknown> — cast properties as needed',
              'Return { result: ... } for success, { error: "message" } for errors',
              'Use a switch on input.action for multi-action skills',
              'No side effects in the handler itself — use the tool dispatch system for I/O',
              'Handlers run in gVisor sandboxes (dynamic skills) — limited filesystem/network access',
            ],
          },
        };
      }

      if (language === 'python') {
        return {
          result: {
            language: 'python',
            template: [
              '# handler.py — Skill handler for: ' + purpose,
              'import json',
              'import sys',
              '',
              'def handler(inputs: dict) -> dict:',
              '    action = inputs.get("action", "")',
              '',
              '    if action == "example_action":',
              '        return {"result": {"message": "Action completed", "data": {}}}',
              '',
              '    return {"error": f"Unknown action \\"{action}\\". Use: example_action"}',
              '',
              'if __name__ == "__main__":',
              '    inputs = json.loads(sys.stdin.read())',
              '    result = handler(inputs)',
              '    print(json.dumps(result))',
            ].join('\n'),
            conventions: [
              'Read JSON from stdin, write JSON to stdout',
              'Return dict with "result" key for success, "error" key for failures',
              'Python skills run in a subprocess — use standard library only (no pip install)',
            ],
          },
        };
      }

      return {
        result: {
          language: 'shell',
          template: [
            '#!/bin/bash',
            '# handler.sh — Skill handler for: ' + purpose,
            '# Input: JSON on stdin',
            '# Output: JSON on stdout',
            '',
            'INPUT=$(cat)',
            'ACTION=$(echo "$INPUT" | jq -r .action)',
            '',
            'case "$ACTION" in',
            '  example_action)',
            '    echo \'{"result": {"message": "Action completed"}}\'',
            '    ;;',
            '  *)',
            '    echo "{\\\"error\\\": \\\"Unknown action: $ACTION\\\"}"',
            '    ;;',
            'esac',
          ].join('\n'),
          conventions: [
            'Read JSON from stdin with cat, parse with jq',
            'Write JSON to stdout',
            'Shell skills are simplest but least powerful — use for system commands and glue logic',
          ],
        },
      };
    }

    case 'skill_manifest_template': {
      return {
        result: {
          title: 'SKILL.md Template',
          template: [
            '---',
            'name: my-skill-name',
            'description: Brief description of what this skill does',
            'version: 0.1.0',
            'publisher: 47dynamics',
            'handler_language: typescript',
            'handler_file: handler.ts',
            'inputs_schema:',
            '  type: object',
            '  properties:',
            '    action:',
            '      type: string',
            '      enum: [action1, action2]',
            '    param1:',
            '      type: string',
            '      description: What this parameter does',
            '  required: [action]',
            'outputs_schema:',
            '  type: object',
            '  properties:',
            '    result:',
            '      type: object',
            'when-to-use: Guidance for the LLM on when to pick this skill.',
            '---',
            '# Skill Title',
            '',
            'Markdown body serves as the prompt template. {variable} placeholders are extracted',
            'as argumentNames and substituted at runtime.',
          ].join('\n'),
          fields: {
            required: ['name', 'description'],
            recommended: ['version', 'publisher', 'handler_language', 'handler_file', 'inputs_schema', 'outputs_schema', 'when-to-use'],
            optional: ['display-name', 'effort', 'effort-min', 'effort-max', 'argument-hint', 'model', 'user-invocable', 'allowed-tools'],
          },
          tips: [
            'name must be kebab-case and unique across all skills',
            'inputs_schema and outputs_schema follow JSON Schema format (as YAML)',
            'when-to-use is critical — this is how the LLM decides to invoke this skill',
            'The Markdown body below the frontmatter is the prompt template — keep it focused',
            '{variable} placeholders in the body are extracted as argumentNames',
          ],
        },
      };
    }

    case 'conventions': {
      return {
        result: {
          title: 'Sven Codebase Conventions — Follow These When Self-Coding',
          api: {
            framework: 'Fastify',
            responseEnvelope: '{ success: boolean, data?: T, error?: string }',
            auth: 'requireRole() + requireTenantMembership() middleware on protected routes',
            validation: 'JSON Schema via Fastify schema or manual validation',
            errorHandling: 'isSchemaCompatError() for graceful degradation when tables do not exist yet',
          },
          database: {
            driver: 'pg (node-postgres) with connection pooling',
            queries: 'ALWAYS parameterized SQL ($1, $2, ...) — NEVER string interpolation',
            migrations: 'Numbered SQL files in services/gateway-api/src/db/migrations/',
            naming: 'snake_case for tables and columns',
          },
          events: {
            bus: 'NATS JetStream',
            patterns: 'Pub/Sub with durable consumers',
            subjects: 'Dot-separated hierarchy (e.g. heal.event.code_fix, tool.run.request)',
          },
          logging: {
            library: 'createLogger() from packages/shared',
            format: 'Structured JSON with level, ts, service, msg fields',
            levels: 'debug, info, warn, error, fatal',
            rule: 'NEVER log secrets, tokens, PII, or raw sensitive data',
          },
          git: {
            commits: 'Conventional Commits: feat|fix|perf|refactor|test|docs|chore(scope): message',
            branches: 'main for production, sven-heal/<timestamp> for self-healing',
            stealthCommit: 'Use stealth-commit.ts for autonomous commits — strips AI markers, configurable author',
          },
          testing: {
            unit: 'Jest',
            e2e: 'Playwright',
            pattern: 'Test files alongside source or in __tests__/ directories',
          },
          typescript: {
            strict: 'strict mode enabled',
            imports: 'Prefer workspace packages (@sven/shared, @sven/trading-platform, etc.)',
            types: 'Export interfaces/types from types.ts files, share via packages/shared',
          },
        },
      };
    }

    case 'extending_gateway': {
      return {
        result: {
          title: 'How to Extend the Gateway API with New Routes',
          location: 'services/gateway-api/src/routes/',
          pattern: {
            description: 'Each route module exports a default async function that receives Fastify instance',
            template: [
              'import { FastifyInstance } from "fastify";',
              'import { requireRole, requireTenantMembership } from "../middleware/auth";',
              '',
              'export default async function myRoutes(app: FastifyInstance) {',
              '  app.get("/v1/my-feature", {',
              '    preHandler: [requireRole("user"), requireTenantMembership],',
              '  }, async (request, reply) => {',
              '    const pool = app.pg; // PostgreSQL pool',
              '    const result = await pool.query("SELECT $1::text AS msg", ["hello"]);',
              '    return reply.send({ success: true, data: result.rows[0] });',
              '  });',
              '}',
            ].join('\n'),
          },
          registration: 'Route modules are registered in services/gateway-api/src/index.ts via app.register(import("./routes/my-routes"))',
          conventions: [
            'Use /v1/ prefix for all API routes',
            'Always apply auth middleware (requireRole, requireTenantMembership)',
            'Use parameterized SQL ($1, $2) — never string interpolation',
            'Return { success: true, data: ... } envelope',
            'Use isSchemaCompatError() for graceful degradation',
            'Add structured logging with createLogger()',
          ],
        },
      };
    }

    case 'extending_skill_runner': {
      return {
        result: {
          title: 'How to Add New Tools to the Skill Runner',
          location: 'services/skill-runner/src/index.ts',
          pattern: {
            description: 'Tools are dispatched via a switch statement on toolName. Add a new case block.',
            template: [
              'case \'my.new.tool\': {',
              '  const param = String(inputs.param || \'\');',
              '  if (!param) {',
              '    return { outputs: {}, error: \'param is required\' };',
              '  }',
              '  try {',
              '    // Implement tool logic here',
              '    const result = { message: \'done\', data: param };',
              '    return { outputs: { result: JSON.stringify(result) } };',
              '  } catch (err) {',
              '    logger.error(\'my.new.tool failed\', { error: String(err) });',
              '    return { outputs: {}, error: String(err) };',
              '  }',
              '}',
            ].join('\n'),
          },
          toolClassification: {
            concurrent: 'Read-only tools safe to parallelise (web.fetch, search.*, DB reads)',
            exclusive: 'Tools with side effects — run sequentially (write_file, git.*, shell.*, docker.*)',
            addTo: 'concurrentSafeTools or exclusiveTools set in tool-executor.ts',
          },
          conventions: [
            'Return { outputs: { result: JSON.stringify(data) } } for success',
            'Return { outputs: {}, error: "message" } for failures',
            'Always validate inputs — never trust raw input',
            'Use structured logging with the existing logger',
            'Gate privileged tools behind requireAdmin47 or RBAC checks',
            'Add the tool name to the concurrent or exclusive classification',
          ],
        },
      };
    }

    case 'dynamic_skill_workflow': {
      return {
        result: {
          title: 'Creating Skills at Runtime via skill.author',
          overview: 'The skill.author tool lets Sven create new skills without restarting the skill-runner. Dynamic skills are sandboxed in gVisor and require admin review.',
          prerequisites: [
            'Setting agent.dynamicTools.enabled must be true in settings_global',
            'User must be authenticated (user/chat context required)',
            'Rate limit: configurable hourly cap per user',
          ],
          workflow: [
            '1. Invoke skill.author with: skill_name, description, handler_language, handler_code, inputs_schema, outputs_schema',
            '2. Handler code is validated (TypeScript: tsc --noEmit, Python: syntax check, Shell: bash -n)',
            '3. Policy scope check — new skill inherits only the scopes the author has',
            '4. Files written to $SVEN_DYNAMIC_SKILLS_DIR/<slug>/ (default ~/.sven/workspace/skills/)',
            '5. Registered in DB: tools table (trust_level=quarantined, execution_mode=gvisor), skills_catalog, skills_installed',
            '6. Quarantine report created — skill is NOT usable until admin reviews and approves',
            '7. Admin approval notification sent',
            '8. Once approved, skill becomes available as dynamic.<slug> tool',
          ],
          inputs: {
            skill_name: 'Kebab-case unique name (required)',
            description: 'What the skill does (required)',
            handler_language: 'typescript | python | shell (required)',
            handler_code: 'The full handler source code (or omit for default template)',
            inputs_schema: 'JSON Schema for inputs (optional)',
            outputs_schema: 'JSON Schema for outputs (optional)',
          },
          security: [
            'Dynamic skills run in gVisor sandboxes — restricted filesystem and network access',
            'All dynamic skills start quarantined (not executable until approved)',
            'Scope inheritance — cannot escalate beyond the author\'s permissions',
            'Rate limited per user to prevent abuse',
            'Handler code max size: 50KB',
          ],
          tips: [
            'Prefer static skills (in the skills/ directory) for permanent capabilities — they are simpler and do not need approval',
            'Use dynamic skills for experimental or user-specific tools',
            'TypeScript handlers must export a default async function — same pattern as static skills',
            'Test your handler logic before submitting to skill.author',
          ],
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Use: skill_authoring_guide, handler_template, skill_manifest_template, conventions, extending_gateway, extending_skill_runner, dynamic_skill_workflow` };
  }
}
