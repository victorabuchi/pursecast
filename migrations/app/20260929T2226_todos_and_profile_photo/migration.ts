#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/17f94c4aa0a97029031804d17cb839da0dc7c8bfc59294d6c4a1f653558afa5e/contract';
import endContract from '../../snapshots/17f94c4aa0a97029031804d17cb839da0dc7c8bfc59294d6c4a1f653558afa5e/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b07a4f40873679af01b8404f3f4b5144280de3319e7660f001371d66c190627d/contract';
import startContract from '../../snapshots/b07a4f40873679af01b8404f3f4b5144280de3319e7660f001371d66c190627d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'todo',
        columns: [
          col('amount', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('doneAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('due', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('incomeId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('text', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'app_user',
        column: col('photo', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'todo',
        index: 'todo_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'todo',
        foreignKey: {
          name: 'todo_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'app_user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'todo' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
