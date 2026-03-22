-- Migration 018: NAS File Operations Audit Table

CREATE TABLE IF NOT EXISTS nas_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_type VARCHAR(50) NOT NULL, -- 'search', 'read', 'write', 'append', 'delete', 'list'
  path TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
  details JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_operation_type CHECK (operation_type IN ('search', 'read', 'write', 'append', 'delete', 'list', 'stats')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'success', 'failed'))
);

CREATE INDEX idx_nas_operations_user_id ON nas_operations(user_id);
CREATE INDEX idx_nas_operations_created_at ON nas_operations(created_at DESC);
CREATE INDEX idx_nas_operations_operation_type ON nas_operations(operation_type);
CREATE INDEX idx_nas_operations_path ON nas_operations(path);

-- Migration 019: NAS File Tools Registration

INSERT INTO tools (name, category, description, execution_mode, is_first_party, trust_level, 
                   timeout_seconds, max_memory_mb, max_cpu_shares, inputs_schema, outputs_schema,
                   permissions_required, resource_limits)
VALUES
  (
    'nas.search',
    'file_operations',
    'Search for files matching a pattern in NAS directories',
    'in_process',
    true,
    'trusted',
    30,
    256,
    512,
    '{
      "type": "object",
      "properties": {
        "path": { "type": "string", "description": "Search path (/nas/shared or /nas/users/<uuid>)" },
        "pattern": { "type": "string", "description": "Regex pattern to match filenames", "default": ".*" },
        "max_results": { "type": "integer", "description": "Maximum results", "default": 100, "minimum": 1, "maximum": 1000 }
      },
      "required": ["path"],
      "additionalProperties": false
    }',
    '{
      "type": "object",
      "properties": {
        "results": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "path": { "type": "string" },
              "name": { "type": "string" },
              "size": { "type": "integer" },
              "isDirectory": { "type": "boolean" },
              "modifiedAt": { "type": "string" }
            }
          }
        }
      }
    }',
    ARRAY[]::text[],
    '{"max_bytes": 268435456, "max_concurrency": 3}'::jsonb
  ),
  (
    'nas.list',
    'file_operations',
    'List directory contents in NAS',
    'in_process',
    true,
    'trusted',
    10,
    128,
    256,
    '{
      "type": "object",
      "properties": {
        "path": { "type": "string", "description": "Directory path to list" }
      },
      "required": ["path"],
      "additionalProperties": false
    }',
    '{
      "type": "object",
      "properties": {
        "entries": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "path": { "type": "string" },
              "name": { "type": "string" },
              "size": { "type": "integer" },
              "isDirectory": { "type": "boolean" },
              "modifiedAt": { "type": "string" }
            }
          }
        }
      }
    }',
    ARRAY[]::text[],
    '{"max_bytes": 52428800, "max_concurrency": 5}'::jsonb
  ),
  (
    'nas.preview',
    'file_operations',
    'Get file preview (first 8KB for text, base64 for binary)',
    'in_process',
    true,
    'trusted',
    10,
    128,
    256,
    '{
      "type": "object",
      "properties": {
        "path": { "type": "string", "description": "File path to preview" }
      },
      "required": ["path"],
      "additionalProperties": false
    }',
    '{
      "type": "object",
      "properties": {
        "path": { "type": "string" },
        "name": { "type": "string" },
        "size": { "type": "integer" },
        "modifiedAt": { "type": "string" },
        "mimeType": { "type": "string" },
        "preview": { "type": "string" },
        "isBinary": { "type": "boolean" },
        "isLarge": { "type": "boolean" }
      }
    }',
    ARRAY[]::text[],
    '{"max_bytes": 52428800, "max_concurrency": 5}'::jsonb
  ),
  (
    'nas.read',
    'file_operations',
    'Read entire file (with size limit)',
    'in_process',
    true,
    'trusted',
    15,
    256,
    512,
    '{
      "type": "object",
      "properties": {
        "path": { "type": "string", "description": "File path to read" },
        "max_bytes": { "type": "integer", "description": "Maximum file size to read", "default": 10485760 }
      },
      "required": ["path"],
      "additionalProperties": false
    }',
    '{
      "type": "object",
      "properties": {
        "content": { "type": "string", "description": "File content (base64 for binary)" },
        "size": { "type": "integer" },
        "isBinary": { "type": "boolean" }
      }
    }',
    ARRAY[]::text[],
    '{"max_bytes": 268435456, "max_concurrency": 3}'::jsonb
  ),
  (
    'nas.write',
    'file_operations',
    'Write file to user NAS directory (requires approval)',
    'in_process',
    true,
    'trusted',
    15,
    256,
    512,
    '{
      "type": "object",
      "properties": {
        "path": { "type": "string", "description": "File path to write" },
        "content": { "type": "string", "description": "File content (base64 for binary)" },
        "append": { "type": "boolean", "description": "Append instead of overwrite", "default": false },
        "create_dirs": { "type": "boolean", "description": "Create parent directories", "default": false }
      },
      "required": ["path", "content"],
      "additionalProperties": false
    }',
    '{
      "type": "object",
      "properties": {
        "path": { "type": "string" },
        "size": { "type": "integer" },
        "message": { "type": "string" }
      }
    }',
    ARRAY['nas.write']::text[],
    '{"max_bytes": 268435456, "max_concurrency": 2}'::jsonb
  ),
  (
    'nas.delete',
    'file_operations',
    'Delete file or directory (requires approval)',
    'in_process',
    true,
    'trusted',
    15,
    128,
    256,
    '{
      "type": "object",
      "properties": {
        "path": { "type": "string", "description": "File or directory path to delete" },
        "recursive": { "type": "boolean", "description": "Delete directory recursively", "default": false }
      },
      "required": ["path"],
      "additionalProperties": false
    }',
    '{
      "type": "object",
      "properties": {
        "message": { "type": "string" }
      }
    }',
    ARRAY['nas.write']::text[],
    '{"max_bytes": 52428800, "max_concurrency": 2}'::jsonb
  ),
  (
    'nas.stats',
    'file_operations',
    'Get file or directory statistics',
    'in_process',
    true,
    'trusted',
    10,
    128,
    256,
    '{
      "type": "object",
      "properties": {
        "path": { "type": "string", "description": "File or directory path" }
      },
      "required": ["path"],
      "additionalProperties": false
    }',
    '{
      "type": "object",
      "properties": {
        "path": { "type": "string" },
        "size": { "type": "integer" },
        "isDirectory": { "type": "boolean" },
        "modifiedAt": { "type": "string" },
        "createdAt": { "type": "string" },
        "isReadable": { "type": "boolean" },
        "isWritable": { "type": "boolean" }
      }
    }',
    ARRAY[]::text[],
    '{"max_bytes": 52428800, "max_concurrency": 5}'::jsonb
  )
ON CONFLICT (name) DO
  UPDATE SET
    description = EXCLUDED.description,
    inputs_schema = EXCLUDED.inputs_schema,
    outputs_schema = EXCLUDED.outputs_schema,
    resource_limits = EXCLUDED.resource_limits;
