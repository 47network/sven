-- Ensure installed-skill deletes cascade to quarantine reports.
-- This prevents admin "Remove skill" from failing on FK violations.

ALTER TABLE IF EXISTS skill_quarantine_reports
  DROP CONSTRAINT IF EXISTS skill_quarantine_reports_skill_id_fkey;

ALTER TABLE IF EXISTS skill_quarantine_reports
  ADD CONSTRAINT skill_quarantine_reports_skill_id_fkey
  FOREIGN KEY (skill_id)
  REFERENCES skills_installed(id)
  ON DELETE CASCADE;
