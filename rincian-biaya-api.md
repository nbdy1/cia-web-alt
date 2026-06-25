# Rincian Biaya API — CIA Assessment System
*Asumsi: 50 laporan/hari · 26 hari aktif/bulan · kurs 1 USD = Rp17.950*

---

## 1. OpenRouter — Model AI (Gemini 3 Flash Preview)

**Apa ini?**
OpenRouter adalah platform yang menyediakan akses ke model AI Gemini 3 Flash Preview dari Google. Model ini digunakan untuk membaca percakapan sesi santri dan menghasilkan laporan penilaian karakter otomatis.

**Berapa biayanya?**
~Rp398.000/bulan (±$22)

Tarif model:
- Gemini 3 Flash Preview: $0,50/1 juta token input · $3,00/1 juta token output
- Text Embedding (pencarian dokumen): $0,02/1 juta token

Sistem tagihan OpenRouter berbasis **pay-as-you-go** — tidak ada paket berlangganan wajib. Bayar sesuai penggunaan aktual.

**Cara pembayaran:**
1. Buka [openrouter.ai](https://openrouter.ai) → klik **Sign In** (atau Sign Up jika belum ada akun)
2. Masuk ke menu **Credits** di dashboard
3. Klik **Add Credits** → masukkan jumlah (disarankan mulai $30–50 sebagai saldo awal)
4. Bayar dengan kartu kredit/debit internasional
5. API key yang sudah ada di sistem akan langsung menggunakan saldo tersebut — tidak perlu konfigurasi tambahan

---

## 2. ElevenLabs — Text-to-Speech (Flash v2.5)

**Apa ini?**
ElevenLabs digunakan untuk mengubah teks respons AI menjadi suara (audio) selama sesi percakapan dengan santri. Model Flash v2.5 dipilih karena latensi rendah dan biaya efisien.

**Berapa biayanya?**
~Rp2.450.000/bulan (±$136,50)

Rincian:
- Paket Starter: $6/bulan (wajib — termasuk lisensi komersial untuk produk yang di-deploy)
- Overage per karakter: $0,05 per 1.000 karakter (~2,61 juta karakter/bulan di atas kuota paket)

Catatan: harga per karakter sama persis antara PAYG dan semua paket berlangganan — tidak ada diskon dari naik paket. Starter adalah minimum yang diperlukan karena Free tier tidak mencakup lisensi komersial.

**Cara pembayaran:**
1. Buka [elevenlabs.io/pricing](https://elevenlabs.io/pricing)
2. Pilih paket **Starter ($6/bulan)** → klik **Choose Starter**
3. Daftarkan akun (atau login jika sudah ada)
4. Masukkan data kartu kredit/debit internasional → konfirmasi langganan
5. Saldo kartu akan ditagih $6 setiap bulan + overage karakter sesuai penggunaan aktual

---

## Ringkasan Total

| Layanan | Paket/Model | Biaya Estimasi/Bulan |
|---|---|---|
| OpenRouter | Gemini 3 Flash Preview (PAYG) | ~Rp398.000 |
| ElevenLabs | Starter + overage Flash v2.5 | ~Rp2.450.000 |
| **Total** | | **~Rp2.850.000** |

*Angka di atas untuk 50 laporan/hari. Biaya aktual proporsional dengan jumlah laporan yang dibuat.*

---

**Metode pembayaran yang diterima:** Kartu kredit/debit Visa, Mastercard, atau American Express dengan kemampuan transaksi internasional.

Kedua platform menagih dalam USD dan menerima kartu Indonesia selama fitur transaksi internasional diaktifkan.
