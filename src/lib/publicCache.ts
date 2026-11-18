import {
  PublicBanner,
  PublicCategory,
  PublicLink,
  PublicProduct,
  PublicProfile,
} from './types';

export interface PublicHomePayload {
  profile: PublicProfile | null;
  banners: PublicBanner[];
  categories: PublicCategory[];
  featuredProducts: PublicProduct[];
  products: PublicProduct[];
  links: PublicLink[];
}

export interface PublicProductDetailPayload {
  profile: PublicProfile | null;
  product: PublicProduct;
  related: PublicProduct[];
}

const HOME_STORAGE_KEY = 'adisss_public_home_v1';
const HOME_TTL_MS = 30_000;
const PRODUCT_TTL_MS = 45_000;

let memoryHome: { timestamp: number; data: PublicHomePayload } | null = null;
const memoryProducts = new Map<string, { timestamp: number; data: PublicProductDetailPayload }>();
const inFlightHomeRequests = new Map<string, Promise<PublicHomePayload>>();
const inFlightProductRequests = new Map<string, Promise<PublicProductDetailPayload | null>>();

function readStoredHome(): PublicHomePayload | null {
  if (memoryHome) return memoryHome.data;
  try {
    const raw = localStorage.getItem(HOME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { timestamp?: number; data?: PublicHomePayload };
    if (parsed?.data && Array.isArray(parsed.data.products)) {
      memoryHome = { timestamp: parsed.timestamp || 0, data: parsed.data };
      return parsed.data;
    }
  } catch {
    // Ignore storage errors in private browsing
  }
  return null;
}

function writeStoredHome(data: PublicHomePayload) {
  const entry = { timestamp: Date.now(), data };
  memoryHome = entry;
  try {
    localStorage.setItem(HOME_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Ignore quota errors
  }
}

export function filterHomePayload(
  base: PublicHomePayload,
  categorySlug?: string,
  search?: string
): PublicHomePayload {
  const cat = (categorySlug || '').trim();
  const q = (search || '').trim().toLowerCase();

  if (!cat && !q) return base;

  const filteredProducts = base.products.filter((item) => {
    if (cat && item.categorySlug !== cat) {
      return false;
    }
    if (q) {
      const hay = `${item.productName || ''} ${item.description || ''} ${item.label || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return {
    ...base,
    products: filteredProducts,
  };
}

export function getCachedHome(categorySlug?: string, search?: string): PublicHomePayload | null {
  const base = readStoredHome();
  if (!base) return null;
  return filterHomePayload(base, categorySlug, search);
}

export function isHomeCacheFresh(): boolean {
  if (!memoryHome) {
    readStoredHome();
  }
  return Boolean(memoryHome && Date.now() - memoryHome.timestamp < HOME_TTL_MS);
}

export async function fetchHomeData(
  categorySlug?: string,
  search?: string
): Promise<PublicHomePayload> {
  const cat = (categorySlug || '').trim();
  const q = (search || '').trim();
  const key = `${cat}::${q.toLowerCase()}`;

  const existing = inFlightHomeRequests.get(key);
  if (existing) return existing;

  const params = new URLSearchParams();
  if (cat) params.set('category', cat);
  if (q) params.set('search', q);
  const queryStr = params.toString();
  const url = queryStr ? `/api/public/home?${queryStr}` : '/api/public/home';

  const request = fetch(url)
    .then(async (res) => {
      if (!res.ok) throw new Error('Gagal memuat katalog');
      const data = (await res.json()) as PublicHomePayload;
      if (!cat && !q) {
        writeStoredHome(data);
      }
      return data;
    })
    .finally(() => {
      inFlightHomeRequests.delete(key);
    });

  inFlightHomeRequests.set(key, request);
  return request;
}

export function getCachedProduct(slug: string): PublicProductDetailPayload | null {
  const normalized = slug.trim().toLowerCase();
  const mem = memoryProducts.get(normalized);
  if (mem && Date.now() - mem.timestamp < PRODUCT_TTL_MS) {
    return mem.data;
  }

  const home = readStoredHome();
  if (home) {
    const matched = home.products.find((p) => p.productSlug.toLowerCase() === normalized);
    if (matched) {
      const related = home.products
        .filter((p) => p.id !== matched.id && (!matched.categoryId || p.categoryId === matched.categoryId))
        .slice(0, 4);
      return {
        profile: home.profile,
        product: matched,
        related,
      };
    }
  }
  return null;
}

export async function fetchProductDetail(
  slug: string
): Promise<PublicProductDetailPayload | null> {
  const normalized = slug.trim().toLowerCase();
  const existing = inFlightProductRequests.get(normalized);
  if (existing) return existing;

  const request = fetch(`/api/public/products/${encodeURIComponent(normalized)}`)
    .then(async (res) => {
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Gagal memuat detail produk');
      const data = (await res.json()) as PublicProductDetailPayload;
      memoryProducts.set(normalized, { timestamp: Date.now(), data });
      return data;
    })
    .finally(() => {
      inFlightProductRequests.delete(normalized);
    });

  inFlightProductRequests.set(normalized, request);
  return request;
}
