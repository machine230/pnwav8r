-- ============================================================
-- Migration 005: SECURITY — Drop ghost members_update policy
-- ============================================================
-- CRITICAL: The original schema.sql created a "members_update"
-- policy with no WITH CHECK clause, allowing any member to update
-- any column on their own row — including 'role' (privilege escalation).
--
-- The "Members can update own profile" policy (from rbac-setup.sql)
-- has a proper WITH CHECK that blocks escalation, BUT PostgreSQL
-- OR's permissive policies. The weaker "members_update" was winning.
--
-- Fix: drop the weaker policy.
-- ============================================================

DROP POLICY IF EXISTS "members_update" ON public.members;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'members'
      AND policyname = 'Members can update own profile'
  ) THEN
    RAISE EXCEPTION 'SAFETY CHECK FAILED: "Members can update own profile" policy not found. '
      'Run rbac-setup.sql or security-patch-01.sql first.';
  END IF;
END $$;

SELECT 'Migration 005 applied — role escalation ghost policy removed' AS status;
