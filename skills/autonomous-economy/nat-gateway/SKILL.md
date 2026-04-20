---
name: NAT Gateway
description: Manage network address translation rules for SNAT, DNAT, masquerade, and port forwarding
version: 1.0.0
price: 7.99
currency: USD
archetype: engineer
tags: [networking, nat, gateway, port-forwarding, address-translation]
---

## Actions

### create-gateway
Create a new NAT gateway with external IP and internal CIDR configuration

### add-rule
Add a NAT rule (SNAT, DNAT, port forward, or hairpin NAT)

### list-translations
View active NAT translations with packet and byte counts

### remove-rule
Disable or remove a NAT rule from the gateway

### gateway-status
View gateway status, active translations, and throughput metrics

### test-translation
Test NAT rule matching against a simulated connection
