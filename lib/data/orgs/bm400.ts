/**
 * lib/data/orgs/bm400.ts
 *
 * Supplementary CDS themes for SMA Bakti Mulya 400 Jakarta
 * (organization_id 0bc3db16-d270-42d9-893a-c233a6b83800), sourced from their
 * "Naskah Akademis Tiga Pilar Pendidikan" reference document (Pilar Religius,
 * Nasionalis, Internasionalis — 13 dimensions total).
 *
 * Each dimension becomes one theme with one indicator, following the doc's
 * own "dimension -> operational description -> observable example behaviors"
 * structure. Sub-indicators are condensed from the doc's "Contoh Kejadian
 * yang Dapat Dicatat" / "Kompetensi yang Hendak Dicapai" text into short
 * observable phrases, in the same style as the base framework.
 *
 * ids continue from the base framework's own numbering (Karakter 1-40,
 * Mental 1-34, Soft Skill 1-14) so they slot in without colliding:
 *   Karakter  41-45 (Akhlak, Ibadah, Praktik Baik, Patriotisme, Integritas Global)
 *   Mental    35-38 (Berwawasan Global, Unggul & Kompetitif, Kemampuan Adaptasi, Kemandirian Berpikir)
 *   Soft Skill 15-18 (Muamalah, Toleransi, Demokrasi, Kolaborasi Lintas Budaya)
 *
 * See lib/data/framework.ts for how this is merged onto the base framework,
 * and the categorization rationale in the plan this was implemented from.
 */

