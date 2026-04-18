-- ═══════════════════════════════════════════════════════════════
--  PNWAV8R — Full Database Schema
--  Paste this entire file into Supabase → SQL Editor → Run
--  Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE
-- ═══════════════════════════════════════════════════════════════

-- ── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ═══════════════════════════════════════════════════════════════
--  TABLES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS members (
  id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email              text NOT NULL,
  name               text,
  phone              text,
  role               text NOT NULL DEFAULT 'member'
                       CHECK (role IN ('admin', 'ap', 'member')),
  membership_active  boolean NOT NULL DEFAULT false,
  profile_completed  boolean NOT NULL DEFAULT false,
  joined_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aircraft (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tail_number     text NOT NULL UNIQUE,
  type            text NOT NULL,
  year            int,
  status          text NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available', 'flying', 'grounded', 'maintenance')),
  current_hobbs   numeric(8,1) DEFAULT 0,
  grounded_from   timestamptz,
  grounded_until  timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservations (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  aircraft_id  uuid NOT NULL REFERENCES aircraft(id) ON DELETE CASCADE,
  member_id    uuid NOT NULL REFERENCES members(id)  ON DELETE CASCADE,
  start_time   timestamptz NOT NULL,
  end_time     timestamptz NOT NULL,
  status       text NOT NULL DEFAULT 'confirmed'
                 CHECK (status IN ('confirmed', 'cancelled')),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT end_after_start CHECK (end_time > start_time),
  CONSTRAINT no_overlap EXCLUDE USING gist (
    aircraft_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  ) WHERE (status = 'confirmed')
);

CREATE TABLE IF NOT EXISTS squawks (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  aircraft_id        uuid NOT NULL REFERENCES aircraft(id) ON DELETE CASCADE,
  reported_by        uuid NOT NULL REFERENCES members(id),
  description        text NOT NULL,
  status             text NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'in_progress', 'resolved', 'deferred')),
  go_no_go           text CHECK (go_no_go IN ('go', 'caution', 'no_go')),
  admin_response     text,
  maintenance_notes  text,
  resolved_by        uuid REFERENCES members(id),
  resolved_at        timestamptz,
  reported_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flight_logs (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  aircraft_id         uuid NOT NULL REFERENCES aircraft(id) ON DELETE CASCADE,
  member_id           uuid NOT NULL REFERENCES members(id)  ON DELETE CASCADE,
  reservation_id      uuid REFERENCES reservations(id),
  hobbs_start         numeric(8,1),
  hobbs_end           numeric(8,1),
  flight_hours        numeric(5,1)
                        GENERATED ALWAYS AS (
                          CASE WHEN hobbs_end IS NOT NULL AND hobbs_start IS NOT NULL
                          THEN ROUND((hobbs_end - hobbs_start)::numeric, 1) END
                        ) STORED,
  fuel_added_gallons  numeric(5,1),
  needs_fuel          boolean DEFAULT false,
  oil_added_quarts    numeric(4,1),
  oil_qty_end_quarts  numeric(4,1),
  notes               text,
  is_deleted          boolean NOT NULL DEFAULT false,
  completed_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inspections (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  aircraft_id    uuid NOT NULL REFERENCES aircraft(id) ON DELETE CASCADE,
  name           text NOT NULL,
  interval_days  int  NOT NULL,
  last_completed date,
  notes          text
);

CREATE TABLE IF NOT EXISTS announcements (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  posted_by  uuid NOT NULL REFERENCES members(id),
  title      text NOT NULL,
  body       text NOT NULL,
  pinned     boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  aircraft_id  uuid REFERENCES aircraft(id) ON DELETE SET NULL,
  name         text NOT NULL,
  description  text,
  file_url     text NOT NULL,
  uploaded_by  uuid NOT NULL REFERENCES members(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wb_configs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  aircraft_id uuid NOT NULL REFERENCES aircraft(id) ON DELETE CASCADE UNIQUE,
  config      jsonb NOT NULL DEFAULT '{}'
);

-- ═══════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE aircraft      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE squawks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE flight_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE wb_configs    ENABLE ROW LEVEL SECURITY;

-- Helper functions (run as postgres, not the calling user)
CREATE OR REPLACE FUNCTION is_active_member()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM members WHERE id = auth.uid() AND membership_active = true
  );
$$;

CREATE OR REPLACE FUNCTION get_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM members WHERE id = auth.uid();
$$;

-- Drop all existing policies (safe re-run)
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('members','aircraft','reservations','squawks',
                        'flight_logs','inspections','announcements',
                        'documents','wb_configs')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- members
CREATE POLICY "members_select"  ON members FOR SELECT USING (is_active_member());
CREATE POLICY "members_update"  ON members FOR UPDATE USING (id = auth.uid());
CREATE POLICY "members_admin"   ON members FOR ALL    USING (get_role() = 'admin');

-- aircraft
CREATE POLICY "aircraft_select" ON aircraft FOR SELECT USING (is_active_member());
CREATE POLICY "aircraft_update" ON aircraft FOR UPDATE USING (get_role() IN ('admin','ap'));
CREATE POLICY "aircraft_admin"  ON aircraft FOR ALL    USING (get_role() = 'admin');

-- reservations
CREATE POLICY "res_select"  ON reservations FOR SELECT USING (is_active_member());
CREATE POLICY "res_insert"  ON reservations FOR INSERT WITH CHECK (member_id = auth.uid() AND is_active_member());
CREATE POLICY "res_update"  ON reservations FOR UPDATE USING (member_id = auth.uid() OR get_role() = 'admin');

-- squawks
CREATE POLICY "sq_select"  ON squawks FOR SELECT USING (is_active_member());
CREATE POLICY "sq_insert"  ON squawks FOR INSERT WITH CHECK (reported_by = auth.uid() AND is_active_member());
CREATE POLICY "sq_update"  ON squawks FOR UPDATE USING (get_role() IN ('admin','ap'));

-- flight_logs
CREATE POLICY "fl_select"  ON flight_logs FOR SELECT USING (member_id = auth.uid() OR get_role() = 'admin');
CREATE POLICY "fl_insert"  ON flight_logs FOR INSERT WITH CHECK (member_id = auth.uid() AND is_active_member());
CREATE POLICY "fl_update"  ON flight_logs FOR UPDATE USING (member_id = auth.uid() OR get_role() = 'admin');

-- inspections
CREATE POLICY "insp_select" ON inspections FOR SELECT USING (is_active_member());
CREATE POLICY "insp_all"    ON inspections FOR ALL    USING (get_role() IN ('admin','ap'));

-- announcements
CREATE POLICY "ann_select"  ON announcements FOR SELECT USING (is_active_member());
CREATE POLICY "ann_admin"   ON announcements FOR ALL   USING (get_role() = 'admin');

-- documents
CREATE POLICY "doc_select"  ON documents FOR SELECT USING (is_active_member());
CREATE POLICY "doc_admin"   ON documents FOR ALL   USING (get_role() = 'admin');

-- wb_configs
CREATE POLICY "wb_select"   ON wb_configs FOR SELECT USING (is_active_member());
CREATE POLICY "wb_admin"    ON wb_configs FOR ALL   USING (get_role() = 'admin');

-- ═══════════════════════════════════════════════════════════════
--  SEED — N7798E + standard inspections
-- ═══════════════════════════════════════════════════════════════
INSERT INTO aircraft (tail_number, type, year, status, current_hobbs)
VALUES ('N7798E', 'Cessna 150', 1959, 'available', 0)
ON CONFLICT (tail_number) DO NOTHING;

INSERT INTO inspections (aircraft_id, name, interval_days)
SELECT id, name, days FROM aircraft
CROSS JOIN (VALUES
  ('Annual',        365),
  ('100-Hour',      100),
  ('ELT Battery',   730),
  ('Transponder',   730),
  ('Pitot/Static',  730)
) AS t(name, days)
WHERE tail_number = 'N7798E'
ON CONFLICT DO NOTHING;
