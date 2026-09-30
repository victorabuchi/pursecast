import 'dotenv/config';
import { Pool } from 'pg';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

// The Supabase session pooler allows only a handful of connections for the
// whole project, shared by every running copy of the app (Render, local dev,
// scripts). Each copy keeps a few; when they are all taken, pages fail. Idle
// ones close after 10 seconds so they go back to the pool quickly.
function makePool(): Pool {
  const p = new Pool({
    connectionString: process.env['DATABASE_URL']!,
    max: Number(process.env['DB_POOL_MAX'] ?? 4),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  // A connection the pooler drops while idle must not crash the server.
  p.on('error', (e) => console.error('Idle database connection closed', e.message));
  return p;
}
// One pool per process: in development each reload would otherwise open a
// new pool and leave the old connections holding their slots.
const g = globalThis as unknown as { pursecastPool?: Pool };
const pool = (g.pursecastPool ??= makePool());

// @ts-expect-error contract.d.ts omits `nullable` on to-one relation
// descriptors (emitter bug in @prisma/orm-postgres@8.0.0-rc.10). contract.json,
// which the runtime validates against, is correct.
export const db = postgres<Contract>({
  contractJson,
  pg: pool,
  // The runtime checks the contract marker once and keeps the result, so a
  // single dropped connection (the Supabase pooler closes idle ones) would fail
  // every later query until a restart. Drift is checked with `prisma db verify`.
  verifyMarker: false,
});
