#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/342e0cddf05a7fba4b37a251a4f201879cab79de6656cdf9460e94d1c4bb241a/contract';
import endContract from '../../snapshots/342e0cddf05a7fba4b37a251a4f201879cab79de6656cdf9460e94d1c4bb241a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/52e68c189fa84984a0f61f00438450a959f03e0c060b43e56ae20d5638fbadf8/contract';
import startContract from '../../snapshots/52e68c189fa84984a0f61f00438450a959f03e0c060b43e56ae20d5638fbadf8/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'recurring',
        column: col('variable', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
