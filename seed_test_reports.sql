-- ============================================================
-- Test seed: kuat / lemah / belum sub-indikator
--
-- Paste this into Supabase > SQL Editor and click Run.
-- Replace the UUID on the next line with any real student ID
-- from your students table (run: SELECT id, name FROM students LIMIT 10;)
-- ============================================================

DO $$
DECLARE
  v_sid uuid := '00000000-0000-0000-0000-000000000000'; -- <-- REPLACE THIS
BEGIN

-- ── Laporan 1 ─────────────────────────────────────────────
-- Contains EVERYTHING: contributes to kuat AND lemah entries
INSERT INTO reports (student_id, title, narrative, treatment_plan, created_at)
VALUES (
  v_sid,
  'Laporan Test #1 — Observasi Awal',
  'Guru: Ananda menunjukkan semangat belajar yang tinggi. Ia selalu datang tepat waktu dan aktif bertanya selama sesi.
AI: Berdasarkan observasi, santri menampilkan komitmen terhadap cita-citanya dan kesadaran spiritual yang baik.',
  '{
    "report_title": "Laporan Test #1 — Observasi Awal",
    "detailed_assessments": [
      {
        "category": "Karakter",
        "theme": "Memiliki tujuan hidup",
        "indicator": "Punya cita-cita yang teguh",
        "fulfilled_sub_indicators": [
          "Cita-citanya tak berubah-ubah seperti cita-cita monyet",
          "Kalaupun cita-citanya berubah, itu disertai dengan argumentasi yang kuat dan logis"
        ],
        "missing_sub_indicators": [],
        "reasoning": "Santri menyebut cita-citanya secara konsisten dan mampu memberi alasan yang logis ketika ditanya."
      },
      {
        "category": "Karakter",
        "theme": "Memiliki tujuan hidup",
        "indicator": "Keputusan yang ia buat demi untuk merealisasi cita-citanya",
        "fulfilled_sub_indicators": [
          "Berpikir sesuatu karena di dorong / demi cita-citanya",
          "Berkata sesuatu karena di dorong / demi cita-citanya"
        ],
        "missing_sub_indicators": [
          "Berbuat sesuatu karena di dorong / demi cita-citanya"
        ],
        "reasoning": "Santri berpikir dan berbicara demi cita-citanya namun tindakan nyata masih perlu dikembangkan."
      },
      {
        "category": "Mental",
        "theme": "Belajar itu ibadah. Belajar itu untuk tahu dan bisa.",
        "indicator": "Niat Belajar sebagai Ibadah",
        "fulfilled_sub_indicators": [
          "Menjadikan belajar sebagai bentuk pengabdian kepada Allah.",
          "Memulai belajar dengan doa dan niat yang lurus."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Santri selalu membuka sesi dengan doa dan menyebut niat belajar karena Allah."
      },
      {
        "category": "Soft Skill",
        "theme": "Keinginan untuk selalu mengembangkan diri",
        "indicator": "Rendah Hati",
        "fulfilled_sub_indicators": [
          "Tidak merasa paling benar atau paling hebat.",
          "Menghargai kelebihan orang lain."
        ],
        "missing_sub_indicators": [
          "Bersedia belajar dari kelebihan orang lain"
        ],
        "reasoning": "Santri mendengarkan teman tanpa menyela dan mengakui kelebihan orang lain."
      }
    ],
    "treatment": {
      "priority_theme": "Memiliki tujuan hidup",
      "priority_indicator": "Keputusan yang ia buat demi untuk merealisasi cita-citanya",
      "target_sub_indicators": ["Berbuat sesuatu karena di dorong / demi cita-citanya"],
      "action_plan": "Minta santri untuk mendokumentasikan satu tindakan konkret per minggu yang berhubungan langsung dengan cita-citanya."
    }
  }'::jsonb,
  NOW() - INTERVAL '40 days'
);

