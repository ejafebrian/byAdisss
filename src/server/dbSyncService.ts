import type { Pool } from 'pg';
import {
  getAdminPool,
  hasAdminDatabaseCredentials,
  isDatabaseConfigured,
  pool,
} from '../db/index.ts';
import {
  backfillMissingProductNumbers,
  ensureInitialData,
  resetSchemaCaches,
} from './seedService.ts';

export interface ColumnDefinition {
  name: string;
  ddl: string;
}

export interface IndexDefinition {
  name: string;
  sql: string;
}

export interface TableSchemaDefinition {
  name: string;
  label: string;
  createSql: string;
  columns: ColumnDefinition[];
  indexes: IndexDefinition[];
  hasSerialId: boolean;
}

export const SCHEMA_DEFINITIONS: TableSchemaDefinition[] = [
  {
    name: 'profiles',
    label: 'Profil Brand & Bio',
    hasSerialId: true,
    createSql: `
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
    `,
    columns: [
      { name: 'id', ddl: 'serial PRIMARY KEY' },
      { name: 'brand_name', ddl: "text DEFAULT 'by Adisss' NOT NULL" },
      { name: 'username', ddl: "text DEFAULT '@adisssfinds' NOT NULL" },
      { name: 'tagline', ddl: "text DEFAULT 'GOOD FINDS, HAPPY BUYS!' NOT NULL" },
      {
        name: 'description',
        ddl: "text DEFAULT 'Hi, I''m Adisss! ♡ Sharing cute finds, daily essentials, and little things worth buying.' NOT NULL",
      },
      { name: 'avatar_url', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'instagram_url', ddl: "text DEFAULT 'https://instagram.com/adisssfinds' NOT NULL" },
      { name: 'tiktok_url', ddl: "text DEFAULT 'https://tiktok.com/@adisssfinds' NOT NULL" },
      { name: 'whatsapp_url', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'footer_text', ddl: "text DEFAULT 'Made with ♡ by Adisss' NOT NULL" },
      { name: 'affiliate_disclosure', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'updated_at', ddl: 'timestamp with time zone DEFAULT now() NOT NULL' },
    ],
    indexes: [],
  },
  {
    name: 'admins',
    label: 'Akun & Role Admin',
    hasSerialId: true,
    createSql: `
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
    `,
    columns: [
      { name: 'id', ddl: 'serial PRIMARY KEY' },
      { name: 'uid', ddl: 'text' },
      { name: 'email', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'display_name', ddl: "text DEFAULT 'Admin' NOT NULL" },
      { name: 'role', ddl: "text DEFAULT 'admin' NOT NULL" },
      { name: 'is_active', ddl: 'boolean DEFAULT true NOT NULL' },
      { name: 'created_at', ddl: 'timestamp with time zone DEFAULT now() NOT NULL' },
      { name: 'updated_at', ddl: 'timestamp with time zone DEFAULT now() NOT NULL' },
    ],
    indexes: [
      {
        name: 'admins_email_idx',
        sql: 'CREATE UNIQUE INDEX IF NOT EXISTS "admins_email_idx" ON "admins" ("email");',
      },
      {
        name: 'admins_uid_idx',
        sql: 'CREATE INDEX IF NOT EXISTS "admins_uid_idx" ON "admins" ("uid");',
      },
    ],
  },
  {
    name: 'categories',
    label: 'Kategori Produk',
    hasSerialId: true,
    createSql: `
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
    `,
    columns: [
      { name: 'id', ddl: 'serial PRIMARY KEY' },
      { name: 'name', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'slug', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'description', ddl: "text DEFAULT ''" },
      { name: 'image_url', ddl: "text DEFAULT ''" },
      { name: 'icon', ddl: "text DEFAULT 'Sparkles'" },
      { name: 'sort_order', ddl: 'integer DEFAULT 0 NOT NULL' },
      { name: 'is_active', ddl: 'boolean DEFAULT true NOT NULL' },
      { name: 'created_at', ddl: 'timestamp with time zone DEFAULT now() NOT NULL' },
      { name: 'updated_at', ddl: 'timestamp with time zone DEFAULT now() NOT NULL' },
    ],
    indexes: [
      {
        name: 'categories_slug_idx',
        sql: 'CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_idx" ON "categories" ("slug");',
      },
      {
        name: 'categories_active_sort_idx',
        sql: 'CREATE INDEX IF NOT EXISTS "categories_active_sort_idx" ON "categories" ("is_active", "sort_order");',
      },
    ],
  },
  {
    name: 'products',
    label: 'Katalog Produk Affiliate',
    hasSerialId: true,
    createSql: `
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
    `,
    columns: [
      { name: 'id', ddl: 'serial PRIMARY KEY' },
      { name: 'product_number', ddl: 'integer' },
      { name: 'product_name', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'product_slug', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'description', ddl: "text DEFAULT ''" },
      { name: 'image_url', ddl: "text DEFAULT ''" },
      { name: 'price', ddl: 'numeric(14, 2)' },
      { name: 'category_id', ddl: 'integer REFERENCES "categories"("id") ON DELETE SET NULL' },
      { name: 'affiliate_url', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'label', ddl: "text DEFAULT ''" },
      { name: 'is_featured', ddl: 'boolean DEFAULT false NOT NULL' },
      { name: 'is_active', ddl: 'boolean DEFAULT true NOT NULL' },
      { name: 'is_archived', ddl: 'boolean DEFAULT false NOT NULL' },
      { name: 'sort_order', ddl: 'integer DEFAULT 0 NOT NULL' },
      { name: 'created_at', ddl: 'timestamp with time zone DEFAULT now() NOT NULL' },
      { name: 'updated_at', ddl: 'timestamp with time zone DEFAULT now() NOT NULL' },
    ],
    indexes: [
      {
        name: 'products_slug_idx',
        sql: 'CREATE UNIQUE INDEX IF NOT EXISTS "products_slug_idx" ON "products" ("product_slug");',
      },
      {
        name: 'products_number_idx',
        sql: 'CREATE INDEX IF NOT EXISTS "products_number_idx" ON "products" ("product_number");',
      },
      {
        name: 'products_category_idx',
        sql: 'CREATE INDEX IF NOT EXISTS "products_category_idx" ON "products" ("category_id");',
      },
      {
        name: 'products_active_featured_idx',
        sql: 'CREATE INDEX IF NOT EXISTS "products_active_featured_idx" ON "products" ("is_active", "is_archived", "is_featured");',
      },
      {
        name: 'products_sort_idx',
        sql: 'CREATE INDEX IF NOT EXISTS "products_sort_idx" ON "products" ("sort_order");',
      },
    ],
  },
  {
    name: 'links',
    label: 'Link Koleksi Bio',
    hasSerialId: true,
    createSql: `
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
    `,
    columns: [
      { name: 'id', ddl: 'serial PRIMARY KEY' },
      { name: 'title', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'slug', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'url', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'description', ddl: "text DEFAULT ''" },
      { name: 'icon', ddl: "text DEFAULT 'ExternalLink'" },
      { name: 'sort_order', ddl: 'integer DEFAULT 0 NOT NULL' },
      { name: 'is_active', ddl: 'boolean DEFAULT true NOT NULL' },
      { name: 'created_at', ddl: 'timestamp with time zone DEFAULT now() NOT NULL' },
      { name: 'updated_at', ddl: 'timestamp with time zone DEFAULT now() NOT NULL' },
    ],
    indexes: [
      {
        name: 'links_slug_idx',
        sql: 'CREATE UNIQUE INDEX IF NOT EXISTS "links_slug_idx" ON "links" ("slug");',
      },
      {
        name: 'links_active_sort_idx',
        sql: 'CREATE INDEX IF NOT EXISTS "links_active_sort_idx" ON "links" ("is_active", "sort_order");',
      },
    ],
  },
  {
    name: 'banners',
    label: 'Banner Promo & Hero',
    hasSerialId: true,
    createSql: `
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
    `,
    columns: [
      { name: 'id', ddl: 'serial PRIMARY KEY' },
      { name: 'title', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'description', ddl: "text DEFAULT ''" },
      { name: 'image_url', ddl: "text DEFAULT ''" },
      { name: 'target_url', ddl: "text DEFAULT ''" },
      { name: 'sort_order', ddl: 'integer DEFAULT 0 NOT NULL' },
      { name: 'is_active', ddl: 'boolean DEFAULT true NOT NULL' },
      { name: 'starts_at', ddl: 'timestamp with time zone' },
      { name: 'ends_at', ddl: 'timestamp with time zone' },
      { name: 'created_at', ddl: 'timestamp with time zone DEFAULT now() NOT NULL' },
      { name: 'updated_at', ddl: 'timestamp with time zone DEFAULT now() NOT NULL' },
    ],
    indexes: [
      {
        name: 'banners_active_sort_idx',
        sql: 'CREATE INDEX IF NOT EXISTS "banners_active_sort_idx" ON "banners" ("is_active", "sort_order");',
      },
    ],
  },
  {
    name: 'visitors',
    label: 'Pengunjung Unik',
    hasSerialId: true,
    createSql: `
      CREATE TABLE IF NOT EXISTS "visitors" (
        "id" serial PRIMARY KEY,
        "visitor_key" text NOT NULL UNIQUE,
        "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
        "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `,
    columns: [
      { name: 'id', ddl: 'serial PRIMARY KEY' },
      { name: 'visitor_key', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'first_seen_at', ddl: 'timestamp with time zone DEFAULT now() NOT NULL' },
      { name: 'last_seen_at', ddl: 'timestamp with time zone DEFAULT now() NOT NULL' },
    ],
    indexes: [
      {
        name: 'visitors_key_idx',
        sql: 'CREATE UNIQUE INDEX IF NOT EXISTS "visitors_key_idx" ON "visitors" ("visitor_key");',
      },
    ],
  },
  {
    name: 'sessions',
    label: 'Sesi Kunjungan',
    hasSerialId: true,
    createSql: `
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
    `,
    columns: [
      { name: 'id', ddl: 'serial PRIMARY KEY' },
      { name: 'visitor_id', ddl: 'integer REFERENCES "visitors"("id") ON DELETE CASCADE' },
      { name: 'session_key', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'started_at', ddl: 'timestamp with time zone DEFAULT now() NOT NULL' },
      { name: 'last_seen_at', ddl: 'timestamp with time zone DEFAULT now() NOT NULL' },
      { name: 'device_type', ddl: "text DEFAULT 'desktop'" },
      { name: 'browser', ddl: "text DEFAULT 'Other'" },
      { name: 'operating_system', ddl: "text DEFAULT 'Other'" },
      { name: 'referrer', ddl: "text DEFAULT 'direct'" },
      { name: 'utm_source', ddl: "text DEFAULT ''" },
      { name: 'utm_medium', ddl: "text DEFAULT ''" },
      { name: 'utm_campaign', ddl: "text DEFAULT ''" },
    ],
    indexes: [
      {
        name: 'sessions_key_idx',
        sql: 'CREATE UNIQUE INDEX IF NOT EXISTS "sessions_key_idx" ON "sessions" ("session_key");',
      },
      {
        name: 'sessions_last_seen_idx',
        sql: 'CREATE INDEX IF NOT EXISTS "sessions_last_seen_idx" ON "sessions" ("last_seen_at");',
      },
      {
        name: 'sessions_visitor_idx',
        sql: 'CREATE INDEX IF NOT EXISTS "sessions_visitor_idx" ON "sessions" ("visitor_id");',
      },
    ],
  },
  {
    name: 'page_views',
    label: 'Statistik Tampilan Halaman',
    hasSerialId: true,
    createSql: `
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
    `,
    columns: [
      { name: 'id', ddl: 'serial PRIMARY KEY' },
      { name: 'visitor_id', ddl: 'integer REFERENCES "visitors"("id") ON DELETE CASCADE' },
      { name: 'session_id', ddl: 'integer REFERENCES "sessions"("id") ON DELETE CASCADE' },
      { name: 'page_url', ddl: "text DEFAULT '/' NOT NULL" },
      { name: 'viewed_at', ddl: 'timestamp with time zone DEFAULT now() NOT NULL' },
      { name: 'referrer', ddl: "text DEFAULT 'direct'" },
      { name: 'utm_source', ddl: "text DEFAULT ''" },
      { name: 'utm_medium', ddl: "text DEFAULT ''" },
      { name: 'utm_campaign', ddl: "text DEFAULT ''" },
      { name: 'device_type', ddl: "text DEFAULT 'desktop'" },
    ],
    indexes: [
      {
        name: 'page_views_viewed_at_idx',
        sql: 'CREATE INDEX IF NOT EXISTS "page_views_viewed_at_idx" ON "page_views" ("viewed_at");',
      },
      {
        name: 'page_views_visitor_idx',
        sql: 'CREATE INDEX IF NOT EXISTS "page_views_visitor_idx" ON "page_views" ("visitor_id");',
      },
      {
        name: 'page_views_page_url_idx',
        sql: 'CREATE INDEX IF NOT EXISTS "page_views_page_url_idx" ON "page_views" ("page_url");',
      },
    ],
  },
  {
    name: 'click_events',
    label: 'Event Klik Affiliate',
    hasSerialId: true,
    createSql: `
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
    `,
    columns: [
      { name: 'id', ddl: 'serial PRIMARY KEY' },
      { name: 'product_id', ddl: 'integer REFERENCES "products"("id") ON DELETE SET NULL' },
      { name: 'link_id', ddl: 'integer REFERENCES "links"("id") ON DELETE SET NULL' },
      { name: 'target_type', ddl: "text DEFAULT 'product' NOT NULL" },
      { name: 'visitor_id', ddl: 'integer REFERENCES "visitors"("id") ON DELETE SET NULL' },
      { name: 'session_id', ddl: 'integer REFERENCES "sessions"("id") ON DELETE SET NULL' },
      { name: 'clicked_at', ddl: 'timestamp with time zone DEFAULT now() NOT NULL' },
      { name: 'referrer', ddl: "text DEFAULT 'direct'" },
      { name: 'utm_source', ddl: "text DEFAULT ''" },
      { name: 'utm_campaign', ddl: "text DEFAULT ''" },
      { name: 'device_type', ddl: "text DEFAULT 'desktop'" },
    ],
    indexes: [
      {
        name: 'click_events_clicked_at_idx',
        sql: 'CREATE INDEX IF NOT EXISTS "click_events_clicked_at_idx" ON "click_events" ("clicked_at");',
      },
      {
        name: 'click_events_product_idx',
        sql: 'CREATE INDEX IF NOT EXISTS "click_events_product_idx" ON "click_events" ("product_id");',
      },
      {
        name: 'click_events_link_idx',
        sql: 'CREATE INDEX IF NOT EXISTS "click_events_link_idx" ON "click_events" ("link_id");',
      },
      {
        name: 'click_events_visitor_idx',
        sql: 'CREATE INDEX IF NOT EXISTS "click_events_visitor_idx" ON "click_events" ("visitor_id");',
      },
    ],
  },
  {
    name: 'affiliate_import_jobs',
    label: 'Riwayat Import Massal',
    hasSerialId: true,
    createSql: `
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
    `,
    columns: [
      { name: 'id', ddl: 'serial PRIMARY KEY' },
      { name: 'admin_id', ddl: 'integer REFERENCES "admins"("id") ON DELETE SET NULL' },
      { name: 'admin_email', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'filename', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'total_rows', ddl: 'integer DEFAULT 0 NOT NULL' },
      { name: 'success_rows', ddl: 'integer DEFAULT 0 NOT NULL' },
      { name: 'updated_rows', ddl: 'integer DEFAULT 0 NOT NULL' },
      { name: 'skipped_rows', ddl: 'integer DEFAULT 0 NOT NULL' },
      { name: 'failed_rows', ddl: 'integer DEFAULT 0 NOT NULL' },
      { name: 'import_status', ddl: "text DEFAULT 'completed' NOT NULL" },
      { name: 'duplicate_mode', ddl: "text DEFAULT 'skip' NOT NULL" },
      { name: 'created_at', ddl: 'timestamp with time zone DEFAULT now() NOT NULL' },
      { name: 'completed_at', ddl: 'timestamp with time zone' },
    ],
    indexes: [
      {
        name: 'import_jobs_created_idx',
        sql: 'CREATE INDEX IF NOT EXISTS "import_jobs_created_idx" ON "affiliate_import_jobs" ("created_at");',
      },
    ],
  },
  {
    name: 'affiliate_import_errors',
    label: 'Log Error Baris Import',
    hasSerialId: true,
    createSql: `
      CREATE TABLE IF NOT EXISTS "affiliate_import_errors" (
        "id" serial PRIMARY KEY,
        "import_job_id" integer NOT NULL REFERENCES "affiliate_import_jobs"("id") ON DELETE CASCADE,
        "row_number" integer NOT NULL,
        "error_message" text NOT NULL,
        "row_data" jsonb,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `,
    columns: [
      { name: 'id', ddl: 'serial PRIMARY KEY' },
      {
        name: 'import_job_id',
        ddl: 'integer REFERENCES "affiliate_import_jobs"("id") ON DELETE CASCADE',
      },
      { name: 'row_number', ddl: 'integer DEFAULT 0 NOT NULL' },
      { name: 'error_message', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'row_data', ddl: 'jsonb' },
      { name: 'created_at', ddl: 'timestamp with time zone DEFAULT now() NOT NULL' },
    ],
    indexes: [
      {
        name: 'import_errors_job_idx',
        sql: 'CREATE INDEX IF NOT EXISTS "import_errors_job_idx" ON "affiliate_import_errors" ("import_job_id");',
      },
    ],
  },
  {
    name: 'settings',
    label: 'Pengaturan Website',
    hasSerialId: true,
    createSql: `
      CREATE TABLE IF NOT EXISTS "settings" (
        "id" serial PRIMARY KEY,
        "setting_key" text NOT NULL UNIQUE,
        "setting_value" text NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `,
    columns: [
      { name: 'id', ddl: 'serial PRIMARY KEY' },
      { name: 'setting_key', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'setting_value', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'updated_at', ddl: 'timestamp with time zone DEFAULT now() NOT NULL' },
    ],
    indexes: [],
  },
  {
    name: 'admin_audit_logs',
    label: 'Log Audit Admin',
    hasSerialId: true,
    createSql: `
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
    `,
    columns: [
      { name: 'id', ddl: 'serial PRIMARY KEY' },
      { name: 'admin_id', ddl: 'integer REFERENCES "admins"("id") ON DELETE SET NULL' },
      { name: 'admin_email', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'action', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'entity_type', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'entity_id', ddl: "text DEFAULT ''" },
      { name: 'details', ddl: 'jsonb' },
      { name: 'created_at', ddl: 'timestamp with time zone DEFAULT now() NOT NULL' },
    ],
    indexes: [
      {
        name: 'audit_logs_created_idx',
        sql: 'CREATE INDEX IF NOT EXISTS "audit_logs_created_idx" ON "admin_audit_logs" ("created_at");',
      },
    ],
  },
  {
    name: 'uploaded_assets',
    label: 'Aset Gambar Tersimpan',
    hasSerialId: true,
    createSql: `
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
    `,
    columns: [
      { name: 'id', ddl: 'serial PRIMARY KEY' },
      { name: 'filename', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'mime_type', ddl: "text DEFAULT 'image/png' NOT NULL" },
      { name: 'size_bytes', ddl: 'integer DEFAULT 0 NOT NULL' },
      { name: 'data_base64', ddl: "text DEFAULT '' NOT NULL" },
      { name: 'folder', ddl: "text DEFAULT 'general' NOT NULL" },
      { name: 'uploaded_by_admin_id', ddl: 'integer REFERENCES "admins"("id") ON DELETE SET NULL' },
      { name: 'created_at', ddl: 'timestamp with time zone DEFAULT now() NOT NULL' },
    ],
    indexes: [],
  },
];

