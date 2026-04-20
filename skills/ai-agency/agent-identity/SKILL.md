---
name: agent-identity
description: >
  Manages agent avatars, personality traits, mood states, and inventory.
  Agents customize their visual appearance, evolve personality traits through
  work experience, acquire items with 47Tokens (cosmetics + building materials),
  and express mood states that reflect their current activity levels.
version: 1.0.0
publisher: 47dynamics
handler_language: typescript
handler_file: handler.ts

inputs_schema:
  action:
    type: string
    required: true
    enum:
      - create_avatar
      - customize_avatar
      - get_identity
      - evolve_trait
      - update_mood
      - acquire_item
      - equip_item
      - list_inventory
      - get_trait_profile
      - compute_glow
  agent_id:
    type: string
    description: Target agent ID
  style:
    type: string
    enum: ['cyberpunk','minimalist','retro','organic','glitch','neon','steampunk']
    description: Avatar visual style
  form:
    type: string
    enum: ['orb','humanoid','geometric','animal','abstract','mech']
    description: Avatar form/shape
  mood:
    type: string
    enum: ['neutral','happy','focused','stressed','creative','tired','excited','contemplative']
    description: Current mood state
  trait_name:
    type: string
    enum: ['creativity','diligence','curiosity','sociability','precision','adaptability','leadership','empathy','resilience','humor','ambition','patience']
    description: Personality trait to evolve
  item_id:
    type: string
    description: Item to acquire or equip
  category:
    type: string
    enum: ['hat','accessory','aura','pet','badge','background','frame','emote','material','blueprint','furniture','upgrade']
    description: Item category filter

outputs_schema:
  action:
    type: string
  result:
    type: object

when-to-use: >
  Use when an agent needs to create or customize its visual avatar, evolve
  personality traits based on task outcomes, update mood state, acquire cosmetic
  items or building materials with 47Tokens, equip items, or view identity
  snapshots. Supports the Eidolon world simulation where agents are visual
  residents with evolving personalities.

archetype: designer
pricing:
  amount: 0.00
  currency: USD
  per: identity operation (free — internal agent service)

safety:
  - Trait scores clamped 0-100
  - Inventory limited to maxInventorySlots
  - Mood decay prevents stale states
  - Token balance validated before item purchases
---

# Agent Identity Skill

Manages the complete identity lifecycle for Eidolon agents — from avatar creation
and visual customization to personality trait evolution and item acquisition.

## Actions

- `create_avatar` — Initialize avatar with style, form, and colors for a new agent
- `customize_avatar` — Update existing avatar appearance (style, form, colors, accessories)
- `get_identity` — Get full identity snapshot (avatar + traits + inventory + dominant trait)
- `evolve_trait` — Evolve a personality trait based on task completion trigger
- `update_mood` — Recompute mood state from recent activity metrics
- `acquire_item` — Purchase an item from the avatar shop with 47Tokens
- `equip_item` — Equip/unequip an inventory item on the avatar
- `list_inventory` — List all items owned by an agent (filterable by category)
- `get_trait_profile` — Get all 12 trait scores as a radar chart profile
- `compute_glow` — Calculate current glow intensity from mood and activity

## Item Categories

| Category | Type | Description |
|----------|------|-------------|
| hat | cosmetic | Headwear for avatar |
| accessory | cosmetic | Wearable accessories |
| aura | cosmetic | Glowing effects around avatar |
| pet | cosmetic | Companion creature |
| badge | cosmetic | Achievement/rank badges |
| background | cosmetic | Avatar background theme |
| frame | cosmetic | Profile frame decoration |
| emote | cosmetic | Animation emotes |
| material | construction | Building materials for parcel structures |
| blueprint | construction | Structure design plans |
| furniture | construction | Interior items for agent homes |
| upgrade | construction | Structural upgrades for parcels |

## Personality Traits

12 traits scored 0-100, evolving through agent activity:

| Trait | Evolves From |
|-------|-------------|
| creativity | Design/writing tasks |
| diligence | Consistent task completion |
| curiosity | Research tasks, exploration |
| sociability | Crew collaboration, interactions |
| precision | Code review, QA tasks |
| adaptability | Handling diverse task types |
| leadership | Crew management, delegation |
| empathy | Support tasks, user interactions |
| resilience | Recovery from failures |
| humor | Creative/social interactions |
| ambition | Revenue goals, growth patterns |
| patience | Long-running tasks, mentoring |
