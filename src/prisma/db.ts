import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

// @ts-expect-error contract.d.ts omits `nullable` on to-one relation
// descriptors (emitter bug in @prisma/orm-postgres@8.0.0-rc.10). contract.json,
// which the runtime validates against, is correct.
export const db = postgres<Contract>({
  contractJson,
  url: process.env['DATABASE_URL']!,
  // The runtime checks the contract marker once and keeps the result, so a
  // single dropped connection (the Supabase pooler closes idle ones) would fail
  // every later query until a restart. Drift is checked with `prisma db verify`.
  verifyMarker: false,
  poolOptions: { idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 },
});