export const bm400Extension = {
  Karakter: {
    themes: [
      {
        id: 41,
        title: "Akhlak mulia dalam interaksi sehari-hari",
        explanation:
          "Akhlak adalah kualitas batin yang tercermin dalam kejujuran, amanah, tanggung jawab, kedisiplinan, kesantunan, dan kemampuan mengendalikan diri — fondasi utama karena Islam menempatkan pembentukan karakter sebagai tujuan utama risalah kenabian.",
        indicators: [
          {
            title: "Akhlak Islami dalam Keseharian",
            sub_indicators: [
              "Mengembalikan barang yang ditemukan kepada pemiliknya",
              "Mengakui kesalahan yang diperbuat",
              "Berbicara santun kepada guru dan teman",
              "Menepati janji dan menyelesaikan tugas dengan penuh tanggung jawab",
            ],
          },
        ],
      },
      {
        id: 42,
        title: "Konsistensi dan adab dalam beribadah",
        explanation:
          "Ibadah adalah bentuk penghambaan kepada Allah yang tidak hanya berupa pelaksanaan ritual, tetapi juga proses pembinaan spiritual (tazkiyatun nafs) yang membentuk kesadaran, kedisiplinan, keikhlasan, dan integritas pribadi.",
        indicators: [
          {
            title: "Kedisiplinan dan Kekhusyukan Ibadah",
            sub_indicators: [
              "Mengikuti salat berjamaah dengan tertib",
              "Berdoa sebelum dan sesudah kegiatan",
              "Membaca Al-Qur'an dengan sungguh-sungguh",
              "Menjaga ketenangan dan adab saat beribadah",
            ],
          },
        ],
      },
      {
        id: 43,
        title: "Kepedulian dan amal kebajikan secara sukarela",
        explanation:
          "Praktik baik adalah implementasi nyata dari nilai religius dalam kehidupan sehari-hari — kualitas keimanan tidak hanya diukur dari apa yang diyakini, tetapi juga dari amal yang dilakukan secara konsisten.",
        indicators: [
          {
            title: "Kebiasaan Berbuat Baik",
            sub_indicators: [
              "Menjaga kebersihan kelas dan fasilitas sekolah",
              "Membantu guru atau teman tanpa diminta",
              "Mengikuti kegiatan bakti sosial atau menjadi relawan kegiatan sekolah",
              "Mengajak teman melakukan kegiatan positif",
            ],
          },
        ],
      },
      {
        id: 44,
        title: "Kecintaan dan kepedulian terhadap bangsa",
        explanation:
          "Patriotisme adalah kepedulian dan kesediaan berkontribusi bagi bangsa — bentuk konkret dari penegasan keterikatan pada tanah air melalui tindakan nyata, bukan sekadar warisan yang diterima begitu saja.",
        indicators: [
          {
            title: "Patriotisme dalam Keseharian",
            sub_indicators: [
              "Mengikuti upacara bendera dengan tertib dan menunjukkan sikap hormat",
              "Aktif dalam kegiatan kepramukaan atau peringatan hari besar nasional",
              "Berinisiatif menggalang bantuan untuk korban bencana",
              "Menunjukkan kepedulian terhadap kondisi bangsa dan lingkungan sekitar",
            ],
          },
        ],
      },
      {
        id: 45,
        title: "Integritas dalam lingkungan global",
        explanation:
          "Integritas global menjunjung tinggi kejujuran akademik, etika komunikasi, tanggung jawab sosial, serta penggunaan teknologi secara bijaksana — karakter religius yang tetap kokoh meski berinteraksi dalam lingkungan multikultural.",
        indicators: [
          {
            title: "Integritas dan Etika Global",
            sub_indicators: [
              "Menjunjung kejujuran akademik dalam tugas dan ujian",
              "Menggunakan teknologi digital secara bijaksana dan bertanggung jawab",
              "Konsisten pada nilai dan prinsip meski dalam lingkungan multikultural",
            ],
          },
        ],
      },
    ],
  },
  Mental: {
    themes: [
      {
        id: 35,
        group: "Wawasan Global",
        title: "Berwawasan global dan terbuka terhadap keberagaman",
        explanation:
          "Global-mindedness adalah keterbukaan terhadap keberagaman budaya, bahasa, dan cara pandang serta kemampuan memahami isu-isu global secara objektif dan bertanggung jawab.",
        indicators: [
          {
            title: "Keterbukaan Wawasan Global",
            sub_indicators: [
              "Menunjukkan keterbukaan terhadap budaya, bahasa, dan cara pandang yang berbeda",
              "Memahami isu-isu global secara objektif",
              "Mengikuti perkembangan ilmu pengetahuan dan isu global dari sumber terpercaya",
            ],
          },
        ],
      },
      {
        id: 36,
        group: "Wawasan Global",
        title: "Semangat unggul dan kompetitif secara sehat",
        explanation:
          "Excellence & competitiveness adalah semangat untuk mencapai standar akademik terbaik melalui kerja keras, disiplin, integritas, dan kemauan untuk terus berkembang.",
        indicators: [
          {
            title: "Orientasi Keunggulan",
            sub_indicators: [
              "Menunjukkan kerja keras dan disiplin untuk mencapai standar akademik terbaik",
              "Menunjukkan kemauan untuk terus berkembang",
              "Bersaing secara sehat di tingkat nasional maupun internasional",
            ],
          },
        ],
      },
      {
        id: 37,
        group: "Wawasan Global",
        title: "Kemampuan beradaptasi terhadap perubahan",
        explanation:
          "Adaptability adalah kemampuan menyesuaikan diri terhadap perubahan lingkungan, perkembangan teknologi, serta kehidupan di lingkungan multikultural.",
        indicators: [
          {
            title: "Adaptasi Lintas Lingkungan",
            sub_indicators: [
              "Menyesuaikan diri dengan lingkungan akademik atau sosial yang baru",
              "Menyesuaikan diri terhadap perkembangan teknologi",
              "Menunjukkan kepercayaan diri berinteraksi di lingkungan multikultural",
            ],
          },
        ],
      },
      {
        id: 38,
        group: "Wawasan Global",
        title: "Kemandirian berpikir dan pengambilan keputusan",
        explanation:
          "Independent thinking adalah kemampuan menganalisis informasi secara kritis, mengambil keputusan berdasarkan data, serta bertanggung jawab atas setiap keputusan yang diambil.",
        indicators: [
          {
            title: "Berpikir Kritis dan Mandiri",
            sub_indicators: [
              "Menganalisis informasi secara kritis sebelum mengambil kesimpulan",
              "Mengambil keputusan berdasarkan data dan bertanggung jawab atasnya",
              "Menyusun perencanaan pendidikan atau portofolio secara mandiri",
            ],
          },
        ],
      },
    ],
  },
  "Soft Skill": {
    themes: [
      {
        id: 15,
        quality: "Kolaborasi",
        title: "Muamalah: membangun hubungan sosial yang harmonis",
        explanation:
          "Muamalah menekankan pentingnya membangun hubungan yang adil, saling menghormati, peduli, serta mampu bekerja sama dengan sesama manusia sebagai perwujudan tanggung jawab manusia sebagai khalifah fi al-'ardh.",
        indicators: [
          {
            title: "Interaksi Sosial yang Sehat",
            sub_indicators: [
              "Membantu teman yang mengalami kesulitan",
              "Menghormati perbedaan pendapat",
              "Bekerja sama dalam kelompok dan menjaga amanah",
              "Menyelesaikan konflik secara santun",
            ],
          },
        ],
      },
      {
        id: 16,
        quality: "Kolaborasi",
        title: "Toleransi terhadap keberagaman",
        explanation:
          "Toleransi adalah kesediaan menerima dan menghargai perbedaan suku, budaya, pendapat, maupun kondisi teman sebaya, tanpa mengorbankan keteguhan pada nilai yang dianut.",
        indicators: [
          {
            title: "Sikap Toleran",
            sub_indicators: [
              "Bekerja sama dalam kelompok dengan teman dari latar belakang berbeda",
              "Membela teman yang menjadi sasaran perundungan atas dasar perbedaan",
              "Menyampaikan pendapat berbeda dengan bahasa yang santun",
            ],
          },
        ],
      },
      {
        id: 17,
        quality: "Kolaborasi",
        title: "Demokrasi dan musyawarah",
        explanation:
          "Demokrasi adalah kesediaan mengambil keputusan bersama melalui musyawarah, menghormati hasil keputusan kolektif, dan menjalankan kepemimpinan maupun keanggotaan organisasi secara bertanggung jawab.",
        indicators: [
          {
            title: "Kecakapan Bermusyawarah",
            sub_indicators: [
              "Mengajukan usulan secara terbuka dalam rapat kelas atau organisasi siswa",
              "Menerima hasil musyawarah meskipun berbeda dengan pendapat pribadi",
              "Menjalankan tanggung jawab kepemimpinan atau keanggotaan organisasi secara konsisten",
            ],
          },
        ],
      },
      {
        id: 18,
        quality: "Kolaborasi",
        title: "Kolaborasi lintas budaya",
        explanation:
          "Cross-cultural collaboration adalah kemampuan bekerja sama secara efektif dengan individu dari berbagai latar belakang budaya, menghormati perbedaan, dan membangun komunikasi yang positif.",
        indicators: [
          {
            title: "Kerja Sama Lintas Budaya",
            sub_indicators: [
              "Bekerja sama secara efektif dengan individu dari berbagai latar belakang budaya",
              "Membangun komunikasi yang positif dalam lingkungan multikultural",
              "Menghormati perbedaan dalam kerja tim lintas budaya",
            ],
          },
        ],
      },
    ],
  },
};
