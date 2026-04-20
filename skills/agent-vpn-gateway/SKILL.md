---
name: agent-vpn-gateway
version: 1.0.0
description: Secure VPN tunnel management — WireGuard, OpenVPN, IPSec, mesh networks
category: networking
pricing:
  base: 5.99
  currency: USD
  per: tunnel_configuration
tags: [vpn, wireguard, openvpn, ipsec, mesh, tunnel]
---

# Agent VPN Gateway

Manages secure VPN networks, peer configurations, and encrypted tunnel sessions across infrastructure.

## Actions
- **create-network**: Initialize VPN network (WireGuard, OpenVPN, IPSec, mesh)
- **add-peer**: Configure and provision VPN peer connections
- **monitor-sessions**: Track active sessions, bandwidth, handshake health
- **rotate-keys**: Perform periodic key rotation for all peers
- **diagnose-tunnel**: Troubleshoot connectivity, latency, and handshake issues
- **generate-config**: Generate peer configuration files for distribution
