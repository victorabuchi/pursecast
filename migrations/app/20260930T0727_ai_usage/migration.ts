#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0e0376e0ccd8a79d4ac773fcbad1065b608811741d0d285896bfd610f077e902/contract';
import startContract from '../../snapshots/0e0376e0ccd8a79d4ac773fcbad1065b608811741d0d285896bfd610f077e902/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/4a129ec21adb2c4448ad6cd60651ca811c5a4537c3a86fb335e82f6a95f0b36d/contract';
import endContract from '../../snapshots/4a129ec21adb2c4448ad6cd60651ca811c5a4537c3a86fb335e82f6a95f0b36d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'ai_usage',
        columns: [
          col('calls', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('day', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ai_usage',
        index: 'ai_usage_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ai_usage',
        foreignKey: {
          name: 'ai_usage_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'ai_usage' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
