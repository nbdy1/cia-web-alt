/**
 * scripts/demo/insan-pratama-stories.ts
 *
 * Fictional observations for the six demo santri of the Insan Pratama demo
 * school. Written to read like real CDS output: a teacher<->AI interview, CMS
 * assessments with the AI's reasoning, a treatment plan, and the parent-facing
 * drafts a musyrif would approve. Used only by seed-insan-pratama-demo.ts.
 */
import { karakterData } from "../../lib/data/karakter";
import { mentalData } from "../../lib/data/mental";
import { softSkillData } from "../../lib/data/soft-skill";

export const FRAMEWORKS = { karakter: karakterData, mental: mentalData, soft: softSkillData } as const;
export type Fw = keyof typeof FRAMEWORKS;

export type Pick = {
  fw: Fw;
  theme: number;
  indicator: number;
  /** indexes into the indicator's sub_indicators that were observed */
  fulfilled: number[];
  /** the AI's short justification, shown on the teacher's report page */
  reasoning: string;
  /** the same behaviour in plain words for parents ("Perilaku yang terlihat") */
  phrase: string;
};

export type Story = {
  nis: string;
  /** days before "now" */
  daysAgo: number;
  title: string;
  status_summary: string;
  /** [AI, Guru, AI, Guru, ...] */
  talk: string[];
  picks: Pick[];
  priority: { fw: Fw; theme: number; indicator: number };
  action_plan: string;
  parent: {
    good: string;
    focus: string;
    focusText: string;
    tips: string[];
    /** this report's "sedang didampingi" card needs the musyrif to call the parent first */
    sensitive?: string;
  };
};

export const transcript = (talk: string[]) =>
  talk.map((line, i) => `${i % 2 === 0 ? "AI" : "Guru"}: ${line}`).join("\n\n");