export interface SchemaMigrationResult {
  tablesCreated: string[];
  columnsAdded: Array<{ table: string; column: string }>;
  indexesCreated: string[];
  skippedDueToPermission: string[];
  productNumbersBackfilled: number;
  usedAdminPool: boolean;
}

export interface TableInspectionStatus {
  name: string;
  label: string;
  exists: boolean;
  rowCount: number;
  expectedColumns: number;
  actualColumns: number;
  missingColumns: string[];
  expectedIndexes: number;
  missingIndexes: string[];
  inSync: boolean;
}

export interface DatabaseInspectionReport {
  configured: boolean;
  connected: boolean;
  databaseName: string | null;
  schemaName: string | null;
  runtimeUser: string | null;
  adminUser: string | null;
  hasAdminCredentials: boolean;
  canAutoMigrate: boolean;
  postgresVersion: string | null;
  checkedAt: string;
  error: string | null;
  summary: {
    totalTables: number;
    existingTables: number;
    missingTables: number;
    totalExpectedColumns: number;
    missingColumns: number;
    missingIndexes: number;
    unnumberedProducts: number;
    totalProducts: number;
    totalCategories: number;
    totalAdmins: number;
    schemaInSync: boolean;
  };
  tables: TableInspectionStatus[];
}

export interface DatabaseSyncOptions {
  createMissingSchema?: boolean;
  backfillProductNumbers?: boolean;
  syncSequences?: boolean;
  seedDefaults?: boolean;
}

