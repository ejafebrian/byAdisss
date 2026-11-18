import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Calendar,
  Download,
  ExternalLink,
  Eye,
  FolderTree,
  MousePointerClick,
  Package,
  Percent,
  Users,
} from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { formatJakartaDateTime } from '../../lib/types';
import { AdminLayout } from './AdminLayout';

interface OverviewResponse {
  range: {
    preset: string;
    label: string;
    start: string;
    end: string;
    timezone: string;
  };
  kpis: {
    totalPageViews: number;
    totalPageViewsDelta: number | null;
    uniqueVisitors: number;
    uniqueVisitorsDelta: number | null;
    totalProductClicks: number;
    totalProductClicksDelta: number | null;
    uniqueClickers: number;
    uniqueClickersDelta: number | null;
    averageCtr: number;
    averageCtrDelta: number | null;
    activeVisitors: number;
    totalActiveProducts: number;
    totalCategories: number;
    totalLinkClicks: number;
  };
  dailySeries: {
    day: string;
    pageViews: number;
    uniqueVisitors: number;
    clicks: number;
    ctr: number;
  }[];
  topProducts: {
    productId: number;
    productName: string;
    productSlug: string;
    imageUrl: string;
    clicks: number;
    uniqueClickers: number;
  }[];
  topCategories: {
    categoryId: number;
    categoryName: string;
    clicks: number;
  }[];
  trafficSources: {
    source: string;
    visits: number;
  }[];
  deviceDistribution: {
    deviceType: string;
    count: number;
  }[];
  recentClicks: {
    id: number;
    targetType: string;
    clickedAt: string;
    deviceType: string;
    referrer: string;
    productName: string | null;
    productSlug: string | null;
    linkTitle: string | null;
  }[];
  recentViews: {
    id: number;
    pageUrl: string;
    viewedAt: string;
    deviceType: string;
    referrer: string;
  }[];
}

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'custom', label: 'Custom Range' },
];

