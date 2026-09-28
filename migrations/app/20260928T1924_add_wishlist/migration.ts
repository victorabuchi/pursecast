#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/342e0cddf05a7fba4b37a251a4f201879cab79de6656cdf9460e94d1c4bb241a/contract';
import startContract from '../../snapshots/342e0cddf05a7fba4b37a251a4f201879cab79de6656cdf9460e94d1c4bb241a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/cd5ccc4e9c6e1ccbd2265d07ddebe5df9df235f223f3e105cfa56edd037aa4fa/contract';
import endContract from '../../snapshots/cd5ccc4e9c6e1ccbd2265d07ddebe5df9df235f223f3e105cfa56edd037aa4fa/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'wish_item',
        columns: [
          col('boughtAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('eventId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('price', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('priority', 'int4', {
            notNull: true,
            default: lit(2),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('url', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'wish_item',
        index: 'wish_item_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'wish_item',
        foreignKey: {
          name: 'wish_item_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'wish_item' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