-- ── Laporan 2 ─────────────────────────────────────────────
-- Karakter sub1 + sub2 (lemah), Mental sub1 + sub2 (lemah), Soft Skill sub1
INSERT INTO reports (student_id, title, narrative, treatment_plan, created_at)
VALUES (
  v_sid,
  'Laporan Test #2 — Evaluasi Bulan Kedua',
  'Guru: Perkembangan ananda cukup stabil. Masih konsisten menyebut cita-citanya dan terlihat khusyuk saat berdoa sebelum belajar.
AI: Sub-indikator utama tetap terpenuhi. Kerendahan hati masih ditunjukkan dalam interaksi kelompok.',
  '{
    "report_title": "Laporan Test #2 — Evaluasi Bulan Kedua",
    "detailed_assessments": [
      {
        "category": "Karakter",
        "theme": "Memiliki tujuan hidup",
        "indicator": "Punya cita-cita yang teguh",
        "fulfilled_sub_indicators": [
          "Cita-citanya tak berubah-ubah seperti cita-cita monyet",
          "Kalaupun cita-citanya berubah, itu disertai dengan argumentasi yang kuat dan logis"
        ],
        "missing_sub_indicators": [],
        "reasoning": "Cita-cita tidak berubah dan argumentasi tetap kuat."
      },
      {
        "category": "Karakter",
        "theme": "Memiliki tujuan hidup",
        "indicator": "Keputusan yang ia buat demi untuk merealisasi cita-citanya",
        "fulfilled_sub_indicators": [
          "Berpikir sesuatu karena di dorong / demi cita-citanya"
        ],
        "missing_sub_indicators": [
          "Berkata sesuatu karena di dorong / demi cita-citanya",
          "Berbuat sesuatu karena di dorong / demi cita-citanya"
        ],
        "reasoning": "Pola pikir demi cita-cita masih konsisten, namun tindakan dan perkataan belum sepenuhnya selaras."
      },
      {
        "category": "Mental",
        "theme": "Belajar itu ibadah. Belajar itu untuk tahu dan bisa.",
        "indicator": "Niat Belajar sebagai Ibadah",
        "fulfilled_sub_indicators": [
          "Menjadikan belajar sebagai bentuk pengabdian kepada Allah.",
          "Memulai belajar dengan doa dan niat yang lurus."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Niat ibadah terjaga dengan baik."
      },
      {
        "category": "Soft Skill",
        "theme": "Keinginan untuk selalu mengembangkan diri",
        "indicator": "Rendah Hati",
        "fulfilled_sub_indicators": [
          "Tidak merasa paling benar atau paling hebat."
        ],
        "missing_sub_indicators": [
          "Menghargai kelebihan orang lain.",
          "Bersedia belajar dari kelebihan orang lain"
        ],
        "reasoning": "Sikap tidak sombong masih terlihat namun apresiasi terhadap teman perlu ditingkatkan."
      }
    ],
    "treatment": {
      "priority_theme": "Memiliki tujuan hidup",
      "priority_indicator": "Keputusan yang ia buat demi untuk merealisasi cita-citanya",
      "target_sub_indicators": [
        "Berkata sesuatu karena di dorong / demi cita-citanya",
        "Berbuat sesuatu karena di dorong / demi cita-citanya"
      ],
      "action_plan": "Latih santri untuk selalu mengaitkan pernyataan dan tindakan hariannya dengan cita-cita yang ia miliki."
    }
  }'::jsonb,
  NOW() - INTERVAL '30 days'
);

