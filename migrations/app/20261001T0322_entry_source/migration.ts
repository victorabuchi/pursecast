#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/a2a68aa60601c5dd3a084f88a05a7cec2ff2b35d99ae09ed024be7eb424e2266/contract';
import startContract from '../../snapshots/a2a68aa60601c5dd3a084f88a05a7cec2ff2b35d99ae09ed024be7eb424e2266/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/aa8320c0aa06007f7ace33d63b8d18472e21c04837aa730726c7d0bad9874129/contract';
import endContract from '../../snapshots/aa8320c0aa06007f7ace33d63b8d18472e21c04837aa730726c7d0bad9874129/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'entry',
        column: col('externalId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'entry',
        column: col('source', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
