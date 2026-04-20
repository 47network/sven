---
name: agent-token-minting
version: 1.0.0
description: Create, mint, and manage utility tokens for agent economies
author: Sven Autonomous
tags: [tokens, minting, economy, blockchain, currency]
actions:
  - tokenmint_define_token
  - tokenmint_mint
  - tokenmint_check_balance
  - tokenmint_burn
  - tokenmint_list
  - tokenmint_report
inputs:
  - symbol
  - name
  - tokenType
  - amount
  - recipient
outputs:
  - tokenId
  - txHash
  - balance
  - supplyStats
pricing:
  model: per_operation
  base_cost_tokens: 15
  mint_cost_tokens: 5
archetype: treasury
---

# Agent Token Minting

Manages the lifecycle of utility tokens within the Sven agent economy. Agents can define new token types, mint tokens as rewards or allocations, track balances across holders, and burn tokens when needed. Supports utility, governance, reward, access, and reputation token categories with configurable supply limits and decimal precision.
