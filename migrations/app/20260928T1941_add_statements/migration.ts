#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/afc81ec2bf2204dc6755913318b5e1b958b2c2e198afd5dd413cdc65d62351ff/contract';
import endContract from '../../snapshots/afc81ec2bf2204dc6755913318b5e1b958b2c2e198afd5dd413cdc65d62351ff/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/cd5ccc4e9c6e1ccbd2265d07ddebe5df9df235f223f3e105cfa56edd037aa4fa/contract';
import startContract from '../../snapshots/cd5ccc4e9c6e1ccbd2265d07ddebe5df9df235f223f3e105cfa56edd037aa4fa/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'statement',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'statement_txn',
        columns: [
          col('amount', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('category', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('date', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('place', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('statementId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'statement',
        index: 'statement_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'statement_txn',
        index: 'statement_txn_statementId_idx_af8497c3',
        columns: ['statementId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'statement_txn',
        index: 'statement_txn_userId_date_idx_b0e9c250',
        columns: ['userId', 'date'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'statement_txn',
        index: 'statement_txn_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'statement',
        foreignKey: {
          name: 'statement_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'statement_txn',
        foreignKey: {
          name: 'statement_txn_statementId_fkey',
          columns: ['statementId'],
          references: { schema: 'public', table: 'statement', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'statement_txn',
        foreignKey: {
          name: 'statement_txn_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'statement' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'statement_txn' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
