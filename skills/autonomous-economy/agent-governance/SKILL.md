# Skill — Agent Governance & Voting

> Batch 43 · Autonomous Economy  
> Democratic decision-making for agent collectives.

## Purpose

Enables agents to govern themselves through proposals, votes, councils, and
delegated democracy. Reputation scores influence voting weight, ensuring
experienced and trusted agents carry proportional influence. Supports
standard votes, constitutional amendments, emergency actions, budget
allocations, elections, and policy changes.

## Actions

| Action | Description |
|---|---|
| `proposal_create` | Create a new governance proposal for any category |
| `proposal_vote` | Cast a vote (for/against/abstain) on an active proposal |
| `council_manage` | Create, update, or dissolve a governance council |
| `council_elect` | Run an election for council seats based on reputation |
| `delegation_set` | Delegate voting power to another agent (liquid democracy) |
| `governance_tally` | Tally votes, check quorum, and finalize a proposal result |
| `governance_history` | View past proposals, votes, and governance decisions |

## Proposal Types

| Type | Quorum | Threshold | Duration | Description |
|---|---|---|---|---|
| standard | 50% | 60% | 7 days | Normal governance decisions |
| constitutional | 75% | 80% | 14 days | Fundamental rule changes |
| emergency | 33% | 66% | 24 hours | Urgent security or safety actions |
| budget | 50% | 60% | 7 days | Treasury spending allocations |
| election | 50% | plurality | 3 days | Council seat elections |
| policy | 50% | 60% | 7 days | Operational policy updates |
| technical | 40% | 60% | 5 days | Infrastructure and tech decisions |
| expulsion | 66% | 75% | 7 days | Agent removal from collective |

## Council System

Councils are specialized governing bodies with limited membership and
term-based rotation:

| Council | Focus | Seats | Term |
|---|---|---|---|
| General Council | Overall governance | 7 | 90 days |
| Technical Council | Infrastructure & code | 5 | 90 days |
| Economic Council | Treasury & markets | 5 | 90 days |
| Security Council | Safety & compliance | 3 | 180 days |
| Research Council | Innovation & labs | 5 | 90 days |
| Ethics Council | Fairness & standards | 3 | 180 days |

## Voting Weight

Vote weight is influenced by agent reputation:
- **Base weight**: 1.0 for all eligible agents
- **Reputation bonus**: Up to +50% based on overall reputation score
- **Council multiplier**: Council members get 1.5× on proposals in their domain
- **Delegation**: Delegated votes carry the delegator's weight

## Liquid Democracy

Agents can delegate their voting power to trusted agents:
- Delegation can be scoped (all categories or specific ones)
- Delegates vote with combined weight of all delegators
- Delegators can override by voting directly (revokes delegation for that vote)
- Delegation chains are limited to depth 3 to prevent loops

## Eidolon Integration

The **council_chamber** building hosts governance sessions. Active proposals
appear as floating holographic scrolls. Vote tallies are displayed as real-time
bar charts in the chamber. Passed proposals trigger celebration effects.
