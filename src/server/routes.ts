import express from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import { db, isDatabaseConfigured } from '../db/index.ts';
import {
  adminAuditLogs,
  admins,
  affiliateImportErrors,
  affiliateImportJobs,
  banners,
  categories,
  clickEvents,
  links,
  pageViews,
  products,
  profiles,
  settings,
  uploadedAssets,
  visitors,
} from '../db/schema.ts';
import { requireAdmin, requireSuperAdmin } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import {
  bannerSchema,
  categorySchema,
  isAllowedAffiliateDomain,
  isAllowedImageUrl,
  isValidHttpUrl,
  linkSchema,
  productSchema,
  profileSchema,
  toCsvString,
  toSlug,
} from '../lib/validators.ts';
import {
  addRealtimeClient,
  getActiveVisitorsCount,
  getAnalyticsDashboardData,
  recordClickEvent,
  recordHeartbeat,
  recordPageView,
  resolveJakartaDateRange,
} from './analyticsService.ts';
import type { DateRangePreset } from './analyticsService.ts';
import {
  buildTemplateWorkbookBuffer,
  executeBatchImport,
  fetchAndPreviewGoogleSheet,
  getAllowedAffiliateDomains,
  parseAndValidateSpreadsheet,
} from './importService.ts';
import type { DuplicateMode, ParsedImportRow } from './importService.ts';
import { createRateLimiter } from './rateLimit.ts';
import { ensureInitialData } from './seedService.ts';

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
});

const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

const trackingLimiter = createRateLimiter({
  name: 'tracking',
  windowMs: 60 * 1000,
  maxRequests: 120,
});

const adminWriteLimiter = createRateLimiter({
  name: 'admin_write',
  windowMs: 60 * 1000,
  maxRequests: 60,
});

function detectImageMagicMime(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  // GIF: GIF87a / GIF89a
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif';
  }
  // WEBP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

async function logAdminAction(params: {
  admin: AuthRequest['admin'];
  action: string;
  entityType: string;
  entityId?: string | number;
  details?: Record<string, unknown>;
}) {
  if (!params.admin) return;
  try {
    await db.insert(adminAuditLogs).values({
      adminId: params.admin.id,
      adminEmail: params.admin.email,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId !== undefined ? String(params.entityId) : '',
      details: params.details ?? {},
    });
  } catch (err) {
    console.error('Audit log insert failed:', err);
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      out[k] = v;
    }
  }
  return out;
}

