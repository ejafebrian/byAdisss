import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id: serial('id').primaryKey(),
  brandName: text('brand_name').notNull().default('by Adisss'),
  username: text('username').notNull().default('@adisssfinds'),
  tagline: text('tagline').notNull().default('GOOD FINDS, HAPPY BUYS!'),
  description: text('description')
    .notNull()
    .default("Hi, I'm Adisss! ♡ Sharing cute finds, daily essentials, and little things worth buying."),
  avatarUrl: text('avatar_url').notNull().default(''),
  instagramUrl: text('instagram_url').notNull().default('https://instagram.com/adisssfinds'),
  tiktokUrl: text('tiktok_url').notNull().default('https://tiktok.com/@adisssfinds'),
  whatsappUrl: text('whatsapp_url').notNull().default(''),
  footerText: text('footer_text').notNull().default('Made with ♡ by Adisss'),
  affiliateDisclosure: text('affiliate_disclosure').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const admins = pgTable(
  'admins',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').unique(),
    email: text('email').notNull().unique(),
    displayName: text('display_name').notNull().default('Admin'),
    role: text('role').notNull().default('admin'), // 'super_admin' | 'admin' | 'editor'
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('admins_email_idx').on(table.email),
    index('admins_uid_idx').on(table.uid),
  ]
);

export const categories = pgTable(
  'categories',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description').default(''),
    imageUrl: text('image_url').default(''),
    icon: text('icon').default('Sparkles'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('categories_slug_idx').on(table.slug),
    index('categories_active_sort_idx').on(table.isActive, table.sortOrder),
  ]
);

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    productName: text('product_name').notNull(),
    productSlug: text('product_slug').notNull().unique(),
    description: text('description').default(''),
    imageUrl: text('image_url').default(''),
    price: numeric('price', { precision: 14, scale: 2 }),
    categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
    affiliateUrl: text('affiliate_url').notNull(),
    label: text('label').default(''), // BEST SELLER, VIRAL, RECOMMENDED, NEW
    isFeatured: boolean('is_featured').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    isArchived: boolean('is_archived').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('products_slug_idx').on(table.productSlug),
    index('products_category_idx').on(table.categoryId),
    index('products_active_featured_idx').on(table.isActive, table.isArchived, table.isFeatured),
    index('products_sort_idx').on(table.sortOrder),
  ]
);

export const links = pgTable(
  'links',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    url: text('url').notNull(),
    description: text('description').default(''),
    icon: text('icon').default('ExternalLink'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('links_slug_idx').on(table.slug),
    index('links_active_sort_idx').on(table.isActive, table.sortOrder),
  ]
);

export const banners = pgTable(
  'banners',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').default(''),
    imageUrl: text('image_url').default(''),
    targetUrl: text('target_url').default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('banners_active_sort_idx').on(table.isActive, table.sortOrder)]
);

