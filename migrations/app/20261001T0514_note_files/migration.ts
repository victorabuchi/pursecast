#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/045aa5b49b149f5d0dcce9d7fc7e4b6858e9c93c62994d71aa29bfda3bbbe14a/contract';
import endContract from '../../snapshots/045aa5b49b149f5d0dcce9d7fc7e4b6858e9c93c62994d71aa29bfda3bbbe14a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/087e0d4ca06fac92412e90918256262dcf851ffaf56bda0249d0a04aa7a92c7b/contract';
import startContract from '../../snapshots/087e0d4ca06fac92412e90918256262dcf851ffaf56bda0249d0a04aa7a92c7b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'note_file',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('data', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('mime', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('size', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'note_file',
        index: 'note_file_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'note_file',
        foreignKey: {
          name: 'note_file_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'note_file' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
