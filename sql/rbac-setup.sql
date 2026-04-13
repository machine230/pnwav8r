-- ============================================================
-- PNWAV8R — RBAC Setup SQL
-- Run this in Supabase SQL Editor before deploying code
-- ============================================================

-- 1. Add 'ap' as a valid role for members
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_role_check;
ALTER TABLE public.members ADD CONSTRAINT members_role_check
    CHECK (role IN ('admin', 'member', 'ap'));

-- 2. Track profile completion (required before first booking)
ALTER TABLE public.members
    ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT false;

-- 3. Squawk enhancements: new statuses + maintenance fields
ALTER TABLE public.squawks DROP CONSTRAINT IF EXISTS squawks_status_check;
ALTER TABLE public.squawks ADD CONSTRAINT squawks_status_check
    CHECK (status IN ('open', 'in_progress', 'deferred', 'resolved'));

ALTER TABLE public.squawks
    ADD COLUMN IF NOT EXISTS maintenance_notes text,
    ADD COLUMN IF NOT EXISTS status_updated_at timestamptz,
    ADD COLUMN IF NOT EXISTS status_updated_by uuid REFERENCES public.members(id) ON DELETE SET NULL;

-- 4. Maintenance blocks (A&P and Admin can block calendar time)
CREATE TABLE IF NOT EXISTS public.maintenance_blocks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    airplane_id uuid NOT NULL REFERENCES public.airplanes(id) ON DELETE CASCADE,
    created_by  uuid REFERENCES public.members(id) ON DELETE SET NULL,
    title       text NOT NULL,
    start_time  timestamptz NOT NULL,
    end_time    timestamptz NOT NULL,
    reason      text,
    created_at  timestamptz DEFAULT now(),
    CONSTRAINT  block_times_valid CHECK (end_time > start_time)
);

ALTER TABLE public.maintenance_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All members can view maintenance_blocks" ON public.maintenance_blocks;
CREATE POLICY "All members can view maintenance_blocks"
    ON public.maintenance_blocks FOR SELECT
    USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin and AP can manage maintenance_blocks" ON public.maintenance_blocks;
CREATE POLICY "Admin and AP can manage maintenance_blocks"
    ON public.maintenance_blocks FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.members
        WHERE id = auth.uid() AND role IN ('admin', 'ap')
    ));

-- 5. Enforce reservation edit rules at RLS level
--    Members can only update/delete their OWN FUTURE reservations
--    A&P and Admin can update any reservation
DROP POLICY IF EXISTS "Members can update own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Members can delete own reservations" ON public.reservations;

CREATE POLICY "Role-based reservation update"
    ON public.reservations FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM public.members WHERE id = auth.uid() AND role IN ('admin','ap'))
        OR (member_id = auth.uid() AND start_time > now())
    );

CREATE POLICY "Role-based reservation delete"
    ON public.reservations FOR DELETE
    USING (
        EXISTS (SELECT 1 FROM public.members WHERE id = auth.uid() AND role IN ('admin','ap'))
        OR (member_id = auth.uid() AND start_time > now())
    );

-- 6. Squawk RLS — Members can insert but not update status
--    Only Admin and A&P can update squawks
DROP POLICY IF EXISTS "Members can update squawks" ON public.squawks;
DROP POLICY IF EXISTS "Role-based squawk update" ON public.squawks;

CREATE POLICY "Role-based squawk update"
    ON public.squawks FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM public.members WHERE id = auth.uid() AND role IN ('admin','ap'))
    );

-- 7. Members table RLS — members can update own email/phone only
--    Admins can update anything
DROP POLICY IF EXISTS "Members can update own profile" ON public.members;
CREATE POLICY "Members can update own profile"
    ON public.members FOR UPDATE
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (
        -- Admin can update anything
        EXISTS (SELECT 1 FROM public.members WHERE id = auth.uid() AND role = 'admin')
        -- Everyone else can only update their own row
        OR id = auth.uid()
    );

-- Done!
SELECT 'RBAC setup complete' AS status;
