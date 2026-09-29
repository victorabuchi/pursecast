#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/ab7e90a716bcf7b0e8fae7756e9e5b1ddb33e39196be32b23800305d93cde93b/contract';
import endContract from '../../snapshots/ab7e90a716bcf7b0e8fae7756e9e5b1ddb33e39196be32b23800305d93cde93b/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/afc81ec2bf2204dc6755913318b5e1b958b2c2e198afd5dd413cdc65d62351ff/contract';
import startContract from '../../snapshots/afc81ec2bf2204dc6755913318b5e1b958b2c2e198afd5dd413cdc65d62351ff/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'debt',
        column: col('photo', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'wish_item',
        column: col('photo', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
