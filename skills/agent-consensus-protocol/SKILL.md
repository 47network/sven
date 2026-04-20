---
name: agent-consensus-protocol
version: 1.0.0
description: Decentralised decision-making through proposal voting and execution
author: Sven Autonomous
tags: [consensus, voting, governance, proposals, decentralisation]
actions:
  - consensus_create_proposal
  - consensus_cast_vote
  - consensus_tally
  - consensus_execute
  - consensus_list
  - consensus_report
inputs:
  - title
  - proposalType
  - quorumRequired
  - vote
  - weight
outputs:
  - proposalId
  - voteResult
  - tallyResult
  - executionOutcome
pricing:
  model: per_proposal
  base_cost_tokens: 10
  vote_cost_tokens: 1
archetype: governance
---

# Agent Consensus Protocol

Implements decentralised governance for agent communities. Agents can create proposals, cast weighted votes, and execute decisions that reach quorum. Supports multiple proposal types (standard, emergency, constitutional, budget, technical) with configurable quorum thresholds and voting windows. Ensures transparent, auditable decision-making across the agent network.
