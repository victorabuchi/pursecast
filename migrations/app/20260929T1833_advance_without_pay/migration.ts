#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3b0824f9f584e220318288e602ed4dc31e7901152a2f86cfcfe6a07b606c2b7f/contract';
import startContract from '../../snapshots/3b0824f9f584e220318288e602ed4dc31e7901152a2f86cfcfe6a07b606c2b7f/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b07a4f40873679af01b8404f3f4b5144280de3319e7660f001371d66c190627d/contract';
import endContract from '../../snapshots/b07a4f40873679af01b8404f3f4b5144280de3319e7660f001371d66c190627d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  // An advance may exist without a pay: the column becomes optional and
  // removing the pay keeps the advance.
  override get operations() {
    return [
      this.dropConstraint({ schema: 'public', table: 'salary_advance', constraint: 'salary_advance_recurringId_fkey', kind: 'foreignKey' }),
      this.dropNotNull({ schema: 'public', table: 'salary_advance', column: 'recurringId' }),
      this.addForeignKey({
        schema: 'public',
        table: 'salary_advance',
        foreignKey: { name: 'salary_advance_recurringId_fkey', columns: ['recurringId'], references: { schema: 'public', table: 'recurring', columns: ['id'] }, onDelete: 'setNull' },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
