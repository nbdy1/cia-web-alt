-- ============================================================
-- Seed: Insert 16 new students assigned to a specific ustadz
--
-- Replace each 'Student N' with the real student name before
-- running this in Supabase > SQL Editor.
-- ============================================================

INSERT INTO public.students (name, assigned_ustadz_id)
VALUES
  ('Student 1',  'bcd6c569-c391-4074-a7bf-2e20b82f9c06'),
  ('Student 2',  'bcd6c569-c391-4074-a7bf-2e20b82f9c06'),
  ('Student 3',  'bcd6c569-c391-4074-a7bf-2e20b82f9c06'),
  ('Student 4',  'bcd6c569-c391-4074-a7bf-2e20b82f9c06'),
  ('Student 5',  'bcd6c569-c391-4074-a7bf-2e20b82f9c06'),
  ('Student 6',  'bcd6c569-c391-4074-a7bf-2e20b82f9c06'),
  ('Student 7',  'bcd6c569-c391-4074-a7bf-2e20b82f9c06'),
  ('Student 8',  'bcd6c569-c391-4074-a7bf-2e20b82f9c06'),
  ('Student 9',  'bcd6c569-c391-4074-a7bf-2e20b82f9c06'),
  ('Student 10', 'bcd6c569-c391-4074-a7bf-2e20b82f9c06'),
  ('Student 11', 'bcd6c569-c391-4074-a7bf-2e20b82f9c06'),
  ('Student 12', 'bcd6c569-c391-4074-a7bf-2e20b82f9c06'),
  ('Student 13', 'bcd6c569-c391-4074-a7bf-2e20b82f9c06'),
  ('Student 14', 'bcd6c569-c391-4074-a7bf-2e20b82f9c06'),
  ('Student 15', 'bcd6c569-c391-4074-a7bf-2e20b82f9c06'),
  ('Student 16', 'bcd6c569-c391-4074-a7bf-2e20b82f9c06');

-- Verify
SELECT id, name, assigned_ustadz_id
FROM public.students
WHERE assigned_ustadz_id = 'bcd6c569-c391-4074-a7bf-2e20b82f9c06'
  AND (is_removed IS NULL OR is_removed = false)
ORDER BY name;
