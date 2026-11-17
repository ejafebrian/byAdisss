import type { Response } from 'express';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  categories,
  clickEvents,
  links,
  pageViews,
  products,
  sessions,
  visitors,
} from '../db/schema.ts';

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | 'this_month'
  | 'last_month'
  | 'custom';

const BOT_UA_REGEX =
  /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|curl|wget|python-requests|headlesschrome|lighthouse|pingdom|uptime/i;

// Real-time SSE clients subscribed to admin dashboard updates
const sseClients = new Set<Response>();

export function addRealtimeClient(res: Response) {
  sseClients.add(res);
  res.on('close', () => {
    sseClients.delete(res);
  });
}

export function broadcastRealtimeEvent(eventType: string, payload: Record<string, unknown>) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify({
    ...payload,
    timestamp: new Date().toISOString(),
  })}\n\n`;

  for (const client of sseClients) {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  }
}

export function isBotUserAgent(ua: string | undefined): boolean {
  if (!ua || ua.trim().length < 8) return true;
  return BOT_UA_REGEX.test(ua);
}

export function parseUserAgent(uaRaw: string | undefined): {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  browser: string;
  operatingSystem: string;
} {
  const ua = uaRaw || '';
  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  if (/ipad|tablet|playbook|silk/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|ipod|android.*mobile|blackberry|iemobile/i.test(ua)) {
    deviceType = 'mobile';
  }

  let browser = 'Other';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/opr|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';

  let operatingSystem = 'Other';
  if (/windows/i.test(ua)) operatingSystem = 'Windows';
  else if (/iphone|ipad|ipod/i.test(ua)) operatingSystem = 'iOS';
  else if (/mac os x|macintosh/i.test(ua)) operatingSystem = 'macOS';
  else if (/android/i.test(ua)) operatingSystem = 'Android';
  else if (/linux/i.test(ua)) operatingSystem = 'Linux';

  return { deviceType, browser, operatingSystem };
}

export function normalizeReferrer(rawRef: string | undefined): string {
  if (!rawRef || !rawRef.trim()) return 'direct';
  try {
    const parsed = new URL(rawRef);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return rawRef.slice(0, 120);
  }
}

export async function upsertVisitorAndSession(params: {
  visitorKey: string;
  sessionKey: string;
  userAgent?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}) {
  const now = new Date();
  const { deviceType, browser, operatingSystem } = parseUserAgent(params.userAgent);
  const referrer = normalizeReferrer(params.referrer);

  const [visitor] = await db
    .insert(visitors)
    .values({
      visitorKey: params.visitorKey.slice(0, 120),
      firstSeenAt: now,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: visitors.visitorKey,
      set: { lastSeenAt: now },
    })
    .returning();

  const [session] = await db
    .insert(sessions)
    .values({
      visitorId: visitor.id,
      sessionKey: params.sessionKey.slice(0, 120),
      startedAt: now,
      lastSeenAt: now,
      deviceType,
      browser,
      operatingSystem,
      referrer,
      utmSource: (params.utmSource || '').slice(0, 100),
      utmMedium: (params.utmMedium || '').slice(0, 100),
      utmCampaign: (params.utmCampaign || '').slice(0, 100),
    })
    .onConflictDoUpdate({
      target: sessions.sessionKey,
      set: {
        lastSeenAt: now,
        deviceType,
        browser,
        operatingSystem,
      },
    })
    .returning();

  return { visitor, session, deviceType, referrer };
}

export async function recordPageView(params: {
  visitorKey: string;
  sessionKey: string;
  pageUrl: string;
  userAgent?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}) {
  if (isBotUserAgent(params.userAgent)) {
    return { recorded: false, reason: 'bot_filtered' };
  }

  // Exclude admin routes from public page view metrics
  if (params.pageUrl.startsWith('/admin')) {
    return { recorded: false, reason: 'admin_excluded' };
  }

  const { visitor, session, deviceType, referrer } = await upsertVisitorAndSession(params);

  // Deduplicate rapid duplicate reloads on identical page within 5 seconds
  const fiveSecAgo = new Date(Date.now() - 5000);
  const recentDup = await db
    .select({ id: pageViews.id })
    .from(pageViews)
    .where(
      and(
        eq(pageViews.sessionId, session.id),
        eq(pageViews.pageUrl, params.pageUrl.slice(0, 300)),
        gte(pageViews.viewedAt, fiveSecAgo)
      )
    )
    .limit(1);

  if (recentDup.length > 0) {
    return { recorded: false, reason: 'duplicate_throttled' };
  }

  const [pv] = await db
    .insert(pageViews)
    .values({
      visitorId: visitor.id,
      sessionId: session.id,
      pageUrl: params.pageUrl.slice(0, 300),
      viewedAt: new Date(),
      referrer,
      utmSource: (params.utmSource || '').slice(0, 100),
      utmMedium: (params.utmMedium || '').slice(0, 100),
      utmCampaign: (params.utmCampaign || '').slice(0, 100),
      deviceType,
    })
    .returning();

  broadcastRealtimeEvent('pageview', {
    pageUrl: pv.pageUrl,
    deviceType: pv.deviceType,
    referrer: pv.referrer,
  });

  return { recorded: true, pageViewId: pv.id };
}

export async function recordHeartbeat(params: {
  visitorKey: string;
  sessionKey: string;
  userAgent?: string;
}) {
  if (isBotUserAgent(params.userAgent)) return { active: false };
  await upsertVisitorAndSession(params);
  const activeCount = await getActiveVisitorsCount();
  broadcastRealtimeEvent('heartbeat', { activeVisitors: activeCount });
  return { active: true, activeVisitors: activeCount };
}

export async function recordClickEvent(params: {
  productId?: number | null;
  linkId?: number | null;
  targetType: 'product' | 'link';
  targetTitle?: string;
  visitorKey?: string;
  sessionKey?: string;
  userAgent?: string;
  referrer?: string;
  utmSource?: string;
  utmCampaign?: string;
}) {
  let visitorId: number | null = null;
  let sessionId: number | null = null;
  const { deviceType } = parseUserAgent(params.userAgent);
  const referrer = normalizeReferrer(params.referrer);

  if (params.visitorKey && params.sessionKey) {
    const res = await upsertVisitorAndSession({
      visitorKey: params.visitorKey,
      sessionKey: params.sessionKey,
      userAgent: params.userAgent,
      referrer: params.referrer,
      utmSource: params.utmSource,
      utmCampaign: params.utmCampaign,
    });
    visitorId = res.visitor.id;
    sessionId = res.session.id;
  }

  const [evt] = await db
    .insert(clickEvents)
    .values({
      productId: params.productId ?? null,
      linkId: params.linkId ?? null,
      targetType: params.targetType,
      visitorId,
      sessionId,
      clickedAt: new Date(),
      referrer,
      utmSource: (params.utmSource || '').slice(0, 100),
      utmCampaign: (params.utmCampaign || '').slice(0, 100),
      deviceType,
    })
    .returning();

  broadcastRealtimeEvent('click', {
    targetType: params.targetType,
    productId: params.productId ?? null,
    linkId: params.linkId ?? null,
    targetTitle: params.targetTitle || '',
    deviceType,
  });

  return evt;
}

export async function getActiveVisitorsCount(): Promise<number> {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  const result = await db
    .select({
      count: sql<number>`count(distinct ${sessions.visitorId})::int`,
    })
    .from(sessions)
    .where(gte(sessions.lastSeenAt, twoMinutesAgo));
  return result[0]?.count ?? 0;
}

/**
 * Computes UTC start/end bounds matching Asia/Jakarta calendar days.
 */
export function resolveJakartaDateRange(
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string
): { start: Date; end: Date; prevStart: Date; prevEnd: Date; label: string } {
  // Asia/Jakarta is UTC+7 with no DST
  const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
  const nowUtcMs = Date.now();
  const jakartaNow = new Date(nowUtcMs + JAKARTA_OFFSET_MS);

  const jakartaMidnightUtcMs = (year: number, month: number, day: number) =>
    Date.UTC(year, month, day, 0, 0, 0, 0) - JAKARTA_OFFSET_MS;

  const y = jakartaNow.getUTCFullYear();
  const m = jakartaNow.getUTCMonth();
  const d = jakartaNow.getUTCDate();

  let startMs: number;
  let endMs: number;
  let label = 'Last 7 Days';

  switch (preset) {
    case 'today':
      startMs = jakartaMidnightUtcMs(y, m, d);
      endMs = nowUtcMs;
      label = 'Today';
      break;
    case 'yesterday':
      startMs = jakartaMidnightUtcMs(y, m, d - 1);
      endMs = jakartaMidnightUtcMs(y, m, d) - 1;
      label = 'Yesterday';
      break;
    case '30d':
      startMs = jakartaMidnightUtcMs(y, m, d - 29);
      endMs = nowUtcMs;
      label = 'Last 30 Days';
      break;
    case 'this_month':
      startMs = jakartaMidnightUtcMs(y, m, 1);
      endMs = nowUtcMs;
      label = 'This Month';
      break;
    case 'last_month':
      startMs = jakartaMidnightUtcMs(y, m - 1, 1);
      endMs = jakartaMidnightUtcMs(y, m, 1) - 1;
      label = 'Last Month';
      break;
    case 'custom': {
      const parsedStart = customStart ? new Date(`${customStart}T00:00:00+07:00`) : null;
      const parsedEnd = customEnd ? new Date(`${customEnd}T23:59:59.999+07:00`) : null;
      if (
        parsedStart &&
        parsedEnd &&
        !Number.isNaN(parsedStart.getTime()) &&
        !Number.isNaN(parsedEnd.getTime()) &&
        parsedStart <= parsedEnd
      ) {
        startMs = parsedStart.getTime();
        endMs = parsedEnd.getTime();
        label = `${customStart} s/d ${customEnd}`;
      } else {
        startMs = jakartaMidnightUtcMs(y, m, d - 6);
        endMs = nowUtcMs;
        label = 'Last 7 Days';
      }
      break;
    }
    case '7d':
    default:
      startMs = jakartaMidnightUtcMs(y, m, d - 6);
      endMs = nowUtcMs;
      label = 'Last 7 Days';
      break;
  }

  const durationMs = Math.max(1000, endMs - startMs);
  const prevEndMs = startMs - 1;
  const prevStartMs = prevEndMs - durationMs;

  return {
    start: new Date(startMs),
    end: new Date(endMs),
    prevStart: new Date(prevStartMs),
    prevEnd: new Date(prevEndMs),
    label,
  };
}

export async function getAnalyticsDashboardData(
  preset: DateRangePreset = '7d',
  customStart?: string,
  customEnd?: string
) {
  const { start, end, prevStart, prevEnd, label } = resolveJakartaDateRange(
    preset,
    customStart,
    customEnd
  );

  // Current period aggregates
  const [pvSummary] = await db
    .select({
      totalPageViews: sql<number>`count(*)::int`,
      uniqueVisitors: sql<number>`count(distinct ${pageViews.visitorId})::int`,
    })
    .from(pageViews)
    .where(and(gte(pageViews.viewedAt, start), lte(pageViews.viewedAt, end)));

  const [clickSummary] = await db
    .select({
      totalProductClicks: sql<number>`count(*) filter (where ${clickEvents.targetType} = 'product')::int`,
      uniqueClickers: sql<number>`count(distinct ${clickEvents.visitorId}) filter (where ${clickEvents.targetType} = 'product')::int`,
      totalLinkClicks: sql<number>`count(*) filter (where ${clickEvents.targetType} = 'link')::int`,
    })
    .from(clickEvents)
    .where(and(gte(clickEvents.clickedAt, start), lte(clickEvents.clickedAt, end)));

  // Previous period aggregates for change percentage
  const [prevPvSummary] = await db
    .select({
      totalPageViews: sql<number>`count(*)::int`,
      uniqueVisitors: sql<number>`count(distinct ${pageViews.visitorId})::int`,
    })
    .from(pageViews)
    .where(and(gte(pageViews.viewedAt, prevStart), lte(pageViews.viewedAt, prevEnd)));

  const [prevClickSummary] = await db
    .select({
      totalProductClicks: sql<number>`count(*) filter (where ${clickEvents.targetType} = 'product')::int`,
      uniqueClickers: sql<number>`count(distinct ${clickEvents.visitorId}) filter (where ${clickEvents.targetType} = 'product')::int`,
    })
    .from(clickEvents)
    .where(and(gte(clickEvents.clickedAt, prevStart), lte(clickEvents.clickedAt, prevEnd)));

  const activeVisitors = await getActiveVisitorsCount();

  const [activeProductsRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(and(eq(products.isActive, true), eq(products.isArchived, false)));

  const [totalCategoriesRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(categories)
    .where(eq(categories.isActive, true));

  const views = pvSummary?.totalPageViews ?? 0;
  const uniqueVis = pvSummary?.uniqueVisitors ?? 0;
  const clicks = clickSummary?.totalProductClicks ?? 0;
  const uniqueClk = clickSummary?.uniqueClickers ?? 0;
  const ctr = views > 0 ? Number(((clicks / views) * 100).toFixed(2)) : 0;

  const prevViews = prevPvSummary?.totalPageViews ?? 0;
  const prevUniqueVis = prevPvSummary?.uniqueVisitors ?? 0;
  const prevClicks = prevClickSummary?.totalProductClicks ?? 0;
  const prevUniqueClk = prevClickSummary?.uniqueClickers ?? 0;
  const prevCtr = prevViews > 0 ? Number(((prevClicks / prevViews) * 100).toFixed(2)) : 0;

  const calcDelta = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : null;
    return Number((((curr - prev) / prev) * 100).toFixed(1));
  };

  // Daily timeseries in Asia/Jakarta timezone
  const dailyViewsRows = await db
    .select({
      day: sql<string>`to_char(${pageViews.viewedAt} AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')`,
      pageViews: sql<number>`count(*)::int`,
      uniqueVisitors: sql<number>`count(distinct ${pageViews.visitorId})::int`,
    })
    .from(pageViews)
    .where(and(gte(pageViews.viewedAt, start), lte(pageViews.viewedAt, end)))
    .groupBy(sql`to_char(${pageViews.viewedAt} AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${pageViews.viewedAt} AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')`);

  const dailyClicksRows = await db
    .select({
      day: sql<string>`to_char(${clickEvents.clickedAt} AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')`,
      clicks: sql<number>`count(*) filter (where ${clickEvents.targetType} = 'product')::int`,
    })
    .from(clickEvents)
    .where(and(gte(clickEvents.clickedAt, start), lte(clickEvents.clickedAt, end)))
    .groupBy(sql`to_char(${clickEvents.clickedAt} AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${clickEvents.clickedAt} AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')`);

  const dailyMap = new Map<
    string,
    { day: string; pageViews: number; uniqueVisitors: number; clicks: number; ctr: number }
  >();
  for (const row of dailyViewsRows) {
    dailyMap.set(row.day, {
      day: row.day,
      pageViews: row.pageViews,
      uniqueVisitors: row.uniqueVisitors,
      clicks: 0,
      ctr: 0,
    });
  }
  for (const row of dailyClicksRows) {
    const existing = dailyMap.get(row.day) ?? {
      day: row.day,
      pageViews: 0,
      uniqueVisitors: 0,
      clicks: 0,
      ctr: 0,
    };
    existing.clicks = row.clicks;
    dailyMap.set(row.day, existing);
  }
  const dailySeries = Array.from(dailyMap.values())
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({
      ...d,
      ctr: d.pageViews > 0 ? Number(((d.clicks / d.pageViews) * 100).toFixed(2)) : 0,
    }));

  // Top Products
  const topProducts = await db
    .select({
      productId: products.id,
      productName: products.productName,
      productSlug: products.productSlug,
      imageUrl: products.imageUrl,
      clicks: sql<number>`count(${clickEvents.id})::int`,
      uniqueClickers: sql<number>`count(distinct ${clickEvents.visitorId})::int`,
    })
    .from(clickEvents)
    .innerJoin(products, eq(clickEvents.productId, products.id))
    .where(
      and(
        eq(clickEvents.targetType, 'product'),
        gte(clickEvents.clickedAt, start),
        lte(clickEvents.clickedAt, end)
      )
    )
    .groupBy(products.id, products.productName, products.productSlug, products.imageUrl)
    .orderBy(desc(sql`count(${clickEvents.id})`))
    .limit(8);

  // Top Categories
  const topCategories = await db
    .select({
      categoryId: categories.id,
      categoryName: categories.name,
      clicks: sql<number>`count(${clickEvents.id})::int`,
    })
    .from(clickEvents)
    .innerJoin(products, eq(clickEvents.productId, products.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(
      and(
        eq(clickEvents.targetType, 'product'),
        gte(clickEvents.clickedAt, start),
        lte(clickEvents.clickedAt, end)
      )
    )
    .groupBy(categories.id, categories.name)
    .orderBy(desc(sql`count(${clickEvents.id})`))
    .limit(6);

  // Traffic Sources (from pageViews)
  const trafficSources = await db
    .select({
      source: sql<string>`coalesce(nullif(${pageViews.utmSource}, ''), nullif(${pageViews.referrer}, ''), 'direct')`,
      visits: sql<number>`count(*)::int`,
    })
    .from(pageViews)
    .where(and(gte(pageViews.viewedAt, start), lte(pageViews.viewedAt, end)))
    .groupBy(
      sql`coalesce(nullif(${pageViews.utmSource}, ''), nullif(${pageViews.referrer}, ''), 'direct')`
    )
    .orderBy(desc(sql`count(*)`))
    .limit(6);

  // Device Distribution
  const deviceDistribution = await db
    .select({
      deviceType: sql<string>`coalesce(${pageViews.deviceType}, 'desktop')`,
      count: sql<number>`count(*)::int`,
    })
    .from(pageViews)
    .where(and(gte(pageViews.viewedAt, start), lte(pageViews.viewedAt, end)))
    .groupBy(sql`coalesce(${pageViews.deviceType}, 'desktop')`)
    .orderBy(desc(sql`count(*)`));

  // Recent Clicks & Recent PageViews (for live activity panel)
  const recentClicks = await db
    .select({
      id: clickEvents.id,
      targetType: clickEvents.targetType,
      clickedAt: clickEvents.clickedAt,
      deviceType: clickEvents.deviceType,
      referrer: clickEvents.referrer,
      productName: products.productName,
      productSlug: products.productSlug,
      linkTitle: links.title,
    })
    .from(clickEvents)
    .leftJoin(products, eq(clickEvents.productId, products.id))
    .leftJoin(links, eq(clickEvents.linkId, links.id))
    .orderBy(desc(clickEvents.clickedAt))
    .limit(12);

  const recentViews = await db
    .select({
      id: pageViews.id,
      pageUrl: pageViews.pageUrl,
      viewedAt: pageViews.viewedAt,
      deviceType: pageViews.deviceType,
      referrer: pageViews.referrer,
    })
    .from(pageViews)
    .orderBy(desc(pageViews.viewedAt))
    .limit(10);

  return {
    range: {
      preset,
      label,
      start: start.toISOString(),
      end: end.toISOString(),
      timezone: 'Asia/Jakarta',
    },
    kpis: {
      totalPageViews: views,
      totalPageViewsDelta: calcDelta(views, prevViews),
      uniqueVisitors: uniqueVis,
      uniqueVisitorsDelta: calcDelta(uniqueVis, prevUniqueVis),
      totalProductClicks: clicks,
      totalProductClicksDelta: calcDelta(clicks, prevClicks),
      uniqueClickers: uniqueClk,
      uniqueClickersDelta: calcDelta(uniqueClk, prevUniqueClk),
      averageCtr: ctr,
      averageCtrDelta: prevViews > 0 ? Number((ctr - prevCtr).toFixed(2)) : null,
      activeVisitors,
      totalActiveProducts: activeProductsRes?.count ?? 0,
      totalCategories: totalCategoriesRes?.count ?? 0,
      totalLinkClicks: clickSummary?.totalLinkClicks ?? 0,
    },
    dailySeries,
    topProducts,
    topCategories,
    trafficSources,
    deviceDistribution,
    recentClicks,
    recentViews,
  };
}
