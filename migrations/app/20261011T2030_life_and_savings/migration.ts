#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/045aa5b49b149f5d0dcce9d7fc7e4b6858e9c93c62994d71aa29bfda3bbbe14a/contract';
import startContract from '../../snapshots/045aa5b49b149f5d0dcce9d7fc7e4b6858e9c93c62994d71aa29bfda3bbbe14a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/3647f3f75530f0bdc2068fec4e173f01058e5cad555425ff582f908e79407962/contract';
import endContract from '../../snapshots/3647f3f75530f0bdc2068fec4e173f01058e5cad555425ff582f908e79407962/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'capsule',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('openOn', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('openedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('text', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('writtenOn', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'saving_deposit',
        columns: [
          col('amount', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('date', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('goalId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'saving_goal',
        columns: [
          col('byDate', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('doneAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('kind', 'text', {
            notNull: true,
            default: lit('custom'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('target', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'app_user',
        column: col('birthday', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'capsule',
        index: 'capsule_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'saving_deposit',
        index: 'saving_deposit_goalId_idx_8733343e',
        columns: ['goalId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'saving_deposit',
        index: 'saving_deposit_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'saving_goal',
        index: 'saving_goal_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'capsule',
        foreignKey: {
          name: 'capsule_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'saving_deposit',
        foreignKey: {
          name: 'saving_deposit_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'saving_deposit',
        foreignKey: {
          name: 'saving_deposit_goalId_fkey',
          columns: ['goalId'],
          references: { schema: 'public', table: 'saving_goal', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'saving_goal',
        foreignKey: {
          name: 'saving_goal_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'capsule' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'saving_deposit' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'saving_goal' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
