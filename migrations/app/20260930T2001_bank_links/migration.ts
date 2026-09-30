#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/78ceb85bd9ffb5e65603db3520ee63f97aaf7635d96fc55ec811ff526619547b/contract';
import startContract from '../../snapshots/78ceb85bd9ffb5e65603db3520ee63f97aaf7635d96fc55ec811ff526619547b/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/a2a68aa60601c5dd3a084f88a05a7cec2ff2b35d99ae09ed024be7eb424e2266/contract';
import endContract from '../../snapshots/a2a68aa60601c5dd3a084f88a05a7cec2ff2b35d99ae09ed024be7eb424e2266/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'bank_account',
        columns: [
          col('accountId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('balance', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('balanceAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('currency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('iban', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('linkId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', {
            notNull: true,
            default: lit('other'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('statementId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('uid', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'bank_link',
        columns: [
          col('aspspCountry', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('aspspName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('error', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lastSyncAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('logo', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('sessionId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('state', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('validUntil', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bank_account',
        index: 'bank_account_linkId_idx_09c902f6',
        columns: ['linkId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bank_account',
        index: 'bank_account_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'bank_link',
        index: 'bank_link_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bank_account',
        foreignKey: {
          name: 'bank_account_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bank_account',
        foreignKey: {
          name: 'bank_account_linkId_fkey',
          columns: ['linkId'],
          references: { schema: 'public', table: 'bank_link', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'bank_link',
        foreignKey: {
          name: 'bank_link_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'bank_account' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'bank_link' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
