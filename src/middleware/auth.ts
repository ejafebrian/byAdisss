import type { Request, Response, NextFunction } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { eq, sql } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db, isDatabaseConfigured } from '../db/index.ts';
import { admins } from '../db/schema.ts';

export interface AdminRecord {
  id: number;
  uid: string | null;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  admin?: AdminRecord;
}

const DEFAULT_OWNER_EMAILS = (
  process.env.ADMIN_OWNER_EMAIL || 'ejafebriansyah3@gmail.com'
)
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
  }

  const token = authHeader.split('Bearer ')[1];

  let decodedToken: DecodedIdToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Sesi Firebase tidak valid atau sudah kedaluwarsa' });
  }

  const email = (decodedToken.email || '').trim().toLowerCase();
  const uid = decodedToken.uid;
  const displayName = decodedToken.name || email.split('@')[0] || 'Admin';

  if (!email) {
    return res.status(403).json({ error: 'Forbidden: Akun Google tidak memiliki alamat email terverifikasi.' });
  }

  if (!isDatabaseConfigured) {
    return res.status(503).json({
      error:
        'Database PostgreSQL belum dikonfigurasi pada server (DATABASE_URL atau SQL_HOST belum diisi di Environment Variables).',
    });
  }

  try {
    // Look up admin by uid or case-insensitive email
    let found = await db
      .select()
      .from(admins)
      .where(eq(admins.uid, uid))
      .limit(1);

    if (!found.length) {
      found = await db
        .select()
        .from(admins)
        .where(sql`lower(${admins.email}) = ${email}`)
        .limit(1);
    }

    // Bootstrap owner email or first-ever admin if admins table is empty
    if (!found.length) {
      const existingAdmins = await db.select({ id: admins.id }).from(admins).limit(1);
      if (existingAdmins.length === 0 || DEFAULT_OWNER_EMAILS.includes(email)) {
        const [inserted] = await db
          .insert(admins)
          .values({
            uid,
            email,
            displayName,
            role: 'super_admin',
            isActive: true,
          })
          .onConflictDoUpdate({
            target: admins.email,
            set: {
              uid,
              displayName,
              updatedAt: new Date(),
            },
          })
          .returning();
        found = [inserted];
      }
    } else if (!found[0].uid || found[0].email !== email) {
      // Link Firebase UID and normalize email on login
      const [updated] = await db
        .update(admins)
        .set({
          uid,
          email,
          displayName: found[0].displayName === 'Admin' ? displayName : found[0].displayName,
          updatedAt: new Date(),
        })
        .where(eq(admins.id, found[0].id))
        .returning();
      found = [updated];
    }

    if (!found.length) {
      return res.status(403).json({
        error: `Forbidden: Akun (${email}) belum terdaftar sebagai admin by Adisss. Tambahkan email ini lewat akun Super Admin (${DEFAULT_OWNER_EMAILS[0] || 'owner'}) di menu Admin Account.`,
      });
    }

    if (!found[0].isActive) {
      return res.status(403).json({
        error: `Forbidden: Akun admin (${email}) sedang dinonaktifkan.`,
      });
    }

    req.admin = found[0];
    next();
  } catch (dbError: any) {
    console.error('Database error during admin verification:', dbError);
    return res.status(503).json({
      error:
        'Database gagal diakses saat memverifikasi admin. Pastikan koneksi PostgreSQL (SQL_HOST / DATABASE_URL) aktif dan dapat dijangkau server.',
    });
  }
};

export const requireSuperAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.admin || req.admin.role !== 'super_admin') {
    return res.status(403).json({
      error: 'Forbidden: Hanya Super Admin yang diizinkan melakukan tindakan ini.',
    });
  }
  next();
};
