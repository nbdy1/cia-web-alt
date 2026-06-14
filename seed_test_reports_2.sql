-- ============================================================
-- Test seed #2: multi-theme coverage for radar chart testing
-- Adds 3 reports that spread across many themes in all 3 categories.
--
-- After running seed_test_reports.sql (5 reports) THEN this file,
-- the radar chart will show spokes in multiple directions.
--
-- Replace the UUID below with the same student ID you used before.
-- ============================================================

DO $$
DECLARE
  v_sid uuid := '00000000-0000-0000-0000-000000000000'; -- <-- REPLACE THIS
BEGIN

-- ── Laporan 6 ─────────────────────────────────────────────
-- Comprehensive: hits many new themes across all 3 categories.
-- This is the only report for several themes → those will be LEMAH (1×).
INSERT INTO reports (student_id, title, narrative, treatment_plan, created_at)
VALUES (
  v_sid,
  'Laporan Test #6 — Observasi Komprehensif I',
  'Guru: Sesi observasi panjang hari ini. Ananda menunjukkan banyak sisi positif: kepemimpinan, disiplin waktu, semangat ibadah, dan kepedulian sosial semuanya tampak dalam satu sesi.
AI: Beragam sub-indikator dari banyak tema teramati secara bersamaan.',
  '{
    "report_title": "Laporan Test #6 — Observasi Komprehensif I",
    "detailed_assessments": [
      {
        "category": "Karakter",
        "theme": "Mampu memimpin & dipimpin",
        "indicator": "Santri yang bisa memimpin",
        "fulfilled_sub_indicators": [
          "Berpikiran Positif ; Mampu membangun suasana optimis dan mendorong tim untuk",
          "Memiliki Kepercayaan diri yang baik ; Menunjukkan keyakinan dalam mengambil"
        ],
        "missing_sub_indicators": [
          "Pandai berkomunikasi ; Menyampaikan visi dengan jelas, pembicara yang baik, juga",
          "Memiliki Integritas ; yang diucapkan sama dengan yang dilakukan.",
          "Kreatif dalam mencari solusi"
        ],
        "reasoning": "Santri tampil percaya diri dan optimis saat memimpin diskusi kelompok."
      },
      {
        "category": "Karakter",
        "theme": "Mampu memimpin & dipimpin",
        "indicator": "Santri yang bisa dipimpin",
        "fulfilled_sub_indicators": [
          "Rendah hati ; mau dan rela dipimpin tanpa merasa direndahkan.",
          "Mau dikritik dan mampu belajar dari kritikan."
        ],
        "missing_sub_indicators": [
          "Disiplin ; mentaati peraturan",
          "Punya tanggung jawab ; Menjalankan tugas sesuai arahan dengan konsisten."
        ],
        "reasoning": "Menerima arahan ustadz dengan lapang dada dan merespons kritik secara konstruktif."
      },
      {
        "category": "Karakter",
        "theme": "Mampu mengatur diri & waktu dengan baik",
        "indicator": "Disiplin",
        "fulfilled_sub_indicators": [
          "Mampu menahan diri dari hal-hal yang tidak penting.",
          "Menjalankan rutinitas tanpa harus selalu diawasi."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Hadir tepat waktu dan menyelesaikan jadwal harian tanpa perlu diingatkan."
      },
      {
        "category": "Karakter",
        "theme": "Mampu mengatur diri & waktu dengan baik",
        "indicator": "Tahu skala prioritas",
        "fulfilled_sub_indicators": [
          "Tahu mana yang harus dilakukan terlebih dahulu.",
          "Tidak mudah tergoda oleh hal-hal yang kurang bermanfaat."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Memilih menyelesaikan tugas sebelum bermain; menunjukkan prioritas yang matang."
      },
      {
        "category": "Karakter",
        "theme": "Konsisten ibadahnya & memiliki hubungan yang kuat dengan Al-Quran",
        "indicator": "Konsistensi Ibadah & Keterikatan Al-Quran",
        "fulfilled_sub_indicators": [
          "Tekun menegakkan shalat; menjaga shalat wajib tepat waktu dan berusaha menambah shalat sunnah.",
          "Tidak meninggalkan ibadah meski sibuk atau lelah."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Tidak pernah absen shalat berjamaah bahkan di hari-hari ujian."
      },
      {
        "category": "Karakter",
        "theme": "Menjadikan Islam sebagai identitas diri yang utama",
        "indicator": "Aqidahnya kokoh",
        "fulfilled_sub_indicators": [
          "Menjadikan tauhid sebagai fondasi hidup.",
          "Keyakinan terhadap Allah dan Rasul-Nya menjadi pusat orientasi diri."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Dalam setiap percakapan, selalu merujuk kembali ke tauhid sebagai dasar."
      },
      {
        "category": "Karakter",
        "theme": "Memiliki daya tahan yang baik terhadap tekanan, kesulitan, & stress",
        "indicator": "Stabilitas Emosi",
        "fulfilled_sub_indicators": [
          "Tetap tenang meski menghadapi tekanan berat.",
          "Tidak mudah meledak atau panik dalam situasi sulit."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Saat hafalan gagal, tidak panik melainkan mengulang dengan tenang."
      },
      {
        "category": "Mental",
        "theme": "Benar, baik, dan indah.",
        "indicator": "Menjadikan nilai \"Benar\" sebagai Fondasi",
        "fulfilled_sub_indicators": [
          "Memastikan setiap pilihan dan tindakan sesuai syariat Allah.",
          "Tidak mengorbankan prinsip halal-haram demi keuntungan duniawi."
        ],
        "missing_sub_indicators": [
          "Menjadikan wahyu sebagai kompas utama dalam hidup."
        ],
        "reasoning": "Menolak ajakan teman yang bertentangan dengan syariat dengan cara yang sopan."
      },
      {
        "category": "Mental",
        "theme": "Berpikir Besar",
        "indicator": "Visinya sampai akhirat",
        "fulfilled_sub_indicators": [
          "Visi misi dan cita-citanya bukan cuma dunia saja tapi sekaligus akhirat",
          "Tidak hanya memikirkan diri sendiri, tetapi juga dampak bagi masyarakat dan umat."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Menyebut ingin mendirikan pesantren untuk umat sebagai bagian dari cita-citanya."
      },
      {
        "category": "Mental",
        "theme": "Mental Inisiatif",
        "indicator": "Ia Proaktif",
        "fulfilled_sub_indicators": [
          "Tidak menunggu diperintah, langsung bergerak ketika melihat peluang atau masalah.",
          "Mampu membaca situasi dan bertindak cepat."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Mengusulkan solusi tanpa diminta saat ada masalah logistik kegiatan."
      },
      {
        "category": "Mental",
        "theme": "Mandiri",
        "indicator": "Kemandirian Perilaku",
        "fulfilled_sub_indicators": [
          "Berani membuat keputusan sendiri dan siap menanggung konsekuensinya.",
          "Mampu menuntaskan pekerjaan tanpa harus selalu diarahkan."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Menyelesaikan tugas kelompok bahkan saat pendamping tidak ada."
      },
      {
        "category": "Mental",
        "theme": "Daya Juang..",
        "indicator": "Ia memiliki ketangguhan",
        "fulfilled_sub_indicators": [
          "Tidak mudah goyah meski menghadapi kesulitan panjang.",
          "Tetap fokus pada tujuan meski hasil belum terlihat."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Bertahan mengulang hafalan yang sulit selama berminggu-minggu tanpa mengeluh."
      },
      {
        "category": "Soft Skill",
        "theme": "Menyayangi manusia, dalam wujud memaafkan & memaklumi",
        "indicator": "Mudah memaklumi keterbatasan",
        "fulfilled_sub_indicators": [
          "Menyadari bahwa setiap orang punya kelemahan.",
          "Tidak menuntut kesempurnaan dari orang lain."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Tidak marah ketika teman kelompoknya membuat kesalahan."
      },
      {
        "category": "Soft Skill",
        "theme": "Kesetiaan pada tujuan",
        "indicator": "Konsistensi dalam Sikap",
        "fulfilled_sub_indicators": [
          "Memperlakukan orang lain dengan cara yang selaras dengan tujuan hidupnya.",
          "Tidak mudah berubah sikap hanya karena tekanan atau kepentingan sesaat."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Tetap berpegang pada prinsipnya meski ditekan oleh teman sebaya."
      },
      {
        "category": "Soft Skill",
        "theme": "Kekuatan untuk mengelola konflik",
        "indicator": "Tenang & Dewasa",
        "fulfilled_sub_indicators": [
          "Tidak mudah terpancing emosi saat berhadapan dengan perbedaan.",
          "Menunjukkan sikap sabar dan bijak dalam merespons orang lain."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Melerai perdebatan antar teman dengan tenang dan bijak."
      },
      {
        "category": "Soft Skill",
        "theme": "Pandai membujuk orang (Persuasif)",
        "indicator": "Komunikasi yang Ramah & Hangat",
        "fulfilled_sub_indicators": [
          "Menyampaikan pesan dengan bahasa yang sopan dan menyenangkan.",
          "Membuat orang lain merasa dihargai dan nyaman."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Berhasil mengajak teman yang malas untuk ikut serta dengan pendekatan yang hangat."
      }
    ],
    "treatment": {
      "priority_theme": "Mampu memimpin & dipimpin",
      "priority_indicator": "Santri yang bisa memimpin",
      "target_sub_indicators": [
        "Pandai berkomunikasi ; Menyampaikan visi dengan jelas, pembicara yang baik, juga",
        "Memiliki Integritas ; yang diucapkan sama dengan yang dilakukan."
      ],
      "action_plan": "Beri santri kesempatan memimpin sesi diskusi mingguan dan berikan umpan balik spesifik tentang cara komunikasinya."
    }
  }'::jsonb,
  NOW() - INTERVAL '8 days'
);

-- ── Laporan 7 ─────────────────────────────────────────────
-- Covers same themes as #6 EXCEPT Karakter T24 dan SS T9 (those stay at 1×/LEMAH).
-- This pushes T2, T3, T5, T10 (Karakter), T2, T8, T10, T13 (Mental), T3, T4, T6 (SS) to 2×.
INSERT INTO reports (student_id, title, narrative, treatment_plan, created_at)
VALUES (
  v_sid,
  'Laporan Test #7 — Observasi Komprehensif II',
  'Guru: Pekan ini ananda kembali menunjukkan konsistensi. Kepemimpinan, disiplin, dan semangat ibadah masih tampak kuat. Daya juang juga terlihat meningkat.
AI: Sub-indikator yang teramati pekan lalu sebagian besar berulang.',
  '{
    "report_title": "Laporan Test #7 — Observasi Komprehensif II",
    "detailed_assessments": [
      {
        "category": "Karakter",
        "theme": "Mampu memimpin & dipimpin",
        "indicator": "Santri yang bisa memimpin",
        "fulfilled_sub_indicators": [
          "Berpikiran Positif ; Mampu membangun suasana optimis dan mendorong tim untuk",
          "Memiliki Kepercayaan diri yang baik ; Menunjukkan keyakinan dalam mengambil"
        ],
        "missing_sub_indicators": [
          "Pandai berkomunikasi ; Menyampaikan visi dengan jelas, pembicara yang baik, juga",
          "Memiliki Integritas ; yang diucapkan sama dengan yang dilakukan.",
          "Kreatif dalam mencari solusi"
        ],
        "reasoning": "Kembali memimpin dengan optimis dan percaya diri."
      },
      {
        "category": "Karakter",
        "theme": "Mampu memimpin & dipimpin",
        "indicator": "Santri yang bisa dipimpin",
        "fulfilled_sub_indicators": [
          "Rendah hati ; mau dan rela dipimpin tanpa merasa direndahkan.",
          "Mau dikritik dan mampu belajar dari kritikan."
        ],
        "missing_sub_indicators": [
          "Disiplin ; mentaati peraturan",
          "Punya tanggung jawab ; Menjalankan tugas sesuai arahan dengan konsisten."
        ],
        "reasoning": "Menerima masukan dengan sikap yang baik."
      },
      {
        "category": "Karakter",
        "theme": "Mampu mengatur diri & waktu dengan baik",
        "indicator": "Disiplin",
        "fulfilled_sub_indicators": [
          "Mampu menahan diri dari hal-hal yang tidak penting.",
          "Menjalankan rutinitas tanpa harus selalu diawasi."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Rutinitas harian terjaga tanpa pengingat."
      },
      {
        "category": "Karakter",
        "theme": "Mampu mengatur diri & waktu dengan baik",
        "indicator": "Tahu skala prioritas",
        "fulfilled_sub_indicators": [
          "Tahu mana yang harus dilakukan terlebih dahulu."
        ],
        "missing_sub_indicators": [
          "Tidak mudah tergoda oleh hal-hal yang kurang bermanfaat."
        ],
        "reasoning": "Prioritas masih baik, namun sesekali masih tergoda gadget."
      },
      {
        "category": "Karakter",
        "theme": "Konsisten ibadahnya & memiliki hubungan yang kuat dengan Al-Quran",
        "indicator": "Konsistensi Ibadah & Keterikatan Al-Quran",
        "fulfilled_sub_indicators": [
          "Tekun menegakkan shalat; menjaga shalat wajib tepat waktu dan berusaha menambah shalat sunnah."
        ],
        "missing_sub_indicators": [
          "Tidak meninggalkan ibadah meski sibuk atau lelah."
        ],
        "reasoning": "Shalat wajib konsisten, shalat sunnah masih perlu didorong."
      },
      {
        "category": "Karakter",
        "theme": "Menjadikan Islam sebagai identitas diri yang utama",
        "indicator": "Aqidahnya kokoh",
        "fulfilled_sub_indicators": [
          "Menjadikan tauhid sebagai fondasi hidup.",
          "Keyakinan terhadap Allah dan Rasul-Nya menjadi pusat orientasi diri."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Aqidah masih kokoh dan tampak dalam keseharian."
      },
      {
        "category": "Mental",
        "theme": "Benar, baik, dan indah.",
        "indicator": "Menjadikan nilai \"Benar\" sebagai Fondasi",
        "fulfilled_sub_indicators": [
          "Memastikan setiap pilihan dan tindakan sesuai syariat Allah.",
          "Tidak mengorbankan prinsip halal-haram demi keuntungan duniawi."
        ],
        "missing_sub_indicators": [
          "Menjadikan wahyu sebagai kompas utama dalam hidup."
        ],
        "reasoning": "Konsisten berpegang pada halal-haram dalam pilihan sehari-hari."
      },
      {
        "category": "Mental",
        "theme": "Berpikir Besar",
        "indicator": "Visinya sampai akhirat",
        "fulfilled_sub_indicators": [
          "Visi misi dan cita-citanya bukan cuma dunia saja tapi sekaligus akhirat"
        ],
        "missing_sub_indicators": [
          "Tidak hanya memikirkan diri sendiri, tetapi juga dampak bagi masyarakat dan umat."
        ],
        "reasoning": "Visi akhirat kuat, dimensi sosialnya mulai muncul."
      },
      {
        "category": "Mental",
        "theme": "Mental Inisiatif",
        "indicator": "Ia Proaktif",
        "fulfilled_sub_indicators": [
          "Tidak menunggu diperintah, langsung bergerak ketika melihat peluang atau masalah."
        ],
        "missing_sub_indicators": [
          "Mampu membaca situasi dan bertindak cepat."
        ],
        "reasoning": "Inisiatif ada, kecepatan membaca situasi masih berkembang."
      },
      {
        "category": "Mental",
        "theme": "Mandiri",
        "indicator": "Kemandirian Perilaku",
        "fulfilled_sub_indicators": [
          "Berani membuat keputusan sendiri dan siap menanggung konsekuensinya.",
          "Mampu menuntaskan pekerjaan tanpa harus selalu diarahkan."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Kemandirian perilaku konsisten."
      },
      {
        "category": "Soft Skill",
        "theme": "Menyayangi manusia, dalam wujud memaafkan & memaklumi",
        "indicator": "Mudah memaklumi keterbatasan",
        "fulfilled_sub_indicators": [
          "Menyadari bahwa setiap orang punya kelemahan.",
          "Tidak menuntut kesempurnaan dari orang lain."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Sikap memaklumi masih konsisten terlihat."
      },
      {
        "category": "Soft Skill",
        "theme": "Kesetiaan pada tujuan",
        "indicator": "Konsistensi dalam Sikap",
        "fulfilled_sub_indicators": [
          "Memperlakukan orang lain dengan cara yang selaras dengan tujuan hidupnya.",
          "Tidak mudah berubah sikap hanya karena tekanan atau kepentingan sesaat."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Konsistensi sikap terlihat jelas."
      },
      {
        "category": "Soft Skill",
        "theme": "Kekuatan untuk mengelola konflik",
        "indicator": "Tenang & Dewasa",
        "fulfilled_sub_indicators": [
          "Tidak mudah terpancing emosi saat berhadapan dengan perbedaan.",
          "Menunjukkan sikap sabar dan bijak dalam merespons orang lain."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Pengelolaan konflik masih baik."
      }
    ],
    "treatment": {
      "priority_theme": "Mental Inisiatif",
      "priority_indicator": "Ia Proaktif",
      "target_sub_indicators": ["Mampu membaca situasi dan bertindak cepat."],
      "action_plan": "Latih santri dengan simulasi situasi mendadak dan minta ia mendeskripsikan langkah yang akan diambil secara spontan."
    }
  }'::jsonb,
  NOW() - INTERVAL '5 days'
);

-- ── Laporan 8 ─────────────────────────────────────────────
-- Covers same themes as #6 and #7 again → pushes those to 3× = KUAT.
-- Adds Mental T17 (Daya Juang) again → 2× (LEMAH staying from #6).
INSERT INTO reports (student_id, title, narrative, treatment_plan, created_at)
VALUES (
  v_sid,
  'Laporan Test #8 — Observasi Komprehensif III',
  'Guru: Observasi ketiga berturut-turut dengan cakupan tema yang sama. Ananda sangat konsisten — sub-indikator utama terus muncul. Daya juang dan inisiatif semakin mantap.
AI: Pola kuat semakin terkonfirmasi. Beberapa indikator baru turut terdeteksi.',
  '{
    "report_title": "Laporan Test #8 — Observasi Komprehensif III",
    "detailed_assessments": [
      {
        "category": "Karakter",
        "theme": "Mampu memimpin & dipimpin",
        "indicator": "Santri yang bisa memimpin",
        "fulfilled_sub_indicators": [
          "Berpikiran Positif ; Mampu membangun suasana optimis dan mendorong tim untuk",
          "Memiliki Kepercayaan diri yang baik ; Menunjukkan keyakinan dalam mengambil"
        ],
        "missing_sub_indicators": [
          "Pandai berkomunikasi ; Menyampaikan visi dengan jelas, pembicara yang baik, juga",
          "Memiliki Integritas ; yang diucapkan sama dengan yang dilakukan.",
          "Kreatif dalam mencari solusi"
        ],
        "reasoning": "Ketiga observasi menunjukkan pola kepemimpinan yang sama."
      },
      {
        "category": "Karakter",
        "theme": "Mampu memimpin & dipimpin",
        "indicator": "Santri yang bisa dipimpin",
        "fulfilled_sub_indicators": [
          "Rendah hati ; mau dan rela dipimpin tanpa merasa direndahkan.",
          "Mau dikritik dan mampu belajar dari kritikan."
        ],
        "missing_sub_indicators": [
          "Disiplin ; mentaati peraturan",
          "Punya tanggung jawab ; Menjalankan tugas sesuai arahan dengan konsisten."
        ],
        "reasoning": "Kerendahan hati dan keterbukaan pada kritik terkonfirmasi."
      },
      {
        "category": "Karakter",
        "theme": "Mampu mengatur diri & waktu dengan baik",
        "indicator": "Disiplin",
        "fulfilled_sub_indicators": [
          "Mampu menahan diri dari hal-hal yang tidak penting.",
          "Menjalankan rutinitas tanpa harus selalu diawasi."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Disiplin diri terkonfirmasi 3 observasi berturut-turut."
      },
      {
        "category": "Karakter",
        "theme": "Mampu mengatur diri & waktu dengan baik",
        "indicator": "Tahu skala prioritas",
        "fulfilled_sub_indicators": [
          "Tahu mana yang harus dilakukan terlebih dahulu.",
          "Tidak mudah tergoda oleh hal-hal yang kurang bermanfaat."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Peningkatan dari laporan sebelumnya; godaan gadget mulai berhasil diatasi."
      },
      {
        "category": "Karakter",
        "theme": "Konsisten ibadahnya & memiliki hubungan yang kuat dengan Al-Quran",
        "indicator": "Konsistensi Ibadah & Keterikatan Al-Quran",
        "fulfilled_sub_indicators": [
          "Tekun menegakkan shalat; menjaga shalat wajib tepat waktu dan berusaha menambah shalat sunnah.",
          "Tidak meninggalkan ibadah meski sibuk atau lelah."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Ibadah konsisten meski jadwal padat."
      },
      {
        "category": "Karakter",
        "theme": "Menjadikan Islam sebagai identitas diri yang utama",
        "indicator": "Aqidahnya kokoh",
        "fulfilled_sub_indicators": [
          "Menjadikan tauhid sebagai fondasi hidup.",
          "Keyakinan terhadap Allah dan Rasul-Nya menjadi pusat orientasi diri."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Identitas Islam semakin kuat dan tampak natural."
      },
      {
        "category": "Mental",
        "theme": "Benar, baik, dan indah.",
        "indicator": "Menjadikan nilai \"Benar\" sebagai Fondasi",
        "fulfilled_sub_indicators": [
          "Memastikan setiap pilihan dan tindakan sesuai syariat Allah.",
          "Tidak mengorbankan prinsip halal-haram demi keuntungan duniawi.",
          "Menjadikan wahyu sebagai kompas utama dalam hidup."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Seluruh sub-indikator terpenuhi — nilai Benar sudah menjadi fondasi."
      },
      {
        "category": "Mental",
        "theme": "Berpikir Besar",
        "indicator": "Visinya sampai akhirat",
        "fulfilled_sub_indicators": [
          "Visi misi dan cita-citanya bukan cuma dunia saja tapi sekaligus akhirat",
          "Tidak hanya memikirkan diri sendiri, tetapi juga dampak bagi masyarakat dan umat."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Visi besar dan akhirat terkonfirmasi penuh."
      },
      {
        "category": "Mental",
        "theme": "Mental Inisiatif",
        "indicator": "Ia Proaktif",
        "fulfilled_sub_indicators": [
          "Tidak menunggu diperintah, langsung bergerak ketika melihat peluang atau masalah.",
          "Mampu membaca situasi dan bertindak cepat."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Inisiatif dan kecepatan baca situasi meningkat signifikan."
      },
      {
        "category": "Mental",
        "theme": "Mandiri",
        "indicator": "Kemandirian Perilaku",
        "fulfilled_sub_indicators": [
          "Berani membuat keputusan sendiri dan siap menanggung konsekuensinya.",
          "Mampu menuntaskan pekerjaan tanpa harus selalu diarahkan."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Kemandirian terkonfirmasi kuat."
      },
      {
        "category": "Mental",
        "theme": "Daya Juang..",
        "indicator": "Ia memiliki ketangguhan",
        "fulfilled_sub_indicators": [
          "Tidak mudah goyah meski menghadapi kesulitan panjang.",
          "Tetap fokus pada tujuan meski hasil belum terlihat."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Daya juang semakin terbukti dalam sesi hafalan panjang."
      },
      {
        "category": "Soft Skill",
        "theme": "Menyayangi manusia, dalam wujud memaafkan & memaklumi",
        "indicator": "Mudah memaklumi keterbatasan",
        "fulfilled_sub_indicators": [
          "Menyadari bahwa setiap orang punya kelemahan.",
          "Tidak menuntut kesempurnaan dari orang lain."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Pola memaklumi konsisten dalam 3 observasi."
      },
      {
        "category": "Soft Skill",
        "theme": "Kesetiaan pada tujuan",
        "indicator": "Konsistensi dalam Sikap",
        "fulfilled_sub_indicators": [
          "Memperlakukan orang lain dengan cara yang selaras dengan tujuan hidupnya.",
          "Tidak mudah berubah sikap hanya karena tekanan atau kepentingan sesaat."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Konsistensi dikonfirmasi 3 kali."
      },
      {
        "category": "Soft Skill",
        "theme": "Kekuatan untuk mengelola konflik",
        "indicator": "Tenang & Dewasa",
        "fulfilled_sub_indicators": [
          "Tidak mudah terpancing emosi saat berhadapan dengan perbedaan.",
          "Menunjukkan sikap sabar dan bijak dalam merespons orang lain."
        ],
        "missing_sub_indicators": [],
        "reasoning": "Pengelolaan konflik sudah menjadi karakter."
      }
    ],
    "treatment": {
      "priority_theme": "Mampu memimpin & dipimpin",
      "priority_indicator": "Santri yang bisa memimpin",
      "target_sub_indicators": [
        "Pandai berkomunikasi ; Menyampaikan visi dengan jelas, pembicara yang baik, juga",
        "Kreatif dalam mencari solusi"
      ],
      "action_plan": "Beri tugas presentasi ide kreatif di depan kelompok dan latih teknik komunikasi visi secara terstruktur."
    }
  }'::jsonb,
  NOW() - INTERVAL '1 day'
);

RAISE NOTICE 'Inserted 3 multi-theme test reports for student %', v_sid;

END $$;

-- ============================================================
-- Expected radar chart results after BOTH seed files:
--
-- KARAKTER spokes with data (others = 0):
--   Spoke 1  (Memiliki tujuan hidup)               → KUAT  (5×, from seed 1)
--   Spoke 2  (Mampu memimpin & dipimpin)            → KUAT  (3×, from this seed)
--   Spoke 3  (Mampu mengatur diri & waktu)          → KUAT  (3×, from this seed)
--   Spoke 5  (Konsisten ibadah & Al-Quran)          → KUAT  (3×, from this seed)
--   Spoke 10 (Islam sebagai identitas utama)        → KUAT  (3×, from this seed)
--   Spoke 24 (Daya tahan terhadap tekanan)          → LEMAH (1×, laporan 6 only)
--
-- MENTAL spokes with data:
--   Spoke 1  (Belajar itu ibadah)                   → KUAT  (4×, from seed 1)
--   Spoke 2  (Benar, baik, dan indah)               → KUAT  (3×, from this seed)
--   Spoke 8  (Berpikir Besar)                       → KUAT  (3×, from this seed)
--   Spoke 10 (Mental Inisiatif)                     → KUAT  (3×, from this seed)
--   Spoke 13 (Mandiri)                              → KUAT  (3×, from this seed)
--   Spoke 17 (Daya Juang)                           → LEMAH (2×, laporan 6 & 8)
--
-- SOFT SKILL spokes with data:
--   Spoke 1  (Keinginan mengembangkan diri)         → KUAT  (3×, from seed 1)
--   Spoke 3  (Menyayangi manusia / memaafkan)       → KUAT  (3×, from this seed)
--   Spoke 4  (Kesetiaan pada tujuan)                → KUAT  (3×, from this seed)
--   Spoke 6  (Kekuatan mengelola konflik)           → KUAT  (3×, from this seed)
--   Spoke 9  (Persuasif)                            → LEMAH (1×, laporan 6 only)
-- ============================================================
