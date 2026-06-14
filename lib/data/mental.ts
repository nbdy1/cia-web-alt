/**
 * lib/data/mental.ts
 *
 * The "Mental" pillar of the CIA assessment framework.
 * Definition: the ability to manage one's own internal state and circumstances.
 *
 * Structure mirrors karakter.ts — 34 themes grouped into four Islamic virtues:
 *   Niat (Intention), Sabar (Patience), Optimisme (Optimism),
 *   and Pengendalian Diri (Self-Control). Each theme has a `.group` field
 *   indicating which virtue it belongs to (shown as a badge in the UI).
 *
 * Same atomic structure as karakter.ts: themes → indicators → sub_indicators.
 * See karakter.ts for a full description of how sub-indicators are used across
 * the app (RAG, recap page, glossary modal).
 */
export const mentalData = {
  category: "Mental",
  definition: "Kemampuan menangani kondisi diri sendiri dan situasi keadaan.",
  themes: [
    {
      id: 1,
      group: "Niat",
      title: "Belajar itu ibadah. Belajar itu untuk tahu dan bisa.",
      explanation: "Belajar itu adalah ibadah. Belajar itu untuk tahu dan bisa. Belajar itu persis seperti ibadah, apabila tidak dilakukan dengan benar maka manfaatnya tidak akan di dapat.",
      indicators: [
        {
          title: "Niat Belajar sebagai Ibadah",
          sub_indicators: [
            "Menjadikan belajar sebagai bentuk pengabdian kepada Allah.",
            "Memulai belajar dengan doa dan niat yang lurus.",
          ]
        },
        {
          title: "Kesadaran bahwa tujuan belajar itu adalah ilmu (bukan ijazah atau sekedar untuk",
          sub_indicators: [
            "Menyadari bahwa belajar bukan sekadar formalitas, tetapi untuk memahami kebenaran.",
            "Menempatkan ilmu sebagai jalan menuju kedekatan dengan Allah.",
          ]
        },
        {
          title: "Orientasi “Tahu dan Bisa”",
          sub_indicators: [
            "Belajar bukan hanya untuk hafal, tetapi untuk memahami dan mengamalkan.",
            "Menjadikan ilmu sebagai bekal praktik nyata dalam kehidupan.",
          ]
        },
        {
          title: "Istiqomah dalam Menuntut Ilmu",
          sub_indicators: [
            "Tekun belajar meski menghadapi kesulitan.",
            "Tidak mudah menyerah ketika belum paham.",
          ]
        },
        {
          title: "Mengintegrasikan Ilmu dan Amal",
          sub_indicators: [
            "Menghubungkan pengetahuan dengan tindakan nyata.",
            "Menjadikan ilmu sebagai pedoman dalam akhlak dan ibadah.",
          ]
        },
        {
          title: "Rendah Hati",
          sub_indicators: [
            "Tidak sombong dengan ilmu yang dimiliki.",
            "Menyadari bahwa ilmu adalah amanah, bukan sekadar prestasi.",
          ]
        },
        {
          title: "Tujuan utama belajar adalah cinta dan ridlo Allah",
          sub_indicators: [
            "Menjadikan belajar sebagai sarana mendekatkan diri kepada Allah.",
            "Meyakini bahwa ilmu yang bermanfaat adalah yang membawa keberkahan.",
          ]
        },
      ]
    },
    {
      id: 2,
      group: "Niat",
      title: "Benar, baik, dan indah.",
      explanation: "Prioritas 1: Indah (Benar + Baik). Prioritas 2: Benar (Allah). Prioritas 3: Baik (Manusia). Harus melakukan apa yang penting dan bermanfaat walau tidak suka.",
      indicators: [
        {
          title: "Menjadikan nilai “Benar” sebagai Fondasi",
          sub_indicators: [
            "Memastikan setiap pilihan dan tindakan sesuai syariat Allah.",
            "Tidak mengorbankan prinsip halal-haram demi keuntungan duniawi.",
            "Menjadikan wahyu sebagai kompas utama dalam hidup.",
          ]
        },
        {
          title: "Menjadikan nilai “Baik” sebagai ekspresi sosial",
          sub_indicators: [
            "Menampilkan akhlak mulia dalam interaksi sosial.",
            "Menghargai norma, budaya, dan etika yang berlaku.",
            "Menjaga hubungan dengan sesama melalui sikap ramah, adil, dan empati.",
          ]
        },
        {
          title: "Menjadikan nilai “Indah” sebagai Harmoni",
          sub_indicators: [
            "Menggabungkan kebenaran syariat dengan kebaikan sosial sehingga lahir keindahan.",
            "Menyampaikan kebenaran dengan cara yang disukai manusia",
            "Mengutamakan amal soleh yang memenuhi nilai “Indah” sebagai prioritas utama.",
          ]
        },
        {
          title: "Prioritas yang Seimbang",
          sub_indicators: [
            "Tidak hanya mengejar “baik menurut manusia” jika bertentangan dengan syariat.",
            "Tidak hanya berpegang pada “benar menurut Allah” tanpa memperhatikan cara penyampaian.",
            "Selalu mencari titik indah: benar secara syariat, baik secara sosial.",
          ]
        },
        {
          title: "Integrasi Spiritualitas & Sosialita",
          sub_indicators: [
            "Menjadikan iman sebagai fondasi.",
            "Menjadikan akhlak sebagai wajah.",
            "Menjadikan maslahat sebagai buah.",
          ]
        },
      ]
    },
    {
      id: 3,
      group: "Niat",
      title: "Bahagia menjadi hamba Allah & siap menghadapNya.",
      explanation: "Bahagia, rela, ridlo menjadi seorang hamba Allah. Karena kita ridlo, maka kita jauh lebih siap menghadapNya.",
      indicators: [
        {
          title: "Merasa bahagia dalam ketaatan",
          sub_indicators: [
            "Merasa tenang dan bahagia ketika beribadah.",
            "Ingin menjadikan ketaatan sebagai sumber kebahagiaan, bukan beban.",
            "Bahagia menjadi hamba Allah.",
          ]
        },
        {
          title: "Konsistensi Ibadah",
          sub_indicators: [
            "Menjaga shalat, dzikir, doa, dan amal shalih dengan istiqamah.",
            "Tidak mudah lalai meski sibuk dengan urusan dunia.",
          ]
        },
        {
          title: "Orientasi Akhirat",
          sub_indicators: [
            "Menyadari bahwa hidup di dunia hanyalah sementara.",
            "Menjadikan akhirat sebagai tujuan utama dalam setiap langkah.",
          ]
        },
        {
          title: "Kesiapan Menghadap Allah",
          sub_indicators: [
            "Senantiasa sibuk memperbaiki diri",
            "Senantiasa sibuk bertaubat dari kesalahan.",
            "Menyambut kematian dengan hati yang ridha, bukan takut berlebihan.",
          ]
        },
        {
          title: "Syukur & Sabar",
          sub_indicators: [
            "Bersyukur atas nikmat kecil maupun besar.",
            "Bersabar atas ujian, karena yakin semua adalah bagian dari kasih sayang Allah.",
          ]
        },
        {
          title: "Hidup dengan “Benar”",
          sub_indicators: [
            "Menjalani kehidupan sesuai syariat, baik dalam ibadah maupun muamalah.",
            "Menjaga akhlak mulia sebagai cerminan hamba Allah.",
          ]
        },
        {
          title: "Keteladanan Spiritual",
          sub_indicators: [
            "Menjadi teladan bagi orang lain dalam ketenangan, kesabaran, dan keikhlasan.",
            "Membuat orang lain merasakan kedamaian dari sikapnya.",
          ]
        },
      ]
    },
    {
      id: 4,
      group: "Niat",
      title: "Bahagia menjadi umat Muhammad Saw & merindukan perjumpaan dengannya.",
      explanation: "Bahagia dan bangga menjadi umat Nabi Muhammad Saw. Mengenal sejarah, hadits, dan patuh kepadanya.",
      indicators: [
        {
          title: "Cinta Nabi Saw",
          sub_indicators: [
            "Menjadikan beliau sebagai teladan utama dalam hidup.",
            "Merasa bangga dan bahagia menjadi bagian dari umatnya.",
          ]
        },
        {
          title: "Menghidupkan Sunnah",
          sub_indicators: [
            "Berusaha menjalankan sunnah Rasulullah dalam ibadah, akhlak, dan muamalah.",
            "Menjadikan sunnah sebagai pedoman sehari-hari, bukan sekadar simbol.",
          ]
        },
        {
          title: "Rindu Nabi Saw",
          sub_indicators: [
            "Sering bershalawat sebagai wujud cinta dan kerinduan.",
            "Berdoa agar kelak bisa berjumpa dengan Rasulullah di akhirat.",
          ]
        },
        {
          title: "Berusaha mengamalkan banyak sunah Nabi saw",
          sub_indicators: [
            "Membaca biografi Nabi Saw",
            "Berinteraksi dengan Quran sebagai sunah yang utama",
            "mempelajari hadis sebagai sunah utama yang kedua",
          ]
        },
        {
          title: "Bersyukur menjadi umat Nabi Saw",
          sub_indicators: [
            "Merasa mulia dengan identitas keislaman yang diwariskan Rasulullah.",
            "Melibatkan diri dalam dakwah",
          ]
        },
        {
          title: "Bukan hanya ingin surga dan melihat Allah, tetapi ingin berjumpa dengan nabi Saw",
          sub_indicators: [
            "Menjadikan perjumpaan dengan Rasulullah sebagai cita-cita tertinggi.",
            "Memperbanyak amal shalih sebagai bekal agar layak bertemu beliau.",
          ]
        },
      ]
    },
    {
      id: 5,
      group: "Niat",
      title: "Jatuh cinta pada kalam Allah & siap hidup berpandu padanya.",
      explanation: "Al-Quran adalah petunjuk kehidupan. Pecinta sejati mempelajari, merenungi, dan menjadikannya pedoman.",
      indicators: [
        {
          title: "Mencintai Al-Qur’an",
          sub_indicators: [
            "Merasa rindu dan bahagia ketika membaca atau mendengar Al-Qur’an.",
            "Menjadikan interaksi dengan Quran (baca, hafal, tadabur) sebagai kebutuhan, bukan kewajiban.",
          ]
        },
        {
          title: "Dekat dengan Al-Qur’an",
          sub_indicators: [
            "Mendawamkan / setiap hari ada target membaca Al-Qur’an",
            "Mendawamkan / setiap hari ada target menghafal Al-Qur’an",
            "Mendawamkan / setiap hari ada target mentadabburi Al-Qur’an.",
          ]
        },
        {
          title: "Berusaha mengamalkan Al-Qur’an",
          sub_indicators: [
            "Menjadikan Al-Qur’an sebagai kompas dalam berpikir, berkata, dan bertindak.",
            "Mengukur benar-salah dengan standar Al-Qur’an, bukan logika manusia.",
          ]
        },
        {
          title: "Konsistensi dengan Al-Qur’an",
          sub_indicators: [
            "Menjalankan ibadah, muamalah, dan akhlak sesuai tuntunan Al-Qur’an.",
            "Tidak mudah tergoda oleh hal-hal yang bertentangan dengan nilai Qur’ani.",
          ]
        },
        {
          title: "Terikat dengan Al-Qur’an",
          sub_indicators: [
            "Merasakan ketenangan hati saat berinteraksi dengan Al-Qur’an.",
            "Menjadikan Al-Qur’an sebagai sumber kekuatan dalam menghadapi ujian hidup.",
            "Menjadikan Al-Qur’an sebagai tiket pertemuan dengan Allah",
          ]
        },
      ]
    },
    {
      id: 6,
      group: "Niat",
      title: "Ingin mulia di akhirat dengan menghafal alQuran.",
      explanation: "Mukmin yang hebat adalah penghafal Al-Quran. Pengamalan bergantung pada kekuatan hafalan.",
      indicators: [
        {
          title: "Niat yang Lurus",
          sub_indicators: [
            "Menghafal Al-Qur’an karena Allah Swt & Rasulullah Saw",
            "Menghafal Al-Qur’an bukan hanya untuk orangtua",
            "Menghafal Al-Qur’an bukan hanya untuk masuk kampus jalur beasiswa",
            "Menghafal Al-Qur’an bukan hanya untuk kebanggaan",
          ]
        },
        {
          title: "Konsistensi dalam Menghafal",
          sub_indicators: [
            "Punya target hafalan (ziyadah & mutqinin)",
            "Menjaga rutinitas muraja’ah (mengulang hafalan) agar tidak hilang.",
            "Menyisihkan waktu khusus setiap hari untuk ziyadah & murajaah",
          ]
        },
        {
          title: "Merasakan koneksi dengan Al-Quran",
          sub_indicators: [
            "Merasakan ketenangan dan kebahagiaan saat berinteraksi dengan Al-Qur’an.",
            "Menjadikan hafalan sebagai sarana memperkuat iman dan taqwa.",
          ]
        },
        {
          title: "Ingin memahami Al-Quran",
          sub_indicators: [
            "Tidak hanya menghafal, tetapi juga berusaha memahami isi Al-Qur’an.",
            "Tidak hanya menghafal, tetapi juga berusaha mengamalkan isi Al-Qur’an.",
          ]
        },
        {
          title: "Orientasi Akhirat",
          sub_indicators: [
            "Meyakini bahwa kemuliaan sejati adalah bersama Al-Qur’an di akhirat.",
            "Menjadikan hafalan sebagai bekal untuk mendapatkan syafaat Al-Qur’an.",
          ]
        },
        {
          title: "Kerendahan Hati",
          sub_indicators: [
            "Tidak sombong dengan hafalan, tapi tetap tawadhu.",
            "Menyadari bahwa hafalan adalah amanah yang harus dijaga.",
          ]
        },
        {
          title: "Dakwah & Teladan",
          sub_indicators: [
            "Mengajak orang lain mencintai Al-Qur’an melalui teladan pribadi.",
            "Takut berbuat salah dan buruk karena merasa menodai Al-Quran",
          ]
        },
      ]
    },
    {
      id: 7,
      group: "Niat",
      title: "Ingin Mulia di dunia dengan teknologi bisnis & dakwah.",
      explanation: "Ahli dalam urusan duniawi (teknologi & bisnis) sebagai syarat kebahagiaan dunia dan sarana dakwah.",
      indicators: [
        {
          title: "Visinya memadukan Teknologi dakwah dan bisnis.",
          sub_indicators: [
            "Menjadikan teknologi, bisnis, dan dakwah bukan sebagai tujuan terpisah, tetapi sebagai sarana saling menguatkan.",
            "Melihat dunia sebagai ladang dakwah yang bisa dimuliakan dengan teknologi dan bisnis.",
          ]
        },
        {
          title: "Pemanfaatan Teknologi untuk Kebaikan",
          sub_indicators: [
            "Menggunakan teknologi sebagai alat untuk mempermudah hidup, memperluas dakwah, dan meningkatkan produktivitas.",
            "Tidak menyalahgunakan teknologi untuk hal yang merusak moral atau merugikan orang lain.",
          ]
        },
        {
          title: "Bisnis yang Beretika & Syariah",
          sub_indicators: [
            "Menjalankan usaha dengan prinsip halal, jujur, dan amanah.",
            "Menjadikan bisnis sebagai sarana memberi manfaat bagi masyarakat, bukan sekadar mencari keuntungan.",
          ]
        },
        {
          title: "Dakwah yang Kreatif & Relevan",
          sub_indicators: [
            "Menggunakan media modern untuk menyampaikan pesan Islam dengan cara yang menarik dan mudah dipahami.",
            "Menjadikan dakwah sebagai bagian dari aktivitas sehari-hari, bukan hanya di mimbar.",
          ]
        },
        {
          title: "Integrasi Dunia & Akhirat",
          sub_indicators: [
            "Menyadari bahwa kemuliaan dunia harus menjadi bekal menuju akhirat.",
            "Menjadikan setiap aktivitas bisnis dan teknologi sebagai ibadah dan diniatkan untuk Allah.",
          ]
        },
        {
          title: "Kepemimpinan & Keteladanan",
          sub_indicators: [
            "Menjadi teladan dalam memadukan profesionalisme dengan nilai spiritual.",
            "Menginspirasi orang lain untuk berbisnis dan berdakwah dengan cara yang mulia.",
          ]
        },
        {
          title: "Orientasi Maslahat",
          sub_indicators: [
            "Fokus pada manfaat luas: teknologi untuk memudahkan, bisnis untuk mensejahterakan, dakwah untuk mensolehkan",
            "Menjadikan keberhasilan dunia sebagai sarana memperkuat ukhuwah dan dakwah.",
          ]
        },
      ]
    },
    {
      id: 8,
      group: "Niat",
      title: "Berpikir Besar",
      explanation: "Apa yang kamu inginkan itulah yang kamu dapat. Bercita-citalah yang tinggi.",
      indicators: [
        {
          title: "Visinya sampai akhirat",
          sub_indicators: [
            "Visi misi dan cita-citanya bukan cuma dunia saja tapi sekaligus akhirat",
            "Tidak hanya memikirkan diri sendiri, tetapi juga dampak bagi masyarakat dan umat.",
          ]
        },
        {
          title: "Berani Bermimpi Besar",
          sub_indicators: [
            "Tidak takut dianggap “terlalu tinggi” dalam cita-cita.",
            "Menjadikan mimpi besar sebagai motivasi, bukan sekadar angan-angan.",
          ]
        },
        {
          title: "Ketekunan & Disiplin",
          sub_indicators: [
            "Cita-cita besar nya setara dengan daya juangnya.",
            "Tidak akan menyerah meski menghadapi rintangan besar.",
          ]
        },
        {
          title: "Berani Mengambil Risiko",
          sub_indicators: [
            "Menyadari bahwa cita-cita besar membutuhkan pengorbanan.",
            "Siap menghadapi tantangan dengan strategi dan keberanian.",
            "Siap bangkit lagi apabila gagal.",
          ]
        },
        {
          title: "Memastikan prosesnya haq (Sesuai syariat)",
          sub_indicators: [
            "Menjadikan cita-cita besar tetap berpandu pada syariat Allah.",
            "Meyakini bahwa keberhasilan sejati adalah yang diridhai Allah.",
          ]
        },
        {
          title: "Mampu menginspirasi",
          sub_indicators: [
            "Membuat orang lain ikut termotivasi dengan cita-citanya.",
            "Menjadi teladan dalam berpikir visioner dan bertindak nyata.",
          ]
        },
      ]
    },
    {
      id: 9,
      group: "Niat",
      title: "Tidak ada rasa malu kecuali dosa",
      explanation: "Malu hanya layak dalam tiga hal: terpikir dosa, sedang berdosa, dan setelah berdosa. Selain itu harus berani (tampil, bicara, memimpin).",
      indicators: [
        {
          title: "Hanya Malu saat ingin berbuat Dosa",
          sub_indicators: [
            "Hatinya langsung resah ketika muncul niat buruk.",
            "Ada dorongan kuat untuk menahan diri sebelum melangkah ke perbuatan salah.",
            "Menjadikan rasa malu sebagai benteng awal agar tidak jatuh ke dalam maksiat.",
          ]
        },
        {
          title: "Hanya Malu saat berbuat Dosa",
          sub_indicators: [
            "Merasa bersalah dan tidak tenang ketika melakukan kesalahan.",
            "Tidak bisa menikmati maksiat karena hati selalu mengingat Allah.",
            "Ada kesadaran bahwa dosa merendahkan martabat dirinya sebagai hamba Allah.",
          ]
        },
        {
          title: "Hanya Malu setelah melakukan dosa.",
          sub_indicators: [
            "Segera menyesal dan merasa hina di hadapan Allah.",
            "Tidak berusaha menutupi dosa dengan alasan, tetapi mengakuinya dengan jujur.",
            "Rasa malu mendorongnya untuk bertaubat dan memperbaiki diri.",
          ]
        },
        {
          title: "Tidak malu dalam hal-hal yang positif, misalnya maju ke depan kelas, bartanya,",
          sub_indicators: [
            "Tidak malu dalam hal-hal yang positif, misalnya maju ke depan kelas, bartanya,",
          ]
        },
      ]
    },
    {
      id: 10,
      group: "Niat",
      title: "Mental Inisiatif",
      explanation: "Kemampuan bertindak tanpa menunggu perintah. Menunjukkan kepedulian, tanggung jawab, dan keberanian.",
      indicators: [
        {
          title: "Ia Proaktif",
          sub_indicators: [
            "Tidak menunggu diperintah, langsung bergerak ketika melihat peluang atau masalah.",
            "Mampu membaca situasi dan bertindak cepat.",
          ]
        },
        {
          title: "Berani Memulai",
          sub_indicators: [
            "Tidak takut mencoba hal baru meski belum ada jaminan berhasil.",
            "Menjadikan tantangan sebagai kesempatan untuk tumbuh.",
          ]
        },
        {
          title: "Dia punya Tanggung Jawab yang besar",
          sub_indicators: [
            "Siap menanggung risiko dari keputusan yang diambil.",
            "Tidak lari dari konsekuensi, tetapi belajar dari hasilnya.",
          ]
        },
        {
          title: "Dia kreatif dalam mencari solusi",
          sub_indicators: [
            "Mencari cara baru untuk menyelesaikan masalah.",
            "Tidak hanya mengikuti pola lama, tetapi berani berinovasi.",
          ]
        },
        {
          title: "Konsistensi dan tekun",
          sub_indicators: [
            "Menyelesaikan apa yang sudah dimulai dengan penuh komitmen.",
            "Tidak mudah menyerah meski menghadapi hambatan.",
          ]
        },
        {
          title: "ia peka secara sosial",
          sub_indicators: [
            "Peka terhadap kebutuhan orang lain dan lingkungan.",
            "Mengambil inisiatif untuk membantu atau memberi manfaat.",
          ]
        },
      ]
    },
    {
      id: 11,
      group: "Niat",
      title: "Kreatif / Daya cipta",
      explanation: "Kemampuan mencari ide dan menciptakan sesuatu yang baru untuk mengatasi masalah.",
      indicators: [
        {
          title: "Suka berpikir Out of the Box",
          sub_indicators: [
            "Mampu melihat kemungkinan di luar kebiasaan.",
            "Tidak terpaku pada cara lama, berani mencoba pendekatan baru.",
          ]
        },
        {
          title: "Kaya Imajinasi",
          sub_indicators: [
            "Sering membayangkan ide, konsep, atau solusi yang belum pernah ada.",
            "Mampu menghubungkan hal-hal yang tampaknya tidak berkaitan.",
          ]
        },
        {
          title: "Pandai beradaptasi",
          sub_indicators: [
            "Mudah beradaptasi dengan perubahan.",
            "Tidak kaku dalam menghadapi masalah, selalu mencari alternatif lain.",
          ]
        },
        {
          title: "Pandai memecahkan masalah",
          sub_indicators: [
            "Menjadikan masalah sebagai tantangan dan peluang untuk berinovasi.",
            "Mampu menemukan solusi kreatif yang praktis dan efektif.",
          ]
        },
        {
          title: "Pandai mengekspresikan diri",
          sub_indicators: [
            "Menyalurkan ide melalui seni, tulisan, desain, atau cara komunikasi yang berbeda.",
            "Menunjukkan ciri khas dalam karya atau tindakan.",
          ]
        },
        {
          title: "Punya Rasa Ingin Tahu yang tinggi",
          sub_indicators: [
            "Aktif mencari pengetahuan baru untuk memperkaya ide.",
            "Suka bereksperimen dan mencoba hal-hal yang belum pernah dilakukan.",
          ]
        },
        {
          title: "Berani tampil beda",
          sub_indicators: [
            "Tidak takut dianggap “aneh” atau “tidak biasa”.",
            "Menjadikan perbedaan sebagai kekuatan, bukan kelemahan.",
          ]
        },
      ]
    },
    {
      id: 12,
      group: "Niat",
      title: "Inovatif / Daya rubah",
      explanation: "Kemampuan memodifikasi sesuatu yang sudah ada untuk menambah manfaatnya.",
      indicators: [
        {
          title: "Peka terhadap Masalah & Peluang",
          sub_indicators: [
            "Pandai mengidentifikasi masalah.",
            "Pandai mengidentifikasi peluang.",
          ]
        },
        {
          title: "Berani bereksperimen",
          sub_indicators: [
            "Tidak takut mencoba cara baru meski belum ada jaminan berhasil.",
            "Menjadikan kegagalan sebagai bahan belajar, bukan penghalang.",
          ]
        },
        {
          title: "Pandai menghasilkan Ide orisinal",
          sub_indicators: [
            "Mampu melahirkan gagasan yang berbeda dari kebiasaan umum.",
            "Menunjukkan ciri khas dalam solusi atau karya yang dibuat.",
          ]
        },
        {
          title: "Pandai beradaptasi dan fleksibel",
          sub_indicators: [
            "Mudah menyesuaikan diri dengan perubahan.",
            "Mampu mengubah strategi ketika kondisi tidak sesuai rencana.",
          ]
        },
        {
          title: "Pandai mengintegrasikan Ilmu & Kreativitas",
          sub_indicators: [
            "Menggabungkan pengetahuan, teknologi, dan imajinasi untuk menciptakan sesuatu yang baru.",
            "Tidak hanya berpikir kreatif, tetapi juga aplikatif.",
          ]
        },
        {
          title: "Pandai menginspirasi",
          sub_indicators: [
            "Membuat orang lain ikut termotivasi untuk berinovasi.",
            "Menjadi teladan dalam berinovasi.",
          ]
        },
      ]
    },
    {
      id: 13,
      group: "Niat",
      title: "Mandiri",
      explanation: "Kemandirian emosional (lepas ortu), perilaku (buat keputusan), dan nilai (tunduk agama).",
      indicators: [
        {
          title: "Kemandirian Emosional",
          sub_indicators: [
            "Tidak bergantung pada orangtua atau orang lain untuk merasa aman.",
            "Mampu mengendalikan emosi tanpa harus selalu mencari validasi eksternal.",
            "Tetap tenang dalam menghadapi tekanan, tidak mudah goyah oleh pengaruh lingkungan.",
          ]
        },
        {
          title: "Kemandirian Perilaku",
          sub_indicators: [
            "Berani membuat keputusan sendiri dan siap menanggung konsekuensinya.",
            "Mampu menuntaskan pekerjaan tanpa harus selalu diarahkan.",
            "Bisa bekerja sendiri sekaligus mampu bekerjasama dengan orang lain secara sehat.",
          ]
        },
        {
          title: "Kemandirian Nilai",
          sub_indicators: [
            "Menjadikan nilai agama sebagai pedoman utama dalam hidup.",
            "Tidak mudah terpengaruh oleh tren atau tekanan sosial yang bertentangan dengan syariat.",
            "Konsisten dalam menjunjung kebenaran meski berbeda dengan mayoritas.",
          ]
        },
        {
          title: "Tanggung Jawab Pribadi",
          sub_indicators: [
            "Menyadari bahwa setiap tindakan membawa akibat, sehingga berhati-hati dalam bertindak.",
            "Tidak menyalahkan orang lain tanpa argumentasi logis dan syar’i",
          ]
        },
      ]
    },
    {
      id: 14,
      group: "Niat",
      title: "Punya action plan",
      explanation: "Rencana kehidupan rinci: Timeline (target usia), Stepline (aktivitas pencapaian), dan Minor routine (istiqomah harian).",
      indicators: [
        {
          title: "Serius dengan cita-citanya",
          sub_indicators: [
            "Memiliki cita-cita yang jelas dengan alasan yang kuat.",
            "Memiliki rencana bagaimana merealisasikan cita-citanya.",
          ]
        },
        {
          title: "Menyusun timeline cita-cita yang realistis",
          sub_indicators: [
            "Menentukan umur atau rentang waktu pencapaian cita-cita.",
            "Membagi perjalanan hidup ke dalam fase-fase yang terstruktur.",
          ]
        },
        {
          title: "Menyusun tahapan (Stepline) cita-cita yang sistematis",
          sub_indicators: [
            "Membuat tahapan bertingkat dari awal hingga akhir.",
            "Menyusun urutan logis agar setiap langkah mendukung pencapaian berikutnya.",
          ]
        },
        {
          title: "Memikirkan semua langkah",
          sub_indicators: [
            "Membedakan antara langkah besar (strategis) dan langkah kecil (teknis).",
            "Menyadari bahwa cita-cita besar membutuhkan kombinasi keduanya.",
          ]
        },
        {
          title: "Disiplin & Konsistensi",
          sub_indicators: [
            "Menjalankan rencana sesuai timeline yang ditetapkan.",
            "Tidak menyerah meski ada hambatan.",
          ]
        },
        {
          title: "Evaluasi & Penyesuaian",
          sub_indicators: [
            "Meninjau kembali rencana secara berkala.",
            "Berani mengubah strategi bila ada kendala, tanpa kehilangan arah utama.",
          ]
        },
        {
          title: "Integrasi Nilai & Spiritualitas",
          sub_indicators: [
            "Tidak mengandalkan ikhtiar saja, tapi mengandalkan doa dan ibadah",
            "Fokus menyempurnakan dan menjaga kualitas proses (harus syar’i)",
          ]
        },
      ]
    },
    {
      id: 15,
      group: "Jihad",
      title: "Sadar bahwa dunia adalah game yang besar.",
      explanation: "Dunia mirip game, bedanya taruhannya adalah surga atau neraka. Syariat Allah adalah aturan mainnya.",
      indicators: [
        {
          title: "Sadar bahwa hidup = ujian",
          sub_indicators: [
            "Menyadari bahwa setiap peristiwa adalah “level” yang harus dilewati.",
            "Tidak menganggap dunia sebagai tujuan akhir, tetapi sebagai arena ujian menuju akhirat.",
          ]
        },
        {
          title: "Memahami aturan main",
          sub_indicators: [
            "Menjadikan syariat Allah sebagai “rule of the game.”",
            "Tidak mencari jalan pintas dengan cara haram, meski tampak menguntungkan.",
          ]
        },
        {
          title: "Selalu punya strategi & perencanaan",
          sub_indicators: [
            "Menyusun langkah hidup seperti strategi dalam permainan besar.",
            "Memahami bahwa setiap keputusan membawa konsekuensi.",
          ]
        },
        {
          title: "Mental Kompetitif yang Sehat",
          sub_indicators: [
            "Berusaha yang terbaik dalam proses",
            "Berkompetisi melawan diri sendiri",
            "Melihat orang lain bukan hanya sebagai kompetitor dalam kebaikan, namun juga melihatnya sebagai partner.",
          ]
        },
        {
          title: "Ketekunan & Kesabaran",
          sub_indicators: [
            "Tidak mudah putus asa ketika “jatuh atau gagal”",
            "Bangkit kembali dengan semangat baru, seperti pemain yang terus mencoba hingga berhasil.",
          ]
        },
        {
          title: "Orientasi Akhirat",
          sub_indicators: [
            "Menyadari bahwa “game dunia” berakhir dengan kematian.",
            "Fokus pada “reward akhirat” sebagai kemenangan sejati.",
          ]
        },
        {
          title: "Rasa Syukur & Tawakal",
          sub_indicators: [
            "Menikmati setiap tahap permainan dengan syukur.",
            "Berserah diri kepada Allah atas hasil, setelah berusaha maksimal.",
          ]
        },
      ]
    },
    {
      id: 16,
      group: "Jihad",
      title: "Setiap pilihan ada konsekuensinya.",
      explanation: "Hidup dipenuhi pilihan. Apapun yang dipilih pasti ada dampaknya. Golput pun adalah pilihan.",
      indicators: [
        {
          title: "Memahami makna “Risiko”",
          sub_indicators: [
            "Menyadari bahwa setiap pilihan membawa dampak positif maupun negatif (resiko).",
            "Tidak takut risiko namun tetap memperhitungkan dan mengukur besarannya.",
          ]
        },
        {
          title: "Pertimbangan Matang",
          sub_indicators: [
            "Menimbang maslahat dan mudharat sebelum memilih.",
            "Menggunakan logika dan syariat dalam mengambil keputusan.",
          ]
        },
        {
          title: "Tanggung Jawab atas Konsekuensi",
          sub_indicators: [
            "Berani menanggung akibat dari keputusan yang diambil.",
            "Tidak menyalahkan orang lain atau keadaan atas hasil pilihan.",
          ]
        },
        {
          title: "Sikap Hati-hati",
          sub_indicators: [
            "Tidak tergesa-gesa dalam menentukan pilihan.",
            "Menghindari keputusan yang hanya didorong oleh emosi sesaat.",
          ]
        },
        {
          title: "Terus menerus melakukan evaluasi dari setiap pilihan yang diambil di masa lalu",
          sub_indicators: [
            "Belajar dari konsekuensi pilihan sebelumnya.",
            "Memperbaiki strategi agar pilihan berikutnya lebih bijak.",
          ]
        },
      ]
    },
    {
      id: 17,
      group: "Jihad",
      title: "Daya Juang..",
      explanation: "Kemampuan terus berikhtiar, tidak menyerah, tidak putus asa meski gagal berkali-kali.",
      indicators: [
        {
          title: "Ia memiliki ketangguhan",
          sub_indicators: [
            "Tidak mudah goyah meski menghadapi kesulitan panjang.",
            "Tetap fokus pada tujuan meski hasil belum terlihat.",
          ]
        },
        {
          title: "Terus berikhtiar",
          sub_indicators: [
            "Terus berikhtiar setiap hari, tidak hanya semangat di awal.",
            "Menjadikan kegagalan sebagai bahan bakar untuk mencoba lagi.",
          ]
        },
        {
          title: "Tetap optimisme dalam keadaan sulit",
          sub_indicators: [
            "Meyakini bahwa setiap rintangan pasti ada jalan keluar.",
            "Melihat ujian sebagai peluang untuk tumbuh lebih kuat.",
          ]
        },
        {
          title: "Mampu bangkit dari kejatuhan",
          sub_indicators: [
            "Cepat pulih setelah jatuh atau gagal.",
            "Tidak membiarkan kegagalan menghentikan langkah (Putus asa).",
          ]
        },
        {
          title: "Mampu berkerja keras dan disiplin",
          sub_indicators: [
            "Menjalankan usaha dengan tekun, bukan sekadar berharap hasil instan.",
            "Siap berkorban waktu, tenaga, dan kenyamanan demi cita-cita.",
          ]
        },
        {
          title: "Ibadah menjadi sebagai sumber kekuatan",
          sub_indicators: [
            "Menguatkan hati dengan doa, ibadah, dan tawakal kepada Allah.",
            "Meyakini bahwa perjuangan adalah bagian dari ibadah.",
          ]
        },
      ]
    },
    {
      id: 18,
      group: "Jihad",
      title: "Kompetitif (Daya saing)",
      explanation: "Ambisi memenangkan kebaikan (Fastabiqhul Khoirot). Merespon kemenangan dengan syukur, kekalahan dengan evaluasi.",
      indicators: [
        {
          title: "Siap Bersaing",
          sub_indicators: [
            "Memiliki motivasi kuat untuk menjadi yang terbaik.",
            "Melihat persaingan sebagai sarana belajar dan meningkatkan kualitas diri.",
            "Tidak takut menghadapi lawan yang lebih kuat.",
          ]
        },
        {
          title: "Merespons Kemenangan dengan Benar",
          sub_indicators: [
            "Bersyukur atas kemenangan tanpa sombong.",
            "Menghargai lawan yang kalah dengan sikap hormat.",
            "Menjadikan kemenangan sebagai dorongan untuk terus berusaha, bukan berhenti dan cepat puas.",
          ]
        },
        {
          title: "Merespons Kekalahan dengan Benar",
          sub_indicators: [
            "Menerima kekalahan dengan lapang dada tanpa menyalahkan orang lain.",
            "Menjadikan kekalahan sebagai bahan evaluasi dan motivasi untuk bangkit.",
            "Tetap menjaga semangat juang meski gagal.",
          ]
        },
        {
          title: "Sportif",
          sub_indicators: [
            "Menjunjung tinggi aturan dan nilai keadilan dalam persaingan.",
            "Tidak menggunakan cara curang untuk menang.",
          ]
        },
        {
          title: "Tangguh dan tawadlu",
          sub_indicators: [
            "Tidak mudah putus asa ketika kalah.",
            "Tidak cepat puas ketika menang dan",
            "Tidak sombong ketika menang",
          ]
        },
        {
          title: "Terus berkompetisi dengan diri sendiri.",
          sub_indicators: [
            "Terus meningkatkan kualitas pribadi, bukan hanya mengalahkan orang lain.",
            "Menjadikan kompetisi sebagai alat untuk merubah diri menjadi lebih baik",
          ]
        },
      ]
    },
    {
      id: 19,
      group: "Jihad",
      title: "Monetitatif (Daya menguangkan).",
      explanation: "Kemampuan menghasilkan uang dari karya/skill (literasi finansial). Paham pemasukan, pengeluaran, investasi, dan zakat.",
      indicators: [
        {
          title: "Kreativitas Produktif",
          sub_indicators: [
            "Pandai menghasilkan karya yang unik, relevan, dan bermanfaat.",
            "Pandai membuat suatu karya sesuai dengan kebutuhan masyarakat.",
          ]
        },
        {
          title: "Punya mental interpreneur",
          sub_indicators: [
            "Berani menawarkan karya kepada publik.",
            "Tidak malu menjadikan karya sebagai sumber penghasilan.",
          ]
        },
        {
          title: "Kemampuan Branding & Promosi",
          sub_indicators: [
            "Mampu memperkenalkan karya dengan cara menarik.",
            "Pandai memanfaatkan media sosial untuk berjualan.",
          ]
        },
        {
          title: "Konsistensi Produksi",
          sub_indicators: [
            "Tidak berhenti berkarya meski belum langsung menghasilkan.",
            "Menjadikan karya sebagai rutinitas yang berkelanjutan.",
          ]
        },
        {
          title: "Tetap setia dengan syariat.",
          sub_indicators: [
            "Tetap menjaga kehalalan, kejujuran, dan etika dalam monetisasi karya.",
            "Menjadikan penghasilan dari karya sebagai sarana dakwah, bukan hanya demi keuntungan pribadi.",
          ]
        },
      ]
    },
    {
      id: 20,
      group: "Jihad",
      title: "3 Cara Belajar",
      explanation: "Belajar dengan 3 cara: Tanya/Ditanya, Menulis Notes (Catat, Rangkum, Respon), dan Murajaah (Mengulang).",
      indicators: [
        {
          title: "Menjalankan prinsip “Tanya atau Ditanya.”",
          sub_indicators: [
            "Aktif bertanya kepada guru untuk memperjelas materi.",
            "Siap ditanya dan mampu menjawab dengan pemahaman, bukan sekadar hafalan.",
            "Menjadikan dialog ilmiah sebagai bagian dari ibadah belajar.",
          ]
        },
        {
          title: "Menjalankan prinsip “Menulis Notes (Mencatat, Merangkum, Merespon).”",
          sub_indicators: [
            "Membuat catatan rapi dan sistematis dengan metode tertentu (layout, Cornell, mindmap).",
            "Merangkum inti materi agar mudah dipahami kembali.",
            "Merespon dengan menambahkan refleksi pribadi atau contoh nyata.",
            "Menjadikan notes sebagai alat penguatan memori dan pemahaman.",
          ]
        },
        {
          title: "Menjalankan prinsip “Murajaah (Mengulang)”",
          sub_indicators: [
            "Konsisten mengulang materi agar tidak hilang dari ingatan.",
            "Menjadikan murajaah sebagai rutinitas harian, bukan hanya menjelang ujian.",
            "Menghubungkan murajaah dengan praktik nyata dalam ibadah dan kehidupan.",
          ]
        },
        {
          title: "Sadar sepenuhnya bahwa belajar itu adalah Ibadah",
          sub_indicators: [
            "Memulai belajar dengan niat mencari ridha Allah.",
            "Menjadikan setiap aktivitas belajar sebagai bentuk pengabdian kepada Allah",
          ]
        },
        {
          title: "Disiplin & Konsistensi",
          sub_indicators: [
            "Menjalankan tiga cara belajar ini secara berkesinambungan.",
            "Tidak mudah lalai atau menunda-nunda.",
          ]
        },
        {
          title: "Integrasi Ilmu & Amal",
          sub_indicators: [
            "Menjadikan hasil belajar sebagai pedoman dalam akhlak, ibadah, dan dakwah.",
            "Tidak berhenti pada teori, tetapi mengamalkan ilmu.",
          ]
        },
      ]
    },
    {
      id: 21,
      group: "Jihad",
      title: "Mulai dari enol",
      explanation: "Kesuksesan dirintis, tidak instan. Butuh perjuangan, pengorbanan, dan jatuh bangun.",
      indicators: [
        {
          title: "Menyadari makna dari kata “Proses”",
          sub_indicators: [
            "Menyadari bahwa kesuksesan itu butuh proses",
            "Menyadari bahwa proses itu adalah “waktu” dan “Pengorbanan”",
            "Meyakini tidak ada yang instant.",
          ]
        },
        {
          title: "Tidak merasa hina untuk mulai dari enol",
          sub_indicators: [
            "Mau menerima posisi awal yang kecil atau sederhana.",
            "Tidak gengsi memulai dari bawah.",
          ]
        },
        {
          title: "Sabar & tekun",
          sub_indicators: [
            "Sabar menjalani proses panjang.",
            "Tekun berusaha meski hasilnya “Kecil” atau “belum terlihat sama sekali”.",
          ]
        },
        {
          title: "Tidak merasa hina untuk belajar dari senior.",
          sub_indicators: [
            "Mau belajar dari pengalaman orang lain yang lebih senior",
            "Menjadikan setiap langkah sebagai kesempatan menambah ilmu.",
          ]
        },
        {
          title: "Endurance & Optimis",
          sub_indicators: [
            "Yakin bahwa usaha kecil akan berbuah besar bila terus dijalankan.",
            "Melihat perjalanan sebagai bagian dari kesuksesan, bukan hanya hasil akhir.",
            "Tidak lelah dan kehabisan energy untuk menyusuri proses.",
          ]
        },
        {
          title: "Selalu mengkoneksikannya dengan ibadah",
          sub_indicators: [
            "Menyadari bahwa semua jerih payah dalam proses adalah ibadah",
            "Menjadikan ikhtiar sebagai jalan pahala, bukan siksaan.",
            "Apapun hasil yang Allah beri (keberhasilan atau kegagalan) akan disyukuri.",
          ]
        },
      ]
    },
    {
      id: 22,
      group: "Jihad",
      title: "Mental belajar.",
      explanation: "Semangat belajar dimanapun, kapanpun, dalam keadaan apapun. Menjadi pembelajar seumur hidup.",
      indicators: [
        {
          title: "Belajar dimanapun",
          sub_indicators: [
            "Mampu menjadikan setiap tempat sebagai ruang belajar.",
            "Tidak membatasi belajar hanya di kelas atau sekolah.",
            "Menangkap pelajaran dari lingkungan, pengalaman, dan interaksi sosial.",
          ]
        },
        {
          title: "Belajar kapanpun",
          sub_indicators: [
            "Memanfaatkan setiap waktu untuk menambah ilmu, baik pagi, siang, maupun malam.",
            "Tidak menunda kesempatan belajar meski hanya sebentar.",
            "Menjadikan belajar sebagai kebiasaan harian, bukan aktivitas musiman.",
          ]
        },
        {
          title: "Belajar dalam Keadaan Apapun",
          sub_indicators: [
            "Tetap belajar meski dalam kondisi sulit, sibuk, atau lelah.",
            "Menjadikan ujian hidup sebagai bahan pelajaran.",
            "Tidak mencari alasan untuk berhenti belajar.",
          ]
        },
        {
          title: "Rasa ingin tahu nya besar",
          sub_indicators: [
            "Selalu bertanya dan mencari jawaban atas hal-hal baru.",
            "Menjadikan rasa penasaran sebagai energi belajar.",
          ]
        },
        {
          title: "Adaptif & Fleksibel",
          sub_indicators: [
            "Mampu menyesuaikan cara belajar dengan situasi.",
            "Menggunakan berbagai metode: membaca, berdiskusi, menonton, atau praktik langsung.",
          ]
        },
        {
          title: "Merasa bahwa belajar itu menyenangkan",
          sub_indicators: [
            "Menjadikan belajar sebagai kesenangan",
            "Tidak pernah bosan dalam belajar",
          ]
        },
      ]
    },
    {
      id: 23,
      group: "Jihad",
      title: "Kontrol Potensi.",
      explanation: "Tahu potensi diri (niat, minat, bakat), merawatnya dengan latihan, dan memanfaatkannya untuk tujuan.",
      indicators: [
        {
          title: "Mampu melihat potensi dalam dirinya",
          sub_indicators: [
            "Mengenali bakat, minat, dan kelebihan yang dimiliki.",
            "Mampu menilai potensi secara realistis, bukan sekadar angan-angan.",
          ]
        },
        {
          title: "Mensyukuri potensi itu",
          sub_indicators: [
            "Mensyukuri potensi itu sebagai anugerah dan ujian dari Allah.",
            "Percaya diri menggunakan potensi tanpa merasa rendah diri atau sombong.",
          ]
        },
        {
          title: "merawat potensi itu",
          sub_indicators: [
            "Memiliki kurikulum untuk merawat potensinya",
            "Merawat agar terus meningkat dan tidak mengerucut apalagi hilang",
            "Terus mengevaluasi kinerja dari potensi dirinya",
          ]
        },
        {
          title: "Menggunakan potensi untuk kebaikan",
          sub_indicators: [
            "Menggunakan potensi untuk mencapai tujuan yang baik dan syar’i",
            "Menjadikan potensi sebagai jalan ibadah dan kontribusi sosial.",
          ]
        },
      ]
    },
    {
      id: 24,
      group: "Jihad",
      title: "Tiga kekuatan internal",
      explanation: "Punya tujuan (visi), bisa berubah (meninggalkan malas), dan bisa mempertahankan perubahan (istiqomah).",
      indicators: [
        {
          title: "Punya Tujuan",
          sub_indicators: [
            "Memiliki visi misi hidup yang jelas dan terukur.",
            "Menjadikan tujuan sebagai dasar dari semua ikhtiarnya",
            "Setia dengan tujuan itu tidak mudah terdistraksi",
          ]
        },
        {
          title: "Bisa Berubah",
          sub_indicators: [
            "Berani meninggalkan kebiasaan lama yang buruk demi tercapainya tujuan",
            "Berani meninggalkan kebiasaan lama yang tidak produktif demi tercapainya tujuan",
          ]
        },
        {
          title: "Bisa Mempertahankan Perubahan",
          sub_indicators: [
            "Konsisten menjalankan kebiasaan baru meski godaan kembali ke pola lama muncul.",
            "Menjadikan perubahan sebagai bagian dari identitas diri.",
            "Mampu menjaga motivasi dengan disiplin, evaluasi, dan dukungan spiritual.",
          ]
        },
        {
          title: "Selalu mengintegrasikan dengan agama",
          sub_indicators: [
            "Menjadikan tujuan, perubahan, dan konsistensi sebagai bentuk ibadah.",
            "Meyakini bahwa istiqamah adalah kunci keberhasilan dunia dan akhirat.",
          ]
        },
      ]
    },
    {
      id: 25,
      group: "Sabar",
      title: "Semua baik dan menjadi alat belajar.",
      explanation: "Tidak menyalahkan keadaan/Tuhan. Musibah adalah hikmah dan alat koreksi diri.",
      indicators: [
        {
          title: "Selalu mencari kebaikan dari peristiwa apapun",
          sub_indicators: [
            "Melihat segala hal dengan sudut pandang optimis.",
            "Tidak mudah mengeluh, tetapi mencari hikmah di balik kejadian.",
          ]
        },
        {
          title: "Fleksibel tidak mudah patah",
          sub_indicators: [
            "Mampu menerima hal baik maupun buruk sebagai bagian dari proses belajar.",
            "Tidak putus așa dan tidak membabi buta (Kalap)",
            "Selalu tenang dalam menyikapi apapun",
          ]
        },
        {
          title: "Pandai muhasabah",
          sub_indicators: [
            "Selalu mengambil pelajaran dari setiap pengalaman.",
            "Menjadikan kesalahan sebagai guru, bukan sebagai alasan putus asa.",
          ]
        },
        {
          title: "Selalu mensyukuri apa yang terjadi.",
          sub_indicators: [
            "Mensyukuri setiap keadaan sebagai kesempatan untuk belajar",
            "Mensyukuri setiap keadaan sebagai jalan kebaikan",
          ]
        },
        {
          title: "Punya tujuan untuk belajar seumur hidup",
          sub_indicators: [
            "Menjadikan setiap interaksi, pekerjaan, atau ujian hidup sebagai bahan belajar.",
            "Tidak membatasi belajar hanya pada ruang kelas.",
          ]
        },
        {
          title: "Menyadari semua dari Allah dan kembali kepada Allah",
          sub_indicators: [
            "Meyakini bahwa semua yang terjadi adalah ketetapan Allah yang penuh hikmah.",
            "Menjadikan pengalaman sebagai sarana mendekatkan diri kepada-Nya.",
          ]
        },
      ]
    },
    {
      id: 26,
      group: "Sabar",
      title: "Aku bagian dari masyarakat.",
      explanation: "Manusia makhluk sosial. Tak mungkin bermanfaat tanpa interaksi dan kontribusi di masyarakat.",
      indicators: [
        {
          title: "Mampu melepaskan diri dari ego diri sendiri",
          sub_indicators: [
            "Merasa dirinya bagian dari masyarakat, bukan individu yang terpisah.",
            "Menganggap keberhasilan dirinya harus bermanfaat untuk masyarakat.",
          ]
        },
        {
          title: "Secara sadar melibatkan diri dalam kehidupan sosial / bermasyarakat",
          sub_indicators: [
            "Aktif berpartisipasi dalam kegiatan pondok.",
            "Tidak hanya hadir secara pasif, tetapi juga memberi kontribusi nyata.",
          ]
        },
        {
          title: "Secara sadar merasa memiliki tanggung jawab sosial",
          sub_indicators: [
            "Menjalankan peran sebagai santri dengan baik.",
            "Menjaga lingkungan, menaati aturan, dan ikut menjaga ketertiban pesantren.",
          ]
        },
        {
          title: "Memiliki simpati dan empati empati",
          sub_indicators: [
            "Peduli terhadap kesulitan santri lain.",
            "Ikut merasakan suka dan duka pesantren.",
            "Turun tangan membantu",
          ]
        },
        {
          title: "Kemampuan berkolaborasi",
          sub_indicators: [
            "Mau bekerja sama demi kepentingan bersama.",
            "Menghargai perbedaan pendapat dan mencari solusi bersama.",
            "Memaklumi keterbatasan orang lain dan memaafkannya",
          ]
        },
        {
          title: "Sadar bahwa Islam mengajarkan untuk bermanfaat bagi umat dan masyarakat umum",
          sub_indicators: [
            "Tahu bedanya umman dengan masyarakat umum",
            "Menjadikan nilai agama sebagai pedoman dalam bermasyarakat.",
            "Menunjukkan akhlak mulia dalam interaksi sosial.",
          ]
        },
      ]
    },
    {
      id: 27,
      group: "Sabar",
      title: "Aku sedang menulis kitabku sendiri.",
      explanation: "Menyadari hidup dicatat malaikat. Mukmin cerdas membuat catatan hidup sendiri (diary/evaluasi).",
      indicators: [
        {
          title: "Memiliki kendali diri yang kuat",
          sub_indicators: [
            "Menyadari bahwa setiap tindakan adalah catatan dalam “kitab kehidupan.”",
            "Mampu mengenali kelebihan dan kelemahan diri dengan jujur.",
          ]
        },
        {
          title: "Pandai introspeksi diri",
          sub_indicators: [
            "Rutin melakukan muhasabah (evaluasi diri).",
            "Menuliskan pengalaman hidup sebagai bahan belajar dan perbaikan.",
          ]
        },
        {
          title: "Memiliki tanggung jawab spiritual ang kuat",
          sub_indicators: [
            "Meyakini bahwa catatan hidup kelak akan dipertanggungjawabkan di hadapan Allah.",
            "Menjadikan setiap amal sebagai bagian dari kitab yang ingin dibawa ke akhirat.",
            "Berjuang menghindari catatan yang buruk, karena itu adalah dosa dan neraka.",
          ]
        },
        {
          title: "Disiplin mengamati kehidupan",
          sub_indicators: [
            "Membiasakan diri menulis diary atau catatan pribadi yang fokus pada perjalanan iman, amal, dan akhlak.",
            "Tidak hanya mencatat keberhasilan, tetapi juga kegagalan sebagai bahan perbaikan.",
            "Disiplin terus memperbaiki pikiran perkataan dan perbuatannya",
          ]
        },
      ]
    },
    {
      id: 28,
      group: "Sabar",
      title: "Empat suara di dalam diri",
      explanation: "Suara Malaikat (Hati), Syaithan (Hawa Nafsu), Diri Pro-Malaikat, Diri Pro-Syaithan. Harus dipimpin Akal & Hati.",
      indicators: [
        {
          title: "Kecerdasan Spiritualnya tinggi",
          sub_indicators: [
            "Menyadari bahwa Allah menempatkan malaikat dan syaithan di dalam diri",
            "Selalu berhati-hati dalam berpikir, berkata dan bertindak.",
          ]
        },
        {
          title: "Pandai membedakan empat suara",
          sub_indicators: [
            "Bisa mengenali suara dari akal atau logika",
            "Bisa mengenali suara dari hati / malaikat",
            "Bisa mengenali suara dari hawa nafsu",
            "Bisa mengenali suara dari syaithan",
          ]
        },
        {
          title: "Kontrol Diri",
          sub_indicators: [
            "Berhati-hati dalam merespons apapun",
            "Berjuang keras menolak keburukan",
          ]
        },
        {
          title: "Kecenderungan pada Kebaikan",
          sub_indicators: [
            "Lebih sering mengikuti suara malaikat dan diri yang pro malaikat.",
            "Menjadikan kebaikan sebagai pilihan utama meski sulit.",
          ]
        },
        {
          title: "Konsistensi dalam melatih diri agar peka dengan kebaikan",
          sub_indicators: [
            "Melatih diri agar suara pro malaikat semakin kuat.",
            "Melemahkan suara pro syaithan dengan dzikir, doa, dan ibadah.",
          ]
        },
        {
          title: "Sering bermuhasabah (Introspeksi)",
          sub_indicators: [
            "Rutin mengevaluasi diri terhadap apa yang sudah dipikirkan",
            "Rutin mengevaluasi diri terhadap apa yang sudah dikatakan",
            "Rutin mengevaluasi diri terhadap apa yang sudah diperbuat",
          ]
        },
      ]
    },
    {
      id: 29,
      group: "Sabar",
      title: "Kontrol Diri",
      explanation: "Kemampuan menahan godaan/distraksi yang merusak fokus. Menunda kepuasan sesaat demi hasil besar.",
      indicators: [
        {
          title: "Tenang, tidak mudah panik dan kalap",
          sub_indicators: [
            "Tidak mudah terbawa emosi atau dorongan sesaat.",
            "Mampu menahan diri dari keinginan yang merusak tujuan jangka panjang.",
          ]
        },
        {
          title: "Mampu fokus",
          sub_indicators: [
            "Mampu fokus pada tujuan yang lebih besar",
            "Mampu fokus pada tujuan jangka panjang",
            "Tidak mudah tergoda oleh distraksi atau sesuatu yang instant",
          ]
        },
        {
          title: "Disiplin dalam rutinitas",
          sub_indicators: [
            "Konsisten menjalankan kebiasaan baik meski ada godaan untuk malas.",
            "Menjadikan disiplin sebagai fondasi kesuksesan.",
          ]
        },
        {
          title: "Mampu menunda kepuasan",
          sub_indicators: [
            "Rela menunda kesenangan sesaat demi hasil besar jangka panjang.",
            "Memahami bahwa kesuksesan butuh proses panjang.",
          ]
        },
        {
          title: "Menjadikan agama sebagai alat kendali utama",
          sub_indicators: [
            "Menjadikan ibadah, doa, dan dzikir sebagai cara menguatkan kontrol diri.",
            "Meyakini bahwa menahan godaan adalah bagian dari jihad melawan hawa nafsu.",
          ]
        },
      ]
    },
    {
      id: 30,
      group: "Sabar",
      title: "Mental Antisipatif (Daya tangkal)",
      explanation: "Ramalkan masalah masa depan, rancang pencegahan, dan rancang penanganan jika masalah muncul.",
      indicators: [
        {
          title: "Pandai membaca situasi.",
          sub_indicators: [
            "Peka terhadap tanda-tanda atau gejala yang bisa berkembang menjadi masalah.",
            "Tidak menunggu masalah muncul baru bergerak.",
          ]
        },
        {
          title: "Selalu punya rencana cadangan",
          sub_indicators: [
            "Selalu menyiapkan rencana cadangan (plan B, bahkan plan C).",
            "Membuat strategi jangka pendek dan jangka panjang.",
          ]
        },
        {
          title: "Siap menghadapi risiko",
          sub_indicators: [
            "Menyadari bahwa setiap keputusan punya konsekuensi.",
            "Selalu membayangkan kemungkinan terbaik dan kemungkinan terburuk",
            "Menyiapkan langkah antisipasi untuk meminimalkan dampak buruk.",
          ]
        },
        {
          title: "Tenang dan mudah beradaptasi",
          sub_indicators: [
            "Mampu menyesuaikan diri dengan perubahan mendadak.",
            "Tidak panik ketika situasi berbeda dari perkiraan.",
          ]
        },
        {
          title: "Lebih proaktif",
          sub_indicators: [
            "Bertindak lebih dulu sebelum masalah muncul.",
            "Tidak menunggu perintah, tetapi bergerak dengan inisiatif.",
          ]
        },
        {
          title: "Terus melakukan evaluasi",
          sub_indicators: [
            "Rutin menilai kondisi dan memperbaiki strategi.",
            "Belajar dari pengalaman agar lebih siap menghadapi masa depan.",
          ]
        },
        {
          title: "Berjuang untuk bisa menerima taqdir apapun",
          sub_indicators: [
            "Meyakini bahwa ikhtiar adalah bagian dari ujian.",
            "Mengawali dengan Bismillah dan Ikhtiar, menengahi dengan doa dan mengakhiri dengan tawakal kepada Allah.",
          ]
        },
      ]
    },
    {
      id: 31,
      group: "Sabar",
      title: "Keseimbangan 4 waktu",
      explanation: "Menyeimbangkan Time to Pray, Time to Learn, Time to Rest, dan Time to Play agar tercukupi asupan lahir batin.",
      indicators: [
        {
          title: "Selalu berjuang menjaga waktu ibadahnya (Time to Pray)",
          sub_indicators: [
            "Menjadikan ibadah sebagai prioritas utama hariannya.",
            "Konsisten menjaga shalat tepat waktu dan ibadah lainnya.",
            "Merasakan ketenangan sebagai dampak ibadahnya.",
          ]
        },
        {
          title: "Selalu berjuang menjaga waktu belajarnya (Time to Learn)",
          sub_indicators: [
            "Menyediakan waktu khusus untuk menambah ilmu setiap hari.",
            "Menjadikan belajar sebagai kebutuhan, bukan sekadar kewajiban.",
            "Fokus belajar nya bagus",
          ]
        },
        {
          title: "Selalu berjuang menjaga waktu istirahatnya (Time to Rest)",
          sub_indicators: [
            "Menjaga pola tidur yang sehat dan cukup.",
            "Memberi tubuh dan pikiran kesempatan untuk pulih.",
            "Tidak mengorbankan kesehatan demi aktivitas berlebihan.",
          ]
        },
        {
          title: "Selalu berjuang menjaga waktu mainnya (Time to Play)",
          sub_indicators: [
            "Menyediakan waktu untuk bersenang-senang.",
            "Menjadikan permainan sebagai sarana kebahagiaan dan penyegaran, bukan pelarian.",
            "Tetap menjaga batas agar hiburan tidak mengganggu ibadah, belajar, dan istirahat.",
          ]
        },
        {
          title: "Tahu skala prioritas dari empat waktu tersebut",
          sub_indicators: [
            "Mampu menyeimbangkan empat waktu tanpa mengorbankan salah satunya.",
            "Menjadikan keseimbangan sebagai gaya hidup, bukan sekadar teori.",
          ]
        },
        {
          title: "Keseimbangan menjaga waktu adalah ibadah",
          sub_indicators: [
            "Meyakini bahwa keseimbangan empat waktu adalah bagian dari amanah Allah.",
            "Menjadikan ibadah sebagai pusat, dan tiga waktu lainnya sebagai pendukung.",
          ]
        },
      ]
    },
    {
      id: 32,
      group: "Sabar",
      title: "Mental ITMI",
      explanation: "Teknologi adalah alat. Tepis mudorotnya, fokus pada manfaat untuk bisnis dan dakwah.",
      indicators: [
        {
          title: "Menyadari manfaat teknologi",
          sub_indicators: [
            "Menyadari bahwa teknologi hanyalah alat.",
            "Menggunakan teknologi untuk memperkuat ibadah, ilmu, dan produktivitas.",
          ]
        },
        {
          title: "Menyadari mudhorot teknologi",
          sub_indicators: [
            "Memilih aplikasi, konten, dan platform yang bermanfaat.",
            "Menolak atau menghindari mudhorotnya (pornografi, hoaks, adiksi).",
          ]
        },
        {
          title: "Menjadikan teknologi alat ibadah",
          sub_indicators: [
            "Menggunakan teknologi untuk memberi manfaat bagi diri dan masyarakat.",
            "Menjadikan teknologi sebagai sarana dakwah, pendidikan, dan kesejahteraan.",
          ]
        },
        {
          title: "Punya kontrol diri yang kuat terhadap gadget",
          sub_indicators: [
            "Tidak larut dalam penggunaan berlebihan yang merusak fokus.",
            "Menetapkan batas waktu dan aturan dalam menggunakan teknologi.",
          ]
        },
        {
          title: "Produktif dan monetitatif dengan teknologi",
          sub_indicators: [
            "Orientasinya produktif, menghasilkan karya",
            "Orientasinya monetitatif, menghasilkan uang dari teknologi",
          ]
        },
      ]
    },
    {
      id: 33,
      group: "Sabar",
      title: "Menghargai karya sendiri.",
      explanation: "Mensyukuri pencapaian, bangga dengan jerih payah. Anti-kufur nikmat dan perfeksionisme yang salah.",
      indicators: [
        {
          title: "Pandai menghargai karya",
          sub_indicators: [
            "Menghargai karya orang lain.",
            "Menghargai karya sendiri.",
            "Selalu menemukan pujian pada sebuah karya.",
          ]
        },
        {
          title: "Tidak malu menunjukkan karya",
          sub_indicators: [
            "Berani menunjukkan karya kepada orang lain tanpa rasa minder.",
            "Meyakini bahwa karya nya selalu punya keunggulan.",
            "Meyakini bahwa karyanya selalu punya nilai unik.",
          ]
        },
        {
          title: "Punya dedikasi dalam menyelesaikan karya",
          sub_indicators: [
            "Sungguh-sungguh dalam mengerjakan.",
            "Menjaga kualitas karya dengan sungguh-sungguh.",
          ]
        },
        {
          title: "Konsistensi berjuang meningkatkan kualitas karya",
          sub_indicators: [
            "Terus menghasilkan karya baru (produktif) memperbanyak portofolio.",
            "Tidak berhenti berkarya hanya karena kritik atau kegagalan.",
          ]
        },
        {
          title: "Pandai mengevaluasi & memperbaiki",
          sub_indicators: [
            "Mampu melihat kekurangan karya tanpa merendahkannya.",
            "Menjadikan evaluasi sebagai jalan untuk meningkatkan kualitas karya.",
          ]
        },
        {
          title: "Menjadikan karya sebagai ibadah",
          sub_indicators: [
            "Meyakini bahwa karya adalah amanah yang harus dijaga.",
            "Menjadikan karya sebagai sarana ibadah dan kontribusi sosial.",
            "Menghargai karya dengan cara memanfaatkannya untuk kebaikan.",
          ]
        },
      ]
    },
    {
      id: 34,
      group: "Sabar",
      title: "Konflik manajemen.",
      explanation: "Mencegah & menangani konflik dengan Tabayun, Muhasabah, dan Ishlah. Berani berkonflik jika syariat dilanggar.",
      indicators: [
        {
          title: "Mengamalkan Tabayun (Cek Kebenaran)",
          sub_indicators: [
            "Tidak langsung percaya pada informasi yang didengar.",
            "Memverifikasi sumber berita sebelum bereaksi.",
            "Menghindari fitnah, prasangka, dan tuduhan tanpa bukti.",
          ]
        },
        {
          title: "Mengamalkan Muhasabah (Introspeksi)",
          sub_indicators: [
            "Mencari kesalahan dalam diri terlebih dahulu",
            "Berani mengakui kesalahan dan meminta maaf",
            "Fokus memperbaiki diri, bukan menyalahkan orang.",
          ]
        },
        {
          title: "Mengamalkan Islah (Berbaikan)",
          sub_indicators: [
            "Berprinsip akhir dari konflik adalah berbaikan kembali",
            "Mengutamakan ukhuwah (persaudaraan) di atas ego pribadi.",
            "Mudah memaafkan orang lain.",
          ]
        },
        {
          title: "Tidak impulsif (reaktif)",
          sub_indicators: [
            "Tidak mudah terpancing amarah.",
            "Menyikapi konflik dengan tenang dan bijak.",
          ]
        },
        {
          title: "Integrasi Syariat",
          sub_indicators: [
            "Menganggap konflik adalah ujian dan nalat belajar",
            "Menyelesaikan konflik sesuai tuntunan Al-Qur’an dan Sunnah.",
            "Mengutamakan ukhuwah dalam setiap konflik",
          ]
        },
      ]
    },
  ]
};