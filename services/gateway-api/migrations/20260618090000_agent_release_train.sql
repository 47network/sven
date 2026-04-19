-- Agent Release Train migration
-- Batch 172: coordinated release scheduling and deployment trains

CREATE TABLE IF NOT EXISTS agent_release_trains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  train_name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  schedule_type VARCHAR(50) NOT NULL CHECK (schedule_type IN ('weekly','biweekly','monthly','quarterly','on_demand','continuous')),
  status VARCHAR(30) DEFAULT 'planning' CHECK (status IN ('planning','boarding','locked','testing','deploying','deployed','cancelled')),
  conductor_agent_id UUID,
  departure_at TIMESTAMPTZ,
  deployed_at TIMESTAMPTZ,
  target_environments TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_release_cars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  train_id UUID NOT NULL REFERENCES agent_release_trains(id),
  car_name VARCHAR(255) NOT NULL,
  component VARCHAR(255) NOT NULL,
  change_type VARCHAR(30) NOT NULL CHECK (change_type IN ('feature','bugfix','hotfix','refactor','dependency','config','migration')),
  status VARCHAR(30) DEFAULT 'boarding' CHECK (status IN ('boarding','ready','testing','approved','rejected','deployed')),
  owner_agent_id UUID,
  commit_ref VARCHAR(100),
  test_results JSONB DEFAULT '{}',
  risk_level VARCHAR(20) DEFAULT 'low' CHECK (risk_level IN ('critical','high','medium','low')),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_release_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  train_id UUID NOT NULL REFERENCES agent_release_trains(id),
  gate_name VARCHAR(255) NOT NULL,
  gate_type VARCHAR(50) NOT NULL CHECK (gate_type IN ('automated_test','manual_approval','security_scan','performance_check','compliance_review','rollback_plan')),
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','passed','failed','skipped','waived')),
  required BOOLEAN DEFAULT true,
  evaluator_agent_id UUID,
  evaluation_data JSONB DEFAULT '{}',
  evaluated_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_release_trains_status ON agent_release_trains(status);
CREATE INDEX idx_release_trains_schedule ON agent_release_trains(schedule_type);
CREATE INDEX idx_release_cars_train ON agent_release_cars(train_id);
CREATE INDEX idx_release_cars_status ON agent_release_cars(status);
CREATE INDEX idx_release_gates_train ON agent_release_gates(train_id);
CREATE INDEX idx_release_gates_status ON agent_release_gates(status);
