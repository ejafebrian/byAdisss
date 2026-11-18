import * as XLSX from 'xlsx';
import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  affiliateImportErrors,
  affiliateImportJobs,
  categories,
  products,
  settings,
} from '../db/schema.ts';
import {
  DEFAULT_ALLOWED_AFFILIATE_DOMAINS,
  isAllowedAffiliateDomain,
  isAllowedImageUrl,
  toSlug,
} from '../lib/validators.ts';

export type ValidationStatus = 'valid' | 'warning' | 'error';
export type DuplicateMode = 'skip' | 'update' | 'new_only';

export interface ParsedImportRow {
  rowNumber: number;
  productNumber: number | null;
  productName: string;
  productSlug: string;
  categoryName: string;
  categoryId: number | null;
  description: string;
  price: number | null;
  imageUrl: string;
  affiliateUrl: string;
  label: string;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  validationStatus: ValidationStatus;
  errors: string[];
  warnings: string[];
  existsInDb: boolean;
  existingProductId: number | null;
}

export interface PreviewImportResult {
  filename: string;
  totalRows: number;
  maxRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  duplicateInDbCount: number;
  rows: ParsedImportRow[];
}

export async function getAllowedAffiliateDomains(): Promise<string[]> {
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.settingKey, 'allowed_affiliate_domains'))
    .limit(1);
  if (!rows.length || !rows[0].settingValue.trim()) {
    return DEFAULT_ALLOWED_AFFILIATE_DOMAINS;
  }
  return rows[0].settingValue
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export async function getImportMaxRows(): Promise<number> {
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.settingKey, 'import_max_rows'))
    .limit(1);
  const parsed = Number(rows[0]?.settingValue);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 2000) : 500;
}

