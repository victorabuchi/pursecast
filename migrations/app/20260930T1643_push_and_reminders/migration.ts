#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/4a129ec21adb2c4448ad6cd60651ca811c5a4537c3a86fb335e82f6a95f0b36d/contract';
import startContract from '../../snapshots/4a129ec21adb2c4448ad6cd60651ca811c5a4537c3a86fb335e82f6a95f0b36d/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/af3d4fc9abd2263afddaa59e9bce6b0148f3a28e589bcb92eb47fc1a751744af/contract';
import endContract from '../../snapshots/af3d4fc9abd2263afddaa59e9bce6b0148f3a28e589bcb92eb47fc1a751744af/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'push_sub',
        columns: [
          col('auth', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('endpoint', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('p256dh', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'reminder_sent',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'app_user',
        column: col('weeklyAt', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'app_user',
        column: col('weeklyEmail', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'push_sub',
        index: 'push_sub_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'reminder_sent',
        index: 'reminder_sent_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'push_sub',
        foreignKey: {
          name: 'push_sub_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'reminder_sent',
        foreignKey: {
          name: 'reminder_sent_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'push_sub' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'reminder_sent' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
