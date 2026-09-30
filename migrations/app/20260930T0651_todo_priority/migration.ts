#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0e0376e0ccd8a79d4ac773fcbad1065b608811741d0d285896bfd610f077e902/contract';
import endContract from '../../snapshots/0e0376e0ccd8a79d4ac773fcbad1065b608811741d0d285896bfd610f077e902/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/17f94c4aa0a97029031804d17cb839da0dc7c8bfc59294d6c4a1f653558afa5e/contract';
import startContract from '../../snapshots/17f94c4aa0a97029031804d17cb839da0dc7c8bfc59294d6c4a1f653558afa5e/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'todo',
        column: col('priority', 'int4', {
          notNull: true,
          default: lit(2),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