export function buildTemplateWorkbookBuffer(): Buffer {
  const wb = XLSX.utils.book_new();

  const templateData = [
    [
      'product_number',
      'product_name',
      'product_slug',
      'category',
      'description',
      'price',
      'image_url',
      'affiliate_url',
      'label',
      'featured',
      'status',
      'sort_order',
    ],
    [
      1,
      'Lip Tint Velvet Matte Warm Rose',
      'lip-tint-velvet-matte-rose',
      'Beauty & Skincare',
      'Lip tint ringan tahan lama dengan hasil akhir soft matte.',
      79000,
      'https://shopee.co.id/example-image.jpg',
      'https://shopee.co.id/product/123456/789012',
      'BEST SELLER',
      'TRUE',
      'active',
      1,
    ],
    [
      '',
      'Cardigan Rajut Crop Cream Aesthetic',
      '',
      'Fashion & Style',
      'Cardigan rajut lembut cocok untuk outfit santai.',
      135000,
      '',
      'https://shope.ee/example-cardigan',
      'NEW',
      'FALSE',
      'active',
      2,
    ],
  ];

  const guideData = [
    ['Kolom', 'Wajib', 'Keterangan & Format'],
    ['product_number', 'Tidak', 'Nomor urut/produk manual (angka >= 1). Kosongkan untuk nomor otomatis berikutnya'],
    ['product_name', 'Ya', 'Nama produk maksimal 200 karakter'],
    ['product_slug', 'Tidak', 'Slug unik huruf kecil & strip. Jika kosong, dibuat otomatis dari nama produk'],
    ['category', 'Tidak', 'Nama kategori yang tersedia di menu Categories (mis. Beauty & Skincare)'],
    ['description', 'Tidak', 'Deskripsi singkat produk'],
    ['price', 'Tidak', 'Harga numerik positif tanpa huruf (mis. 129000)'],
    ['image_url', 'Tidak', 'URL gambar valid http:// atau https://'],
    ['affiliate_url', 'Ya', 'URL link Shopee Affiliate valid dari domain yang diizinkan'],
    ['label', 'Tidak', 'BEST SELLER, VIRAL, RECOMMENDED, atau NEW'],
    ['featured', 'Tidak', 'TRUE atau FALSE (default FALSE)'],
    ['status', 'Tidak', 'active atau inactive (default active)'],
    ['sort_order', 'Tidak', 'Angka urutan tampil (default 0)'],
  ];

  const wsProducts = XLSX.utils.aoa_to_sheet(templateData);
  const wsGuide = XLSX.utils.aoa_to_sheet(guideData);
  XLSX.utils.book_append_sheet(wb, wsProducts, 'Products');
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Petunjuk');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function normalizeHeader(h: unknown): string {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export async function fetchAndPreviewGoogleSheet(rawUrl: string): Promise<PreviewImportResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('URL Google Sheet tidak valid.');
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== 'docs.google.com') {
    throw new Error('URL harus berasal dari https://docs.google.com/spreadsheets/...');
  }

  const match = parsed.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error('ID Google Sheet tidak ditemukan dalam URL. Pastikan format URL seperti https://docs.google.com/spreadsheets/d/SHEET_ID/edit');
  }

  const sheetId = match[1];
  let gid = parsed.searchParams.get('gid') || '';
  if (!gid && parsed.hash) {
    const hashMatch = parsed.hash.match(/gid=(\d+)/);
    if (hashMatch) gid = hashMatch[1];
  }
  if (gid && !/^\d+$/.test(gid)) {
    gid = '';
  }

  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx${gid ? `&gid=${gid}` : ''}`;
  const response = await fetch(exportUrl, {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
    headers: {
      'User-Agent': 'by-Adisss-Sheet-Importer/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Gagal mengambil Google Sheet (HTTP ${response.status}). Pastikan akses berbagi Google Sheet diatur ke "Siapa saja yang memiliki link (Viewer)".`
    );
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html')) {
    throw new Error(
      'Google Sheet bersifat privat dan mengembalikan halaman login. Ubah pengaturan Share menjadi "Anyone with the link (Viewer)" lalu coba lagi.'
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > 5 * 1024 * 1024) {
    throw new Error('Ukuran file Google Sheet melebihi batas maksimal 5MB.');
  }

  const buffer = Buffer.from(arrayBuffer);
  return parseAndValidateSpreadsheet(buffer, `google-sheet-${sheetId.slice(0, 8)}.xlsx`);
}

