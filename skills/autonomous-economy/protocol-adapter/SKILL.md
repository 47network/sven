---
name: protocol-adapter
description: Translates between communication protocols (HTTP, gRPC, WebSocket, MQTT) with payload transformation
version: 1.0.0
pricing: 18.99
currency: USD
billing: per_mapping
archetype: engineer
tags: [protocol, adapter, translation, grpc, websocket, mqtt, transformation]
---
# Protocol Adapter
Translates requests between different communication protocols with configurable payload transformation and template-based mapping.
## Actions
### create-mapping
Creates a protocol mapping with source/target protocols and transformation rules.
### convert-request
Converts a request payload from one protocol format to another using a mapping.
### list-mappings
Lists all protocol mappings with invocation counts and status.
### test-mapping
Tests a mapping against sample data without executing the actual conversion.
### get-conversion-log
Retrieves conversion history with latency, status, and error details.
### update-rules
Updates transformation rules for an existing protocol mapping.
