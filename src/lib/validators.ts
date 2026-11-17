import { z } from 'zod';

export const DEFAULT_ALLOWED_AFFILIATE_DOMAINS = [
  'shopee.co.id',
  'shope.ee',
  's.shopee.co.id',
  'shp.ee',
  'shopee.com',
];

export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export function isValidHttpUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isAllowedImageUrl(rawUrl: string): boolean {
  if (!rawUrl || rawUrl.trim() === '') return true;
  const trimmed = rawUrl.trim();
  // Allow internal generated/uploaded asset paths safely
  if (trimmed.startsWith('/api/assets/') || trimmed.startsWith('/src/assets/')) {
    return !trimmed.includes('..');
  }
  return isValidHttpUrl(trimmed);
}

export function isAllowedAffiliateDomain(
  rawUrl: string,
  allowedDomains: string[] = DEFAULT_ALLOWED_AFFILIATE_DOMAINS
): { valid: boolean; reason?: string } {
  if (!isValidHttpUrl(rawUrl)) {
    return { valid: false, reason: 'URL harus menggunakan protokol http:// atau https:// yang valid' };
  }
  try {
    const parsed = new URL(rawUrl.trim());
    const hostname = parsed.hostname.toLowerCase();
    const normalizedAllowed = allowedDomains
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    const matched = normalizedAllowed.some(
      (domain) => hostname === domain || hostname.endsWith('.' + domain)
    );
    if (!matched) {
      return {
        valid: false,
        reason: `Domain "${hostname}" tidak termasuk dalam allowlist domain affiliate (${normalizedAllowed.join(', ')})`,
      };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'Format URL tidak dapat diparsing' };
  }
}

export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  // Prevent CSV formula injection (=, +, -, @, tab, CR)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  // Escape double quotes and wrap if needed
  const escaped = str.replace(/"/g, '""');
  if (/[",\n\r]/.test(escaped)) {
    return `"${escaped}"`;
  }
  return escaped;
}

export function toCsvString(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(sanitizeCsvCell).join(',');
  const bodyLines = rows.map((row) => row.map(sanitizeCsvCell).join(','));
  return '\uFEFF' + [headerLine, ...bodyLines].join('\r\n');
}

export const productSchema = z.object({
  productName: z.string().trim().min(1, 'Nama produk wajib diisi').max(200),
  productSlug: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).optional().default(''),
  imageUrl: z.string().trim().max(1000).optional().default(''),
  price: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((val) => {
      if (val === null || val === undefined || String(val).trim() === '') return null;
      const num = Number(String(val).replace(/[^\d.]/g, ''));
      return Number.isFinite(num) ? num : NaN;
    })
    .refine((val) => val === null || (!Number.isNaN(val) && val >= 0), {
      message: 'Harga harus berupa angka positif',
    }),
  categoryId: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((val) => {
      if (val === null || val === undefined || val === '') return null;
      const n = Number(val);
      return Number.isInteger(n) && n > 0 ? n : null;
    }),
  affiliateUrl: z.string().trim().min(1, 'Link affiliate wajib diisi').max(2000),
  label: z.string().trim().max(40).optional().default(''),
  isFeatured: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  isArchived: z.boolean().optional().default(false),
  sortOrder: z.coerce.number().int().min(0).max(99999).optional().default(0),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Nama kategori wajib diisi').max(100),
  slug: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional().default(''),
  imageUrl: z.string().trim().max(1000).optional().default(''),
  icon: z.string().trim().max(60).optional().default('Sparkles'),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const linkSchema = z.object({
  title: z.string().trim().min(1, 'Judul link wajib diisi').max(150),
  slug: z.string().trim().max(120).optional(),
  url: z.string().trim().min(1, 'URL tujuan wajib diisi').max(2000),
  description: z.string().trim().max(500).optional().default(''),
  icon: z.string().trim().max(60).optional().default('ExternalLink'),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const bannerSchema = z.object({
  title: z.string().trim().min(1, 'Judul banner wajib diisi').max(150),
  description: z.string().trim().max(500).optional().default(''),
  imageUrl: z.string().trim().max(1000).optional().default(''),
  targetUrl: z.string().trim().max(2000).optional().default(''),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isActive: z.boolean().optional().default(true),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
});

export const profileSchema = z.object({
  brandName: z.string().trim().min(1).max(100),
  username: z.string().trim().min(1).max(60),
  tagline: z.string().trim().min(1).max(160),
  description: z.string().trim().max(600),
  avatarUrl: z.string().trim().max(1000).optional().default(''),
  instagramUrl: z.string().trim().max(500).optional().default(''),
  tiktokUrl: z.string().trim().max(500).optional().default(''),
  whatsappUrl: z.string().trim().max(500).optional().default(''),
  footerText: z.string().trim().max(200).optional().default('Made with ♡ by Adisss'),
  affiliateDisclosure: z.string().trim().max(1000).optional().default(''),
});
