CREATE TABLE IF NOT EXISTS agent_registry (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_code text NOT NULL,
  callsign text NOT NULL,
  machine_name text,
  agent_version text,
  local_ip text,
  status text DEFAULT 'ONLINE',
  last_heartbeat timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_code, callsign)
);

ALTER TABLE agent_registry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON agent_registry;
CREATE POLICY "Enable all operations for authenticated users" ON agent_registry FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Enable all operations for anon" ON agent_registry;
CREATE POLICY "Enable all operations for anon" ON agent_registry FOR ALL TO anon USING (true) WITH CHECK (true);