export interface DatabaseSyncReport {
  ok: boolean;
  durationMs: number;
  syncedAt: string;
  migration: SchemaMigrationResult;
  sequencesSynced: string[];
  defaultsSeeded: boolean;
  inspection: DatabaseInspectionReport;
}

function sanitizeIdentifier(ident: string): string {
  return ident.replace(/[^a-zA-Z0-9_]/g, '');
}

async function grantRuntimePrivilegesIfNeeded(ddlPool: Pool, tableName: string): Promise<void> {
  const runtimeUser = sanitizeIdentifier(process.env.SQL_USER || '');
  if (!runtimeUser) return;
  try {
    const me = await ddlPool.query<{ u: string }>('SELECT current_user AS u');
    if (me.rows[0]?.u === runtimeUser) return;
    const safeTable = sanitizeIdentifier(tableName);
    await ddlPool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "${safeTable}" TO "${runtimeUser}"`);
    await ddlPool.query(
      `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA current_schema() TO "${runtimeUser}"`
    );
  } catch {
    // Non-fatal: role might already have privileges via default grants or superuser
  }
}

async function selectDdlPool(): Promise<{ ddlPool: Pool; usedAdminPool: boolean }> {
  const adminPool = getAdminPool();
  const usedAdminPool = adminPool !== pool;
  if (usedAdminPool) {
    try {
      await adminPool.query('SELECT 1');
      return { ddlPool: adminPool, usedAdminPool: true };
    } catch (err) {
      console.warn('Admin SQL pool connection failed, falling back to runtime pool:', err);
    }
  }
  return { ddlPool: pool, usedAdminPool: false };
}

export async function runAutoSchemaMigration(): Promise<SchemaMigrationResult> {
  if (!isDatabaseConfigured) {
    return {
      tablesCreated: [],
      columnsAdded: [],
      indexesCreated: [],
      skippedDueToPermission: [],
      productNumbersBackfilled: 0,
      usedAdminPool: false,
    };
  }

  const { ddlPool, usedAdminPool } = await selectDdlPool();

  const tablesCreated: string[] = [];
  const columnsAdded: Array<{ table: string; column: string }> = [];
  const indexesCreated: string[] = [];
  const skippedDueToPermission: string[] = [];

  const [tablesRes, colsRes, idxRes] = await Promise.all([
    ddlPool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()`
    ),
    ddlPool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = current_schema()`
    ),
    ddlPool.query<{ tablename: string; indexname: string }>(
      `SELECT tablename, indexname FROM pg_indexes WHERE schemaname = current_schema()`
    ),
  ]);

  const existingTables = new Set(tablesRes.rows.map((r) => r.table_name));
  const columnsByTable = new Map<string, Set<string>>();
  for (const row of colsRes.rows) {
    if (!columnsByTable.has(row.table_name)) {
      columnsByTable.set(row.table_name, new Set());
    }
    columnsByTable.get(row.table_name)!.add(row.column_name);
  }
  const existingIndexes = new Set(idxRes.rows.map((r) => r.indexname));

  for (const def of SCHEMA_DEFINITIONS) {
    if (!existingTables.has(def.name)) {
      try {
        await ddlPool.query(def.createSql);
        tablesCreated.push(def.name);
        existingTables.add(def.name);
        columnsByTable.set(
          def.name,
          new Set(def.columns.map((c) => c.name))
        );
        await grantRuntimePrivilegesIfNeeded(ddlPool, def.name);
      } catch (err: any) {
        if (err?.code === '42501') {
          skippedDueToPermission.push(`table:${def.name}`);
          continue;
        }
        throw err;
      }
    } else {
      const currentCols = columnsByTable.get(def.name) || new Set<string>();
      for (const col of def.columns) {
        if (!currentCols.has(col.name)) {
          try {
            await ddlPool.query(
              `ALTER TABLE "${def.name}" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.ddl};`
            );
            columnsAdded.push({ table: def.name, column: col.name });
            currentCols.add(col.name);
          } catch (err: any) {
            if (err?.code === '42501') {
              skippedDueToPermission.push(`column:${def.name}.${col.name}`);
            } else {
              throw err;
            }
          }
        }
      }
    }

    for (const idx of def.indexes) {
      if (!existingIndexes.has(idx.name)) {
        try {
          await ddlPool.query(idx.sql);
          indexesCreated.push(idx.name);
          existingIndexes.add(idx.name);
        } catch (err: any) {
          if (err?.code === '42501') {
            skippedDueToPermission.push(`index:${idx.name}`);
          } else {
            throw err;
          }
        }
      }
    }
  }

  resetSchemaCaches();
  const productNumbersBackfilled = await backfillMissingProductNumbers();

  return {
    tablesCreated,
    columnsAdded,
    indexesCreated,
    skippedDueToPermission,
    productNumbersBackfilled,
    usedAdminPool,
  };
}

export async function inspectDatabaseSchema(): Promise<DatabaseInspectionReport> {
  const checkedAt = new Date().toISOString();
  if (!isDatabaseConfigured) {
    return {
      configured: false,
      connected: false,
      databaseName: null,
      schemaName: null,
      runtimeUser: null,
      adminUser: null,
      hasAdminCredentials: false,
      canAutoMigrate: false,
      postgresVersion: null,
      checkedAt,
      error: 'DATABASE_URL / SQL_HOST belum dikonfigurasi.',
      summary: {
        totalTables: SCHEMA_DEFINITIONS.length,
        existingTables: 0,
        missingTables: SCHEMA_DEFINITIONS.length,
        totalExpectedColumns: SCHEMA_DEFINITIONS.reduce((acc, t) => acc + t.columns.length, 0),
        missingColumns: SCHEMA_DEFINITIONS.reduce((acc, t) => acc + t.columns.length, 0),
        missingIndexes: SCHEMA_DEFINITIONS.reduce((acc, t) => acc + t.indexes.length, 0),
        unnumberedProducts: 0,
        totalProducts: 0,
        totalCategories: 0,
        totalAdmins: 0,
        schemaInSync: false,
      },
      tables: SCHEMA_DEFINITIONS.map((t) => ({
        name: t.name,
        label: t.label,
        exists: false,
        rowCount: 0,
        expectedColumns: t.columns.length,
        actualColumns: 0,
        missingColumns: t.columns.map((c) => c.name),
        expectedIndexes: t.indexes.length,
        missingIndexes: t.indexes.map((i) => i.name),
        inSync: false,
      })),
    };
  }

  try {
    const infoRes = await pool.query<{
      db_name: string;
      schema_name: string;
      runtime_user: string;
      pg_version: string;
    }>(
      `SELECT current_database() AS db_name,
              current_schema() AS schema_name,
              current_user AS runtime_user,
              split_part(version(), ',', 1) AS pg_version`
    );
    const meta = infoRes.rows[0];

    let adminUser: string | null = null;
    let canAutoMigrate = false;
    const adminPool = getAdminPool();
    if (adminPool !== pool) {
      try {
        const admRes = await adminPool.query<{ u: string }>('SELECT current_user AS u');
        adminUser = admRes.rows[0]?.u || null;
        canAutoMigrate = true;
      } catch {
        adminUser = null;
        canAutoMigrate = false;
      }
    } else {
      adminUser = meta?.runtime_user || null;
      canAutoMigrate = true;
    }

    const [tablesRes, colsRes, idxRes] = await Promise.all([
      pool.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()`
      ),
      pool.query<{ table_name: string; column_name: string }>(
        `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = current_schema()`
      ),
      pool.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()`
      ),
    ]);

    const existingTables = new Set(tablesRes.rows.map((r) => r.table_name));
    const columnsByTable = new Map<string, Set<string>>();
    for (const row of colsRes.rows) {
      if (!columnsByTable.has(row.table_name)) {
        columnsByTable.set(row.table_name, new Set());
      }
      columnsByTable.get(row.table_name)!.add(row.column_name);
    }
    const existingIndexes = new Set(idxRes.rows.map((r) => r.indexname));

    const rowCounts = new Map<string, number>();
    await Promise.all(
      SCHEMA_DEFINITIONS.map(async (def) => {
        if (!existingTables.has(def.name)) {
          rowCounts.set(def.name, 0);
          return;
        }
        try {
          const cntRes = await pool.query<{ cnt: number }>(
            `SELECT count(*)::int AS cnt FROM "${def.name}"`
          );
          rowCounts.set(def.name, Number(cntRes.rows[0]?.cnt ?? 0));
        } catch {
          rowCounts.set(def.name, 0);
        }
      })
    );

    let unnumberedProducts = 0;
    const productCols = columnsByTable.get('products');
    if (existingTables.has('products') && productCols?.has('product_number')) {
      try {
        const nullRes = await pool.query<{ cnt: number }>(
          `SELECT count(*)::int AS cnt FROM "products" WHERE "product_number" IS NULL`
        );
        unnumberedProducts = Number(nullRes.rows[0]?.cnt ?? 0);
      } catch {
        unnumberedProducts = 0;
      }
    }

    const tables: TableInspectionStatus[] = SCHEMA_DEFINITIONS.map((def) => {
      const exists = existingTables.has(def.name);
      const actualColSet = columnsByTable.get(def.name) || new Set<string>();
      const missingColumns = def.columns
        .map((c) => c.name)
        .filter((colName) => !actualColSet.has(colName));
      const missingIndexes = def.indexes
        .map((i) => i.name)
        .filter((idxName) => !existingIndexes.has(idxName));

      return {
        name: def.name,
        label: def.label,
        exists,
        rowCount: rowCounts.get(def.name) ?? 0,
        expectedColumns: def.columns.length,
        actualColumns: actualColSet.size,
        missingColumns,
        expectedIndexes: def.indexes.length,
        missingIndexes,
        inSync: exists && missingColumns.length === 0 && missingIndexes.length === 0,
      };
    });

    const existingCount = tables.filter((t) => t.exists).length;
    const missingTables = tables.length - existingCount;
    const missingColumns = tables.reduce((acc, t) => acc + t.missingColumns.length, 0);
    const missingIndexes = tables.reduce((acc, t) => acc + t.missingIndexes.length, 0);
    const totalExpectedColumns = tables.reduce((acc, t) => acc + t.expectedColumns, 0);

    return {
      configured: true,
      connected: true,
      databaseName: meta?.db_name || null,
      schemaName: meta?.schema_name || null,
      runtimeUser: meta?.runtime_user || null,
      adminUser,
      hasAdminCredentials: hasAdminDatabaseCredentials,
      canAutoMigrate,
      postgresVersion: meta?.pg_version || null,
      checkedAt,
      error: null,
      summary: {
        totalTables: tables.length,
        existingTables: existingCount,
        missingTables,
        totalExpectedColumns,
        missingColumns,
        missingIndexes,
        unnumberedProducts,
        totalProducts: rowCounts.get('products') ?? 0,
        totalCategories: rowCounts.get('categories') ?? 0,
        totalAdmins: rowCounts.get('admins') ?? 0,
        schemaInSync: missingTables === 0 && missingColumns === 0 && missingIndexes === 0,
      },
      tables,
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      databaseName: null,
      schemaName: null,
      runtimeUser: null,
      adminUser: null,
      hasAdminCredentials: hasAdminDatabaseCredentials,
      canAutoMigrate: false,
      postgresVersion: null,
      checkedAt,
      error: err?.message || 'Gagal menghubungi PostgreSQL',
      summary: {
        totalTables: SCHEMA_DEFINITIONS.length,
        existingTables: 0,
        missingTables: SCHEMA_DEFINITIONS.length,
        totalExpectedColumns: SCHEMA_DEFINITIONS.reduce((acc, t) => acc + t.columns.length, 0),
        missingColumns: 0,
        missingIndexes: 0,
        unnumberedProducts: 0,
        totalProducts: 0,
        totalCategories: 0,
        totalAdmins: 0,
        schemaInSync: false,
      },
      tables: [],
    };
  }
}

async function syncSerialSequences(): Promise<string[]> {
  const synced: string[] = [];
  for (const def of SCHEMA_DEFINITIONS) {
    if (!def.hasSerialId) continue;
    try {
      const res = await pool.query<{ seq_name: string | null }>(
        `SELECT pg_get_serial_sequence($1, 'id') AS seq_name`,
        [def.name]
      );
      const seqName = res.rows[0]?.seq_name;
      if (!seqName) continue;
      await pool.query(
        `SELECT setval($1::regclass, COALESCE((SELECT MAX("id") FROM "${def.name}"), 1), EXISTS(SELECT 1 FROM "${def.name}"))`,
        [seqName]
      );
      synced.push(def.name);
    } catch {
      // ignore if table missing or sequence inaccessible
    }
  }
  return synced;
}

export async function synchronizeDatabase(
  options: DatabaseSyncOptions = {}
): Promise<DatabaseSyncReport> {
  const start = Date.now();
  const createMissingSchema = options.createMissingSchema !== false;
  const shouldBackfillNumbers = options.backfillProductNumbers !== false;
  const shouldSyncSequences = options.syncSequences !== false;
  const shouldSeedDefaults = options.seedDefaults !== false;

  let migration: SchemaMigrationResult = {
    tablesCreated: [],
    columnsAdded: [],
    indexesCreated: [],
    skippedDueToPermission: [],
    productNumbersBackfilled: 0,
    usedAdminPool: false,
  };

  if (createMissingSchema) {
    migration = await runAutoSchemaMigration();
  } else if (shouldBackfillNumbers) {
    resetSchemaCaches();
    migration.productNumbersBackfilled = await backfillMissingProductNumbers();
  }

  let defaultsSeeded = false;
  if (shouldSeedDefaults) {
    await ensureInitialData(true);
    defaultsSeeded = true;
  }

  let sequencesSynced: string[] = [];
  if (shouldSyncSequences) {
    sequencesSynced = await syncSerialSequences();
  }

  const inspection = await inspectDatabaseSchema();

  return {
    ok: inspection.connected,
    durationMs: Date.now() - start,
    syncedAt: new Date().toISOString(),
    migration,
    sequencesSynced,
    defaultsSeeded,
    inspection,
  };
}
