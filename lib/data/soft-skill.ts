/**
 * lib/data/soft-skill.ts
 *
 * The "Soft Skill" pillar of the CIA assessment framework.
 * Definition: the ability to handle the attitudes and actions of others.
 *
 * Structure mirrors karakter.ts — 14 themes covering three interpersonal
 * competency areas: Charisma / Self-Development, Communication, and
 * Leadership. Each theme has a `.quality` field indicating its competency
 * area (shown as a badge in the glossary modal).
 *
 * Same atomic structure as karakter.ts: themes → indicators → sub_indicators.
 * See karakter.ts for a full description of how sub-indicators are used across
 * the app (RAG, recap page, glossary modal).
 */
export const softSkillData = {
  category: "Soft Skill",
  definition: "Kemampuan menangani sikap dan perbuatan orang lain.",
  themes: [
    {
      id: 1,
      quality: "Kharisma",
      title: "Keinginan untuk selalu mengembangkan diri",
      explanation: "Sikap dan perbuatan orang lain itu ada tiga warna: tidak menyenangkan, menyenangkan, dan belum jelas. Dorongan untuk terus mengembangkan diri membuat seseorang lebih terbuka, sabar, dan bijak dalam merespons.",
      indicators: [
        {
          title: "Mudah mendengar masukan dari orang lain (saran, nasehat, kritik, penilaian)",
          sub_indicators: [
            "Menerima saran, nasehat, kritik, penilaian dari orang lain tanpa merasa diserang.",
            "Menganggap saran, nasehat, kritik, penilaian sebagai peluang untuk belajar, bukan ancaman dan hinaan.",
          ]
        },
        {
          title: "Rendah Hati",
          sub_indicators: [
            "Tidak merasa paling benar atau paling hebat.",
            "Menghargai kelebihan orang lain.",
            "Bersedia belajar dari kelebihan orang lain",
          ]
        },
        {
          title: "Pandai menghargai",
          sub_indicators: [
            "Pandai mengapresiasi karya, usaha, dan pendapat orang lain.",
            "Pandai mengapresiasi karya dan usaha sendiri",
          ]
        },
        {
          title: "Pandai melihat dari perspektif orang lain",
          sub_indicators: [
            "Mau memahami sudut pandang orang lain.",
            "Pandai memahami perasaan dan kesulitan orang lain",
            "Pandai memaklumi keterbatasan orang lain.",
          ]
        },
        {
          title: "Pandai bekerjasama dengan orang lain",
          sub_indicators: [
            "Senang bekerja sama untuk mencapai tujuan bersama.",
            "Melihat orang lain sebagai mitra belajar, bukan pesaing semata.",
            "Cenderung mendahulukan kepentingan orang lain / orang banyak.",
          ]
        },
        {
          title: "Berbagi Ilmu & Pengalaman",
          sub_indicators: [
            "Tidak pelit membagikan pengetahuan yang dimiliki.",
            "Menjadikan berbagi sebagai bagian dari proses pengembangan diri.",
          ]
        },
      ]
    },
    {
      id: 2,
      quality: "Kharisma",
      title: "Kesetiaan pada Agama dalam wujud berbuat benar",
      explanation: "Kesetiaan pada agama adalah pondasi vital yang diwujudkan dalam tindakan: jujur, adil, egaliter. Agama memberikan pedoman ketenangan dan kebijaksanaan dalam merespons orang lain.",
      indicators: [
        {
          title: "Menjadikan Syariat sebagai pondasi",
          sub_indicators: [
            "Menjadikan Syariat sebagai landasan berpikirnya",
            "Menjadikan Syariat sebagai landasan perkataannya",
            "Menjadikan Syariat sebagai landasan perbuatannya",
          ]
        },
        {
          title: "Menempatkan Baik sebagai Wajah",
          sub_indicators: [
            "Menampilkan perkataan dan perbuatan yang baik di mata manusia umum (awam / belum paham syariah)",
            "Menghargai norma, budaya, dan etika yang berlaku sepanjang syariat mentolerirNya",
            "Menjaga hubungan dengan sesama melalui sikap ramah, adil, dan empati.",
          ]
        },
        {
          title: "Menjadikan Indah sebagai Harmoni",
          sub_indicators: [
            "Prioritasnya adalah indah (benar menurut Allah dan manusia menganggapnya baik)",
            "Berjuang mempertemukan atau menyelaraskan syariat dengan budaya manusia",
            "Menyampaikan kebenaran dengan cara yang menyejukkan dan menenangkan manusia (awam / belum paham syariah).",
          ]
        },
        {
          title: "Prioritas yang Seimbang",
          sub_indicators: [
            "Tidak hanya mengejar baik menurut manusia jika bertentangan dengan syariat.",
            "Tidak hanya berpegang pada benar menurut Allah tanpa memperhatikan cara penyampaian kepada manusia.",
            "Selalu mencari titik indah: benar secara syariat, baik secara sosial.",
          ]
        },
      ]
    },
    {
      id: 3,
      quality: "Kharisma",
      title: "Menyayangi manusia, dalam wujud memaafkan & memaklumi",
      explanation: "Kasih sayang adalah kunci respon yang indah. Mampu melihat kelemahan orang lain sebagai bagian kemanusiaan, bukan serangan.",
      indicators: [
        {
          title: "Mudah memaklumi keterbatasan",
          sub_indicators: [
            "Menyadari bahwa setiap orang punya kelemahan.",
            "Tidak menuntut kesempurnaan dari orang lain.",
          ]
        },
        {
          title: "Mudah Memaafkan",
          sub_indicators: [
            "Tidak menyimpan dendam ketika disakiti.",
            "Cepat memberi maaf tanpa menunggu permintaan maaf.",
          ]
        },
        {
          title: "Empati dan kasih sayang",
          sub_indicators: [
            "Berusaha memahami alasan di balik kesalahan orang lain.",
            "Menunjukkan kepedulian meski pernah dirugikan.",
          ]
        },
        {
          title: "Menjaga lisan & sikap",
          sub_indicators: [
            "Tidak membalas kesalahan dengan kata-kata kasar.",
            "Menyikapi orang lain dengan kelembutan dan persuasif.",
          ]
        },
        {
          title: "Orientasi Perdamaian",
          sub_indicators: [
            "Fokus pada solusi, bukan mencari kesalahan.",
            "Lebih memilih damai daripada memperbesar konflik.",
            "Menjadi penyejuk dalam lingkungan sosial.",
          ]
        },
        {
          title: "Keteladanan Akhlak",
          sub_indicators: [
            "Menjadikan sikap pemaaf sebagai teladan bagi teman-teman.",
            "Menunjukkan bahwa kasih sayang adalah bagian dari iman.",
            "Meyakini bahwa memaafkan adalah perintah Allah dan sunnah Nabi Saw.",
          ]
        },
      ]
    },
    {
      id: 4,
      quality: "Power",
      title: "Kesetiaan pada tujuan",
      explanation: "Kekuatan menghadapi kendala rintangan hanya lahir dari kesetiaan pada tujuan. Rintangan menjadi bahan bakar kekuatan.",
      indicators: [
        {
          title: "Konsistensi dalam Sikap",
          sub_indicators: [
            "Memperlakukan orang lain dengan cara yang selaras dengan tujuan hidupnya.",
            "Tidak mudah berubah sikap hanya karena tekanan atau kepentingan sesaat.",
          ]
        },
        {
          title: "Kejujuran & Integritas",
          sub_indicators: [
            "Menyampaikan pendapat dengan jujur meski berisiko.",
            "Tidak mengorbankan kebenaran demi keuntungan pribadi.",
          ]
        },
        {
          title: "Dukungan terhadap Orang Lain",
          sub_indicators: [
            "Mendorong orang lain agar ikut fokus pada tujuan baik.",
            "Menjadi teladan dalam menjaga komitmen.",
          ]
        },
        {
          title: "Keteguhan dalam Prinsip",
          sub_indicators: [
            "Tidak ikut-ikutan dalam hal yang menyimpang dari tujuan.",
            "Berani menolak ajakan yang bertentangan dengan nilai kebenaran.",
          ]
        },
        {
          title: "Empati & Pengertian",
          sub_indicators: [
            "Memahami bahwa orang lain mungkin belum sejalan, tetapi tetap memperlakukan mereka dengan hormat.",
            "Menjadi penyemangat, bukan penghakim.",
          ]
        },
        {
          title: "Orientasi pada Kebaikan Bersama",
          sub_indicators: [
            "Menjadikan tujuan pribadi selaras dengan maslahat sosial.",
            "Mengajak orang lain untuk bersama-sama menuju kebaikan.",
          ]
        },
        {
          title: "Integrasi Spiritualitas",
          sub_indicators: [
            "Meyakini bahwa kesetiaan pada tujuan adalah bagian dari ibadah.",
            "Memperlakukan orang lain dengan adab Islami sebagai wujud kesetiaan pada agama dan tujuan hidup.",
          ]
        },
      ]
    },
    {
      id: 5,
      quality: "Power",
      title: "Kemauan untuk berkurban demi tercapainya tujuan",
      explanation: "Rela melepas kenyamanan, waktu, dan tenaga. Memenuhi permintaan pihak terkait (atasan, partner, konsumen) dengan benar.",
      indicators: [
        {
          title: "Mendahulukan Kepentingan Bersama",
          sub_indicators: [
            "Rela menunda kepentingan pribadi demi keberhasilan kelompok.",
            "Menempatkan tujuan bersama di atas ego individu.",
          ]
        },
        {
          title: "Rela Berkorban Waktu & Tenaga",
          sub_indicators: [
            "Bersedia membantu orang lain meski harus mengurangi kenyamanan diri.",
            "Menyumbangkan tenaga, pikiran, atau waktu untuk keberhasilan bersama.",
          ]
        },
        {
          title: "Tidak Perhitungan",
          sub_indicators: [
            "Tidak selalu menuntut imbalan atas pengorbanan.",
            "Ikhlas memberi tanpa mengungkit-ungkit.",
          ]
        },
        {
          title: "Solidaritas & Empati",
          sub_indicators: [
            "Peduli terhadap kesulitan orang lain dan siap membantu.",
            "Menjadikan pengorbanan sebagai wujud kasih sayang sesama.",
          ]
        },
        {
          title: "Menjaga Ukhuwah",
          sub_indicators: [
            "Tidak membiarkan perbedaan kecil merusak tujuan besar.",
            "Mengutamakan persaudaraan meski harus mengalah.",
          ]
        },
        {
          title: "Keteguhan pada Tujuan",
          sub_indicators: [
            "Konsisten menjaga arah meski harus mengorbankan kenyamanan pribadi.",
            "Tidak mudah tergoda untuk meninggalkan komitmen.",
          ]
        },
        {
          title: "Integrasi Nilai Spiritual",
          sub_indicators: [
            "Meyakini bahwa berkorban demi tujuan baik adalah amal yang bernilai di sisi Allah.",
            "Menjadikan pengorbanan sebagai bentuk ibadah dan jihad diri.",
          ]
        },
      ]
    },
    {
      id: 6,
      quality: "Power",
      title: "Kekuatan untuk mengelola konflik",
      explanation: "Mengelola konflik berarti mengelola sikap dan perbuatan orang lain agar tidak menguras energi. Mengubah perbedaan menjadi peluang.",
      indicators: [
        {
          title: "Tenang & Dewasa",
          sub_indicators: [
            "Tidak mudah terpancing emosi saat berhadapan dengan perbedaan.",
            "Menunjukkan sikap sabar dan bijak dalam merespons orang lain.",
          ]
        },
        {
          title: "Mau Mendengar",
          sub_indicators: [
            "Memberi ruang bagi orang lain untuk menyampaikan pendapat.",
            "Tidak memotong pembicaraan atau meremehkan sudut pandang lawan bicara.",
          ]
        },
        {
          title: "Tabayun (Verifikasi)",
          sub_indicators: [
            "Memastikan kebenaran informasi sebelum bereaksi.",
            "Tidak langsung menuduh atau menyalahkan orang lain.",
          ]
        },
        {
          title: "Muhasabah (Introspeksi)",
          sub_indicators: [
            "Mengoreksi diri sebelum menyalahkan orang lain.",
            "Berani mengakui kesalahan bila memang salah.",
          ]
        },
        {
          title: "Islah (Perdamaian)",
          sub_indicators: [
            "Berusaha mencari titik temu yang adil.",
            "Mengutamakan ukhuwah daripada ego pribadi.",
          ]
        },
        {
          title: "Fokus pada Solusi",
          sub_indicators: [
            "Tidak berhenti pada masalah, tetapi mencari jalan keluar bersama.",
            "Mengarahkan konflik menjadi sarana belajar dan memperkuat hubungan.",
          ]
        },
        {
          title: "Integrasi Nilai Islam",
          sub_indicators: [
            "Menyelesaikan konflik dengan adab Islami.",
            "Menjadikan musyawarah dan kasih sayang sebagai pedoman.",
          ]
        },
      ]
    },
    {
      id: 7,
      quality: "Power",
      title: "Keberanian untuk mengambil keputusan dan menanggung resikonya",
      explanation: "Langkah terhenti tanpa keberanian memutuskan. Siap menghadapi konsekuensi, siap belajar, dan siap salah.",
      indicators: [
        {
          title: "Ketegasan dalam Sikap",
          sub_indicators: [
            "Berani menyampaikan keputusan meski berbeda dengan mayoritas.",
            "Tidak ragu menolak ajakan yang bertentangan dengan nilai kebenaran.",
          ]
        },
        {
          title: "Tanggung Jawab terhadap Dampak",
          sub_indicators: [
            "Tidak menyalahkan orang lain atas konsekuensi keputusan yang diambil.",
            "Siap menanggung akibat dari pilihan yang dibuat, termasuk bila merugikan diri sendiri.",
          ]
        },
        {
          title: "Transparansi & Kejujuran",
          sub_indicators: [
            "Menjelaskan alasan keputusan dengan jujur kepada orang lain.",
            "Tidak menutup-nutupi risiko yang mungkin muncul.",
          ]
        },
        {
          title: "Menghargai Orang Lain",
          sub_indicators: [
            "Tetap memperlakukan orang lain dengan hormat meski berbeda pendapat.",
            "Tidak memaksakan keputusan, tetapi mengajak dengan argumentasi yang baik.",
          ]
        },
        {
          title: "Menjadi Teladan",
          sub_indicators: [
            "Memberi contoh keberanian dalam mengambil keputusan yang benar.",
            "Menginspirasi orang lain untuk berani bertanggung jawab atas pilihannya.",
          ]
        },
        {
          title: "Empati dalam Risiko",
          sub_indicators: [
            "Mempertimbangkan dampak keputusan terhadap orang lain.",
            "Tidak mengambil keputusan yang merugikan banyak pihak tanpa maslahat jelas.",
          ]
        },
        {
          title: "Integrasi Nilai Spiritual",
          sub_indicators: [
            "Meyakini bahwa setiap keputusan harus sesuai syariat dan akan dipertanggungjawabkan di hadapan Allah.",
            "Menjadikan keberanian sebagai bentuk jihad melawan rasa takut dan keraguan.",
          ]
        },
      ]
    },
    {
      id: 8,
      quality: "Authority",
      title: "Memahami apa yang ia buat atau rencanakan (masterplan)",
      explanation: "Authority adalah kemampuan memberi perintah jelas. Tanpa pemahaman masterplan, perintah tidak memiliki makna dan kekuatan.",
      indicators: [
        {
          title: "Pandai dalam Komunikasi",
          sub_indicators: [
            "Menjelaskan tujuan dan rencana dengan bahasa yang mudah dipahami orang lain.",
            "Tidak membuat orang lain bingung atau merasa ditinggalkan.",
          ]
        },
        {
          title: "Transparansi & Kejujuran",
          sub_indicators: [
            "Terbuka mengenai langkah yang akan diambil.",
            "Tidak menyembunyikan hal penting yang berdampak pada orang lain.",
          ]
        },
        {
          title: "Menghargai Peran Orang Lain",
          sub_indicators: [
            "Menempatkan orang lain sesuai kapasitasnya dalam rencana.",
            "Memberi ruang kontribusi agar semua merasa dilibatkan.",
          ]
        },
        {
          title: "Kolaboratif",
          sub_indicators: [
            "Mengajak orang lain bekerja sama untuk mewujudkan masterplan.",
            "Tidak memaksakan kehendak, tetapi membangun kesepahaman.",
          ]
        },
        {
          title: "Konsistensi dalam Perlakuan",
          sub_indicators: [
            "Memperlakukan orang lain sesuai dengan arah tujuan, bukan sekadar spontanitas.",
            "Menunjukkan sikap yang stabil dan dapat dipercaya.",
          ]
        },
        {
          title: "Orientasi pada Maslahat Bersama",
          sub_indicators: [
            "Menjadikan rencana bukan hanya untuk kepentingan pribadi, tetapi juga manfaat sosial.",
            "Memastikan orang lain merasakan dampak positif dari masterplan.",
          ]
        },
        {
          title: "Integrasi Nilai Spiritual",
          sub_indicators: [
            "Meyakini bahwa setiap rencana harus sesuai syariat dan bernilai ibadah.",
            "Memperlakukan orang lain dengan adab Islami sebagai bagian dari keberhasilan rencana.",
          ]
        },
      ]
    },
    {
      id: 9,
      quality: "Authority",
      title: "Pandai membujuk orang (Persuasif)",
      explanation: "Membuat orang lain mau melaksanakan perintah dengan kesadaran, tanpa merasa terbebani atau dipaksa.",
      indicators: [
        {
          title: "Komunikasi yang Ramah & Hangat",
          sub_indicators: [
            "Menyampaikan pesan dengan bahasa yang sopan dan menyenangkan.",
            "Membuat orang lain merasa dihargai dan nyaman.",
          ]
        },
        {
          title: "Kemampuan Mendengar",
          sub_indicators: [
            "Tidak hanya berbicara, tetapi juga mendengarkan dengan penuh perhatian.",
            "Menunjukkan bahwa pendapat orang lain penting.",
          ]
        },
        {
          title: "Argumentasi yang Logis & Religius",
          sub_indicators: [
            "Menggunakan alasan yang masuk akal dan sesuai syariat.",
            "Membujuk dengan dalil, contoh nyata, dan manfaat yang jelas.",
          ]
        },
        {
          title: "Empati & Kepedulian",
          sub_indicators: [
            "Menyesuaikan cara berbicara dengan kondisi orang lain.",
            "Membujuk dengan memahami kebutuhan dan perasaan lawan bicara.",
          ]
        },
        {
          title: "Keteladanan Sikap",
          sub_indicators: [
            "Membuktikan kata-kata dengan perbuatan nyata.",
            "Orang lain lebih mudah terbujuk karena melihat konsistensi akhlak.",
          ]
        },
        {
          title: "Tidak Memaksa",
          sub_indicators: [
            "Membujuk dengan kelembutan, bukan tekanan.",
            "Memberi ruang bagi orang lain untuk memilih dengan ikhlas.",
          ]
        },
        {
          title: "Orientasi Kebaikan Bersama",
          sub_indicators: [
            "Membujuk bukan untuk kepentingan pribadi semata, tetapi demi maslahat bersama.",
            "Menjadikan persuasi sebagai sarana dakwah dan ukhuwah.",
          ]
        },
      ]
    },
    {
      id: 10,
      quality: "Authority",
      title: "Pandai memaksa orang (Imperatif)",
      explanation: "Memastikan perintah dilaksanakan demi tujuan yang benar, meski orang yang diperintah keberatan. Ketegasan diperlukan untuk hasil akhir.",
      indicators: [
        {
          title: "Ketegasan dalam Perintah",
          sub_indicators: [
            "Memberikan instruksi dengan jelas dan langsung.",
            "Tidak membiarkan orang lain ragu terhadap apa yang diminta.",
          ]
        },
        {
          title: "Otoritas dalam Sikap",
          sub_indicators: [
            "Memposisikan diri sebagai pemimpin yang harus diikuti.",
            "Menunjukkan wibawa sehingga orang lain merasa perlu patuh.",
          ]
        },
        {
          title: "Konsistensi dalam Tuntutan",
          sub_indicators: [
            "Tidak mudah berubah-ubah dalam arahan.",
            "Menuntut orang lain untuk mengikuti aturan yang sudah ditetapkan.",
          ]
        },
        {
          title: "Minim Ruang Negosiasi",
          sub_indicators: [
            "Jarang memberi kesempatan orang lain untuk menolak.",
            "Lebih menekankan kepatuhan daripada diskusi panjang.",
          ]
        },
        {
          title: "Orientasi pada Tujuan",
          sub_indicators: [
            "Memaksa bukan untuk kepentingan pribadi, tetapi demi tercapainya tujuan bersama.",
            "Menekankan hasil yang harus dicapai oleh kelompok.",
          ]
        },
        {
          title: "Menggunakan Bahasa Tegas",
          sub_indicators: [
            "Menghindari bahasa yang terlalu lunak atau ambigu.",
            "Menggunakan kalimat perintah yang jelas dan langsung.",
          ]
        },
        {
          title: "Integrasi Nilai Spiritual",
          sub_indicators: [
            "Menjadikan sikap imperatif sebagai bentuk tanggung jawab kepemimpinan.",
            "Meyakini bahwa ketegasan diperlukan agar tujuan yang baik tercapai sesuai syariat.",
          ]
        },
      ]
    },
    {
      id: 11,
      quality: "Influential",
      title: "Kemampuan komunikasi dalam wujud interaksi & negoisasi",
      explanation: "Mempengaruhi orang lain melalui kata-kata kuat yang didukung teladan. Membangun kepercayaan dan menyampaikan gagasan meyakinkan.",
      indicators: [
        {
          title: "Keterampilan Mendengar",
          sub_indicators: [
            "Memberi ruang bagi orang lain untuk berbicara.",
            "Menunjukkan perhatian penuh terhadap pendapat dan perasaan lawan bicara.",
          ]
        },
        {
          title: "Penggunaan diksi yang Sopan & Jelas",
          sub_indicators: [
            "Menggunakan kata-kata yang lembut, tidak menyakiti.",
            "Menyampaikan maksud dengan jelas agar tidak menimbulkan salah paham.",
          ]
        },
        {
          title: "Empati & Pengertian",
          sub_indicators: [
            "Menyesuaikan cara berbicara dengan kondisi orang lain.",
            "Memahami kebutuhan dan sudut pandang lawan bicara sebelum memberi solusi.",
          ]
        },
        {
          title: "Argumentasi yang Bijak",
          sub_indicators: [
            "Menyampaikan alasan dengan logis, syar'i, dan mudah diterima.",
            "Tidak memaksakan kehendak, tetapi mengajak dengan dalil dan manfaat.",
          ]
        },
        {
          title: "Orientasi pada Titik Temu",
          sub_indicators: [
            "Berusaha mencari kesepakatan yang adil bagi semua pihak.",
            "Mengutamakan maslahat bersama daripada kepentingan pribadi.",
          ]
        },
        {
          title: "Keteguhan & Fleksibilitas",
          sub_indicators: [
            "Teguh pada prinsip, tetapi fleksibel dalam cara penyampaian.",
            "Tidak kaku, melainkan terbuka terhadap alternatif solusi.",
          ]
        },
        {
          title: "Integrasi Nilai Spiritual",
          sub_indicators: [
            "Menjadikan komunikasi sebagai sarana dakwah dan ibadah.",
            "Memperlakukan orang lain dengan adab Islami dalam interaksi dan negosiasi.",
          ]
        },
      ]
    },
    {
      id: 12,
      quality: "Influential",
      title: "Kepandaian memilih diksi yang mumpuni",
      explanation: "Kata-kata harus mengandung keindahan dan magnet penggerak hati. Kualitas influence tumbuh dari pengolahan diksi yang tepat.",
      indicators: [
        {
          title: "Kelembutan dalam Berbicara",
          sub_indicators: [
            "Menggunakan kata-kata yang menenangkan, bukan menyakiti.",
            "Menyampaikan kritik dengan bahasa yang halus dan membangun.",
          ]
        },
        {
          title: "Ketepatan Diksi",
          sub_indicators: [
            "Memilih kata sesuai konteks dan lawan bicara.",
            "Tidak menggunakan istilah yang membingungkan atau menyinggung.",
          ]
        },
        {
          title: "Menghargai Lawan Bicara",
          sub_indicators: [
            "Menyesuaikan bahasa dengan tingkat pemahaman orang lain.",
            "Menghindari kata-kata yang merendahkan atau meremehkan.",
          ]
        },
        {
          title: "Persuasif & Meyakinkan",
          sub_indicators: [
            "Menggunakan diksi yang mampu menggerakkan hati orang lain.",
            "Menyampaikan ajakan dengan kata-kata yang inspiratif.",
          ]
        },
        {
          title: "Menjaga Adab Lisan",
          sub_indicators: [
            "Tidak berkata kasar, menghina, atau berlebihan.",
            "Menjadikan lisan sebagai sarana dakwah dan ukhuwah.",
          ]
        },
        {
          title: "Empati dalam Bahasa",
          sub_indicators: [
            "Memilih kata yang menunjukkan kepedulian terhadap perasaan orang lain.",
            "Menggunakan bahasa yang menenangkan saat orang lain sedang sulit.",
          ]
        },
        {
          title: "Integrasi Nilai Spiritual",
          sub_indicators: [
            "Menjadikan pilihan kata sebagai cerminan akhlak Islami.",
            "Meyakini bahwa setiap kata akan dipertanggungjawabkan di hadapan Allah.",
          ]
        },
      ]
    },
    {
      id: 13,
      quality: "Influential",
      title: "Daya ajak yang kuat",
      explanation: "Call To Action yang mampu menggerakkan pikiran, hati, dan perbuatan orang lain, bukan sekadar terdengar indah.",
      indicators: [
        {
          title: "Komunikasi yang Meyakinkan",
          sub_indicators: [
            "Menyampaikan pesan dengan jelas, penuh semangat, dan mudah dipahami.",
            "Membuat orang lain merasa yakin dengan ajakan yang disampaikan.",
          ]
        },
        {
          title: "Keteladanan Sikap",
          sub_indicators: [
            "Menjadi contoh nyata sehingga orang lain terdorong mengikuti.",
            "Konsistensi antara ucapan dan perbuatan membuat ajakan lebih kuat.",
          ]
        },
        {
          title: "Empati & Kepedulian",
          sub_indicators: [
            "Menyesuaikan cara mengajak dengan kondisi orang lain.",
            "Menunjukkan bahwa ajakan lahir dari kepedulian, bukan sekadar kepentingan pribadi.",
          ]
        },
        {
          title: "Persuasif & Inspiratif",
          sub_indicators: [
            "Menggunakan kata-kata yang membangkitkan semangat.",
            "Mengajak dengan motivasi yang menyentuh hati, bukan dengan paksaan.",
          ]
        },
        {
          title: "Membangun Kepercayaan",
          sub_indicators: [
            "Memperlakukan orang lain dengan jujur dan adil sehingga ajakan dipercaya.",
            "Menjaga amanah agar orang lain merasa aman mengikuti.",
          ]
        },
        {
          title: "Orientasi Kebaikan Bersama",
          sub_indicators: [
            "Mengajak bukan untuk keuntungan pribadi, tetapi demi maslahat kelompok.",
            "Menekankan manfaat sosial dan spiritual dari ajakan.",
          ]
        },
        {
          title: "Integrasi Nilai Spiritual",
          sub_indicators: [
            "Menjadikan daya ajak sebagai sarana dakwah.",
            "Meyakini bahwa mengajak orang lain kepada kebaikan adalah amal yang bernilai di sisi Allah.",
          ]
        },
      ]
    },
    {
      id: 14,
      quality: "Influential",
      title: "Tauladan yang selaras dengan pikiran dan kata-katanya",
      explanation: "Influence gagal tanpa bukti nyata. Orang lain menuntut bukti keselarasan antara ucapan dan tindakan.",
      indicators: [
        {
          title: "Konsistensi Pikiran, Ucapan, dan Tindakan",
          sub_indicators: [
            "Tidak berkata sesuatu yang bertentangan dengan perbuatannya.",
            "Menjadi teladan nyata, bukan hanya pandai berbicara.",
          ]
        },
        {
          title: "Kejujuran dalam Komunikasi",
          sub_indicators: [
            "Menyampaikan pendapat sesuai keyakinan hati dan pikiran.",
            "Tidak menipu atau berpura-pura demi menyenangkan orang lain.",
          ]
        },
        {
          title: "Keteladanan Akhlak",
          sub_indicators: [
            "Memperlakukan orang lain dengan adab yang sesuai dengan kata-kata yang ia ucapkan.",
            "Menjadi contoh nyata dalam disiplin, kesopanan, dan tanggung jawab.",
          ]
        },
        {
          title: "Integritas dalam Hubungan",
          sub_indicators: [
            "Menepati janji dan komitmen yang diucapkan.",
            "Tidak mengingkari ucapan meski menghadapi kesulitan.",
          ]
        },
        {
          title: "Inspiratif & Meyakinkan",
          sub_indicators: [
            "Membuat orang lain percaya karena melihat keselarasan antara ucapan dan tindakan.",
            "Menjadi sosok yang menggerakkan orang lain menuju kebaikan.",
          ]
        },
        {
          title: "Menghargai Orang Lain",
          sub_indicators: [
            "Tidak berkata manis lalu memperlakukan dengan kasar.",
            "Menjaga kehormatan orang lain sesuai dengan kata-kata yang ia sampaikan.",
          ]
        },
        {
          title: "Integrasi Nilai Spiritual",
          sub_indicators: [
            "Meyakini bahwa keselarasan pikiran, ucapan, dan tindakan adalah amanah iman.",
            "Menjadikan keteladanan sebagai bentuk dakwah bil hal (dakwah dengan perbuatan).",
          ]
        },
      ]
    },
  ]
};