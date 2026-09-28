#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/7fa5f87c0657aaee85464faaf1fc6338af136f97fcc6ae23cb0ee8019064c19e/contract';
import startContract from '../../snapshots/7fa5f87c0657aaee85464faaf1fc6338af136f97fcc6ae23cb0ee8019064c19e/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b282ec169724fca9db6ea3ba1c0f6a12bddd4ebb1b774bf608132443977ee0fc/contract';
import endContract from '../../snapshots/b282ec169724fca9db6ea3ba1c0f6a12bddd4ebb1b774bf608132443977ee0fc/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'debt',
        column: col('party', 'text', {
          notNull: true,
          default: lit('person'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
