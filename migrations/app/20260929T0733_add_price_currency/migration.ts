#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3b0824f9f584e220318288e602ed4dc31e7901152a2f86cfcfe6a07b606c2b7f/contract';
import endContract from '../../snapshots/3b0824f9f584e220318288e602ed4dc31e7901152a2f86cfcfe6a07b606c2b7f/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ab7e90a716bcf7b0e8fae7756e9e5b1ddb33e39196be32b23800305d93cde93b/contract';
import startContract from '../../snapshots/ab7e90a716bcf7b0e8fae7756e9e5b1ddb33e39196be32b23800305d93cde93b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'recurring',
        column: col('priceAmount', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'recurring',
        column: col('priceCurrency', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
