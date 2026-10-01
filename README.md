# Keuangan Marindo Farm

Aplikasi pencatatan keuangan peternakan berbasis Next.js App Router, TypeScript, Tailwind CSS, dan SQLite lokal atau Supabase. Seluruh antarmuka menggunakan Bahasa Indonesia, tanggal `dd/mm/yyyy`, dan Rupiah.

## Menjalankan lokal

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000). Pada development tanpa konfigurasi Supabase, aplikasi menggunakan SQLite lokal di `.data/marindo.sqlite` untuk uji coba di komputer ini. Mode lokal tidak menyediakan autentikasi dan tidak boleh diekspos ke internet. Saat `NODE_ENV=production`, Supabase wajib dikonfigurasi: dashboard tertutup dan endpoint SQLite dinonaktifkan tanpanya.

Runtime SQLite bawaan memerlukan Node.js 22.13 atau lebih baru. Atur `MARINDO_DB_PATH` untuk menyimpan file database di lokasi lain. Buat salinan berkala dari file `.data/marindo.sqlite` saat aplikasi berhenti untuk backup fisik.

## Login, database online, dan deployment publik

1. Buat proyek Supabase untuk autentikasi dan database online. Salin Project URL dan anon/publishable key dari pengaturan API proyek.
2. Salin `.env.example` menjadi `.env.local`, lalu isi:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

3. Jalankan semua file `supabase/migrations` berurutan lewat Supabase CLI (`supabase db push`) atau SQL Editor. Migration membuat profil dan kategori awal saat signup, tabel, indeks, RLS, bucket privat `farm-assets`, serta pencatatan pembayaran dan arus kas atomik.
4. Di Authentication → URL Configuration, set Site URL dan tambahkan URL redirect lokal dan produksi yang mengizinkan `/auth/callback` (untuk konfirmasi email dan reset kata sandi).
5. Untuk uji lokal, jalankan `npm run dev`, daftar lewat `/daftar`, lalu masuk. Semua perubahan disimpan ke Supabase dan terisolasi per pengguna melalui RLS.
6. Untuk publikasi, buat repository GitHub dan deploy aplikasi Next.js (misalnya di Vercel). Masukkan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` di Environment Variables platform hosting, lalu deploy ulang. Jangan unggah `.env.local`, `.data/`, atau database SQLite.

> Anon/publishable key memang digunakan di browser. Keamanan data bergantung pada RLS yang aktif di seluruh tabel dan bucket privat. Jangan pernah menaruh service-role key di variabel `NEXT_PUBLIC_*`, GitHub, atau konfigurasi browser.

### Seed contoh

Daftarkan user Supabase dengan email `demo@marindofarm.id`, lalu jalankan `supabase/seed.sql` lewat SQL Editor. Untuk menggunakan akun lain, ubah email pada file seed terlebih dahulu. Seed menolak berjalan bila user tersebut sudah memiliki transaksi, untuk mencegah duplikasi. Data contoh mencakup kandang broiler/layer/kambing, pemasukan/pengeluaran, hutang/piutang, pembayaran, dan anggaran pada rentang tiga bulan.

## Modul aplikasi

- Development lokal: SQLite satu ruang usaha untuk uji coba. Production: wajib memakai login Supabase, database hosted, dan RLS.
- Dashboard: ringkasan pemasukan/pengeluaran/laba-rugi/arus kas, grafik 12 bulan, biaya per kategori, transaksi terakhir, dan pantauan anggaran.
- Transaksi: tambah, ubah, soft delete, cari, urutkan, filter tanggal/jenis/kategori/kandang, paginasi, serta lampiran nota gambar yang dapat dibuka.
- Kategori dan kandang/batch: pengelolaan master data dan hubungan transaksi.
- Hutang/piutang: status belum lunas/sebagian/lunas, tanggal jatuh tempo, tanda terlambat, dan riwayat pembayaran.
- Anggaran bulanan: target biaya per kategori dengan penanda 80% dan 100%.
- Laporan: laba-rugi, arus kas, dan biaya/pendapatan/laba per kandang serta biaya per ekor.
- Pengaturan: profil usaha, alamat, logo upload, mata uang IDR, dan backup semua tabel dengan ID relasi.
- Ekspor laporan: workbook `.xlsx` multi-sheet dan PDF. Kop memuat nama usaha, periode, dan tanggal cetak.

## Struktur penting

```text
src/app/                 Routes, layout, dan halaman
src/components/          Shell, form, dan komponen UI
src/lib/                 Supabase, data demo, validasi, format, ekspor
supabase/migrations/     Skema PostgreSQL, indeks, trigger, dan RLS
supabase/seed.sql        Data contoh untuk user Supabase
```

`xlsx` (SheetJS) dari registry npm memiliki temuan prototype-pollution dan ReDoS tanpa versi perbaikan yang tersedia pada saat setup. Ekspor tetap `.xlsx` memakai ExcelJS; audit saat ini masih melaporkan dua temuan moderat pada dependency transitif `uuid` di ExcelJS.

## Pemeriksaan

```bash
npm run lint
npm run typecheck
npm run build
```

Mode SQLite lokal berjalan pada satu komputer dan satu ruang usaha. Untuk pemakaian beberapa perangkat atau pengguna, hubungkan Supabase mengikuti langkah di atas.

Pada beberapa lingkungan Windows terkelola, `next dev` dan `next build` dapat gagal membuat proses anak dengan `spawn EPERM`; jalankan `npm run typecheck` terpisah untuk memeriksa tipe.

Migration belum dijalankan terhadap proyek Supabase nyata karena kredensial dan database remote tidak disediakan. Terapkan migration dan seed setelah menyiapkan proyek Supabase Anda. Supabase Storage harus mengizinkan operasi sesuai policy pada migration; path bucket tetap privat dan gambar dibuka melalui signed URL.
