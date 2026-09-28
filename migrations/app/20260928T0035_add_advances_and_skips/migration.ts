#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/7fa5f87c0657aaee85464faaf1fc6338af136f97fcc6ae23cb0ee8019064c19e/contract';
import endContract from '../../snapshots/7fa5f87c0657aaee85464faaf1fc6338af136f97fcc6ae23cb0ee8019064c19e/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b8ef66d3e58c90809e20243d00d5fd8f31eb59cade909bd954db4d61e0ccba91/contract';
import startContract from '../../snapshots/b8ef66d3e58c90809e20243d00d5fd8f31eb59cade909bd954db4d61e0ccba91/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'salary_advance',
        columns: [
          col('amount', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('entryId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('payday', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('recurringId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('settledAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('takenOn', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'recurring',
        column: col('paused', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'recurring',
        column: col('skips', 'text', {
          notNull: true,
          default: lit(''),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'salary_advance',
        index: 'salary_advance_recurringId_idx_1efc3657',
        columns: ['recurringId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'salary_advance',
        index: 'salary_advance_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'salary_advance',
        foreignKey: {
          name: 'salary_advance_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'salary_advance',
        foreignKey: {
          name: 'salary_advance_recurringId_fkey',
          columns: ['recurringId'],
          references: { schema: 'public', table: 'recurring', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'salary_advance' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