export const visitors = pgTable(
  'visitors',
  {
    id: serial('id').primaryKey(),
    visitorKey: text('visitor_key').notNull().unique(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('visitors_key_idx').on(table.visitorKey)]
);

export const sessions = pgTable(
  'sessions',
  {
    id: serial('id').primaryKey(),
    visitorId: integer('visitor_id')
      .references(() => visitors.id, { onDelete: 'cascade' })
      .notNull(),
    sessionKey: text('session_key').notNull().unique(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    deviceType: text('device_type').default('desktop'),
    browser: text('browser').default('Other'),
    operatingSystem: text('operating_system').default('Other'),
    referrer: text('referrer').default('direct'),
    utmSource: text('utm_source').default(''),
    utmMedium: text('utm_medium').default(''),
    utmCampaign: text('utm_campaign').default(''),
  },
  (table) => [
    uniqueIndex('sessions_key_idx').on(table.sessionKey),
    index('sessions_last_seen_idx').on(table.lastSeenAt),
    index('sessions_visitor_idx').on(table.visitorId),
  ]
);

export const pageViews = pgTable(
  'page_views',
  {
    id: serial('id').primaryKey(),
    visitorId: integer('visitor_id')
      .references(() => visitors.id, { onDelete: 'cascade' })
      .notNull(),
    sessionId: integer('session_id')
      .references(() => sessions.id, { onDelete: 'cascade' })
      .notNull(),
    pageUrl: text('page_url').notNull(),
    viewedAt: timestamp('viewed_at', { withTimezone: true }).defaultNow().notNull(),
    referrer: text('referrer').default('direct'),
    utmSource: text('utm_source').default(''),
    utmMedium: text('utm_medium').default(''),
    utmCampaign: text('utm_campaign').default(''),
    deviceType: text('device_type').default('desktop'),
  },
  (table) => [
    index('page_views_viewed_at_idx').on(table.viewedAt),
    index('page_views_visitor_idx').on(table.visitorId),
    index('page_views_page_url_idx').on(table.pageUrl),
  ]
);

export const clickEvents = pgTable(
  'click_events',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
    linkId: integer('link_id').references(() => links.id, { onDelete: 'set null' }),
    targetType: text('target_type').notNull().default('product'), // 'product' | 'link'
    visitorId: integer('visitor_id').references(() => visitors.id, { onDelete: 'set null' }),
    sessionId: integer('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    clickedAt: timestamp('clicked_at', { withTimezone: true }).defaultNow().notNull(),
    referrer: text('referrer').default('direct'),
    utmSource: text('utm_source').default(''),
    utmCampaign: text('utm_campaign').default(''),
    deviceType: text('device_type').default('desktop'),
  },
  (table) => [
    index('click_events_clicked_at_idx').on(table.clickedAt),
    index('click_events_product_idx').on(table.productId),
    index('click_events_link_idx').on(table.linkId),
    index('click_events_visitor_idx').on(table.visitorId),
  ]
);

export const affiliateImportJobs = pgTable(
  'affiliate_import_jobs',
  {
    id: serial('id').primaryKey(),
    adminId: integer('admin_id').references(() => admins.id, { onDelete: 'set null' }),
    adminEmail: text('admin_email').notNull(),
    filename: text('filename').notNull(),
    totalRows: integer('total_rows').notNull().default(0),
    successRows: integer('success_rows').notNull().default(0),
    updatedRows: integer('updated_rows').notNull().default(0),
    skippedRows: integer('skipped_rows').notNull().default(0),
    failedRows: integer('failed_rows').notNull().default(0),
    importStatus: text('import_status').notNull().default('completed'), // 'processing' | 'completed' | 'partial' | 'failed'
    duplicateMode: text('duplicate_mode').notNull().default('skip'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [index('import_jobs_created_idx').on(table.createdAt)]
);

export const affiliateImportErrors = pgTable(
  'affiliate_import_errors',
  {
    id: serial('id').primaryKey(),
    importJobId: integer('import_job_id')
      .references(() => affiliateImportJobs.id, { onDelete: 'cascade' })
      .notNull(),
    rowNumber: integer('row_number').notNull(),
    errorMessage: text('error_message').notNull(),
    rowData: jsonb('row_data'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('import_errors_job_idx').on(table.importJobId)]
);

export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  settingKey: text('setting_key').notNull().unique(),
  settingValue: text('setting_value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const adminAuditLogs = pgTable(
  'admin_audit_logs',
  {
    id: serial('id').primaryKey(),
    adminId: integer('admin_id').references(() => admins.id, { onDelete: 'set null' }),
    adminEmail: text('admin_email').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').default(''),
    details: jsonb('details'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('audit_logs_created_idx').on(table.createdAt)]
);

export const uploadedAssets = pgTable('uploaded_assets', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  dataBase64: text('data_base64').notNull(),
  folder: text('folder').notNull().default('general'),
  uploadedByAdminId: integer('uploaded_by_admin_id').references(() => admins.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  clickEvents: many(clickEvents),
}));

export const linksRelations = relations(links, ({ many }) => ({
  clickEvents: many(clickEvents),
}));

export const visitorsRelations = relations(visitors, ({ many }) => ({
  sessions: many(sessions),
  pageViews: many(pageViews),
  clickEvents: many(clickEvents),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  visitor: one(visitors, {
    fields: [sessions.visitorId],
    references: [visitors.id],
  }),
  pageViews: many(pageViews),
  clickEvents: many(clickEvents),
}));

export const affiliateImportJobsRelations = relations(affiliateImportJobs, ({ one, many }) => ({
  admin: one(admins, {
    fields: [affiliateImportJobs.adminId],
    references: [admins.id],
  }),
  errors: many(affiliateImportErrors),
}));

export const affiliateImportErrorsRelations = relations(affiliateImportErrors, ({ one }) => ({
  job: one(affiliateImportJobs, {
    fields: [affiliateImportErrors.importJobId],
    references: [affiliateImportJobs.id],
  }),
}));