export async function parseAndValidateSpreadsheet(
  buffer: Buffer,
  filename: string
): Promise<PreviewImportResult> {
  const lowerName = filename.toLowerCase();
  if (!/\.(xlsx|xls|csv)$/.test(lowerName)) {
    throw new Error('Format file harus .xlsx, .xls, atau .csv');
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', raw: false });
  } catch {
    throw new Error('File spreadsheet tidak dapat dibaca atau rusak');
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('File spreadsheet kosong dan tidak memiliki sheet');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawMatrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (rawMatrix.length < 2) {
    throw new Error('Spreadsheet tidak memiliki baris data (minimal 1 header + 1 baris produk)');
  }

  const headers = (rawMatrix[0] || []).map(normalizeHeader);
  if (!headers.includes('product_name') || !headers.includes('affiliate_url')) {
    throw new Error(
      'Struktur kolom wajib tidak lengkap. Pastikan terdapat kolom "product_name" dan "affiliate_url".'
    );
  }

  const dataRows = rawMatrix.slice(1).filter((row) =>
    Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== '')
  );

  const maxRows = await getImportMaxRows();
  if (dataRows.length === 0) {
    throw new Error('Tidak ditemukan baris produk yang berisi data.');
  }
  if (dataRows.length > maxRows) {
    throw new Error(
      `Jumlah baris (${dataRows.length}) melebihi batas maksimal ${maxRows} baris per file.`
    );
  }

  const allCategories = await db.select().from(categories);
  const categoryByName = new Map(
    allCategories.map((c) => [c.name.trim().toLowerCase(), c])
  );
  const categoryBySlug = new Map(
    allCategories.map((c) => [c.slug.trim().toLowerCase(), c])
  );

  const allowedDomains = await getAllowedAffiliateDomains();

  // First pass: map columns & compute candidate slugs
  const colIdx = (name: string) => headers.indexOf(name);
  const getCell = (row: unknown[], col: string) => {
    const idx = colIdx(col);
    return idx >= 0 ? String(row[idx] ?? '').trim() : '';
  };

  const parsedDrafts = dataRows.map((row, i) => {
    const rowNumber = i + 2; // 1-indexed spreadsheet row with header at 1
    const rawProductNumber = getCell(row, 'product_number');
    const productName = getCell(row, 'product_name');
    const rawSlug = getCell(row, 'product_slug');
    const productSlug = toSlug(rawSlug || productName);
    const categoryName = getCell(row, 'category');
    const description = getCell(row, 'description');
    const rawPrice = getCell(row, 'price');
    const imageUrl = getCell(row, 'image_url');
    const affiliateUrl = getCell(row, 'affiliate_url');
    const label = getCell(row, 'label').toUpperCase();
    const rawFeatured = getCell(row, 'featured');
    const rawStatus = getCell(row, 'status');
    const rawSortOrder = getCell(row, 'sort_order');

    return {
      rowNumber,
      rawProductNumber,
      productName,
      rawSlug,
      productSlug,
      categoryName,
      description,
      rawPrice,
      imageUrl,
      affiliateUrl,
      label,
      rawFeatured,
      rawStatus,
      rawSortOrder,
    };
  });

  // Query existing slugs in DB in one batch
  const candidateSlugs = Array.from(
    new Set(parsedDrafts.map((d) => d.productSlug).filter(Boolean))
  );
  const existingProducts = candidateSlugs.length
    ? await db
        .select({ id: products.id, productSlug: products.productSlug })
        .from(products)
        .where(inArray(products.productSlug, candidateSlugs))
    : [];
  const existingSlugMap = new Map(
    existingProducts.map((p) => [p.productSlug.toLowerCase(), p.id])
  );

  const seenSlugsInFile = new Map<string, number>();

  const rows: ParsedImportRow[] = parsedDrafts.map((draft) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!draft.productName) {
      errors.push('product_name wajib diisi');
    }
    if (!draft.productSlug) {
      errors.push('product_slug tidak dapat dibuat karena nama/slug kosong');
    } else {
      const prevRow = seenSlugsInFile.get(draft.productSlug);
      if (prevRow !== undefined) {
        errors.push(`Slug duplikat di dalam file (sama dengan baris ${prevRow})`);
      } else {
        seenSlugsInFile.set(draft.productSlug, draft.rowNumber);
      }
    }

    if (!draft.affiliateUrl) {
      errors.push('affiliate_url wajib diisi');
    } else {
      const domainCheck = isAllowedAffiliateDomain(draft.affiliateUrl, allowedDomains);
      if (!domainCheck.valid) {
        errors.push(domainCheck.reason || 'Affiliate URL tidak valid');
      }
    }

    let price: number | null = null;
    if (draft.rawPrice !== '') {
      const cleaned = draft.rawPrice.replace(/,/g, '');
      const num = Number(cleaned);
      if (!Number.isFinite(num) || num < 0) {
        errors.push(`Harga tidak valid ("${draft.rawPrice}") — harus angka positif`);
      } else {
        price = num;
      }
    }

    if (draft.imageUrl && !isAllowedImageUrl(draft.imageUrl)) {
      errors.push('URL gambar (image_url) tidak valid');
    }

    let categoryId: number | null = null;
    if (draft.categoryName) {
      const cat =
        categoryByName.get(draft.categoryName.toLowerCase()) ||
        categoryBySlug.get(toSlug(draft.categoryName));
      if (!cat) {
        warnings.push(`Kategori "${draft.categoryName}" belum ada di database (akan dikosongkan)`);
      } else {
        categoryId = cat.id;
      }
    }

    let isFeatured = false;
    if (draft.rawFeatured !== '') {
      const upper = draft.rawFeatured.toUpperCase();
      if (upper === 'TRUE' || upper === '1' || upper === 'YES' || upper === 'YA') {
        isFeatured = true;
      } else if (upper === 'FALSE' || upper === '0' || upper === 'NO' || upper === 'TIDAK') {
        isFeatured = false;
      } else {
        errors.push(`Nilai featured tidak sesuai ("${draft.rawFeatured}") — gunakan TRUE/FALSE`);
      }
    }

    let isActive = true;
    if (draft.rawStatus !== '') {
      const lower = draft.rawStatus.toLowerCase();
      if (lower === 'active' || lower === 'aktif') {
        isActive = true;
      } else if (lower === 'inactive' || lower === 'nonaktif') {
        isActive = false;
      } else {
        errors.push(`Nilai status tidak sesuai ("${draft.rawStatus}") — gunakan active/inactive`);
      }
    }

    let productNumber: number | null = null;
    if (draft.rawProductNumber !== '') {
      const cleanedNo = draft.rawProductNumber.replace(/^#/, '').trim();
      const num = Number(cleanedNo);
      if (!Number.isInteger(num) || num < 1 || num > 999999) {
        errors.push(`product_number "${draft.rawProductNumber}" tidak valid (harus angka bulat >= 1)`);
      } else {
        productNumber = num;
      }
    }

    let sortOrder = 0;
    if (draft.rawSortOrder !== '') {
      const n = Number(draft.rawSortOrder);
      if (!Number.isInteger(n) || n < 0) {
        warnings.push(`sort_order "${draft.rawSortOrder}" tidak valid, menggunakan 0`);
      } else {
        sortOrder = n;
      }
    }

    const existingId = draft.productSlug
      ? existingSlugMap.get(draft.productSlug.toLowerCase()) ?? null
      : null;
    const existsInDb = existingId !== null;
    if (existsInDb) {
      warnings.push('Produk dengan slug ini sudah ada di database');
    }

    const validationStatus: ValidationStatus =
      errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid';

    return {
      rowNumber: draft.rowNumber,
      productNumber,
      productName: draft.productName,
      productSlug: draft.productSlug,
      categoryName: draft.categoryName,
      categoryId,
      description: draft.description,
      price,
      imageUrl: draft.imageUrl,
      affiliateUrl: draft.affiliateUrl,
      label: draft.label,
      isFeatured,
      isActive,
      sortOrder,
      validationStatus,
      errors,
      warnings,
      existsInDb,
      existingProductId: existingId,
    };
  });

  return {
    filename,
    totalRows: rows.length,
    maxRows,
    validCount: rows.filter((r) => r.validationStatus === 'valid').length,
    warningCount: rows.filter((r) => r.validationStatus === 'warning').length,
    errorCount: rows.filter((r) => r.validationStatus === 'error').length,
    duplicateInDbCount: rows.filter((r) => r.existsInDb).length,
    rows,
  };
}