function renderBrandedErrorHtml(statusCode: number, title: string, message: string): string {
  const safeTitle = title.replace(/[<>&"]/g, '');
  const safeMsg = message.replace(/[<>&"]/g, '');
  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle} — by Adisss</title>
  <style>
    body { margin: 0; font-family: 'Poppins', system-ui, sans-serif; background: #FFF6F8; color: #3F232C; display: flex; min-height: 100vh; align-items: center; justify-content: center; padding: 24px; }
    .card { max-width: 420px; width: 100%; background: #FFFFFF; border: 1px solid #F0C6D2; border-radius: 20px; padding: 32px; text-align: center; box-shadow: 0 10px 30px rgba(194,91,124,0.1); }
    .code { font-size: 13px; letter-spacing: 0.12em; color: #C25B7C; font-weight: 600; margin-bottom: 8px; }
    h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 26px; margin: 0 0 12px; color: #3F232C; }
    p { font-size: 14px; line-height: 1.6; color: #7D4E5D; margin: 0 0 24px; }
    a { display: inline-block; background: #C25B7C; color: #FFFFFF; text-decoration: none; padding: 12px 24px; border-radius: 12px; font-size: 14px; font-weight: 500; }
  </style>
</head>
<body>
  <div class="card">
    <div class="code">STATUS ${statusCode}</div>
    <h1>${safeTitle}</h1>
    <p>${safeMsg}</p>
    <a href="/">Kembali ke Katalog by Adisss</a>
  </div>
</body>
</html>`;
}

export function registerRoutes(app: express.Express) {
  // ==========================================
  // HEALTH CHECK
  // ==========================================
  app.get('/api/health', async (_req: Request, res: Response) => {
    let dbConnected = false;
    let dbError: string | null = null;
    if (isDatabaseConfigured) {
      try {
        await db.execute(sql`SELECT 1`);
        dbConnected = true;
      } catch (err: any) {
        dbError = err?.code || err?.message || 'Database connection failed';
      }
    } else {
      dbError = 'DATABASE_URL / SQL_HOST not configured';
    }
    return res.status(dbConnected ? 200 : 503).json({
      ok: dbConnected,
      dbConfigured: isDatabaseConfigured,
      dbConnected,
      dbError,
    });
  });

  // ==========================================
  // PUBLIC ASSETS SERVING
  // ==========================================
  app.get('/api/assets/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(404).send('Not found');
      }
      const rows = await db
        .select()
        .from(uploadedAssets)
        .where(eq(uploadedAssets.id, id))
        .limit(1);
      if (!rows.length) {
        return res.status(404).send('Not found');
      }
      const asset = rows[0];
      const buffer = Buffer.from(asset.dataBase64, 'base64');
      res.setHeader('Content-Type', asset.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(buffer);
    } catch (err) {
      console.error('Asset fetch error:', err);
      return res.status(500).send('Failed to load asset');
    }
  });

  // ==========================================
  // SERVER-SIDE AFFILIATE & LINK REDIRECTS
  // ==========================================
  app.get('/go/:slug', async (req: Request, res: Response) => {
    try {
      await ensureInitialData();
      const slug = String(req.params.slug || '').trim().toLowerCase();
      if (!slug) {
        return res
          .status(404)
          .send(renderBrandedErrorHtml(404, 'Produk Tidak Ditemukan', 'Link produk tidak valid.'));
      }

      const rows = await db
        .select()
        .from(products)
        .where(eq(products.productSlug, slug))
        .limit(1);

      if (!rows.length) {
        return res
          .status(404)
          .send(
            renderBrandedErrorHtml(
              404,
              'Produk Tidak Ditemukan',
              'Maaf, produk rekomendasi ini tidak ditemukan di katalog by Adisss.'
            )
          );
      }

      const product = rows[0];
      if (!product.isActive || product.isArchived) {
        return res
          .status(404)
          .send(
            renderBrandedErrorHtml(
              404,
              'Produk Tidak Tersedia',
              'Produk ini sedang tidak aktif atau telah diarsipkan oleh pemilik katalog.'
            )
          );
      }

      // Security: Never accept redirect URL from query parameters; validate stored DB URL
      const allowedDomains = await getAllowedAffiliateDomains();
      const domainCheck = isAllowedAffiliateDomain(product.affiliateUrl, allowedDomains);
      if (!domainCheck.valid) {
        console.error(`Blocked unsafe affiliate redirect for product ${product.id}: ${domainCheck.reason}`);
        return res
          .status(422)
          .send(
            renderBrandedErrorHtml(
              422,
              'Link Tujuan Tidak Valid',
              'Link affiliate produk ini tidak lolos verifikasi keamanan domain.'
            )
          );
      }

      const cookies = parseCookies(req.headers.cookie);
      const visitorKey = cookies._resty_vid || undefined;
      const sessionKey = cookies._resty_sid || undefined;
      const utmSource = typeof req.query.utm_source === 'string' ? req.query.utm_source : undefined;
      const utmCampaign =
        typeof req.query.utm_campaign === 'string' ? req.query.utm_campaign : undefined;

      // Record click event before issuing redirect; safe documented fallback if analytics insert fails
      try {
        await recordClickEvent({
          productId: product.id,
          targetType: 'product',
          targetTitle: product.productName,
          visitorKey,
          sessionKey,
          userAgent: req.headers['user-agent'],
          referrer: req.headers.referer,
          utmSource,
          utmCampaign,
        });
      } catch (logErr) {
        console.error(
          `[FALLBACK_POLICY] Click recording failed for product ${product.id} (${slug}), proceeding with validated 302 redirect without claiming recorded click:`,
          logErr
        );
      }

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      return res.redirect(302, product.affiliateUrl);
    } catch (err) {
      console.error('Redirect error /go/:slug:', err);
      return res
        .status(500)
        .send(
          renderBrandedErrorHtml(
            500,
            'Terjadi Kesalahan',
            'Sistem sedang mengalami gangguan saat memproses link produk.'
          )
        );
    }
  });

  app.get('/l/:slug', async (req: Request, res: Response) => {
    try {
      await ensureInitialData();
      const slug = String(req.params.slug || '').trim().toLowerCase();
      const rows = await db
        .select()
        .from(links)
        .where(and(eq(links.slug, slug), eq(links.isActive, true)))
        .limit(1);

      if (!rows.length) {
        return res
          .status(404)
          .send(renderBrandedErrorHtml(404, 'Tautan Tidak Ditemukan', 'Tautan ini tidak aktif atau tidak ditemukan.'));
      }

      const link = rows[0];
      if (!isValidHttpUrl(link.url)) {
        return res
          .status(422)
          .send(renderBrandedErrorHtml(422, 'URL Tidak Valid', 'URL tautan ini tidak lolos pemeriksaan keamanan protokol.'));
      }

      const cookies = parseCookies(req.headers.cookie);
      try {
        await recordClickEvent({
          linkId: link.id,
          targetType: 'link',
          targetTitle: link.title,
          visitorKey: cookies._resty_vid,
          sessionKey: cookies._resty_sid,
          userAgent: req.headers['user-agent'],
          referrer: req.headers.referer,
        });
      } catch (logErr) {
        console.error('[FALLBACK_POLICY] Link click recording failed, continuing validated 302 redirect:', logErr);
      }

      res.setHeader('Cache-Control', 'no-store');
      return res.redirect(302, link.url);
    } catch (err) {
      console.error('Link redirect error:', err);
      return res.status(500).send(renderBrandedErrorHtml(500, 'Terjadi Kesalahan', 'Gagal mengarahkan tautan.'));
    }
  });

  // ==========================================
  // PUBLIC CATALOG & TRACKING APIs
  // ==========================================
  app.get('/api/public/home', async (req: Request, res: Response) => {
    try {
      await ensureInitialData();
      const now = new Date();
      const categorySlug = typeof req.query.category === 'string' ? req.query.category.trim() : '';
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

      const [profile] = await db.select().from(profiles).limit(1);

      const activeBanners = await db
        .select()
        .from(banners)
        .where(
          and(
            eq(banners.isActive, true),
            or(isNull(banners.startsAt), lte(banners.startsAt, now)),
            or(isNull(banners.endsAt), gte(banners.endsAt, now))
          )
        )
        .orderBy(asc(banners.sortOrder), desc(banners.createdAt));

      const activeCategories = await db
        .select({
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
          description: categories.description,
          imageUrl: categories.imageUrl,
          icon: categories.icon,
          sortOrder: categories.sortOrder,
          productCount: sql<number>`count(${products.id}) filter (where ${products.isActive} = true and ${products.isArchived} = false)::int`,
        })
        .from(categories)
        .leftJoin(products, eq(products.categoryId, categories.id))
        .where(eq(categories.isActive, true))
        .groupBy(categories.id)
        .orderBy(asc(categories.sortOrder), asc(categories.name));

      const activeLinks = await db
        .select()
        .from(links)
        .where(eq(links.isActive, true))
        .orderBy(asc(links.sortOrder), asc(links.id));

      const productConditions = [eq(products.isActive, true), eq(products.isArchived, false)];
      if (categorySlug) {
        const matchedCat = activeCategories.find((c) => c.slug === categorySlug);
        if (matchedCat) {
          productConditions.push(eq(products.categoryId, matchedCat.id));
        } else {
          // Force empty if unknown category filter
          productConditions.push(eq(products.id, -1));
        }
      }
      if (search) {
        productConditions.push(
          or(
            ilike(products.productName, `%${search}%`),
            ilike(products.description, `%${search}%`),
            ilike(products.label, `%${search}%`)
          )!
        );
      }

      const catalogProducts = await db
        .select({
          id: products.id,
          productName: products.productName,
          productSlug: products.productSlug,
          description: products.description,
          imageUrl: products.imageUrl,
          price: products.price,
          categoryId: products.categoryId,
          categoryName: categories.name,
          categorySlug: categories.slug,
          label: products.label,
          isFeatured: products.isFeatured,
          sortOrder: products.sortOrder,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(and(...productConditions))
        .orderBy(asc(products.sortOrder), desc(products.createdAt));

      const featuredProducts = await db
        .select({
          id: products.id,
          productName: products.productName,
          productSlug: products.productSlug,
          description: products.description,
          imageUrl: products.imageUrl,
          price: products.price,
          categoryId: products.categoryId,
          categoryName: categories.name,
          categorySlug: categories.slug,
          label: products.label,
          isFeatured: products.isFeatured,
          sortOrder: products.sortOrder,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(
          and(
            eq(products.isActive, true),
            eq(products.isArchived, false),
            eq(products.isFeatured, true)
          )
        )
        .orderBy(asc(products.sortOrder), desc(products.createdAt))
        .limit(8);

      const settingRows = await db.select().from(settings);
      const settingsMap = Object.fromEntries(settingRows.map((s) => [s.settingKey, s.settingValue]));

      return res.json({
        profile,
        banners: activeBanners,
        categories: activeCategories,
        featuredProducts,
        products: catalogProducts,
        links: activeLinks,
        privacy: {
          enabled: settingsMap.privacy_notice_enabled !== 'false',
          text:
            settingsMap.privacy_notice_text ||
            'Kami menggunakan pengenal sesi anonim untuk analitik katalog tanpa menyimpan data pribadi.',
        },
      });
    } catch (err) {
      console.error('Error loading public home:', err);
      return res.status(500).json({ error: 'Gagal memuat katalog produk' });
    }
  });

  app.get('/api/public/products/:slug', async (req: Request, res: Response) => {
    try {
      await ensureInitialData();
      const slug = String(req.params.slug || '').trim().toLowerCase();
      const rows = await db
        .select({
          id: products.id,
          productName: products.productName,
          productSlug: products.productSlug,
          description: products.description,
          imageUrl: products.imageUrl,
          price: products.price,
          categoryId: products.categoryId,
          categoryName: categories.name,
          categorySlug: categories.slug,
          label: products.label,
          isFeatured: products.isFeatured,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(
          and(
            eq(products.productSlug, slug),
            eq(products.isActive, true),
            eq(products.isArchived, false)
          )
        )
        .limit(1);

      if (!rows.length) {
        return res.status(404).json({ error: 'Produk tidak ditemukan' });
      }

      const product = rows[0];
      const related = await db
        .select({
          id: products.id,
          productName: products.productName,
          productSlug: products.productSlug,
          imageUrl: products.imageUrl,
          price: products.price,
          label: products.label,
          categoryName: categories.name,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(
          and(
            eq(products.isActive, true),
            eq(products.isArchived, false),
            sql`${products.id} != ${product.id}`,
            product.categoryId ? eq(products.categoryId, product.categoryId) : sql`true`
          )
        )
        .orderBy(asc(products.sortOrder))
        .limit(4);

      const [profile] = await db.select().from(profiles).limit(1);
      return res.json({ product, related, profile });
    } catch (err) {
      console.error('Error loading product detail:', err);
      return res.status(500).json({ error: 'Gagal memuat detail produk' });
    }
  });

  app.post('/api/track/pageview', trackingLimiter, async (req: Request, res: Response) => {
    try {
      const { visitorKey, sessionKey, pageUrl, referrer, utmSource, utmMedium, utmCampaign } =
        req.body || {};

      if (!visitorKey || !sessionKey || !pageUrl) {
        return res.status(400).json({ error: 'Missing tracking parameters' });
      }

      const result = await recordPageView({
        visitorKey: String(visitorKey),
        sessionKey: String(sessionKey),
        pageUrl: String(pageUrl),
        userAgent: req.headers['user-agent'],
        referrer: typeof referrer === 'string' ? referrer : undefined,
        utmSource: typeof utmSource === 'string' ? utmSource : undefined,
        utmMedium: typeof utmMedium === 'string' ? utmMedium : undefined,
        utmCampaign: typeof utmCampaign === 'string' ? utmCampaign : undefined,
      });

      return res.json(result);
    } catch (err) {
      console.error('Pageview tracking error:', err);
      return res.status(500).json({ recorded: false });
    }
  });

  app.post('/api/track/heartbeat', trackingLimiter, async (req: Request, res: Response) => {
    try {
      const { visitorKey, sessionKey } = req.body || {};
      if (!visitorKey || !sessionKey) {
        return res.status(400).json({ error: 'Missing heartbeat parameters' });
      }
      const result = await recordHeartbeat({
        visitorKey: String(visitorKey),
        sessionKey: String(sessionKey),
        userAgent: req.headers['user-agent'],
      });
      return res.json(result);
    } catch (err) {
      console.error('Heartbeat tracking error:', err);
      return res.status(500).json({ active: false });
    }
  });

  // ==========================================
  // ADMIN AUTH & REAL-TIME ANALYTICS
  // ==========================================
  app.get('/api/admin/me', requireAdmin, async (req: AuthRequest, res: Response) => {
    await ensureInitialData();
    return res.json({ admin: req.admin });
  });

  app.get('/api/admin/overview', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      await ensureInitialData();
      const preset = (String(req.query.preset || '7d') as DateRangePreset) || '7d';
      const customStart = typeof req.query.start === 'string' ? req.query.start : undefined;
      const customEnd = typeof req.query.end === 'string' ? req.query.end : undefined;

      const data = await getAnalyticsDashboardData(preset, customStart, customEnd);
      return res.json(data);
    } catch (err) {
      console.error('Error loading admin overview:', err);
      return res.status(500).json({ error: 'Gagal memuat statistik analitik' });
    }
  });

  app.get('/api/admin/realtime', requireAdmin, async (req: AuthRequest, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const activeVisitors = await getActiveVisitorsCount().catch(() => 0);
    res.write(
      `event: connected\ndata: ${JSON.stringify({
        activeVisitors,
        timestamp: new Date().toISOString(),
      })}\n\n`
    );

    addRealtimeClient(res);

    const keepAlive = setInterval(() => {
      try {
        res.write(`: keepalive\n\n`);
      } catch {
        clearInterval(keepAlive);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
    });
  });

  // ==========================================
  // ADMIN PRODUCTS CRUD & BULK ACTIONS
  // ==========================================
  app.get('/api/admin/products', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      await ensureInitialData();
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const categoryId = Number(req.query.categoryId) || 0;
      const status = typeof req.query.status === 'string' ? req.query.status : 'all';
      const sort = typeof req.query.sort === 'string' ? req.query.sort : 'sortOrder';

      const conditions = [];
      if (search) {
        conditions.push(
          or(
            ilike(products.productName, `%${search}%`),
            ilike(products.productSlug, `%${search}%`),
            ilike(products.label, `%${search}%`)
          )!
        );
      }
      if (categoryId > 0) {
        conditions.push(eq(products.categoryId, categoryId));
      }
      if (status === 'active') {
        conditions.push(and(eq(products.isActive, true), eq(products.isArchived, false))!);
      } else if (status === 'inactive') {
        conditions.push(and(eq(products.isActive, false), eq(products.isArchived, false))!);
      } else if (status === 'archived') {
        conditions.push(eq(products.isArchived, true));
      } else if (status === 'all') {
        conditions.push(eq(products.isArchived, false));
      }

      const whereClause = conditions.length ? and(...conditions) : undefined;

      const [{ totalCount }] = await db
        .select({ totalCount: sql<number>`count(*)::int` })
        .from(products)
        .where(whereClause);

      const [{ totalCatalogViews }] = await db
        .select({ totalCatalogViews: sql<number>`count(*)::int` })
        .from(pageViews);

      const productRows = await db
        .select({
          id: products.id,
          productName: products.productName,
          productSlug: products.productSlug,
          description: products.description,
          imageUrl: products.imageUrl,
          price: products.price,
          categoryId: products.categoryId,
          categoryName: categories.name,
          affiliateUrl: products.affiliateUrl,
          label: products.label,
          isFeatured: products.isFeatured,
          isActive: products.isActive,
          isArchived: products.isArchived,
          sortOrder: products.sortOrder,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
          clicks: sql<number>`count(${clickEvents.id})::int`,
          uniqueClickers: sql<number>`count(distinct ${clickEvents.visitorId})::int`,
          lastClickAt: sql<string | null>`max(${clickEvents.clickedAt})`,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(
          clickEvents,
          and(eq(clickEvents.productId, products.id), eq(clickEvents.targetType, 'product'))
        )
        .where(whereClause)
        .groupBy(products.id, categories.name)
        .orderBy(
          sort === 'newest'
            ? desc(products.createdAt)
            : sort === 'clicks'
              ? desc(sql`count(${clickEvents.id})`)
              : sort === 'price_asc'
                ? asc(products.price)
                : sort === 'price_desc'
                  ? desc(products.price)
                  : asc(products.sortOrder),
          desc(products.id)
        )
        .limit(limit)
        .offset(offset);

      // Count product detail views per slug (/product/[slug]) + catalog impressions
      const detailViewsRows = await db
        .select({
          pageUrl: pageViews.pageUrl,
          views: sql<number>`count(*)::int`,
        })
        .from(pageViews)
        .where(ilike(pageViews.pageUrl, '/product/%'))
        .groupBy(pageViews.pageUrl);

      const detailViewsMap = new Map(
        detailViewsRows.map((r) => [r.pageUrl.replace(/^\/product\//, ''), r.views])
      );

      const enriched = productRows.map((p) => {
        const directProductViews = detailViewsMap.get(p.productSlug) ?? 0;
        const effectiveViews = directProductViews > 0 ? directProductViews : totalCatalogViews;
        const ctr =
          effectiveViews > 0 ? Number(((p.clicks / effectiveViews) * 100).toFixed(2)) : 0;
        return {
          ...p,
          views: directProductViews > 0 ? directProductViews : totalCatalogViews,
          ctr,
        };
      });

      return res.json({
        items: enriched,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.max(1, Math.ceil(totalCount / limit)),
        },
      });
    } catch (err) {
      console.error('Error listing admin products:', err);
      return res.status(500).json({ error: 'Gagal memuat daftar produk' });
    }
  });

  app.get('/api/admin/products/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID produk tidak valid' });
    }
    const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!rows.length) {
      return res.status(404).json({ error: 'Produk tidak ditemukan' });
    }
    return res.json({ product: rows[0] });
  });

  app.post(
    '/api/admin/products',
    requireAdmin,
    adminWriteLimiter,
    async (req: AuthRequest, res: Response) => {
      try {
        const parsed = productSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data produk tidak valid' });
        }

        const data = parsed.data;
        const allowedDomains = await getAllowedAffiliateDomains();
        const domainCheck = isAllowedAffiliateDomain(data.affiliateUrl, allowedDomains);
        if (!domainCheck.valid) {
          return res.status(400).json({ error: domainCheck.reason });
        }
        if (data.imageUrl && !isAllowedImageUrl(data.imageUrl)) {
          return res.status(400).json({ error: 'URL gambar tidak valid' });
        }

        const slug = toSlug(data.productSlug || data.productName);
        if (!slug) {
          return res.status(400).json({ error: 'Slug produk tidak valid' });
        }

        const existingSlug = await db
          .select({ id: products.id })
          .from(products)
          .where(eq(products.productSlug, slug))
          .limit(1);
        if (existingSlug.length > 0) {
          return res.status(409).json({
            error: `Slug "${slug}" sudah digunakan oleh produk lain. Gunakan slug unik.`,
          });
        }

        const [created] = await db
          .insert(products)
          .values({
            productName: data.productName,
            productSlug: slug,
            description: data.description,
            imageUrl: data.imageUrl,
            price: data.price !== null ? String(data.price) : null,
            categoryId: data.categoryId,
            affiliateUrl: data.affiliateUrl,
            label: data.label,
            isFeatured: data.isFeatured,
            isActive: data.isActive,
            isArchived: data.isArchived,
            sortOrder: data.sortOrder,
          })
          .returning();

        await logAdminAction({
          admin: req.admin,
          action: 'CREATE_PRODUCT',
          entityType: 'product',
          entityId: created.id,
          details: { productName: created.productName, slug: created.productSlug },
        });

        return res.status(201).json({ product: created });
      } catch (err) {
        console.error('Create product error:', err);
        return res.status(500).json({ error: 'Gagal menambahkan produk' });
      }
    }
  );

  app.put(
    '/api/admin/products/:id',
    requireAdmin,
    adminWriteLimiter,
    async (req: AuthRequest, res: Response) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
          return res.status(400).json({ error: 'ID produk tidak valid' });
        }

        const parsed = productSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data produk tidak valid' });
        }

        const data = parsed.data;
        const allowedDomains = await getAllowedAffiliateDomains();
        const domainCheck = isAllowedAffiliateDomain(data.affiliateUrl, allowedDomains);
        if (!domainCheck.valid) {
          return res.status(400).json({ error: domainCheck.reason });
        }
        if (data.imageUrl && !isAllowedImageUrl(data.imageUrl)) {
          return res.status(400).json({ error: 'URL gambar tidak valid' });
        }

        const slug = toSlug(data.productSlug || data.productName);
        const dup = await db
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.productSlug, slug), sql`${products.id} != ${id}`))
          .limit(1);
        if (dup.length > 0) {
          return res.status(409).json({
            error: `Slug "${slug}" sudah digunakan produk lain.`,
          });
        }

        const [updated] = await db
          .update(products)
          .set({
            productName: data.productName,
            productSlug: slug,
            description: data.description,
            imageUrl: data.imageUrl,
            price: data.price !== null ? String(data.price) : null,
            categoryId: data.categoryId,
            affiliateUrl: data.affiliateUrl,
            label: data.label,
            isFeatured: data.isFeatured,
            isActive: data.isActive,
            isArchived: data.isArchived,
            sortOrder: data.sortOrder,
            updatedAt: new Date(),
          })
          .where(eq(products.id, id))
          .returning();

        if (!updated) {
          return res.status(404).json({ error: 'Produk tidak ditemukan' });
        }

        await logAdminAction({
          admin: req.admin,
          action: 'UPDATE_PRODUCT',
          entityType: 'product',
          entityId: updated.id,
          details: { productName: updated.productName, slug: updated.productSlug },
        });

        return res.json({ product: updated });
      } catch (err) {
        console.error('Update product error:', err);
        return res.status(500).json({ error: 'Gagal memperbarui produk' });
      }
    }
  );

  app.patch(
    '/api/admin/products/:id/affiliate-url',
    requireAdmin,
    adminWriteLimiter,
    async (req: AuthRequest, res: Response) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
          return res.status(400).json({ error: 'ID produk tidak valid' });
        }
        const affiliateUrl = String(req.body?.affiliateUrl || '').trim();
        const allowedDomains = await getAllowedAffiliateDomains();
        const domainCheck = isAllowedAffiliateDomain(affiliateUrl, allowedDomains);
        if (!domainCheck.valid) {
          return res.status(400).json({ error: domainCheck.reason || 'Affiliate URL tidak valid' });
        }

        const [updated] = await db
          .update(products)
          .set({ affiliateUrl, updatedAt: new Date() })
          .where(eq(products.id, id))
          .returning();

        if (!updated) {
          return res.status(404).json({ error: 'Produk tidak ditemukan' });
        }

        await logAdminAction({
          admin: req.admin,
          action: 'UPDATE_AFFILIATE_URL',
          entityType: 'product',
          entityId: updated.id,
          details: { slug: updated.productSlug, affiliateUrl },
        });

        return res.json({ product: updated });
      } catch (err) {
        console.error('Patch affiliate url error:', err);
        return res.status(500).json({ error: 'Gagal memperbarui link affiliate' });
      }
    }
  );

  app.post('/api/admin/sandbox/test-link', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const rawUrl = String(req.body?.url || '').trim();
      const productId = req.body?.productId ? Number(req.body.productId) : null;

      if (!rawUrl) {
        return res.status(400).json({ error: 'Masukkan URL affiliate untuk diuji di sandbox.' });
      }

      const allowedDomains = await getAllowedAffiliateDomains();
      const isHttp = isValidHttpUrl(rawUrl);
      const domainCheck = isAllowedAffiliateDomain(rawUrl, allowedDomains);

      let parsedHost = '';
      let parsedProtocol = '';
      let parsedPath = '';
      let queryParams: Record<string, string> = {};

      if (isHttp) {
        const parsed = new URL(rawUrl);
        parsedHost = parsed.hostname;
        parsedProtocol = parsed.protocol.replace(':', '');
        parsedPath = parsed.pathname;
        parsed.searchParams.forEach((v, k) => {
          queryParams[k] = v;
        });
      }

      let productPreview: {
        id: number;
        productName: string;
        productSlug: string;
        isActive: boolean;
        isArchived: boolean;
        currentAffiliateUrl: string;
      } | null = null;

      if (productId && Number.isInteger(productId)) {
        const rows = await db.select().from(products).where(eq(products.id, productId)).limit(1);
        if (rows.length) {
          const p = rows[0];
          productPreview = {
            id: p.id,
            productName: p.productName,
            productSlug: p.productSlug,
            isActive: p.isActive,
            isArchived: p.isArchived,
            currentAffiliateUrl: p.affiliateUrl,
          };
        }
      }

      return res.json({
        validProtocol: isHttp,
        validAllowlist: domainCheck.valid,
        reason: domainCheck.valid ? 'URL lolos verifikasi keamanan & allowlist domain.' : domainCheck.reason,
        allowedDomains,
        parsed: {
          protocol: parsedProtocol,
          host: parsedHost,
          path: parsedPath,
          queryParams,
        },
        productPreview,
        simulatedRedirect: domainCheck.valid && productPreview
          ? `/go/${productPreview.productSlug} → HTTP 302 → ${rawUrl}`
          : null,
      });
    } catch (err) {
      console.error('Sandbox test error:', err);
      return res.status(500).json({ error: 'Gagal memvalidasi URL di sandbox' });
    }
  });

  app.post('/api/admin/products/:id/duplicate', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
      if (!rows.length) return res.status(404).json({ error: 'Produk tidak ditemukan' });
      const orig = rows[0];
      const suffix = Date.now().toString().slice(-4);
      const newSlug = `${orig.productSlug}-copy-${suffix}`.slice(0, 100);

      const [copy] = await db
        .insert(products)
        .values({
          productName: `${orig.productName} (Salinan)`,
          productSlug: newSlug,
          description: orig.description,
          imageUrl: orig.imageUrl,
          price: orig.price,
          categoryId: orig.categoryId,
          affiliateUrl: orig.affiliateUrl,
          label: orig.label,
          isFeatured: false,
          isActive: false,
          isArchived: false,
          sortOrder: orig.sortOrder + 1,
        })
        .returning();

      return res.status(201).json({ product: copy });
    } catch (err) {
      console.error('Duplicate product error:', err);
      return res.status(500).json({ error: 'Gagal menduplikasi produk' });
    }
  });

  app.delete('/api/admin/products/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const [deleted] = await db.delete(products).where(eq(products.id, id)).returning();
      if (!deleted) return res.status(404).json({ error: 'Produk tidak ditemukan' });

      await logAdminAction({
        admin: req.admin,
        action: 'DELETE_PRODUCT',
        entityType: 'product',
        entityId: id,
        details: { productName: deleted.productName },
      });

      return res.json({ deleted: true });
    } catch (err) {
      console.error('Delete product error:', err);
      return res.status(500).json({ error: 'Gagal menghapus produk' });
    }
  });

  app.post('/api/admin/products/bulk', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { ids, action, categoryId, label } = req.body || {};
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Pilih minimal satu produk' });
      }
      const cleanIds = ids.map(Number).filter((n) => Number.isInteger(n) && n > 0);
      if (!cleanIds.length) {
        return res.status(400).json({ error: 'ID produk tidak valid' });
      }

      if (action === 'activate') {
        await db
          .update(products)
          .set({ isActive: true, isArchived: false, updatedAt: new Date() })
          .where(inArray(products.id, cleanIds));
      } else if (action === 'deactivate') {
        await db
          .update(products)
          .set({ isActive: false, updatedAt: new Date() })
          .where(inArray(products.id, cleanIds));
      } else if (action === 'archive') {
        await db
          .update(products)
          .set({ isArchived: true, isActive: false, updatedAt: new Date() })
          .where(inArray(products.id, cleanIds));
      } else if (action === 'unarchive') {
        await db
          .update(products)
          .set({ isArchived: false, updatedAt: new Date() })
          .where(inArray(products.id, cleanIds));
      } else if (action === 'delete') {
        await db.delete(products).where(inArray(products.id, cleanIds));
      } else if (action === 'edit') {
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (categoryId !== undefined) updates.categoryId = categoryId ? Number(categoryId) : null;
        if (label !== undefined) updates.label = String(label);
        await db.update(products).set(updates).where(inArray(products.id, cleanIds));
      } else {
        return res.status(400).json({ error: 'Aksi massal tidak dikenali' });
      }

      await logAdminAction({
        admin: req.admin,
        action: `BULK_${String(action).toUpperCase()}`,
        entityType: 'product',
        details: { count: cleanIds.length, ids: cleanIds },
      });

      return res.json({ success: true, count: cleanIds.length });
    } catch (err) {
      console.error('Bulk product error:', err);
      return res.status(500).json({ error: 'Gagal memproses aksi massal' });
    }
  });

  // ==========================================
  // ADMIN CATEGORIES CRUD
  // ==========================================
  app.get('/api/admin/categories', requireAdmin, async (_req: AuthRequest, res: Response) => {
    await ensureInitialData();
    const rows = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        description: categories.description,
        imageUrl: categories.imageUrl,
        icon: categories.icon,
        sortOrder: categories.sortOrder,
        isActive: categories.isActive,
        createdAt: categories.createdAt,
        productCount: sql<number>`count(${products.id})::int`,
      })
      .from(categories)
      .leftJoin(products, eq(products.categoryId, categories.id))
      .groupBy(categories.id)
      .orderBy(asc(categories.sortOrder), asc(categories.name));

    return res.json({ items: rows });
  });

  app.post('/api/admin/categories', requireAdmin, async (req: AuthRequest, res: Response) => {
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data kategori tidak valid' });
    }
    const data = parsed.data;
    const slug = toSlug(data.slug || data.name);
    if (!slug) return res.status(400).json({ error: 'Slug kategori tidak valid' });

    const existing = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
    if (existing.length) return res.status(409).json({ error: `Slug "${slug}" sudah digunakan.` });

    const [created] = await db
      .insert(categories)
      .values({ ...data, slug })
      .returning();
    return res.status(201).json({ category: created });
  });

  app.put('/api/admin/categories/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const parsed = categorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data kategori tidak valid' });
    }
    const data = parsed.data;
    const slug = toSlug(data.slug || data.name);
    const dup = await db
      .select()
      .from(categories)
      .where(and(eq(categories.slug, slug), sql`${categories.id} != ${id}`))
      .limit(1);
    if (dup.length) return res.status(409).json({ error: `Slug "${slug}" sudah digunakan.` });

    const [updated] = await db
      .update(categories)
      .set({ ...data, slug, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Kategori tidak ditemukan' });
    return res.json({ category: updated });
  });

  app.delete('/api/admin/categories/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const force = req.query.force === 'true';
    const [{ linkedCount }] = await db
      .select({ linkedCount: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.categoryId, id));

    if (linkedCount > 0 && !force) {
      return res.status(409).json({
        error: `Kategori ini masih digunakan oleh ${linkedCount} produk. Konfirmasi untuk melepas kategori dari produk tersebut atau pindahkan produk terlebih dahulu.`,
        linkedCount,
      });
    }

    const [deleted] = await db.delete(categories).where(eq(categories.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: 'Kategori tidak ditemukan' });
    return res.json({ deleted: true });
  });

  // ==========================================
  // ADMIN LINKS CRUD
  // ==========================================
  app.get('/api/admin/links', requireAdmin, async (_req: AuthRequest, res: Response) => {
    await ensureInitialData();
    const rows = await db
      .select({
        id: links.id,
        title: links.title,
        slug: links.slug,
        url: links.url,
        description: links.description,
        icon: links.icon,
        sortOrder: links.sortOrder,
        isActive: links.isActive,
        createdAt: links.createdAt,
        clicks: sql<number>`count(${clickEvents.id})::int`,
      })
      .from(links)
      .leftJoin(
        clickEvents,
        and(eq(clickEvents.linkId, links.id), eq(clickEvents.targetType, 'link'))
      )
      .groupBy(links.id)
      .orderBy(asc(links.sortOrder), asc(links.id));

    return res.json({ items: rows });
  });

  app.post('/api/admin/links', requireAdmin, async (req: AuthRequest, res: Response) => {
    const parsed = linkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data tautan tidak valid' });
    }
    const data = parsed.data;
    if (!isValidHttpUrl(data.url)) {
      return res.status(400).json({ error: 'URL harus diawali http:// atau https://' });
    }
    const slug = toSlug(data.slug || data.title);
    const existing = await db.select().from(links).where(eq(links.slug, slug)).limit(1);
    if (existing.length) return res.status(409).json({ error: `Slug "${slug}" sudah digunakan.` });

    const [created] = await db.insert(links).values({ ...data, slug }).returning();
    return res.status(201).json({ link: created });
  });

  app.put('/api/admin/links/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const parsed = linkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data tautan tidak valid' });
    }
    const data = parsed.data;
    if (!isValidHttpUrl(data.url)) {
      return res.status(400).json({ error: 'URL harus diawali http:// atau https://' });
    }
    const slug = toSlug(data.slug || data.title);
    const dup = await db
      .select()
      .from(links)
      .where(and(eq(links.slug, slug), sql`${links.id} != ${id}`))
      .limit(1);
    if (dup.length) return res.status(409).json({ error: `Slug "${slug}" sudah digunakan.` });

    const [updated] = await db
      .update(links)
      .set({ ...data, slug, updatedAt: new Date() })
      .where(eq(links.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Tautan tidak ditemukan' });
    return res.json({ link: updated });
  });

  app.delete('/api/admin/links/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(links).where(eq(links.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: 'Tautan tidak ditemukan' });
    return res.json({ deleted: true });
  });

  // ==========================================
  // ADMIN BANNERS CRUD
  // ==========================================
  app.get('/api/admin/banners', requireAdmin, async (_req: AuthRequest, res: Response) => {
    await ensureInitialData();
    const rows = await db
      .select()
      .from(banners)
      .orderBy(asc(banners.sortOrder), desc(banners.createdAt));
    return res.json({ items: rows });
  });

  app.post('/api/admin/banners', requireAdmin, async (req: AuthRequest, res: Response) => {
    const parsed = bannerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data banner tidak valid' });
    }
    const d = parsed.data;
    if (d.targetUrl && !d.targetUrl.startsWith('#') && !d.targetUrl.startsWith('/') && !isValidHttpUrl(d.targetUrl)) {
      return res.status(400).json({ error: 'Target URL banner tidak valid' });
    }
    const [created] = await db
      .insert(banners)
      .values({
        title: d.title,
        description: d.description,
        imageUrl: d.imageUrl,
        targetUrl: d.targetUrl,
        sortOrder: d.sortOrder,
        isActive: d.isActive,
        startsAt: d.startsAt ? new Date(d.startsAt) : null,
        endsAt: d.endsAt ? new Date(d.endsAt) : null,
      })
      .returning();
    return res.status(201).json({ banner: created });
  });

  app.put('/api/admin/banners/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const parsed = bannerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data banner tidak valid' });
    }
    const d = parsed.data;
    const [updated] = await db
      .update(banners)
      .set({
        title: d.title,
        description: d.description,
        imageUrl: d.imageUrl,
        targetUrl: d.targetUrl,
        sortOrder: d.sortOrder,
        isActive: d.isActive,
        startsAt: d.startsAt ? new Date(d.startsAt) : null,
        endsAt: d.endsAt ? new Date(d.endsAt) : null,
        updatedAt: new Date(),
      })
      .where(eq(banners.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Banner tidak ditemukan' });
    return res.json({ banner: updated });
  });

  app.delete('/api/admin/banners/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(banners).where(eq(banners.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: 'Banner tidak ditemukan' });
    return res.json({ deleted: true });
  });

  // ==========================================
  // PROFILE, SETTINGS & ADMIN ACCOUNTS
  // ==========================================
  app.get('/api/admin/profile', requireAdmin, async (_req: AuthRequest, res: Response) => {
    await ensureInitialData();
    const [profile] = await db.select().from(profiles).limit(1);
    return res.json({ profile });
  });

  app.put('/api/admin/profile', requireAdmin, async (req: AuthRequest, res: Response) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data profil tidak valid' });
    }
    const d = parsed.data;
    const [existing] = await db.select().from(profiles).limit(1);
    let saved;
    if (existing) {
      [saved] = await db
        .update(profiles)
        .set({ ...d, updatedAt: new Date() })
        .where(eq(profiles.id, existing.id))
        .returning();
    } else {
      [saved] = await db.insert(profiles).values(d).returning();
    }
    await logAdminAction({
      admin: req.admin,
      action: 'UPDATE_PROFILE',
      entityType: 'profile',
      entityId: saved.id,
    });
    return res.json({ profile: saved });
  });

  app.get('/api/admin/settings', requireAdmin, async (_req: AuthRequest, res: Response) => {
    await ensureInitialData();
    const rows = await db.select().from(settings).orderBy(asc(settings.settingKey));
    const map = Object.fromEntries(rows.map((r) => [r.settingKey, r.settingValue]));
    return res.json({ settings: map });
  });

  app.put('/api/admin/settings', requireAdmin, async (req: AuthRequest, res: Response) => {
    const payload = req.body?.settings;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Format pengaturan tidak valid' });
    }

    const allowedKeys = [
      'allowed_affiliate_domains',
      'import_max_rows',
      'analytics_retention_days',
      'privacy_notice_enabled',
      'privacy_notice_text',
      'timezone',
    ];

    for (const [key, val] of Object.entries(payload)) {
      if (!allowedKeys.includes(key)) continue;
      await db
        .insert(settings)
        .values({
          settingKey: key,
          settingValue: String(val ?? ''),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: settings.settingKey,
          set: { settingValue: String(val ?? ''), updatedAt: new Date() },
        });
    }

    await logAdminAction({
      admin: req.admin,
      action: 'UPDATE_SETTINGS',
      entityType: 'settings',
    });

    const rows = await db.select().from(settings);
    return res.json({ settings: Object.fromEntries(rows.map((r) => [r.settingKey, r.settingValue])) });
  });

  app.get('/api/admin/accounts', requireAdmin, async (_req: AuthRequest, res: Response) => {
    const rows = await db.select().from(admins).orderBy(asc(admins.id));
    const logs = await db
      .select()
      .from(adminAuditLogs)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(20);
    return res.json({ accounts: rows, auditLogs: logs });
  });

  app.post(
    '/api/admin/accounts',
    requireAdmin,
    requireSuperAdmin,
    async (req: AuthRequest, res: Response) => {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const displayName = String(req.body?.displayName || '').trim() || 'Admin';
      const role = ['super_admin', 'admin', 'editor'].includes(req.body?.role)
        ? req.body.role
        : 'admin';

      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Email admin tidak valid' });
      }

      const [created] = await db
        .insert(admins)
        .values({ email, displayName, role, isActive: true })
        .onConflictDoUpdate({
          target: admins.email,
          set: { displayName, role, isActive: true, updatedAt: new Date() },
        })
        .returning();

      await logAdminAction({
        admin: req.admin,
        action: 'UPSERT_ADMIN_ACCOUNT',
        entityType: 'admin',
        entityId: created.id,
        details: { email, role },
      });

      return res.status(201).json({ account: created });
    }
  );

  app.delete(
    '/api/admin/accounts/:id',
    requireAdmin,
    requireSuperAdmin,
    async (req: AuthRequest, res: Response) => {
      const id = Number(req.params.id);
      if (req.admin && req.admin.id === id) {
        return res.status(400).json({ error: 'Tidak dapat menghapus akun yang sedang aktif digunakan.' });
      }
      await db.delete(admins).where(eq(admins.id, id));
      return res.json({ deleted: true });
    }
  );

  // ==========================================
  // SECURE IMAGE UPLOAD (WITH MAGIC-BYTE CHECK)
  // ==========================================
  app.post(
    '/api/admin/upload',
    requireAdmin,
    adminWriteLimiter,
    imageUpload.single('file'),
    async (req: AuthRequest, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'File gambar wajib diunggah' });
        }

        // Validate actual binary magic bytes (never trust file extension or client MIME alone)
        const detectedMime = detectImageMagicMime(req.file.buffer);
        if (!detectedMime) {
          return res.status(400).json({
            error: 'File ditolak: Hanya gambar JPEG, PNG, WEBP, atau GIF asli yang diperbolehkan.',
          });
        }

        const folder = String(req.body?.folder || 'general').replace(/[^a-z0-9_-]/gi, '');
        const safeFilename = `${folder}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const [asset] = await db
          .insert(uploadedAssets)
          .values({
            filename: safeFilename,
            mimeType: detectedMime,
            sizeBytes: req.file.size,
            dataBase64: req.file.buffer.toString('base64'),
            folder,
            uploadedByAdminId: req.admin?.id ?? null,
          })
          .returning({ id: uploadedAssets.id });

        // Clean up previous uploaded asset if replaced and not referenced anywhere else
        const replaceUrl = typeof req.body?.replaceUrl === 'string' ? req.body.replaceUrl : '';
        const match = replaceUrl.match(/^\/api\/assets\/(\d+)$/);
        if (match) {
          const oldId = Number(match[1]);
          if (oldId && oldId !== asset.id) {
            await db.delete(uploadedAssets).where(eq(uploadedAssets.id, oldId)).catch(() => {});
          }
        }

        return res.status(201).json({
          url: `/api/assets/${asset.id}`,
          id: asset.id,
          mimeType: detectedMime,
          sizeBytes: req.file.size,
        });
      } catch (err) {
        console.error('Image upload error:', err);
        return res.status(500).json({ error: 'Gagal mengunggah gambar' });
      }
    }
  );

  // ==========================================
  // MASS SPREADSHEET IMPORT (XLSX / XLS / CSV)
  // ==========================================
  app.get('/api/admin/import/template', requireAdmin, (_req: AuthRequest, res: Response) => {
    const buffer = buildTemplateWorkbookBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="by-adisss-import-template.xlsx"');
    return res.send(buffer);
  });

  app.post(
    '/api/admin/import/preview',
    requireAdmin,
    adminWriteLimiter,
    spreadsheetUpload.single('file'),
    async (req: AuthRequest, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'Silakan pilih file .xlsx, .xls, atau .csv' });
        }
        const preview = await parseAndValidateSpreadsheet(req.file.buffer, req.file.originalname);
        return res.json(preview);
      } catch (err: any) {
        return res.status(400).json({
          error: err?.message || 'Gagal membaca file spreadsheet',
        });
      }
    }
  );

  app.post(
    '/api/admin/import/google-sheet',
    requireAdmin,
    adminWriteLimiter,
    async (req: AuthRequest, res: Response) => {
      try {
        const url = String(req.body?.url || '').trim();
        if (!url) {
          return res.status(400).json({ error: 'Masukkan URL Google Sheet terlebih dahulu.' });
        }
        const preview = await fetchAndPreviewGoogleSheet(url);
        return res.json(preview);
      } catch (err: any) {
        return res.status(400).json({
          error: err?.message || 'Gagal membaca Google Sheet',
        });
      }
    }
  );

  app.post(
    '/api/admin/import/execute',
    requireAdmin,
    adminWriteLimiter,
    async (req: AuthRequest, res: Response) => {
      try {
        const { filename, duplicateMode, rows } = req.body || {};
        if (!Array.isArray(rows) || rows.length === 0) {
          return res.status(400).json({ error: 'Tidak ada baris data untuk diimport' });
        }

        const mode: DuplicateMode = ['skip', 'update', 'new_only'].includes(duplicateMode)
          ? duplicateMode
          : 'skip';

        // Re-filter rows if duplicateMode is new_only
        const rowsToProcess: ParsedImportRow[] =
          mode === 'new_only'
            ? rows.map((r: ParsedImportRow) => ({ ...r }))
            : rows;

        const result = await executeBatchImport({
          adminId: req.admin!.id,
          adminEmail: req.admin!.email,
          filename: String(filename || 'import-spreadsheet.xlsx'),
          duplicateMode: mode,
          rows: rowsToProcess,
        });

        await logAdminAction({
          admin: req.admin,
          action: 'IMPORT_PRODUCTS',
          entityType: 'import_job',
          entityId: result.job.id,
          details: {
            filename: result.job.filename,
            total: result.job.totalRows,
            success: result.job.successRows,
            updated: result.job.updatedRows,
            skipped: result.job.skippedRows,
            failed: result.job.failedRows,
          },
        });

        return res.json(result);
      } catch (err) {
        console.error('Import execute error:', err);
        return res.status(500).json({ error: 'Gagal memproses import produk' });
      }
    }
  );

  app.get('/api/admin/import/history', requireAdmin, async (_req: AuthRequest, res: Response) => {
    const jobs = await db
      .select()
      .from(affiliateImportJobs)
      .orderBy(desc(affiliateImportJobs.createdAt))
      .limit(50);

    return res.json({ items: jobs });
  });

  app.get(
    '/api/admin/import/history/:id/errors.csv',
    requireAdmin,
    async (req: AuthRequest, res: Response) => {
      const id = Number(req.params.id);
      const rows = await db
        .select()
        .from(affiliateImportErrors)
        .where(eq(affiliateImportErrors.importJobId, id))
        .orderBy(asc(affiliateImportErrors.rowNumber));

      const headers = ['row_number', 'error_message', 'product_name', 'product_slug', 'affiliate_url'];
      const csvRows = rows.map((r) => {
        const raw = (r.rowData || {}) as Record<string, unknown>;
        return [
          r.rowNumber,
          r.errorMessage,
          raw.productName ?? '',
          raw.productSlug ?? '',
          raw.affiliateUrl ?? '',
        ];
      });

      const csv = toCsvString(headers, csvRows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="import-errors-job-${id}.csv"`
      );
      return res.send(csv);
    }
  );

  // ==========================================
  // CSV EXPORTS (FORMULA-INJECTION SAFE)
  // ==========================================
  app.get('/api/admin/export/:type', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const type = String(req.params.type);
      const preset = (String(req.query.preset || '30d') as DateRangePreset) || '30d';
      const customStart = typeof req.query.start === 'string' ? req.query.start : undefined;
      const customEnd = typeof req.query.end === 'string' ? req.query.end : undefined;
      const { start, end } = resolveJakartaDateRange(preset, customStart, customEnd);

      let csv = '';
      let filename = `by-adisss-${type}.csv`;

      if (type === 'products') {
        const rows = await db
          .select({
            id: products.id,
            productName: products.productName,
            productSlug: products.productSlug,
            category: categories.name,
            price: products.price,
            affiliateUrl: products.affiliateUrl,
            label: products.label,
            isFeatured: products.isFeatured,
            isActive: products.isActive,
            isArchived: products.isArchived,
            sortOrder: products.sortOrder,
          })
          .from(products)
          .leftJoin(categories, eq(products.categoryId, categories.id))
          .orderBy(asc(products.sortOrder), asc(products.id));

        csv = toCsvString(
          [
            'ID',
            'Product Name',
            'Product Slug',
            'Category',
            'Price',
            'Affiliate URL',
            'Label',
            'Featured',
            'Active',
            'Archived',
            'Sort Order',
          ],
          rows.map((r) => [
            r.id,
            r.productName,
            r.productSlug,
            r.category || '',
            r.price || '',
            r.affiliateUrl,
            r.label || '',
            r.isFeatured ? 'TRUE' : 'FALSE',
            r.isActive ? 'active' : 'inactive',
            r.isArchived ? 'TRUE' : 'FALSE',
            r.sortOrder,
          ])
        );
      } else if (type === 'page_views') {
        const rows = await db
          .select({
            id: pageViews.id,
            pageUrl: pageViews.pageUrl,
            viewedAt: pageViews.viewedAt,
            referrer: pageViews.referrer,
            utmSource: pageViews.utmSource,
            utmMedium: pageViews.utmMedium,
            utmCampaign: pageViews.utmCampaign,
            deviceType: pageViews.deviceType,
          })
          .from(pageViews)
          .where(and(gte(pageViews.viewedAt, start), lte(pageViews.viewedAt, end)))
          .orderBy(desc(pageViews.viewedAt))
          .limit(5000);

        csv = toCsvString(
          ['ID', 'Page URL', 'Viewed At (UTC)', 'Referrer', 'UTM Source', 'UTM Medium', 'UTM Campaign', 'Device'],
          rows.map((r) => [
            r.id,
            r.pageUrl,
            r.viewedAt.toISOString(),
            r.referrer,
            r.utmSource,
            r.utmMedium,
            r.utmCampaign,
            r.deviceType,
          ])
        );
      } else if (type === 'product_clicks') {
        const rows = await db
          .select({
            id: clickEvents.id,
            productName: products.productName,
            productSlug: products.productSlug,
            clickedAt: clickEvents.clickedAt,
            referrer: clickEvents.referrer,
            utmSource: clickEvents.utmSource,
            utmCampaign: clickEvents.utmCampaign,
            deviceType: clickEvents.deviceType,
          })
          .from(clickEvents)
          .leftJoin(products, eq(clickEvents.productId, products.id))
          .where(
            and(
              eq(clickEvents.targetType, 'product'),
              gte(clickEvents.clickedAt, start),
              lte(clickEvents.clickedAt, end)
            )
          )
          .orderBy(desc(clickEvents.clickedAt))
          .limit(5000);

        csv = toCsvString(
          ['Click ID', 'Product Name', 'Product Slug', 'Clicked At (UTC)', 'Referrer', 'UTM Source', 'UTM Campaign', 'Device'],
          rows.map((r) => [
            r.id,
            r.productName || '',
            r.productSlug || '',
            r.clickedAt.toISOString(),
            r.referrer,
            r.utmSource,
            r.utmCampaign,
            r.deviceType,
          ])
        );
      } else if (type === 'unique_visitors') {
        const rows = await db
          .select({
            visitorId: visitors.id,
            firstSeenAt: visitors.firstSeenAt,
            lastSeenAt: visitors.lastSeenAt,
            pageViewCount: sql<number>`count(${pageViews.id})::int`,
          })
          .from(visitors)
          .leftJoin(pageViews, eq(pageViews.visitorId, visitors.id))
          .where(and(gte(visitors.lastSeenAt, start), lte(visitors.lastSeenAt, end)))
          .groupBy(visitors.id)
          .orderBy(desc(visitors.lastSeenAt))
          .limit(5000);

        csv = toCsvString(
          ['Pseudonymous Visitor ID', 'First Seen (UTC)', 'Last Seen (UTC)', 'Page Views'],
          rows.map((r) => [
            `visitor_${r.visitorId}`,
            r.firstSeenAt.toISOString(),
            r.lastSeenAt.toISOString(),
            r.pageViewCount,
          ])
        );
      } else if (type === 'top_products' || type === 'analytics_daily') {
        const data = await getAnalyticsDashboardData(preset, customStart, customEnd);
        if (type === 'top_products') {
          csv = toCsvString(
            ['Product ID', 'Product Name', 'Slug', 'Total Clicks', 'Unique Clickers'],
            data.topProducts.map((p) => [
              p.productId,
              p.productName,
              p.productSlug,
              p.clicks,
              p.uniqueClickers,
            ])
          );
        } else {
          csv = toCsvString(
            ['Date (Asia/Jakarta)', 'Page Views', 'Unique Visitors', 'Product Clicks', 'CTR (%)'],
            data.dailySeries.map((d) => [
              d.day,
              d.pageViews,
              d.uniqueVisitors,
              d.clicks,
              d.ctr,
            ])
          );
        }
      } else if (type === 'import_history') {
        const jobs = await db
          .select()
          .from(affiliateImportJobs)
          .orderBy(desc(affiliateImportJobs.createdAt));

        csv = toCsvString(
          [
            'Job ID',
            'Filename',
            'Admin Email',
            'Mode',
            'Total Rows',
            'Success',
            'Updated',
            'Skipped',
            'Failed',
            'Status',
            'Created At (UTC)',
          ],
          jobs.map((j) => [
            j.id,
            j.filename,
            j.adminEmail,
            j.duplicateMode,
            j.totalRows,
            j.successRows,
            j.updatedRows,
            j.skippedRows,
            j.failedRows,
            j.importStatus,
            j.createdAt.toISOString(),
          ])
        );
      } else {
        return res.status(400).json({ error: 'Tipe export tidak valid' });
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    } catch (err) {
      console.error('Export CSV error:', err);
      return res.status(500).json({ error: 'Gagal melakukan export CSV' });
    }
  });
}
