#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/6b6213d88c6af453633fcc2f2eb1ef4f647ae703820cff2c7b502ea84b37f6f3/contract';
import endContract from '../../snapshots/6b6213d88c6af453633fcc2f2eb1ef4f647ae703820cff2c7b502ea84b37f6f3/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/aa8320c0aa06007f7ace33d63b8d18472e21c04837aa730726c7d0bad9874129/contract';
import startContract from '../../snapshots/aa8320c0aa06007f7ace33d63b8d18472e21c04837aa730726c7d0bad9874129/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'bank_name',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('currency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('iban', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bank_name',
        index: 'bank_name_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bank_name',
        foreignKey: {
          name: 'bank_name_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'bank_name' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