export const STORIES: Story[] = [
  // ───────────── IP001 Fadhil ─────────────
  {
    nis: "IP001", daysAgo: 42, title: "Adaptasi awal dan kedisiplinan ibadah",
    status_summary: "Fadhil masih menyesuaikan diri dengan ritme asrama, tetapi nyaris tidak pernah meninggalkan salat berjamaah dan sangat santun kepada ustadz.",
    talk: [
      "Assalamu'alaikum Ustadz. Bagaimana perkembangan Fadhil pekan ini di asrama?",
      "Wa'alaikumussalam. Fadhil masih menyesuaikan diri, kadang bangun agak telat, tapi salat berjamaah subuh dan maghrib hampir tidak pernah ia tinggalkan.",
      "Bagaimana sikapnya kepada ustadz dan teman sekamar?",
      "Santun sekali. Waktu saya tegur soal jadwal, dia mendengarkan dan bilang 'siap Ustadz, saya perbaiki'. Dengan teman sekamar akrab, tapi belum bisa mengatur waktunya sendiri.",
      "Adakah hal lain yang Ustadz perhatikan?",
      "Ia sering bertanya bagaimana cara menghafal yang cepat. Kelihatan sekali ingin bisa.",
    ],
    picks: [
      { fw: "karakter", theme: 4, indicator: 0, fulfilled: [0, 1], reasoning: "Ustadz mencatat Fadhil hampir tidak pernah meninggalkan salat berjamaah subuh dan maghrib meski masih beradaptasi.", phrase: "Tekun melaksanakan salat berjamaah" },
      { fw: "soft", theme: 0, indicator: 0, fulfilled: [0, 1], reasoning: "Ketika ditegur soal jadwal ia mendengarkan dan langsung berjanji memperbaiki, tanpa membantah.", phrase: "Mau mendengarkan masukan ustadz dengan santun" },
      { fw: "karakter", theme: 5, indicator: 0, fulfilled: [0], reasoning: "Ia aktif bertanya tentang cara menghafal yang lebih cepat, tanda rasa ingin tahu dan keinginan berkembang.", phrase: "Rasa ingin tahunya besar tentang cara menghafal" },
      { fw: "mental", theme: 0, indicator: 0, fulfilled: [0], reasoning: "Antusiasmenya untuk bisa menghafal menunjukkan niat belajar yang kuat.", phrase: "Bersemangat untuk belajar" },
    ],
    priority: { fw: "karakter", theme: 2, indicator: 0 },
    action_plan: "Dampingi Fadhil menyusun jadwal harian sederhana (bangun, salat, belajar) dan tempelkan di dekat tempat tidurnya. Apresiasi setiap kali ia menepati jadwal selama dua pekan, lalu evaluasi bersama.",
    parent: {
      good: "Alhamdulillah, Fadhil mulai terbiasa dengan ritme pondok. Ia hampir tidak pernah meninggalkan salat berjamaah dan sangat santun kepada para ustadz.",
      focus: "Membiasakan jadwal harian asrama",
      focusText: "Di minggu-minggu awal wajar bila ia masih menyesuaikan jam bangun dan jadwal belajar. Kami mendampinginya langkah demi langkah dengan jadwal harian yang sederhana.",
      tips: ["Saat menelepon, tanyakan satu hal yang ia syukuri hari itu.", "Sampaikan bahwa Ayah/Bunda bangga ia tidak meninggalkan salat berjamaah."],
    },
  },
  {
    nis: "IP001", daysAgo: 21, title: "Mulai mandiri dan bertanggung jawab",
    status_summary: "Fadhil mulai merapikan kamar dan menyelesaikan piket tanpa diingatkan. Ia masih mudah kehilangan fokus saat belajar malam.",
    talk: [
      "Bagaimana kabar Fadhil dalam tiga pekan terakhir, Ustadz?",
      "Banyak kemajuan. Sekarang dia merapikan tempat tidur sendiri dan piket kamar selesai sebelum saya periksa. Dulu harus diingatkan terus.",
      "Bagaimana dengan belajar dan ibadahnya?",
      "Salat berjamaah tetap rajin, bahkan sering datang lebih awal. Tapi saat belajar malam, 15 menit pertama ia fokus lalu mulai melamun atau menggambar-gambar di buku.",
      "Apa yang sudah Ustadz coba?",
      "Saya beri target pendek, 20 menit satu halaman. Hasilnya lumayan kalau ada yang menemani.",
    ],
    picks: [
      { fw: "mental", theme: 12, indicator: 1, fulfilled: [0, 1], reasoning: "Ia merapikan tempat tidur dan menyelesaikan piket tanpa diingatkan, tanda kemandirian perilaku.", phrase: "Mengurus kamar dan keperluannya sendiri" },
      { fw: "karakter", theme: 2, indicator: 0, fulfilled: [0], reasoning: "Piket kamar selesai tepat waktu sebelum diperiksa ustadz.", phrase: "Menyelesaikan piket tepat waktu tanpa diingatkan" },
      { fw: "karakter", theme: 4, indicator: 0, fulfilled: [0, 1], reasoning: "Salat berjamaah tetap terjaga dan ia sering datang lebih awal.", phrase: "Datang lebih awal untuk salat berjamaah" },
      { fw: "soft", theme: 0, indicator: 0, fulfilled: [0], reasoning: "Ia menerima target belajar pendek yang diberikan ustadz dan berusaha memenuhinya.", phrase: "Menerima arahan ustadz dengan baik" },
    ],
    priority: { fw: "mental", theme: 28, indicator: 1 },
    action_plan: "Pertahankan target belajar malam yang pendek (20 menit per halaman) dan tambah bertahap. Ajak Fadhil memilih tempat duduk yang jauh dari gangguan, dan beri pujian khusus saat ia menyelesaikan target tanpa melamun.",
    parent: {
      good: "Dalam tiga pekan terakhir Fadhil menunjukkan kemajuan yang menggembirakan: ia merapikan kamar dan menyelesaikan piket tanpa harus diingatkan, dan tetap rajin salat berjamaah.",
      focus: "Menjaga fokus saat belajar malam",
      focusText: "Ia masih sering melamun setelah 15 menit belajar. Kami melatihnya dengan target waktu yang pendek namun konsisten.",
      tips: ["Apresiasi kemandiriannya secara spesifik, misalnya \"Ayah bangga kamu sudah merapikan kamar sendiri\"."],
    },
  },
  {
    nis: "IP001", daysAgo: 4, title: "Fokus belajar membaik dan mulai membantu teman",
    status_summary: "Fadhil kini mampu belajar malam lebih lama dan mulai membantu temannya yang kesulitan menghafal. Kepercayaan dirinya meningkat.",
    talk: [
      "Bagaimana perkembangan Fadhil pekan ini?",
      "Alhamdulillah, belajar malamnya sudah bisa satu jam penuh tanpa melamun. Ia juga membantu Zidan yang lambat menghafal, dengan mengulang ayat bersama-sama.",
      "Bagaimana ia memperlakukan temannya saat membantu?",
      "Sabar. Tidak mengejek, malah menyemangati. Saya lihat ia mulai percaya diri bicara di depan kelompok hafalan.",
      "Apakah ada hal yang masih perlu dibina?",
      "Ia belum pernah memimpin. Saya ingin ia mencoba memimpin kelompok hafalan kecil supaya kepemimpinannya terlatih.",
    ],
    picks: [
      { fw: "mental", theme: 28, indicator: 1, fulfilled: [0, 1], reasoning: "Belajar malam kini bisa satu jam penuh tanpa melamun, menandakan kemampuan fokus yang meningkat.", phrase: "Mampu menjaga fokus belajar malam lebih lama" },
      { fw: "karakter", theme: 3, indicator: 2, fulfilled: [0, 1], reasoning: "Ia membantu temannya yang lambat menghafal dengan mengulang ayat bersama, tanpa mengejek.", phrase: "Membantu temannya yang kesulitan menghafal" },
      { fw: "karakter", theme: 4, indicator: 0, fulfilled: [0, 1], reasoning: "Ibadah berjamaah tetap konsisten dan menjadi kebiasaan.", phrase: "Konsisten menjaga salat berjamaah" },
      { fw: "mental", theme: 21, indicator: 0, fulfilled: [0], reasoning: "Ia mau belajar di waktu malam dan mengulang hafalan bersama teman.", phrase: "Belajar di berbagai waktu dengan semangat" },
    ],
    priority: { fw: "karakter", theme: 1, indicator: 0 },
    action_plan: "Beri Fadhil kesempatan memimpin kelompok hafalan kecil (3–4 santri) selama dua pekan, dengan ustadz mendampingi dari jauh. Setelah sesi, ajak ia merefleksikan apa yang berjalan baik dan apa yang bisa diperbaiki.",
    parent: {
      good: "Kabar baik pekan ini: Fadhil sudah mampu belajar malam hampir satu jam penuh tanpa melamun. Ia juga membantu temannya yang kesulitan menghafal dengan sabar.",
      focus: "Belajar memimpin kelompok kecil",
      focusText: "Kepercayaan dirinya tumbuh, jadi langkah berikutnya kami memberinya kesempatan memimpin kelompok hafalan kecil sambil didampingi.",
      tips: ["Minta ia bercerita tentang hafalan yang sedang dipelajari; mendengarkan membuatnya makin semangat."],
    },
  },

  // ───────────── IP002 Aisyah ─────────────
  {
    nis: "IP002", daysAgo: 30, title: "Ceria dan mudah bergaul",
    status_summary: "Aisyah mudah bergaul dan aktif dalam kegiatan kelompok, tetapi masih sering tergesa-gesa menyelesaikan tugas.",
    talk: [
      "Assalamu'alaikum Ustadz, bagaimana Aisyah belakangan ini?",
      "Wa'alaikumussalam. Aisyah anak yang ceria, cepat akrab dengan siapa saja. Di kerja kelompok ia sering jadi penyemangat dan mau berbagi tugas.",
      "Bagaimana kepeduliannya terhadap teman?",
      "Peduli sekali. Kalau ada temannya yang belum makan atau kelihatan murung, dia yang pertama menghampiri. Hanya saja dalam mengerjakan tugas dia suka buru-buru, jadi banyak yang terlewat.",
    ],
    picks: [
      { fw: "soft", theme: 7, indicator: 3, fulfilled: [0, 1], reasoning: "Dalam kerja kelompok ia mau berbagi tugas dan menyemangati anggota lain.", phrase: "Senang bekerja sama dalam kelompok" },
      { fw: "karakter", theme: 3, indicator: 2, fulfilled: [0, 1], reasoning: "Ia lebih dulu menghampiri teman yang murung atau belum makan.", phrase: "Peduli dan menyemangati teman" },
      { fw: "soft", theme: 2, indicator: 2, fulfilled: [0], reasoning: "Empati dan kasih sayangnya kepada teman terlihat dalam keseharian.", phrase: "Penuh empati kepada teman" },
      { fw: "karakter", theme: 6, indicator: 0, fulfilled: [0], reasoning: "Ia mudah menerima dan akrab dengan teman dari latar yang berbeda.", phrase: "Mudah menerima perbedaan dan beradaptasi" },
    ],
    priority: { fw: "karakter", theme: 13, indicator: 1 },
    action_plan: "Ajak Aisyah membuat kebiasaan memeriksa ulang pekerjaannya satu kali sebelum dikumpulkan (misalnya dengan daftar centang kecil). Beri pujian saat ia menemukan sendiri kekeliruannya.",
    parent: {
      good: "Aisyah adalah santri yang ceria dan mudah akrab. Ia sering menjadi penyemangat dalam kerja kelompok dan peka terhadap teman yang sedang murung.",
      focus: "Lebih teliti dan tidak tergesa-gesa",
      focusText: "Ia kerap terburu-buru mengerjakan tugas sehingga ada bagian yang terlewat. Kami melatihnya memeriksa ulang sebelum mengumpulkan.",
      tips: ["Biasakan bertanya dengan nada ringan, \"Sudah kamu periksa lagi?\" sebelum ia menyelesaikan sesuatu."],
    },
  },
  {
    nis: "IP002", daysAgo: 6, title: "Lebih teliti dan lebih sabar",
    status_summary: "Aisyah mulai memeriksa ulang tugasnya dan lebih sabar menunggu giliran. Ia sempat bersitegang dengan teman sekamar soal giliran piket dan sudah berbaikan setelah dibimbing ustadz.",
    talk: [
      "Bagaimana perkembangan Aisyah sebulan ini?",
      "Ada kemajuan nyata. Sekarang ia memeriksa tugasnya sebelum dikumpulkan, dan menunggu giliran dengan sabar. Kemarin juga ia menenangkan temannya yang sedang sedih.",
      "Apakah ada kejadian yang perlu dicatat?",
      "Ada. Kemarin ia sempat bersitegang dengan teman sekamarnya soal giliran piket, suaranya sempat tinggi. Setelah saya ajak bicara, mereka saling meminta maaf dan berbaikan.",
      "Bagaimana sikapnya setelah dibimbing?",
      "Ia mau mengakui kesalahannya dan minta maaf duluan. Menurut saya ini kedewasaan yang bagus, tapi perlu terus dipantau supaya tidak terulang.",
    ],
    picks: [
      { fw: "karakter", theme: 13, indicator: 1, fulfilled: [0, 1], reasoning: "Ia memeriksa kembali pekerjaannya sebelum dikumpulkan sehingga lebih berhati-hati.", phrase: "Memeriksa kembali pekerjaannya sebelum dikumpulkan" },
      { fw: "karakter", theme: 3, indicator: 0, fulfilled: [0, 1], reasoning: "Ia menenangkan temannya yang sedang sedih tanpa diminta.", phrase: "Menenangkan teman yang sedang sedih" },
      { fw: "soft", theme: 5, indicator: 4, fulfilled: [0], reasoning: "Setelah bersitegang ia mau berbaikan (ishlah) dan meminta maaf lebih dulu.", phrase: "Mau berbaikan dan meminta maaf lebih dulu" },
      { fw: "karakter", theme: 37, indicator: 2, fulfilled: [0], reasoning: "Ia mengakui kesalahannya dan menempuh jalan ishlah dengan teman sekamar.", phrase: "Belajar menyelesaikan perselisihan dengan baik" },
    ],
    priority: { fw: "mental", theme: 28, indicator: 1 },
    action_plan: "Pantau hubungan Aisyah dengan teman sekamar selama dua pekan dan beri ruang bagi keduanya menyusun jadwal piket bersama. Latih Aisyah menarik napas dan menunda bicara saat emosi mulai naik.",
    parent: {
      good: "Aisyah menunjukkan perubahan yang nyata. Ia kini memeriksa kembali tugasnya sebelum dikumpulkan, lebih sabar menunggu giliran, dan menenangkan temannya yang sedang sedih tanpa diminta.",
      focus: "Mengelola emosi saat berbeda pendapat",
      focusText: "Aisyah sempat bersitegang dengan teman sekamarnya soal giliran piket. Ia sudah meminta maaf dan berbaikan, dan kami terus mendampinginya agar semakin tenang saat berselisih.",
      tips: ["Ceritakan pengalaman Ayah/Bunda dulu saat berbeda pendapat dengan teman, dan bagaimana cara menyelesaikannya."],
      sensitive: "Menyangkut perselisihan dengan teman sekamar. Hubungi wali terlebih dahulu sebelum dikirim.",
    },
  },

  // ───────────── IP003 Zidan ─────────────
  {
    nis: "IP003", daysAgo: 35, title: "Tekun menghafal, masih pendiam",
    status_summary: "Zidan tekun menyetor hafalan setiap hari, namun jarang berbicara dan enggan bertanya saat kesulitan.",
    talk: [
      "Bagaimana Zidan, Ustadz?",
      "Zidan pendiam tapi sangat tekun. Setiap hari ia setor hafalan dan jarang absen. Ia mengulang ayat sendiri di sela waktu istirahat.",
      "Bagaimana interaksinya di kelas dan dengan teman?",
      "Ia jarang bicara. Kalau tidak paham, ia diam saja dan tidak bertanya. Dengan teman ia baik, hanya saja lebih banyak mendengarkan.",
    ],
    picks: [
      { fw: "mental", theme: 5, indicator: 1, fulfilled: [0, 1], reasoning: "Ia setor hafalan setiap hari dan mengulang ayat di sela istirahat, menunjukkan konsistensi menghafal.", phrase: "Konsisten menyetor hafalan setiap hari" },
      { fw: "karakter", theme: 4, indicator: 0, fulfilled: [0], reasoning: "Ibadah dan interaksinya dengan Al-Qur'an terjaga setiap hari.", phrase: "Dekat dengan Al-Qur'an" },
      { fw: "mental", theme: 28, indicator: 1, fulfilled: [0], reasoning: "Ia mampu fokus mengulang hafalan sendiri tanpa dipantau.", phrase: "Mampu fokus dan disiplin dalam rutinitas" },
      { fw: "soft", theme: 10, indicator: 0, fulfilled: [0], reasoning: "Ia pendengar yang baik dalam percakapan dengan teman.", phrase: "Pendengar yang baik" },
    ],
    priority: { fw: "soft", theme: 10, indicator: 0 },
    action_plan: "Dorong Zidan bertanya dengan target kecil: satu pertanyaan per hari kepada ustadz. Beri apresiasi setiap pertanyaannya, sehingga ia merasa aman untuk berbicara.",
    parent: {
      good: "Zidan sangat tekun. Ia menyetor hafalan hampir setiap hari dan mengulang ayat sendiri di sela waktu istirahat.",
      focus: "Berani bertanya saat belum paham",
      focusText: "Zidan cenderung diam ketika kesulitan. Kami mengajaknya mulai dengan satu pertanyaan kecil setiap hari agar ia terbiasa menyampaikan kebutuhannya.",
      tips: ["Saat menelepon, tanyakan, \"Hari ini kamu bertanya apa kepada ustadz?\" dengan nada penasaran, bukan menuntut."],
    },
  },
  {
    nis: "IP003", daysAgo: 9, title: "Setoran meningkat, mulai berani bertanya",
    status_summary: "Setoran hafalan Zidan meningkat dan ia mulai berani mengajukan pertanyaan kepada ustadz.",
    talk: [
      "Bagaimana perkembangan Zidan pekan ini?",
      "Setoran hafalannya naik dari setengah halaman menjadi satu halaman penuh. Dan kemarin, untuk pertama kalinya, ia mengangkat tangan dan bertanya arti sebuah ayat.",
      "Bagaimana reaksi teman-temannya?",
      "Mereka mendengarkan dengan baik. Zidan terlihat senang. Setelahnya ia lebih santai berbincang dengan teman sebangku.",
    ],
    picks: [
      { fw: "mental", theme: 5, indicator: 1, fulfilled: [0, 1], reasoning: "Setoran hafalan meningkat dari setengah menjadi satu halaman penuh.", phrase: "Setoran hafalannya meningkat" },
      { fw: "karakter", theme: 5, indicator: 0, fulfilled: [0, 1], reasoning: "Untuk pertama kalinya ia bertanya arti sebuah ayat di depan kelas.", phrase: "Berani bertanya tentang arti ayat" },
      { fw: "soft", theme: 10, indicator: 0, fulfilled: [0, 1], reasoning: "Ia lebih santai berbincang dengan teman sebangku setelah berani bertanya.", phrase: "Lebih santai berbincang dengan teman" },
      { fw: "mental", theme: 21, indicator: 0, fulfilled: [0], reasoning: "Ia belajar dari pertanyaannya sendiri dan menggunakannya untuk memahami hafalan.", phrase: "Belajar dengan rasa ingin tahu" },
    ],
    priority: { fw: "karakter", theme: 1, indicator: 1 },
    action_plan: "Beri Zidan peran kecil dalam kelompok (misalnya pencatat) agar suaranya terdengar secara bertahap. Lanjutkan apresiasi untuk setiap pertanyaannya.",
    parent: {
      good: "Setoran hafalan Zidan naik menjadi satu halaman penuh, dan untuk pertama kalinya ia berani mengangkat tangan menanyakan arti sebuah ayat di kelas.",
      focus: "Terus melatih keberanian berbicara",
      focusText: "Kami memberinya peran kecil di kelompok agar suaranya terdengar sedikit demi sedikit.",
      tips: ["Puji keberaniannya bertanya, bukan hanya hasil hafalannya."],
    },
  },

  // ───────────── IP004 Nabila ─────────────
  {
    nis: "IP004", daysAgo: 28, title: "Kreatif, perlu mengatur waktu",
    status_summary: "Nabila sangat kreatif dalam kaligrafi dan menggambar, tetapi sering kehabisan waktu untuk tugas lain.",
    talk: [
      "Bagaimana Nabila, Ustadz?",
      "Nabila kreatif sekali. Kaligrafinya dipajang di mading dan teman-temannya sering minta diajari. Tapi ia suka tenggelam di gambar sampai lupa tugas lain.",
      "Apakah ia bisa mengatur waktunya?",
      "Belum. Perlu dibantu menyusun prioritas. Kalau diingatkan ia langsung mengerti dan mau memperbaiki.",
    ],
    picks: [
      { fw: "karakter", theme: 7, indicator: 0, fulfilled: [0, 1], reasoning: "Karya kaligrafinya dipajang di mading dan menunjukkan kreativitas tinggi.", phrase: "Kreatif dalam kaligrafi dan menggambar" },
      { fw: "mental", theme: 10, indicator: 0, fulfilled: [0], reasoning: "Ia kaya imajinasi dan sering menghasilkan karya yang orisinal.", phrase: "Banyak ide dan imajinasi" },
      { fw: "mental", theme: 32, indicator: 0, fulfilled: [0], reasoning: "Ia menghargai karyanya dan tidak malu menunjukkannya.", phrase: "Percaya diri menunjukkan karya" },
      { fw: "soft", theme: 12, indicator: 2, fulfilled: [0], reasoning: "Teman-temannya tertarik dan meminta diajari, tanda keteladanan yang menginspirasi.", phrase: "Menginspirasi teman untuk belajar kaligrafi" },
    ],
    priority: { fw: "karakter", theme: 2, indicator: 1 },
    action_plan: "Bantu Nabila menyusun daftar prioritas harian (tugas wajib dulu, lalu berkarya) dengan batas waktu untuk kegiatan seni. Beri apresiasi saat ia menyelesaikan tugas wajib tepat waktu.",
    parent: {
      good: "Nabila sangat kreatif. Karya kaligrafinya dipajang di mading, dan teman-temannya sering meminta diajari.",
      focus: "Mengatur prioritas dan waktu",
      focusText: "Karena begitu menikmati berkarya, ia kadang kehabisan waktu untuk tugas lain. Kami membantunya menyusun daftar prioritas harian.",
      tips: ["Ajak ia membuat jadwal sederhana: tugas dulu, berkarya setelahnya."],
    },
  },
  {
    nis: "IP004", daysAgo: 7, title: "Memimpin proyek mading kelompok",
    status_summary: "Nabila menyelesaikan proyek mading tepat waktu dan memimpin kelompok kecil dengan baik.",
    talk: [
      "Bagaimana perkembangan Nabila pekan ini?",
      "Luar biasa. Ia memimpin proyek mading kelompok, membagi tugas ke empat temannya, dan selesai sebelum tenggat. Daftar prioritasnya ia pakai sendiri.",
      "Bagaimana caranya memimpin teman?",
      "Mengajak, bukan memerintah. Ia mendengarkan ide teman dan menggabungkannya. Hasilnya mading paling rapi di angkatan.",
    ],
    picks: [
      { fw: "karakter", theme: 2, indicator: 1, fulfilled: [0, 1], reasoning: "Ia menggunakan daftar prioritas dan menyelesaikan proyek sebelum tenggat.", phrase: "Menyelesaikan tugas tepat waktu dengan daftar prioritas" },
      { fw: "karakter", theme: 1, indicator: 0, fulfilled: [0, 1], reasoning: "Ia memimpin kelompok empat orang dengan membagi tugas secara adil.", phrase: "Memimpin kelompok dengan baik" },
      { fw: "soft", theme: 12, indicator: 0, fulfilled: [0, 1], reasoning: "Ia mengajak teman dengan keteladanan, bukan perintah, dan menggabungkan ide mereka.", phrase: "Mengajak teman dengan ramah, bukan memerintah" },
      { fw: "mental", theme: 9, indicator: 0, fulfilled: [0], reasoning: "Ia berinisiatif memulai proyek tanpa menunggu diminta.", phrase: "Berinisiatif memulai proyek" },
    ],
    priority: { fw: "mental", theme: 28, indicator: 0 },
    action_plan: "Beri Nabila tanggung jawab proyek berikutnya dan ajak ia merefleksikan cara membagi tugas. Latih ia tetap tenang ketika ada anggota yang terlambat menyelesaikan bagiannya.",
    parent: {
      good: "Nabila memimpin proyek mading kelompok, membagi tugas dengan adil, dan menyelesaikannya sebelum tenggat. Ia mengajak teman dengan ramah, bukan memerintah.",
      focus: "Tetap tenang saat memimpin",
      focusText: "Kami melatihnya tetap sabar ketika ada anggota kelompok yang terlambat menyelesaikan bagiannya.",
      tips: ["Tanyakan, \"Siapa yang kamu pimpin hari ini dan bagaimana rasanya?\""],
    },
  },

  // ───────────── IP005 Raihan ─────────────
  {
    nis: "IP005", daysAgo: 30, title: "Semangat tinggi, belajar menerima kekalahan",
    status_summary: "Raihan sangat aktif dan semangat dalam olahraga, tetapi masih sulit menerima kekalahan dengan tenang.",
    talk: [
      "Bagaimana Raihan, Ustadz?",
      "Raihan energik sekali, paling semangat di futsal dan selalu mengajak teman berolahraga. Hanya saja kalau timnya kalah ia cemberut dan menyalahkan teman.",
      "Bagaimana di luar lapangan?",
      "Baik dan rajin membantu menyiapkan perlengkapan olahraga. Ia mau mendengar kalau diajak bicara setelah emosinya reda.",
    ],
    picks: [
      { fw: "mental", theme: 17, indicator: 0, fulfilled: [0], reasoning: "Ia sangat siap bersaing dan paling semangat dalam futsal.", phrase: "Semangat tinggi dan siap bersaing" },
      { fw: "mental", theme: 16, indicator: 1, fulfilled: [0], reasoning: "Ia terus berusaha dan mengajak teman berolahraga walau lelah.", phrase: "Pantang menyerah dan terus berusaha" },
      { fw: "karakter", theme: 3, indicator: 1, fulfilled: [0, 1], reasoning: "Ia rajin membantu menyiapkan perlengkapan olahraga untuk kelompoknya.", phrase: "Rajin membantu menyiapkan perlengkapan olahraga" },
      { fw: "soft", theme: 0, indicator: 0, fulfilled: [0], reasoning: "Ia mau mendengar masukan setelah emosinya reda.", phrase: "Mau mendengar masukan setelah tenang" },
    ],
    priority: { fw: "mental", theme: 17, indicator: 2 },
    action_plan: "Ajak Raihan mendiskusikan sikap setelah pertandingan: apa yang dirasakan, lalu apa yang bisa dilakukan selain menyalahkan. Berikan peran kapten yang menyemangati tim pada pertandingan berikutnya.",
    parent: {
      good: "Raihan sangat semangat dan aktif, terutama dalam olahraga. Ia rajin membantu menyiapkan perlengkapan dan mengajak teman bergerak.",
      focus: "Menerima kekalahan dengan lapang dada",
      focusText: "Ia masih mudah kesal saat timnya kalah. Kami mengajaknya belajar mengelola perasaan setelah pertandingan.",
      tips: ["Saat ia bercerita tentang pertandingan, tanyakan, \"Apa yang kamu pelajari hari ini?\" bukan hanya hasilnya."],
    },
  },
  {
    nis: "IP005", daysAgo: 5, title: "Sportif menerima kekalahan",
    status_summary: "Raihan kini lebih sportif; ia menerima kekalahan futsal tanpa menyalahkan teman dan menyemangati timnya.",
    talk: [
      "Bagaimana perkembangan Raihan pekan ini?",
      "Pekan lalu tim futsalnya kalah 2-3. Biasanya ia kesal, tapi kali ini ia menyalami lawan dan bilang ke timnya, 'tidak apa-apa, kita latihan lagi.'",
      "Apa yang berubah menurut Ustadz?",
      "Setelah obrolan kita, ia mulai menarik napas dan menenangkan diri dulu. Ia juga mau menjadi kapten dan menyemangati teman yang melakukan kesalahan.",
    ],
    picks: [
      { fw: "mental", theme: 17, indicator: 2, fulfilled: [0], reasoning: "Ia menerima kekalahan 2-3 dengan sportif dan menyalami lawan.", phrase: "Menerima kekalahan dengan sportif" },
      { fw: "mental", theme: 28, indicator: 0, fulfilled: [0, 1], reasoning: "Ia menarik napas dan menenangkan diri sebelum bereaksi.", phrase: "Tenang dan mengendalikan diri" },
      { fw: "karakter", theme: 1, indicator: 0, fulfilled: [0, 1], reasoning: "Sebagai kapten ia menyemangati teman yang melakukan kesalahan.", phrase: "Menyemangati teman sebagai kapten tim" },
      { fw: "karakter", theme: 28, indicator: 0, fulfilled: [0], reasoning: "Ia mengambil hikmah dari kekalahan dan mengajak latihan lagi.", phrase: "Mengambil hikmah dari kekalahan" },
    ],
    priority: { fw: "soft", theme: 5, indicator: 0 },
    action_plan: "Pertahankan peran kapten dan beri umpan balik positif setiap pertandingan. Latih Raihan tetap tenang ketika berbeda pendapat dengan teman di luar lapangan, bukan hanya saat bertanding.",
    parent: {
      good: "Raihan kini jauh lebih sportif. Ia menerima kekalahan futsal tanpa menyalahkan teman, menyalami lawan, dan menyemangati timnya sebagai kapten.",
      focus: "Tetap tenang saat berbeda pendapat",
      focusText: "Kami melatih ketenangan yang sama untuk situasi di luar lapangan, misalnya saat berbeda pendapat dengan teman.",
      tips: ["Puji sikap sportifnya, misalnya \"Ayah senang kamu mau menyalami lawan.\""],
    },
  },

  // ───────────── IP006 Maryam ─────────────
  {
    nis: "IP006", daysAgo: 24, title: "Gemar membaca, tenang dan pendiam",
    status_summary: "Maryam gemar membaca dan rutin ke perpustakaan, tenang dan pendiam, namun belum banyak berbagi pendapat.",
    talk: [
      "Bagaimana Maryam, Ustadz?",
      "Maryam tenang dan rajin. Setiap sore ia ke perpustakaan, membaca satu buku seminggu, dan sering mencatat hal baru yang ia temukan.",
      "Bagaimana dengan interaksinya?",
      "Ia pendiam. Kalau ditanya pendapat, jawabannya bagus tetapi singkat, dan jarang mengajukan diri berbicara di kelas.",
    ],
    picks: [
      { fw: "karakter", theme: 5, indicator: 3, fulfilled: [0, 1], reasoning: "Ia menyediakan waktu rutin setiap sore untuk membaca dan menyelesaikan satu buku per pekan.", phrase: "Rutin membaca di perpustakaan setiap sore" },
      { fw: "mental", theme: 21, indicator: 0, fulfilled: [0, 1], reasoning: "Ia mencatat hal baru yang ditemukan dari bacaannya.", phrase: "Mencatat hal baru yang dipelajari" },
      { fw: "mental", theme: 28, indicator: 1, fulfilled: [0], reasoning: "Ia tenang dan mampu fokus lama saat membaca.", phrase: "Tenang dan mampu fokus" },
      { fw: "karakter", theme: 2, indicator: 0, fulfilled: [0], reasoning: "Ia disiplin dengan jadwal membacanya setiap sore.", phrase: "Disiplin menjaga jadwal sendiri" },
    ],
    priority: { fw: "soft", theme: 10, indicator: 0 },
    action_plan: "Dorong Maryam berbagi satu hal menarik dari bacaannya dalam kelompok kecil setiap pekan. Mulai dari audiens kecil agar ia nyaman berbicara.",
    parent: {
      good: "Maryam gemar membaca. Setiap sore ia ke perpustakaan, menyelesaikan satu buku per pekan, dan mencatat hal-hal baru yang ia pelajari.",
      focus: "Berbagi pendapat dengan teman",
      focusText: "Maryam pendiam dan jawabannya singkat. Kami mengajaknya berbagi satu hal menarik dari bacaannya di kelompok kecil.",
      tips: ["Minta ia menceritakan isi buku yang sedang dibaca, lalu tanyakan bagian favoritnya."],
    },
  },
  {
    nis: "IP006", daysAgo: 3, title: "Berbagi buku dan membantu adik kelas",
    status_summary: "Maryam mulai berbagi isi bacaannya dengan teman dan membantu adik kelas yang kesulitan membaca.",
    talk: [
      "Bagaimana perkembangan Maryam pekan ini?",
      "Pekan ini ia memberanikan diri bercerita tentang buku sirah kepada tiga temannya, dan mereka antusias. Ia juga meminjamkan bukunya kepada adik kelas.",
      "Bagaimana sikapnya kepada adik kelas?",
      "Sabar sekali. Ia menemani adik kelas membaca pelan-pelan dan tidak menertawakan kalau salah baca. Saya lihat ia mulai lebih percaya diri.",
    ],
    picks: [
      { fw: "soft", theme: 10, indicator: 0, fulfilled: [0, 1], reasoning: "Ia memberanikan diri bercerita tentang buku sirah kepada tiga temannya.", phrase: "Berani bercerita tentang buku yang dibaca" },
      { fw: "karakter", theme: 3, indicator: 0, fulfilled: [0, 1], reasoning: "Ia meminjamkan buku dan menemani adik kelas membaca dengan sabar.", phrase: "Membantu adik kelas membaca" },
      { fw: "soft", theme: 2, indicator: 2, fulfilled: [0, 1], reasoning: "Ia tidak menertawakan kesalahan adik kelas dan penuh empati.", phrase: "Sabar dan penuh empati kepada adik kelas" },
      { fw: "karakter", theme: 5, indicator: 0, fulfilled: [0], reasoning: "Rasa ingin tahunya mendorong ia mencari buku sirah baru untuk dibaca.", phrase: "Antusias mencari bacaan baru" },
    ],
    priority: { fw: "karakter", theme: 1, indicator: 0 },
    action_plan: "Beri Maryam kesempatan menjadi pendamping baca adik kelas secara rutin dan ajak ia memimpin diskusi buku kecil satu kali dalam sebulan.",
    parent: {
      good: "Maryam memberanikan diri bercerita tentang buku sirah kepada teman-temannya dan dengan sabar menemani adik kelas membaca, tanpa menertawakan kesalahan mereka.",
      focus: "Percaya diri memimpin diskusi kecil",
      focusText: "Kami memberinya kesempatan menjadi pendamping baca adik kelas dan memimpin diskusi buku sebulan sekali.",
      tips: ["Beri apresiasi, \"Ayah/Bunda bangga kamu mau membantu adik kelas membaca.\""],
    },
  },
];

