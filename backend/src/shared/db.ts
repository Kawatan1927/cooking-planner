import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * PostgreSQL 接続（postgres.js）。
 * 接続は遅延（初回クエリ時）に確立される。
 * テストではリポジトリ層をモックするため、本モジュールは評価されない。
 */
const connectionString = process.env.DATABASE_URL ?? '';
const client = postgres(connectionString);

export const db = drizzle(client, { schema });
