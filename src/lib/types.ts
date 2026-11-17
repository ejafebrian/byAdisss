export interface PublicProfile {
  id: number;
  brandName: string;
  username: string;
  tagline: string;
  description: string;
  avatarUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  whatsappUrl: string;
  footerText: string;
  affiliateDisclosure: string;
}

export interface PublicBanner {
  id: number;
  title: string;
  description: string;
  imageUrl: string;
  targetUrl: string;
  sortOrder: number;
  isActive: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface PublicCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  icon: string;
  sortOrder: number;
  isActive?: boolean;
  productCount?: number;
}

export interface PublicProduct {
  id: number;
  productName: string;
  productSlug: string;
  description: string;
  imageUrl: string;
  price: string | number | null;
  categoryId: number | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  affiliateUrl?: string;
  label: string;
  isFeatured: boolean;
  isActive?: boolean;
  isArchived?: boolean;
  sortOrder?: number;
}

export interface PublicLink {
  id: number;
  title: string;
  slug: string;
  url: string;
  description: string;
  icon: string;
  sortOrder: number;
  isActive?: boolean;
  clicks?: number;
}

export function formatIdr(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatJakartaDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
