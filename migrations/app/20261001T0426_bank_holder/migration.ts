#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/087e0d4ca06fac92412e90918256262dcf851ffaf56bda0249d0a04aa7a92c7b/contract';
import endContract from '../../snapshots/087e0d4ca06fac92412e90918256262dcf851ffaf56bda0249d0a04aa7a92c7b/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/6b6213d88c6af453633fcc2f2eb1ef4f647ae703820cff2c7b502ea84b37f6f3/contract';
import startContract from '../../snapshots/6b6213d88c6af453633fcc2f2eb1ef4f647ae703820cff2c7b502ea84b37f6f3/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'bank_account',
        column: col('holder', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
