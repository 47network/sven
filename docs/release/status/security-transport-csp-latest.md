# Security Transport/CSP Check

Generated: 2026-02-16T01:51:46.021Z
Status: pass

- [x] Gateway CSP enabled: Fastify helmet CSP must be configured
- [x] Gateway HSTS enabled: Strict transport headers required on API responses
- [x] Gateway frame/referrer protections enabled: frameguard + referrerPolicy must be set
- [x] Desktop CSP present: Tauri CSP must define default-src self
- [x] Desktop CSP avoids wildcard HTTPS egress: connect-src cannot use bare https://* wildcard
- [x] Desktop transport policy enforced: Desktop client must block insecure non-local gateway URLs
- [x] Desktop cert validation not bypassed: Desktop HTTP client cannot disable certificate validation
- [x] Canvas A2UI HTML sanitization: A2UI HTML must be sanitized before dangerouslySetInnerHTML
