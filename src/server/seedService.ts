import { count } from 'drizzle-orm';
import { db, pool } from '../db/index.ts';
import {
  banners,
  categories,
  links,
  products,
  profiles,
  settings,
} from '../db/schema.ts';
import { DEFAULT_ALLOWED_AFFILIATE_DOMAINS } from '../lib/validators.ts';

let schemaPromise: Promise<void> | null = null;
let seedPromise: Promise<void> | null = null;

export async function ensureDatabaseSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = runCreateTables().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

const REQUIRED_TABLES = [
  'profiles',
  'admins',
  'categories',
  'products',
  'links',
  'banners',
  'visitors',
  'sessions',
  'page_views',
  'click_events',
  'affiliate_import_jobs',
  'affiliate_import_errors',
  'settings',
  'admin_audit_logs',
  'uploaded_assets',
];

async function runCreateTables(): Promise<void> {
  const existingRes = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()`
  );
  const existing = new Set(existingRes.rows.map((r) => r.table_name));
  const missing = REQUIRED_TABLES.filter((tableName) => !existing.has(tableName));

  if (missing.length === 0) {
    await ensureProductNumberColumn();
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "profiles" (
      "id" serial PRIMARY KEY,
      "brand_name" text DEFAULT 'by Adisss' NOT NULL,
      "username" text DEFAULT '@adisssfinds' NOT NULL,
      "tagline" text DEFAULT 'GOOD FINDS, HAPPY BUYS!' NOT NULL,
      "description" text DEFAULT 'Hi, I''m Adisss! ♡ Sharing cute finds, daily essentials, and little things worth buying.' NOT NULL,
      "avatar_url" text DEFAULT '' NOT NULL,
      "instagram_url" text DEFAULT 'https://instagram.com/adisssfinds' NOT NULL,
      "tiktok_url" text DEFAULT 'https://tiktok.com/@adisssfinds' NOT NULL,
      "whatsapp_url" text DEFAULT '' NOT NULL,
      "footer_text" text DEFAULT 'Made with ♡ by Adisss' NOT NULL,
      "affiliate_disclosure" text DEFAULT '' NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "admins" (
      "id" serial PRIMARY KEY,
      "uid" text UNIQUE,
      "email" text NOT NULL UNIQUE,
      "display_name" text DEFAULT 'Admin' NOT NULL,
      "role" text DEFAULT 'admin' NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "admins_email_idx" ON "admins" ("email");
    CREATE INDEX IF NOT EXISTS "admins_uid_idx" ON "admins" ("uid");

    CREATE TABLE IF NOT EXISTS "categories" (
      "id" serial PRIMARY KEY,
      "name" text NOT NULL,
      "slug" text NOT NULL UNIQUE,
      "description" text DEFAULT '',
      "image_url" text DEFAULT '',
      "icon" text DEFAULT 'Sparkles',
      "sort_order" integer DEFAULT 0 NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_idx" ON "categories" ("slug");
    CREATE INDEX IF NOT EXISTS "categories_active_sort_idx" ON "categories" ("is_active", "sort_order");

    CREATE TABLE IF NOT EXISTS "products" (
      "id" serial PRIMARY KEY,
      "product_number" integer,
      "product_name" text NOT NULL,
      "product_slug" text NOT NULL UNIQUE,
      "description" text DEFAULT '',
      "image_url" text DEFAULT '',
      "price" numeric(14, 2),
      "category_id" integer REFERENCES "categories"("id") ON DELETE SET NULL,
      "affiliate_url" text NOT NULL,
      "label" text DEFAULT '',
      "is_featured" boolean DEFAULT false NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "is_archived" boolean DEFAULT false NOT NULL,
      "sort_order" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "products_slug_idx" ON "products" ("product_slug");
    CREATE INDEX IF NOT EXISTS "products_number_idx" ON "products" ("product_number");
    CREATE INDEX IF NOT EXISTS "products_category_idx" ON "products" ("category_id");
    CREATE INDEX IF NOT EXISTS "products_active_featured_idx" ON "products" ("is_active", "is_archived", "is_featured");
    CREATE INDEX IF NOT EXISTS "products_sort_idx" ON "products" ("sort_order");

    CREATE TABLE IF NOT EXISTS "links" (
      "id" serial PRIMARY KEY,
      "title" text NOT NULL,
      "slug" text NOT NULL UNIQUE,
      "url" text NOT NULL,
      "description" text DEFAULT '',
      "icon" text DEFAULT 'ExternalLink',
      "sort_order" integer DEFAULT 0 NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "links_slug_idx" ON "links" ("slug");
    CREATE INDEX IF NOT EXISTS "links_active_sort_idx" ON "links" ("is_active", "sort_order");

    CREATE TABLE IF NOT EXISTS "banners" (
      "id" serial PRIMARY KEY,
      "title" text NOT NULL,
      "description" text DEFAULT '',
      "image_url" text DEFAULT '',
      "target_url" text DEFAULT '',
      "sort_order" integer DEFAULT 0 NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "starts_at" timestamp with time zone,
      "ends_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "banners_active_sort_idx" ON "banners" ("is_active", "sort_order");

    CREATE TABLE IF NOT EXISTS "visitors" (
      "id" serial PRIMARY KEY,
      "visitor_key" text NOT NULL UNIQUE,
      "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
      "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "visitors_key_idx" ON "visitors" ("visitor_key");

    CREATE TABLE IF NOT EXISTS "sessions" (
      "id" serial PRIMARY KEY,
      "visitor_id" integer NOT NULL REFERENCES "visitors"("id") ON DELETE CASCADE,
      "session_key" text NOT NULL UNIQUE,
      "started_at" timestamp with time zone DEFAULT now() NOT NULL,
      "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
      "device_type" text DEFAULT 'desktop',
      "browser" text DEFAULT 'Other',
      "operating_system" text DEFAULT 'Other',
      "referrer" text DEFAULT 'direct',
      "utm_source" text DEFAULT '',
      "utm_medium" text DEFAULT '',
      "utm_campaign" text DEFAULT ''
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "sessions_key_idx" ON "sessions" ("session_key");
    CREATE INDEX IF NOT EXISTS "sessions_last_seen_idx" ON "sessions" ("last_seen_at");
    CREATE INDEX IF NOT EXISTS "sessions_visitor_idx" ON "sessions" ("visitor_id");

    CREATE TABLE IF NOT EXISTS "page_views" (
      "id" serial PRIMARY KEY,
      "visitor_id" integer NOT NULL REFERENCES "visitors"("id") ON DELETE CASCADE,
      "session_id" integer NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
      "page_url" text NOT NULL,
      "viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
      "referrer" text DEFAULT 'direct',
      "utm_source" text DEFAULT '',
      "utm_medium" text DEFAULT '',
      "utm_campaign" text DEFAULT '',
      "device_type" text DEFAULT 'desktop'
    );
    CREATE INDEX IF NOT EXISTS "page_views_viewed_at_idx" ON "page_views" ("viewed_at");
    CREATE INDEX IF NOT EXISTS "page_views_visitor_idx" ON "page_views" ("visitor_id");
    CREATE INDEX IF NOT EXISTS "page_views_page_url_idx" ON "page_views" ("page_url");

    CREATE TABLE IF NOT EXISTS "click_events" (
      "id" serial PRIMARY KEY,
      "product_id" integer REFERENCES "products"("id") ON DELETE SET NULL,
      "link_id" integer REFERENCES "links"("id") ON DELETE SET NULL,
      "target_type" text DEFAULT 'product' NOT NULL,
      "visitor_id" integer REFERENCES "visitors"("id") ON DELETE SET NULL,
      "session_id" integer REFERENCES "sessions"("id") ON DELETE SET NULL,
      "clicked_at" timestamp with time zone DEFAULT now() NOT NULL,
      "referrer" text DEFAULT 'direct',
      "utm_source" text DEFAULT '',
      "utm_campaign" text DEFAULT '',
      "device_type" text DEFAULT 'desktop'
    );
    CREATE INDEX IF NOT EXISTS "click_events_clicked_at_idx" ON "click_events" ("clicked_at");
    CREATE INDEX IF NOT EXISTS "click_events_product_idx" ON "click_events" ("product_id");
    CREATE INDEX IF NOT EXISTS "click_events_link_idx" ON "click_events" ("link_id");
    CREATE INDEX IF NOT EXISTS "click_events_visitor_idx" ON "click_events" ("visitor_id");

    CREATE TABLE IF NOT EXISTS "affiliate_import_jobs" (
      "id" serial PRIMARY KEY,
      "admin_id" integer REFERENCES "admins"("id") ON DELETE SET NULL,
      "admin_email" text NOT NULL,
      "filename" text NOT NULL,
      "total_rows" integer DEFAULT 0 NOT NULL,
      "success_rows" integer DEFAULT 0 NOT NULL,
      "updated_rows" integer DEFAULT 0 NOT NULL,
      "skipped_rows" integer DEFAULT 0 NOT NULL,
      "failed_rows" integer DEFAULT 0 NOT NULL,
      "import_status" text DEFAULT 'completed' NOT NULL,
      "duplicate_mode" text DEFAULT 'skip' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "completed_at" timestamp with time zone
    );
    CREATE INDEX IF NOT EXISTS "import_jobs_created_idx" ON "affiliate_import_jobs" ("created_at");

    CREATE TABLE IF NOT EXISTS "affiliate_import_errors" (
      "id" serial PRIMARY KEY,
      "import_job_id" integer NOT NULL REFERENCES "affiliate_import_jobs"("id") ON DELETE CASCADE,
      "row_number" integer NOT NULL,
      "error_message" text NOT NULL,
      "row_data" jsonb,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "import_errors_job_idx" ON "affiliate_import_errors" ("import_job_id");

    CREATE TABLE IF NOT EXISTS "settings" (
      "id" serial PRIMARY KEY,
      "setting_key" text NOT NULL UNIQUE,
      "setting_value" text NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
      "id" serial PRIMARY KEY,
      "admin_id" integer REFERENCES "admins"("id") ON DELETE SET NULL,
      "admin_email" text NOT NULL,
      "action" text NOT NULL,
      "entity_type" text NOT NULL,
      "entity_id" text DEFAULT '',
      "details" jsonb,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "audit_logs_created_idx" ON "admin_audit_logs" ("created_at");

    CREATE TABLE IF NOT EXISTS "uploaded_assets" (
      "id" serial PRIMARY KEY,
      "filename" text NOT NULL,
      "mime_type" text NOT NULL,
      "size_bytes" integer NOT NULL,
      "data_base64" text NOT NULL,
      "folder" text DEFAULT 'general' NOT NULL,
      "uploaded_by_admin_id" integer REFERENCES "admins"("id") ON DELETE SET NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `);
  await ensureProductNumberColumn();
}

