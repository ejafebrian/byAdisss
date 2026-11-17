import { count } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  banners,
  categories,
  links,
  products,
  profiles,
  settings,
} from '../db/schema.ts';
import { DEFAULT_ALLOWED_AFFILIATE_DOMAINS } from '../lib/validators.ts';

let seedPromise: Promise<void> | null = null;

export async function ensureInitialData(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function runSeed(): Promise<void> {
  const [{ value: profileCount }] = await db.select({ value: count() }).from(profiles);

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

  const [{ value: settingsCount }] = await db.select({ value: count() }).from(settings);
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

  const [{ value: categoryCount }] = await db.select({ value: count() }).from(categories);
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

  const [{ value: bannerCount }] = await db.select({ value: count() }).from(banners);
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

  const [{ value: linkCount }] = await db.select({ value: count() }).from(links);
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
