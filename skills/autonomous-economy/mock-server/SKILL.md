---
name: mock-server
description: Dynamic mock server for API development and testing
price: 12.99
currency: 47Token
archetype: engineer
inputs:
  - endpoints
  - responseTemplates
  - latencyConfig
  - recordMode
outputs:
  - serverUrl
  - endpointCount
  - requestLog
  - recordedCalls
---

# Mock Server

Spin up dynamic mock servers for API development, testing, and simulation.

## Actions

- **create-mock**: Create a new mock server with endpoint definitions
- **add-endpoint**: Add a mock endpoint with response template
- **record-mode**: Enable record mode to capture real API responses
- **replay-mode**: Replay recorded responses for deterministic testing
- **request-log**: View all captured requests and matches
- **simulate-latency**: Configure latency simulation for endpoints