async function ensureProductNumberColumn(): Promise<void> {
  const colRes = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'products'
       AND column_name = 'product_number'`
  );

  if (colRes.rows.length === 0) {
    return;
  }

  const nullCheck = await pool.query<{ cnt: number }>(
    `SELECT count(*)::int AS cnt FROM "products" WHERE "product_number" IS NULL`
  );
  const nullCount = Number(nullCheck.rows[0]?.cnt ?? 0);
  if (nullCount > 0) {
    await pool.query(`
      WITH base AS (
        SELECT COALESCE(MAX("product_number"), 0) AS max_num FROM "products"
      ),
      numbered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order ASC, id ASC) AS seq
        FROM "products"
        WHERE "product_number" IS NULL
      )
      UPDATE "products" p
      SET "product_number" = base.max_num + n.seq
      FROM numbered n, base
      WHERE p.id = n.id AND p."product_number" IS NULL;
    `);
  }
}

export async function ensureInitialData(): Promise<void> {
  await ensureDatabaseSchema();
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function runSeed(): Promise<void> {
  const [
    [{ value: profileCount }],
    [{ value: settingsCount }],
    [{ value: categoryCount }],
    [{ value: bannerCount }],
    [{ value: linkCount }],
  ] = await Promise.all([
    db.select({ value: count() }).from(profiles),
    db.select({ value: count() }).from(settings),
    db.select({ value: count() }).from(categories),
    db.select({ value: count() }).from(banners),
    db.select({ value: count() }).from(links),
  ]);

  if (
    profileCount > 0 &&
    settingsCount > 0 &&
    categoryCount > 0 &&
    bannerCount > 0 &&
    linkCount > 0
  ) {
    return;
  }

  if (profileCount === 0) {
    await db.insert(profiles).values({
      brandName: 'by Adisss',
      username: '@adisssfinds',
      tagline: 'GOOD FINDS, HAPPY BUYS!',
      description:
        "Hi, I'm Adisss! ♡ Sharing cute finds, daily essentials, and little things worth buying.",
      avatarUrl: '/src/assets/images/resty_profile_avatar_1794936986435.jpg',
      instagramUrl: 'https://instagram.com/adisssfinds',
      tiktokUrl: 'https://tiktok.com/@adisssfinds',
      whatsappUrl: '',
      footerText: 'Made with ♡ by Adisss',
      affiliateDisclosure: '',
    });
  }

  if (settingsCount === 0) {
    await db
      .insert(settings)
      .values([
        {
          settingKey: 'allowed_affiliate_domains',
          settingValue: DEFAULT_ALLOWED_AFFILIATE_DOMAINS.join(','),
        },
        {
          settingKey: 'import_max_rows',
          settingValue: '500',
        },
        {
          settingKey: 'analytics_retention_days',
          settingValue: '365',
        },
        {
          settingKey: 'privacy_notice_enabled',
          settingValue: 'false',
        },
        {
          settingKey: 'privacy_notice_text',
          settingValue: '',
        },
        {
          settingKey: 'timezone',
          settingValue: 'Asia/Jakarta',
        },
      ])
      .onConflictDoNothing();
  }

  if (categoryCount === 0) {
    const insertedCategories = await db
      .insert(categories)
      .values([
        {
          name: 'Viral Finds',
          slug: 'viral-finds',
          description: 'Produk pilihan yang sedang ramai dan paling banyak dicari minggu ini.',
          icon: 'Flame',
          sortOrder: 1,
          isActive: true,
        },
        {
          name: 'Fashion & Style',
          slug: 'fashion-style',
          description: 'Tas, aksesori, dan outfit minimalis yang mudah dipadupadankan.',
          icon: 'ShoppingBag',
          sortOrder: 2,
          isActive: true,
        },
        {
          name: 'Beauty & Skincare',
          slug: 'beauty-skincare',
          description: 'Rekomendasi skincare harian dan produk kecantikan favorit.',
          icon: 'Sparkles',
          sortOrder: 3,
          isActive: true,
        },
        {
          name: 'Home & Living',
          slug: 'home-living',
          description: 'Dekorasi kamar aesthetic, organizer meja, dan perlengkapan rumah.',
          icon: 'Home',
          sortOrder: 4,
          isActive: true,
        },
        {
          name: 'Daily Essentials',
          slug: 'daily-essentials',
          description: 'Barang fungsional untuk rutinitas kerja, kuliah, dan bepergian.',
          icon: 'Coffee',
          sortOrder: 5,
          isActive: true,
        },
        {
          name: 'Special Deals',
          slug: 'special-deals',
          description: 'Produk promo dengan penawaran harga terbaik di Shopee.',
          icon: 'Tag',
          sortOrder: 6,
          isActive: true,
        },
      ])
      .returning();

    const bySlug = new Map(insertedCategories.map((c) => [c.slug, c.id]));

    const [{ value: productCount }] = await db.select({ value: count() }).from(products);
    if (productCount === 0) {
      await db.insert(products).values([
        {
          productNumber: 1,
          productName: 'Rosehip Radiance Glow Serum 30ml',
          productSlug: 'rosehip-radiance-serum',
          description:
            'Serum pencerah bertekstur ringan dengan ekstrak rosehip dan hyaluronic acid untuk kulit lembap bercahaya.',
          imageUrl: '/src/assets/images/product_skincare_serum_1794936987643.jpg',
          price: '129000',
          categoryId: bySlug.get('beauty-skincare') ?? null,
          affiliateUrl: 'https://shopee.co.id/search?keyword=rosehip%20radiance%20serum',
          label: 'BEST SELLER',
          isFeatured: true,
          isActive: true,
          isArchived: false,
          sortOrder: 1,
        },
        {
          productNumber: 2,
          productName: 'Cream Baguette Shoulder Bag Gold Buckle',
          productSlug: 'cream-baguette-shoulder-bag',
          description:
            'Tas bahu wanita berbahan vegan leather lembut warna cream dengan detail gesper emas minimalis.',
          imageUrl: '/src/assets/images/product_shoulder_bag_1794936987753.jpg',
          price: '165000',
          categoryId: bySlug.get('fashion-style') ?? null,
          affiliateUrl: 'https://shopee.co.id/search?keyword=cream%20baguette%20shoulder%20bag',
          label: 'VIRAL',
          isFeatured: true,
          isActive: true,
          isArchived: false,
          sortOrder: 2,
        },
        {
          productNumber: 3,
          productName: 'Fluted Ceramic Brush Holder & Travertine Tray',
          productSlug: 'fluted-ceramic-vanity-organizer',
          description:
            'Set organizer meja rias keramik bergaris dan nampan batu travertine untuk tampilan kamar rapi dan hangat.',
          imageUrl: '/src/assets/images/product_ceramic_organizer_1794936988640.jpg',
          price: '89000',
          categoryId: bySlug.get('home-living') ?? null,
          affiliateUrl: 'https://shopee.co.id/search?keyword=ceramic%20vanity%20organizer',
          label: 'RECOMMENDED',
          isFeatured: true,
          isActive: true,
          isArchived: false,
          sortOrder: 3,
        },
      ]);
    }
  }

  if (bannerCount === 0) {
    await db.insert(banners).values({
      title: "A Little Something You'll Love ♡",
      description: 'Koleksi kurasi mingguan Shopee paling favorit — semua link sudah terverifikasi.',
      imageUrl: '/src/assets/images/hero_banner_finds_1794936987593.jpg',
      targetUrl: '#catalog',
      sortOrder: 1,
      isActive: true,
    });
  }

  if (linkCount === 0) {
    await db.insert(links).values([
      {
        title: 'Koleksi Skincare Routine Pagi & Malam',
        slug: 'skincare-routine',
        url: 'https://shopee.co.id/search?keyword=skincare%20minimalis',
        description: 'Semua produk skincare yang dipakai harian beserta urutan pemakaian.',
        icon: 'Sparkles',
        sortOrder: 1,
        isActive: true,
      },
      {
        title: 'Outfit Capsule Wardrobe Warna Cream & Beige',
        slug: 'capsule-wardrobe',
        url: 'https://shopee.co.id/search?keyword=outfit%20cream%20beige',
        description: 'Mix & match atasan, blazer, dan tas warna netral.',
        icon: 'ShoppingBag',
        sortOrder: 2,
        isActive: true,
      },
      {
        title: 'Promo Shopee Live & Voucher Gratis Ongkir',
        slug: 'promo-shopee-live',
        url: 'https://shopee.co.id/',
        description: 'Klaim voucher harian sebelum checkout keranjangmu.',
        icon: 'Tag',
        sortOrder: 3,
        isActive: true,
      },
    ]);
  }
}
