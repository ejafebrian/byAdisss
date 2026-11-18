import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
  var _postgresAdminPool: Pool | undefined;
}

export const isDatabaseConfigured = Boolean(
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SQL_HOST
);

export const hasAdminDatabaseCredentials = Boolean(
  process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    (process.env.SQL_HOST && process.env.SQL_ADMIN_USER && process.env.SQL_ADMIN_PASSWORD)
);

export const createPool = () => {
  if (!global._postgresPool) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    global._postgresPool = connectionString
      ? new Pool({
          connectionString,
          ssl: process.env.SQL_SSL === 'false' ? false : { rejectUnauthorized: false },
          max: 10,
          connectionTimeoutMillis: 15000,
        })
      : new Pool({
          host: process.env.SQL_HOST,
          user: process.env.SQL_USER,
          password: process.env.SQL_PASSWORD,
          database: process.env.SQL_DB_NAME,
          ssl: process.env.SQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
          max: 10,
          connectionTimeoutMillis: 15000,
        });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

export const getAdminPool = (): Pool => {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (connectionString) {
    return createPool();
  }

  if (process.env.SQL_HOST && process.env.SQL_ADMIN_USER && process.env.SQL_ADMIN_PASSWORD) {
    if (!global._postgresAdminPool) {
      global._postgresAdminPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_ADMIN_USER,
        password: process.env.SQL_ADMIN_PASSWORD,
        database: process.env.SQL_DB_NAME,
        ssl: process.env.SQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
        max: 4,
        connectionTimeoutMillis: 15000,
      });

      global._postgresAdminPool.on('error', (err) => {
        console.error('Unexpected error on idle admin SQL pool client:', err);
      });
    }
    return global._postgresAdminPool;
  }

  return createPool();
};

const pool = createPool();

export const db = drizzle(pool, { schema });
export { pool };
