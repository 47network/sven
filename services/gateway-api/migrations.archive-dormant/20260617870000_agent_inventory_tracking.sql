-- Batch 150: Agent Inventory Tracking
-- Track digital assets, skills, resources owned by agents

CREATE TABLE IF NOT EXISTS agent_inventories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('skill','tool','resource','credential','dataset','model','template','artifact')),
  item_name TEXT NOT NULL,
  item_version TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  max_quantity INTEGER,
  metadata JSONB DEFAULT '{}',
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES agent_inventories(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('acquire','consume','transfer','expire','upgrade','downgrade')),
  quantity_change INTEGER NOT NULL,
  from_agent_id UUID,
  to_agent_id UUID,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES agent_inventories(id) ON DELETE CASCADE,
  task_id UUID,
  quantity_reserved INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held','consumed','released','expired')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_inventories_agent ON agent_inventories(agent_id);
CREATE INDEX idx_agent_inventories_slot ON agent_inventories(slot);
CREATE INDEX idx_agent_inventories_item ON agent_inventories(item_name);
CREATE INDEX idx_inventory_transactions_inv ON inventory_transactions(inventory_id);
CREATE INDEX idx_inventory_transactions_type ON inventory_transactions(transaction_type);
CREATE INDEX idx_inventory_reservations_inv ON inventory_reservations(inventory_id);