// ───────────── Parent-facing monthly summary + profile per student ─────────────
export const PARENT_PROFILES: Record<string, {
  overview: string; strengths: string[]; growth_areas: string[]; next_focus: string;
  profile: { overview: string; strengths: string[]; best_approach: string[] };
}> = {
  IP001: {
    overview: "Dalam sekitar enam pekan, Fadhil berkembang dari santri yang masih beradaptasi menjadi santri yang lebih mandiri dan percaya diri. Ibadah berjamaahnya terjaga, ia mulai bertanggung jawab atas kamar dan piketnya, dan belakangan fokus belajarnya membaik sehingga ia mampu membantu teman.",
    strengths: ["Rajin beribadah berjamaah", "Santun kepada ustadz", "Mulai mandiri", "Peduli pada teman"],
    growth_areas: ["Konsistensi fokus belajar", "Belajar memimpin dengan sabar"],
    next_focus: "Memberi kesempatan memimpin kelompok hafalan kecil.",
    profile: {
      overview: "Fadhil adalah anak yang santun dan tekun beribadah. Ia tumbuh menjadi pribadi yang semakin mandiri, dan paling bersemangat ketika merasa dipercaya. Ini gambaran periode ini, bukan vonis.",
      strengths: ["Santun", "Tekun beribadah", "Mau belajar mandiri", "Peduli teman"],
      best_approach: ["Beri tanggung jawab kecil yang jelas dan puji usahanya secara spesifik.", "Dengarkan ceritanya dulu sebelum memberi nasihat."],
    },
  },
  IP002: {
    overview: "Aisyah adalah santri yang ceria, mudah bergaul, dan kini semakin teliti. Dalam sebulan terakhir ia belajar memeriksa kembali pekerjaannya dan lebih sabar, serta menunjukkan kepedulian kepada teman yang sedang kesulitan.",
    strengths: ["Mudah bergaul", "Penyemangat teman", "Peduli", "Mulai teliti"],
    growth_areas: ["Ketelitian di suasana ramai", "Tenang saat berbeda pendapat"],
    next_focus: "Menjaga ketelitian dan ketenangan saat suasana ramai.",
    profile: {
      overview: "Aisyah ceria, hangat, dan pandai menyemangati teman. Ia belajar paling baik lewat contoh dan ajakan yang ringan. Ini gambaran periode ini, bukan vonis.",
      strengths: ["Ceria", "Hangat kepada teman", "Cepat beradaptasi", "Mau mengakui kesalahan"],
      best_approach: ["Ajak bicara santai; ia terbuka saat tidak merasa dinilai.", "Beri contoh bersikap sabar lewat cerita pengalaman sendiri."],
    },
  },
  IP003: {
    overview: "Zidan adalah santri yang tekun dan konsisten dalam menghafal. Dalam sebulan terakhir setoran hafalannya meningkat dan ia mulai berani bertanya, langkah besar bagi anak yang biasanya pendiam.",
    strengths: ["Tekun menghafal", "Disiplin", "Pendengar yang baik"],
    growth_areas: ["Berani menyampaikan pendapat"],
    next_focus: "Memberinya peran kecil di kelompok agar suaranya terdengar.",
    profile: {
      overview: "Zidan pendiam namun sangat tekun. Ia tumbuh paling baik di lingkungan yang tenang dan menghargai usahanya. Ini gambaran periode ini, bukan vonis.",
      strengths: ["Tekun", "Disiplin", "Pendengar yang baik"],
      best_approach: ["Beri waktu berpikir sebelum meminta ia menjawab.", "Apresiasi setiap kali ia berani bertanya."],
    },
  },
  IP004: {
    overview: "Nabila sangat kreatif dan kini belajar mengatur waktu. Ia berhasil memimpin proyek mading kelompok, membagi tugas dengan adil, dan menyelesaikannya tepat waktu dengan cara mengajak teman, bukan memerintah.",
    strengths: ["Kreatif", "Percaya diri berkarya", "Mengajak dengan ramah", "Berinisiatif"],
    growth_areas: ["Tetap tenang saat memimpin"],
    next_focus: "Memberi tanggung jawab proyek berikutnya sambil melatih kesabaran.",
    profile: {
      overview: "Nabila kreatif dan penuh ide. Ia bersemangat saat diberi ruang berkarya dan kepercayaan memimpin. Ini gambaran periode ini, bukan vonis.",
      strengths: ["Kreatif", "Berinisiatif", "Mudah menginspirasi teman"],
      best_approach: ["Beri ruang berkarya, lalu bantu ia mengatur waktunya.", "Ajak ia merefleksikan cara memimpin setelah sebuah proyek."],
    },
  },
  IP005: {
    overview: "Raihan energik dan sangat semangat. Dalam sebulan terakhir ia belajar menerima kekalahan dengan sportif dan menyemangati timnya sebagai kapten, perubahan yang membanggakan.",
    strengths: ["Semangat tinggi", "Pantang menyerah", "Sportif", "Rajin membantu"],
    growth_areas: ["Tetap tenang saat berbeda pendapat di luar lapangan"],
    next_focus: "Melatih ketenangan yang sama di situasi sehari-hari.",
    profile: {
      overview: "Raihan penuh energi dan setia kawan. Ia belajar paling baik ketika diajak bicara setelah emosinya reda. Ini gambaran periode ini, bukan vonis.",
      strengths: ["Semangat", "Setia kawan", "Mau belajar dari kekalahan"],
      best_approach: ["Ajak bicara setelah emosinya reda, bukan saat ia sedang kesal.", "Puji sikap sportifnya secara spesifik."],
    },
  },
  IP006: {
    overview: "Maryam gemar membaca dan tenang. Belakangan ia mulai berani bercerita tentang bacaannya kepada teman dan dengan sabar membantu adik kelas, menunjukkan kepercayaan dirinya yang tumbuh.",
    strengths: ["Gemar membaca", "Tenang dan fokus", "Sabar", "Peduli adik kelas"],
    growth_areas: ["Percaya diri memimpin diskusi"],
    next_focus: "Memberi kesempatan memimpin diskusi buku kecil.",
    profile: {
      overview: "Maryam tenang, tekun, dan penuh rasa ingin tahu. Ia mekar saat diberi ruang berbagi dalam kelompok kecil. Ini gambaran periode ini, bukan vonis.",
      strengths: ["Gemar membaca", "Sabar", "Rasa ingin tahu besar"],
      best_approach: ["Mulai dari audiens kecil sebelum meminta ia berbicara di depan banyak orang.", "Tanyakan bagian favorit dari buku yang sedang ia baca."],
    },
  },
};
