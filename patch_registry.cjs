const fs = require('fs');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    /           expires_at = CURRENT_TIMESTAMP \+ INTERVAL '7 days'\n      params,/g,
    `           expires_at = EXCLUDED.expires_at\`,
      params,`
  );
  content = content.replace(
    /           expires_at = CURRENT_TIMESTAMP \+ INTERVAL '7 days'\n      \[REGISTRY_MARKETPLACE_EMBEDDING_TOOL_NAME, cacheKey, JSON\.stringify\(embedding\)\],/g,
    `           expires_at = CURRENT_TIMESTAMP + INTERVAL '7 days',
           updated_at = CURRENT_TIMESTAMP\`,
      [REGISTRY_MARKETPLACE_EMBEDDING_TOOL_NAME, cacheKey, JSON.stringify(embedding)],`
  );
  fs.writeFileSync(file, content);
}

fixFile('services/gateway-api/src/routes/admin/registry.ts');