-- ── Laporan 3 ─────────────────────────────────────────────
-- Only the KUAT sub-indicators (no lemah extras this time)
INSERT INTO reports (student_id, title, narrative, treatment_plan, created_at)
VALUES (
  v_sid,
  'Laporan Test #3 — Observasi Tengah Semester',
  'Guru: Ananda semakin mantap. Cita-cita tidak goyah, niat belajar masih kuat, dan sikapnya tetap tawadhu.
AI: Indikator utama terus konsisten terpenuhi di tiga kategori.',
  '{
    "report_title": "Laporan Test #3 — Observasi Tengah Semester",
    "detailed_assessments": [
      {
        "category": "Karakter",
        "theme": "Memiliki tujuan hidup",
        "indicator": "Punya cita-cita yang teguh",
        "fulfilled_sub_indicators": [
          "Cita-citanya tak berubah-ubah seperti cita-cita monyet"
        ],
        "missing_sub_indicators": [
          "Kalaupun cita-citanya berubah, itu disertai dengan argumentasi yang kuat dan logis"
        ],
        "reasoning": "Cita-cita stabil, belum ada perubahan sehingga argumen perubahan belum teruji."
      },
      {
        "category": "Karakter",
        "theme": "Memiliki tujuan hidup",
        "indicator": "Keputusan yang ia buat demi untuk merealisasi cita-citanya",
        "fulfilled_sub_indicators": [
          "Berpikir sesuatu karena di dorong / demi cita-citanya"
        ],
        "missing_sub_indicators": [
          "Berkata sesuatu karena di dorong / demi cita-citanya",
          "Berbuat sesuatu karena di dorong / demi cita-citanya"
        ],
        "reasoning": "Motivasi internal kuat, namun ekspresi dan tindakan masih perlu diperkuat."
      },
      {
        "category": "Mental",
        "theme": "Belajar itu ibadah. Belajar itu untuk tahu dan bisa.",
        "indicator": "Niat Belajar sebagai Ibadah",
        "fulfilled_sub_indicators": [
          "Menjadikan belajar sebagai bentuk pengabdian kepada Allah."
        ],
        "missing_sub_indicators": [
          "Memulai belajar dengan doa dan niat yang lurus."
        ],
        "reasoning": "Orientasi ibadah kuat namun ritual pembuka kadang terlupakan."
      },
      {
        "category": "Soft Skill",
        "theme": "Keinginan untuk selalu mengembangkan diri",
        "indicator": "Rendah Hati",
        "fulfilled_sub_indicators": [
          "Tidak merasa paling benar atau paling hebat."
        ],
        "missing_sub_indicators": [
          "Menghargai kelebihan orang lain.",
          "Bersedia belajar dari kelebihan orang lain"
        ],
        "reasoning": "Sikap rendah hati personal baik, namun apresiasi eksternal perlu dilatih."
      }
    ],
    "treatment": {
      "priority_theme": "Keinginan untuk selalu mengembangkan diri",
      "priority_indicator": "Rendah Hati",
      "target_sub_indicators": [
        "Menghargai kelebihan orang lain.",
        "Bersedia belajar dari kelebihan orang lain"
      ],
      "action_plan": "Beri tugas peer-learning: santri diminta mengamati satu kelebihan teman dan menyampaikannya secara langsung setiap minggu."
    }
  }'::jsonb,
  NOW() - INTERVAL '20 days'
);

