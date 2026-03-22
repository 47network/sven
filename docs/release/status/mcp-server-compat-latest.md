# MCP Server Compatibility Gate

Generated: 2026-03-21T00:28:45.746Z
Status: fail

## Checks
- [ ] mcp_server_route_tests_pass: failed: FAIL src/__tests__/mcp-server-route.test.ts
  ● Test suite failed to run

    ENOENT: no such file or directory, open '/media/hantz/47Network_Main/47Network/47Network_Future/TheSven/thesven_v0.1.0/services/gateway-api/src/__tests__/mcp-server-route.test.ts'

      at runTestInternal (../../node_modules/jest-runner/build/runTest.js:170:27)

Test Suites: 1 failed, 1 total
Tests:       0 total
Snapshots:   0 total
Time:        0.418 s
Ran all test suites within paths "src/__tests__/mcp-server-route.test.ts".
- [ ] mcp_server_live_e2e_tests_pass: missing TEST_MCP_SERVER_TOKEN (or SVEN_MCP_SERVER_TOKEN) for live compatibility run
- [ ] mcp_server_http_smoke_pass: missing TEST_MCP_SERVER_TOKEN (or SVEN_MCP_SERVER_TOKEN) for live HTTP smoke
