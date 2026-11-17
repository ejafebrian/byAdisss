# by Adisss (@adisssfinds) — Shopee Affiliate Link-in-Bio & Catalog Platform

Aplikasi full-stack personal affiliate marketing **by Adisss** (`@adisssfinds`) dengan tema pink feminin, katalog publik mobile-first, navbar hamburger katalog, server-side affiliate redirect (`/go/[slug]`), dashboard admin terlindungi, link sandbox & editor cepat, import produk massal Excel/CSV maupun Google Sheets, analitik real-time (`Asia/Jakarta`), dan export CSV aman.

## Arsitektur & Teknologi

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **Backend**: Node.js + Express (`server.ts`), Zod validation, Multer file upload, SheetJS (`xlsx`)
- **Database**: PostgreSQL (Cloud SQL) dengan Drizzle ORM (`src/db/schema.ts`)
- **Autentikasi**: Firebase Authentication (Google Sign-In & Email/Password support) + verifikasi server-side `firebase-admin` + RBAC tabel `admins`
- **Real-time**: Server-Sent Events (`/api/admin/realtime`) + heartbeat 30 detik (window aktif 2 menit)

## Struktur Route

### Halaman Publik (Tanpa Menu Login & Tanpa Tautan Sosial di Footer)
- `/` — Beranda Link-in-Bio & Katalog Produk (`max-width: 480px` terpusat di desktop) dengan Navbar Hamburger untuk navigasi katalog & kategori
- `/links` — Daftar Tautan Pilihan (`/l/[slug]`)
- `/category/[slug]` — Katalog terfilter per kategori
- `/product/[slug]` — Detail produk & tombol beli
- `/go/[slug]` — Endpoint server-side yang memvalidasi domain allowlist, mencatat `click_events` sebelum mengirim HTTP `302` redirect ke Shopee

### Dashboard Admin (`/admin/*`)
- `/admin/login` — Login Admin (tanpa registrasi publik)
- `/admin` & `/admin/analytics` — Ringkasan KPI, grafik harian, filter tanggal (`Asia/Jakarta`), dan aktivitas real-time
- `/admin/products` — Tabel produk dengan statistik aktual (views, clicks, unique clickers, CTR, last click), quick edit link affiliate, & aksi massal
- `/admin/products/add` & `/admin/products/[id]/edit` — Form tambah/edit produk, upload gambar, & tombol uji link ke Sandbox
- `/admin/sandbox` — **Link Sandbox**: simulasi validasi protokol & allowlist domain Shopee, inspeksi parameter query, pratinjau redirect `/go/[slug]`, dan simpan URL affiliate langsung ke database
- `/admin/products/import` — Import massal melalui **Google Sheets URL** (Viewer public) maupun file `.xlsx`, `.xls`, `.csv` (template `.xlsx`, preview validasi, mode duplikasi, error report CSV)
- `/admin/categories`, `/admin/links`, `/admin/banners` — Manajemen kategori, tautan, dan banner terjadwal
- `/admin/import-history`, `/admin/profile`, `/admin/settings`, `/admin/account`

## Kebijakan Fallback Pencatatan Klik (`/go/[slug]`)
1. Server mencari produk aktif (non-archived) berdasarkan `productSlug` dan memvalidasi `affiliateUrl` terhadap protokol `http/https` serta allowlist domain pada tabel `settings`.
2. Server mencatat event klik ke `click_events` sebelum mengirim HTTP `302`.
3. Jika pencatatan klik mengalami kegagalan database sementara, server mencatat log error di sisi server tanpa mengklaim klik tercatat, dan tetap melanjutkan redirect hanya jika URL database lolos validasi keamanan domain.
4. Produk tidak ditemukan, nonaktif, diarsipkan, atau URL tidak lolos validasi mengembalikan halaman error `404` / `422` tanpa redirect.

## Menjalankan Secara Lokal
1. Isi environment variables (`SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`) sesuai `.env.example`.
2. Install dependensi: `npm install`
3. Sinkronkan schema Drizzle: `npx drizzle-kit push --config=src/db/drizzle.config.ts`
4. Jalankan server pengembangan: `npm run dev`
5. Build produksi: `npm run build` dan jalankan `npm start`