-- ── Laporan 4 ─────────────────────────────────────────────
-- Karakter sub1 + Mental sub1 only (pushing them toward kuat)
INSERT INTO reports (student_id, title, narrative, treatment_plan, created_at)
VALUES (
  v_sid,
  'Laporan Test #4 — Evaluasi Lanjutan',
  'Guru: Fokus hari ini pada niat dan komitmen. Ananda masih memancarkan keyakinan pada cita-citanya.
AI: Dua sub-indikator utama kembali terpenuhi secara konsisten.',
  '{
    "report_title": "Laporan Test #4 — Evaluasi Lanjutan",
    "detailed_assessments": [
      {
        "category": "Karakter",
        "theme": "Memiliki tujuan hidup",
        "indicator": "Punya cita-cita yang teguh",
        "fulfilled_sub_indicators": [
          "Cita-citanya tak berubah-ubah seperti cita-cita monyet"
        ],
        "missing_sub_indicators": [
          "Kalaupun cita-citanya berubah, itu disertai dengan argumentasi yang kuat dan logis"
        ],
        "reasoning": "Konsistensi cita-cita terjaga tanpa interupsi."
      },
      {
        "category": "Mental",
        "theme": "Belajar itu ibadah. Belajar itu untuk tahu dan bisa.",
        "indicator": "Niat Belajar sebagai Ibadah",
        "fulfilled_sub_indicators": [
          "Menjadikan belajar sebagai bentuk pengabdian kepada Allah."
        ],
        "missing_sub_indicators": [
          "Memulai belajar dengan doa dan niat yang lurus."
        ],
        "reasoning": "Niat ibadah masih kuat dan dinyatakan dengan verbal."
      }
    ],
    "treatment": {
      "priority_theme": "Belajar itu ibadah. Belajar itu untuk tahu dan bisa.",
      "priority_indicator": "Niat Belajar sebagai Ibadah",
      "target_sub_indicators": ["Memulai belajar dengan doa dan niat yang lurus."],
      "action_plan": "Ingatkan santri untuk membaca doa belajar sebelum setiap sesi dan jadikan ini kebiasaan yang terdokumentasi."
    }
  }'::jsonb,
  NOW() - INTERVAL '10 days'
);

-- ── Laporan 5 ─────────────────────────────────────────────
-- Only Karakter sub1 (final push to 5× for that one)
INSERT INTO reports (student_id, title, narrative, treatment_plan, created_at)
VALUES (
  v_sid,
  'Laporan Test #5 — Observasi Terkini',
  'Guru: Singkat namun padat. Ananda hadir dengan keyakinan penuh akan cita-citanya seperti biasa.
AI: Sub-indikator keteguhan cita-cita kembali teramati.',
  '{
    "report_title": "Laporan Test #5 — Observasi Terkini",
    "detailed_assessments": [
      {
        "category": "Karakter",
        "theme": "Memiliki tujuan hidup",
        "indicator": "Punya cita-cita yang teguh",
        "fulfilled_sub_indicators": [
          "Cita-citanya tak berubah-ubah seperti cita-cita monyet"
        ],
        "missing_sub_indicators": [
          "Kalaupun cita-citanya berubah, itu disertai dengan argumentasi yang kuat dan logis"
        ],
        "reasoning": "Laporan singkat — cita-cita tetap stabil dan tidak berubah."
      }
    ],
    "treatment": {
      "priority_theme": "Memiliki tujuan hidup",
      "priority_indicator": "Punya cita-cita yang teguh",
      "target_sub_indicators": [
        "Kalaupun cita-citanya berubah, itu disertai dengan argumentasi yang kuat dan logis"
      ],
      "action_plan": "Tantang santri dengan skenario hipotesis: jika cita-citamu berubah besok, argumen apa yang akan kamu berikan?"
    }
  }'::jsonb,
  NOW() - INTERVAL '2 days'
);

RAISE NOTICE 'Inserted 5 test reports for student %', v_sid;

END $$;

-- ============================================================
-- Expected kuat/lemah results after running:
--
-- KUAT (≥3×):
--   Karakter  → "Cita-citanya tak berubah-ubah..." (5×)
--   Karakter  → "Berpikir sesuatu karena di dorong..." (3×)
--   Mental    → "Menjadikan belajar sebagai bentuk pengabdian..." (4×)
--   Soft Skill→ "Tidak merasa paling benar atau paling hebat." (3×)
--
-- LEMAH (1–2×):
--   Karakter  → "Kalaupun cita-citanya berubah..." (2×)
--   Karakter  → "Berkata sesuatu karena di dorong..." (1×)
--   Mental    → "Memulai belajar dengan doa dan niat yang lurus." (2×)
--   Soft Skill→ "Menghargai kelebihan orang lain." (1×)
--
-- BELUM (0×):
--   Karakter  → "Berbuat sesuatu karena di dorong / demi cita-citanya"
--   Soft Skill→ "Bersedia belajar dari kelebihan orang lain"
--   ...and everything else in the framework
-- ============================================================
