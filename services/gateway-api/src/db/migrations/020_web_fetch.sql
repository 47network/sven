-- Migration 020: Web Fetch Tools Registration

INSERT INTO tools (name, category, description, execution_mode, is_first_party, trust_level,
                   timeout_seconds, max_memory_mb, max_cpu_shares, inputs_schema, outputs_schema,
                   permissions_required, resource_limits)
VALUES
  (
    'web.fetch',
    'web_operations',
    'Fetch web content with HTML text extraction and metadata',
    'in_process',
    true,
    'trusted',
    30,
    512,
    1024,
    '{
      "type": "object",
      "properties": {
        "url": { "type": "string", "description": "URL to fetch" },
        "timeout": { "type": "integer", "description": "Request timeout in ms", "default": 30000, "minimum": 1000, "maximum": 120000 },
        "max_content_length": { "type": "integer", "description": "Maximum response size in bytes", "default": 10485760, "minimum": 1024, "maximum": 104857600 },
        "extract_html": { "type": "boolean", "description": "Include full HTML content (first 64KB)", "default": false }
      },
      "required": ["url"],
      "additionalProperties": false
    }',
    '{
      "type": "object",
      "properties": {
        "url": { "type": "string" },
        "status": { "type": "integer" },
        "contentType": { "type": "string" },
        "charset": { "type": "string" },
        "title": { "type": "string" },
        "description": { "type": "string" },
        "author": { "type": "string" },
        "favicon": { "type": "string" },
        "ogImage": { "type": "string" },
        "ogTitle": { "type": "string" },
        "ogDescription": { "type": "string" },
        "textContent": { "type": "string" },
        "htmlContent": { "type": "string" },
        "contentLength": { "type": "integer" },
        "fetchedAt": { "type": "string" },
        "fromCache": { "type": "boolean" },
        "cacheExpiry": { "type": "string" }
      }
    }',
    ARRAY['web.fetch']::text[],
    '{"max_bytes": 104857600, "max_concurrency": 5}'::jsonb
  ),
  (
    'web.extract-text',
    'web_operations',
    'Extract plain text from HTML content',
    'in_process',
    true,
    'trusted',
    10,
    256,
    512,
    '{
      "type": "object",
      "properties": {
        "html": { "type": "string", "description": "HTML content to extract from" },
        "max_length": { "type": "integer", "description": "Maximum text length", "default": 8192, "minimum": 256, "maximum": 1048576 }
      },
      "required": ["html"],
      "additionalProperties": false
    }',
    '{
      "type": "object",
      "properties": {
        "text": { "type": "string" },
        "length": { "type": "integer" }
      }
    }',
    ARRAY[]::text[],
    '{"max_bytes": 52428800, "max_concurrency": 10}'::jsonb
  ),
  (
    'web.extract-metadata',
    'web_operations',
    'Extract metadata from HTML (title, description, Open Graph, etc.)',
    'in_process',
    true,
    'trusted',
    10,
    256,
    512,
    '{
      "type": "object",
      "properties": {
        "html": { "type": "string", "description": "HTML content to extract metadata from" }
      },
      "required": ["html"],
      "additionalProperties": false
    }',
    '{
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "description": { "type": "string" },
        "author": { "type": "string" },
        "favicon": { "type": "string" },
        "ogImage": { "type": "string" },
        "ogTitle": { "type": "string" },
        "ogDescription": { "type": "string" }
      }
    }',
    ARRAY[]::text[],
    '{"max_bytes": 52428800, "max_concurrency": 10}'::jsonb
  )
ON CONFLICT (name) DO
  UPDATE SET
    description = EXCLUDED.description,
    inputs_schema = EXCLUDED.inputs_schema,
    outputs_schema = EXCLUDED.outputs_schema,
    resource_limits = EXCLUDED.resource_limits;
