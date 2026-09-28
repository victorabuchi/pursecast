#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/52e68c189fa84984a0f61f00438450a959f03e0c060b43e56ae20d5638fbadf8/contract';
import endContract from '../../snapshots/52e68c189fa84984a0f61f00438450a959f03e0c060b43e56ae20d5638fbadf8/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b282ec169724fca9db6ea3ba1c0f6a12bddd4ebb1b774bf608132443977ee0fc/contract';
import startContract from '../../snapshots/b282ec169724fca9db6ea3ba1c0f6a12bddd4ebb1b774bf608132443977ee0fc/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'app_user',
        column: col('notepad', 'text', {
          notNull: true,
          default: lit(''),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'app_user',
        column: col('notepadAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