export function AdminDashboardPage({ isAnalyticsView = false }: { isAnalyticsView?: boolean }) {
  const { admin, authFetch, getToken } = useAuth();
  const [preset, setPreset] = useState<string>('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(false);

  const loadData = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams({ preset });
    if (preset === 'custom' && customStart && customEnd) {
      params.set('start', customStart);
      params.set('end', customEnd);
    }
    try {
      const res = await authFetch(`/api/admin/overview?${params.toString()}`);
      if (!res.ok) throw new Error('Gagal memuat data analitik');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan saat memuat statistik');
    } finally {
      setLoading(false);
    }
  }, [authFetch, preset, customStart, customEnd]);

  useEffect(() => {
    if (!admin) return;
    if (preset === 'custom' && (!customStart || !customEnd)) return;
    loadData();
  }, [admin, loadData, preset, customStart, customEnd]);

  // Real-time SSE stream subscription via fetch ReadableStream with Bearer header
  useEffect(() => {
    if (!admin) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function connectSse() {
      try {
        const token = await getToken();
        if (!token) return;
        const response = await fetch('/api/admin/realtime', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) return;
        setSseConnected(true);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() || '';
          for (const chunk of chunks) {
            if (chunk.includes('event: click') || chunk.includes('event: pageview')) {
              loadData();
            } else if (chunk.includes('event: heartbeat')) {
              const dataLine = chunk.split('\n').find((l) => l.startsWith('data:'));
              if (dataLine) {
                try {
                  const parsed = JSON.parse(dataLine.replace(/^data:\s*/, ''));
                  setData((prev) =>
                    prev
                      ? {
                          ...prev,
                          kpis: { ...prev.kpis, activeVisitors: parsed.activeVisitors ?? prev.kpis.activeVisitors },
                        }
                      : prev
                  );
                } catch {
                  // ignore
                }
              }
            }
          }
        }
      } catch {
        setSseConnected(false);
        if (!controller.signal.aborted) {
          timer = setTimeout(connectSse, 8000);
        }
      }
    }

    connectSse();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [admin, getToken, loadData]);

  const handleExport = async (type: string) => {
    const params = new URLSearchParams({ preset });
    if (preset === 'custom' && customStart && customEnd) {
      params.set('start', customStart);
      params.set('end', customEnd);
    }
    const res = await authFetch(`/api/admin/export/${type}?${params.toString()}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `by-adisss-${type}-${preset}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const kpis = data?.kpis;
  const maxDailyVal = Math.max(
    1,
    ...(data?.dailySeries || []).map((d) => Math.max(d.pageViews, d.clicks))
  );

  return (
    <AdminLayout
      title={isAnalyticsView ? 'Analytics & Traffic' : 'Dashboard Overview'}
      subtitle="Statistik aktual pengunjung, klik affiliate, dan aktivitas real-time (Zona Waktu: Asia/Jakarta)"
      actions={
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-[#7D4E5D] px-2.5 py-1 rounded-lg bg-[#FFF6F8] border border-[#F0C6D2]">
            <span
              className={`w-2 h-2 rounded-full ${
                sseConnected ? 'bg-emerald-600' : 'bg-[#F0C6D2]'
              }`}
            />
            <span>{sseConnected ? 'Realtime terhubung' : 'Sinkronisasi'}</span>
          </span>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Filter & Export Bar */}
        <section className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-3.5 sm:p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <Calendar className="w-4 h-4 text-[#C25B7C] mr-1 shrink-0" />
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={`min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  preset === p.id
                    ? 'bg-[#C25B7C] text-[#FFFFFF]'
                    : 'bg-[#FFF6F8] text-[#7D4E5D] hover:text-[#3F232C] border border-[#F0C6D2]/70'
                }`}
              >
                {p.label}
              </button>
            ))}

            {preset === 'custom' && (
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto pt-1 sm:pt-0 sm:ml-1">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="flex-1 sm:flex-none min-h-[38px] px-2.5 py-1.5 rounded-lg border border-[#F0C6D2] bg-[#FFF6F8] text-xs"
                />
                <span className="text-xs text-[#7D4E5D]">s/d</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="flex-1 sm:flex-none min-h-[38px] px-2.5 py-1.5 rounded-lg border border-[#F0C6D2] bg-[#FFF6F8] text-xs"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleExport('analytics_daily')}
              className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#F0C6D2] bg-[#FFF6F8] hover:bg-[#FDE8EE]/70 text-[11px] sm:text-xs font-medium text-[#3F232C] whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-[#C25B7C] shrink-0" />
              <span className="truncate">Harian</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('product_clicks')}
              className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#F0C6D2] bg-[#FFF6F8] hover:bg-[#FDE8EE]/70 text-[11px] sm:text-xs font-medium text-[#3F232C] whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-[#C25B7C] shrink-0" />
              <span className="truncate">Klik</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('page_views')}
              className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#F0C6D2] bg-[#FFF6F8] hover:bg-[#FDE8EE]/70 text-[11px] sm:text-xs font-medium text-[#3F232C] whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-[#C25B7C] shrink-0" />
              <span className="truncate">Views</span>
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-[#FFF5F5] p-4 text-sm text-red-900">
            {error}
          </div>
        )}

        {/* KPI Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            {
              label: 'Total Page Views',
              value: kpis?.totalPageViews ?? 0,
              delta: kpis?.totalPageViewsDelta,
              icon: Eye,
              hint: 'Kunjungan halaman publik valid',
            },
            {
              label: 'Unique Visitors',
              value: kpis?.uniqueVisitors ?? 0,
              delta: kpis?.uniqueVisitorsDelta,
              icon: Users,
              hint: 'Estimasi berbasis visitor ID pseudonim',
            },
            {
              label: 'Total Product Clicks',
              value: kpis?.totalProductClicks ?? 0,
              delta: kpis?.totalProductClicksDelta,
              icon: MousePointerClick,
              hint: 'Klik redirect terverifikasi (/go)',
            },
            {
              label: 'Unique Clickers',
              value: kpis?.uniqueClickers ?? 0,
              delta: kpis?.uniqueClickersDelta,
              icon: Users,
              hint: 'Visitor unik pengklik produk',
            },
            {
              label: 'Average CTR',
              value: `${kpis?.averageCtr ?? 0}%`,
              delta: kpis?.averageCtrDelta,
              icon: Percent,
              hint: '(Product Clicks / Page Views) × 100%',
            },
            {
              label: 'Active Visitors',
              value: kpis?.activeVisitors ?? 0,
              delta: null,
              icon: Activity,
              hint: 'Estimasi sesi heartbeat 2 menit terakhir',
            },
            {
              label: 'Active Products',
              value: kpis?.totalActiveProducts ?? 0,
              delta: null,
              icon: Package,
              hint: 'Produk aktif di katalog publik',
            },
            {
              label: 'Active Categories',
              value: kpis?.totalCategories ?? 0,
              delta: null,
              icon: FolderTree,
              hint: 'Kategori aktif di halaman depan',
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-3.5 sm:p-4 flex flex-col justify-between min-w-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] sm:text-xs font-medium text-[#7D4E5D] truncate">{card.label}</span>
                  <Icon className="w-4 h-4 text-[#C25B7C] shrink-0" />
                </div>

                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <div className="text-xl sm:text-2xl font-semibold text-[#3F232C] tabular-nums truncate">
                    {loading ? '—' : card.value}
                  </div>
                  {card.delta !== null && card.delta !== undefined && (
                    <span
                      className={`text-[11px] font-medium tabular-nums shrink-0 ${
                        card.delta >= 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {card.delta >= 0 ? `+${card.delta}%` : `${card.delta}%`}
                    </span>
                  )}
                </div>

                <div className="mt-1.5 text-[10px] sm:text-[11px] text-[#7D4E5D]/85 leading-snug">{card.hint}</div>
              </div>
            );
          })}
        </section>

        {/* Daily Trend Chart & Live Activity */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Chart */}
          <div className="lg:col-span-2 rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-4 sm:p-5 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div className="min-w-0">
                <h2 className="font-serif-display text-base sm:text-lg font-semibold text-[#3F232C]">
                  Performa Harian (Views & Clicks)
                </h2>
                <p className="text-xs text-[#7D4E5D]">
                  Pengelompokan tanggal berdasarkan Asia/Jakarta ({data?.range.label || 'Last 7 Days'})
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs shrink-0">
                <span className="flex items-center gap-1.5 text-[#7D4E5D]">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#F0C6D2]" />
                  Page Views
                </span>
                <span className="flex items-center gap-1.5 text-[#3F232C]">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#C25B7C]" />
                  Clicks
                </span>
              </div>
            </div>

            {!data || data.dailySeries.length === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center rounded-xl bg-[#FFF6F8] border border-dashed border-[#F0C6D2] text-center p-6">
                <BarChart3 className="w-7 h-7 text-[#C25B7C]/50 mb-2" />
                <p className="text-sm font-medium text-[#3F232C]">Belum ada data trafik pada periode ini</p>
                <p className="text-xs text-[#7D4E5D] mt-1">
                  Statistik akan muncul otomatis ketika pengunjung membuka katalog atau mengklik produk.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="h-56 flex items-end gap-2 pt-4 pb-2 border-b border-[#F0C6D2]/70 overflow-x-auto">
                  {data.dailySeries.map((row) => {
                    const viewPct = Math.max(4, Math.round((row.pageViews / maxDailyVal) * 100));
                    const clickPct = Math.max(
                      row.clicks > 0 ? 4 : 0,
                      Math.round((row.clicks / maxDailyVal) * 100)
                    );
                    return (
                      <div
                        key={row.day}
                        className="flex-1 min-w-[44px] h-full flex flex-col justify-end items-center group"
                      >
                        <div className="w-full flex items-end justify-center gap-1 h-44">
                          <div
                            title={`${row.day}: ${row.pageViews} views, ${row.uniqueVisitors} unique`}
                            style={{ height: `${viewPct}%` }}
                            className="w-3.5 rounded-t-md bg-[#F0C6D2] transition-all"
                          />
                          <div
                            title={`${row.day}: ${row.clicks} clicks (CTR ${row.ctr}%)`}
                            style={{ height: `${clickPct}%` }}
                            className="w-3.5 rounded-t-md bg-[#C25B7C] transition-all"
                          />
                        </div>
                        <div className="mt-2 text-[10px] font-mono-tabular text-[#7D4E5D]">
                          {row.day.slice(5)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Compact Daily Table */}
                <div className="overflow-x-auto -mx-1 px-1">
                  <table className="w-full min-w-[420px] text-xs">
                    <thead>
                      <tr className="text-left text-[#7D4E5D] border-b border-[#F0C6D2]/60">
                        <th className="py-2 pr-2 font-medium">Tanggal</th>
                        <th className="py-2 px-2 font-medium text-right">Page Views</th>
                        <th className="py-2 px-2 font-medium text-right">Unique Visitors</th>
                        <th className="py-2 px-2 font-medium text-right">Clicks</th>
                        <th className="py-2 pl-2 font-medium text-right">CTR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0C6D2]/40 tabular-nums">
                      {data.dailySeries.map((d) => (
                        <tr key={d.day}>
                          <td className="py-2 pr-2 font-mono-tabular whitespace-nowrap">{d.day}</td>
                          <td className="py-2 px-2 text-right">{d.pageViews}</td>
                          <td className="py-2 px-2 text-right">{d.uniqueVisitors}</td>
                          <td className="py-2 px-2 text-right font-medium text-[#3F232C]">{d.clicks}</td>
                          <td className="py-2 pl-2 text-right">{d.ctr}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Live Activity Feed */}
          <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-4 sm:p-5 flex flex-col min-w-0">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="min-w-0">
                <h2 className="font-serif-display text-base sm:text-lg font-semibold text-[#3F232C] truncate">
                  Aktivitas Terbaru
                </h2>
                <p className="text-xs text-[#7D4E5D] truncate">Pembaruan klik & kunjungan real-time</p>
              </div>
              <span className="text-xs font-semibold text-[#C25B7C] tabular-nums shrink-0">
                {kpis?.activeVisitors ?? 0} aktif
              </span>
            </div>

            {!data || (data.recentClicks.length === 0 && data.recentViews.length === 0) ? (
              <div className="flex-1 flex flex-col items-center justify-center rounded-xl bg-[#FFF6F8] border border-dashed border-[#F0C6D2] p-6 text-center">
                <Activity className="w-6 h-6 text-[#C25B7C]/50 mb-2" />
                <p className="text-xs text-[#7D4E5D]">Belum ada aktivitas klik atau kunjungan tercatat.</p>
              </div>
            ) : (
              <div className="space-y-2.5 overflow-y-auto max-h-[360px] pr-1">
                {data.recentClicks.map((clk) => (
                  <div
                    key={`clk-${clk.id}`}
                    className="p-3 rounded-xl bg-[#FFF6F8] border border-[#F0C6D2]/70 text-xs min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#3F232C] truncate min-w-0">
                        Klik: {clk.productName || clk.linkTitle || 'Item'}
                      </span>
                      <span className="text-[11px] text-[#7D4E5D] shrink-0">
                        {clk.deviceType}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[#7D4E5D]">
                      <span className="truncate min-w-0">Sumber: {clk.referrer || 'direct'}</span>
                      <span className="tabular-nums shrink-0">
                        {formatJakartaDateTime(clk.clickedAt)}
                      </span>
                    </div>
                  </div>
                ))}

                {data.recentViews.slice(0, 5).map((pv) => (
                  <div
                    key={`pv-${pv.id}`}
                    className="p-2.5 rounded-xl border border-[#F0C6D2]/50 text-xs min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#3F232C] truncate min-w-0">View: {pv.pageUrl}</span>
                      <span className="text-[11px] text-[#7D4E5D] shrink-0">{pv.deviceType}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-[#7D4E5D] tabular-nums">
                      {formatJakartaDateTime(pv.viewedAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Top Products, Categories, Sources & Devices */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Top Products */}
          <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-4 sm:p-5 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="font-serif-display text-base font-semibold text-[#3F232C] truncate">
                Top Products
              </h2>
              <button
                type="button"
                onClick={() => handleExport('top_products')}
                className="text-xs text-[#C25B7C] hover:text-[#A84867] underline underline-offset-4 shrink-0"
              >
                Export CSV
              </button>
            </div>
            {!data || data.topProducts.length === 0 ? (
              <p className="text-xs text-[#7D4E5D] py-6 text-center">Belum ada klik produk pada periode ini.</p>
            ) : (
              <div className="space-y-3">
                {data.topProducts.map((p) => (
                  <div key={p.productId} className="flex items-center justify-between gap-3 text-xs min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[#3F232C] truncate">{p.productName}</div>
                      <div className="text-[11px] text-[#C25B7C] flex items-center gap-1 min-w-0">
                        <span className="truncate">/go/{p.productSlug}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </div>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <div className="font-semibold text-[#3F232C]">{p.clicks} klik</div>
                      <div className="text-[11px] text-[#7D4E5D]">{p.uniqueClickers} unik</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Categories */}
          <div className="rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-4 sm:p-5 min-w-0">
            <h2 className="font-serif-display text-base font-semibold text-[#3F232C] mb-3">
              Top Categories
            </h2>
            {!data || data.topCategories.length === 0 ? (
              <p className="text-xs text-[#7D4E5D] py-6 text-center">Belum ada data klik kategori.</p>
            ) : (
              <div className="space-y-3">
                {data.topCategories.map((c) => {
                  const maxCat = Math.max(1, data.topCategories[0]?.clicks || 1);
                  const pct = Math.round((c.clicks / maxCat) * 100);
                  return (
                    <div key={c.categoryId} className="space-y-1 text-xs min-w-0">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium text-[#3F232C] truncate">{c.categoryName}</span>
                        <span className="tabular-nums text-[#7D4E5D] shrink-0">{c.clicks} klik</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#FFF6F8] overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full rounded-full bg-[#C25B7C]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Traffic Sources & Devices */}
          <div className="md:col-span-2 lg:col-span-1 rounded-2xl bg-[#FFFFFF] border border-[#F0C6D2] p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5 min-w-0">
            <div className="min-w-0">
              <h2 className="font-serif-display text-base font-semibold text-[#3F232C] mb-2.5">
                Traffic Sources
              </h2>
              {!data || data.trafficSources.length === 0 ? (
                <p className="text-xs text-[#7D4E5D]">Belum ada data sumber trafik.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {data.trafficSources.map((s) => (
                    <div key={s.source} className="flex justify-between gap-2 min-w-0">
                      <span className="text-[#3F232C] truncate">{s.source}</span>
                      <span className="tabular-nums font-medium text-[#7D4E5D] shrink-0">{s.visits}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 sm:pt-0 sm:pl-5 sm:border-l lg:pl-0 lg:border-l-0 lg:pt-4 border-t sm:border-t-0 lg:border-t border-[#F0C6D2]/60 min-w-0">
              <h2 className="font-serif-display text-base font-semibold text-[#3F232C] mb-2.5">
                Device Distribution
              </h2>
              {!data || data.deviceDistribution.length === 0 ? (
                <p className="text-xs text-[#7D4E5D]">Belum ada data perangkat.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {data.deviceDistribution.map((d) => (
                    <div key={d.deviceType} className="flex justify-between gap-2 capitalize">
                      <span className="text-[#3F232C] truncate">{d.deviceType}</span>
                      <span className="tabular-nums font-medium text-[#7D4E5D] shrink-0">{d.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