export async function executeBatchImport(params: {
  adminId: number;
  adminEmail: string;
  filename: string;
  duplicateMode: DuplicateMode;
  rows: ParsedImportRow[];
}) {
  const { adminId, adminEmail, filename, duplicateMode, rows } = params;
  const allowedDomains = await getAllowedAffiliateDomains();

  const [job] = await db
    .insert(affiliateImportJobs)
    .values({
      adminId,
      adminEmail,
      filename,
      totalRows: rows.length,
      importStatus: 'processing',
      duplicateMode,
    })
    .returning();

  let successRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;
  let failedRows = 0;
  const errorRecords: {
    importJobId: number;
    rowNumber: number;
    errorMessage: string;
    rowData: unknown;
  }[] = [];

  const [{ maxNo }] = await db
    .select({ maxNo: sql<number>`coalesce(max(${products.productNumber}), 0)::int` })
    .from(products);
  let nextAutoNumber = (maxNo || 0) + 1;

  const BATCH_SIZE = 50;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      // Re-validate critically on server before DB write
      if (!row.productName || !row.productSlug || !row.affiliateUrl) {
        failedRows++;
        errorRecords.push({
          importJobId: job.id,
          rowNumber: row.rowNumber,
          errorMessage: row.errors.join('; ') || 'Kolom wajib tidak lengkap',
          rowData: row,
        });
        continue;
      }

      if (row.errors.length > 0) {
        failedRows++;
        errorRecords.push({
          importJobId: job.id,
          rowNumber: row.rowNumber,
          errorMessage: row.errors.join('; '),
          rowData: row,
        });
        continue;
      }

      const domainCheck = isAllowedAffiliateDomain(row.affiliateUrl, allowedDomains);
      if (!domainCheck.valid) {
        failedRows++;
        errorRecords.push({
          importJobId: job.id,
          rowNumber: row.rowNumber,
          errorMessage: domainCheck.reason || 'Domain affiliate tidak diizinkan',
          rowData: row,
        });
        continue;
      }

      try {
        await db.transaction(async (tx) => {
          const existing = await tx
            .select({ id: products.id })
            .from(products)
            .where(eq(products.productSlug, row.productSlug))
            .limit(1);

          if (existing.length > 0) {
            if (duplicateMode === 'update') {
              const updateSet: Record<string, unknown> = {
                productName: row.productName,
                description: row.description,
                imageUrl: row.imageUrl,
                price: row.price !== null ? String(row.price) : null,
                categoryId: row.categoryId,
                affiliateUrl: row.affiliateUrl,
                label: row.label,
                isFeatured: row.isFeatured,
                isActive: row.isActive,
                isArchived: false,
                sortOrder: row.sortOrder,
                updatedAt: new Date(),
              };
              if (row.productNumber !== null && row.productNumber !== undefined) {
                updateSet.productNumber = row.productNumber;
                if (row.productNumber >= nextAutoNumber) {
                  nextAutoNumber = row.productNumber + 1;
                }
              }
              await tx
                .update(products)
                .set(updateSet)
                .where(eq(products.id, existing[0].id));
              updatedRows++;
            } else {
              skippedRows++;
            }
          } else {
            const assignedNumber =
              row.productNumber !== null && row.productNumber !== undefined
                ? row.productNumber
                : nextAutoNumber++;
            if (assignedNumber >= nextAutoNumber) {
              nextAutoNumber = assignedNumber + 1;
            }
            await tx.insert(products).values({
              productNumber: assignedNumber,
              productName: row.productName,
              productSlug: row.productSlug,
              description: row.description,
              imageUrl: row.imageUrl,
              price: row.price !== null ? String(row.price) : null,
              categoryId: row.categoryId,
              affiliateUrl: row.affiliateUrl,
              label: row.label,
              isFeatured: row.isFeatured,
              isActive: row.isActive,
              isArchived: false,
              sortOrder: row.sortOrder,
            });
            successRows++;
          }
        });
      } catch (err: any) {
        failedRows++;
        errorRecords.push({
          importJobId: job.id,
          rowNumber: row.rowNumber,
          errorMessage: err?.message || 'Gagal menyimpan baris ke database',
          rowData: row,
        });
      }
    }
  }

  if (errorRecords.length > 0) {
    await db.insert(affiliateImportErrors).values(errorRecords);
  }

  const finalStatus =
    failedRows === rows.length && rows.length > 0
      ? 'failed'
      : failedRows > 0
        ? 'partial'
        : 'completed';

  const [updatedJob] = await db
    .update(affiliateImportJobs)
    .set({
      successRows,
      updatedRows,
      skippedRows,
      failedRows,
      importStatus: finalStatus,
      completedAt: new Date(),
    })
    .where(eq(affiliateImportJobs.id, job.id))
    .returning();

  return {
    job: updatedJob,
    errors: errorRecords,
  };
}
