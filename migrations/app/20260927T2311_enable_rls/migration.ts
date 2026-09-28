#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4db9ddb116364d2bd260919ad15444e8ad4daf883bae2c5a3d13f0fd97e6573c/contract';
import endContract from '../../snapshots/4db9ddb116364d2bd260919ad15444e8ad4daf883bae2c5a3d13f0fd97e6573c/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/857d3b709365fdeeb3e253e10dabb49d3385f474b0ec7a4c196435d6273047b9/contract';
import startContract from '../../snapshots/857d3b709365fdeeb3e253e10dabb49d3385f474b0ec7a4c196435d6273047b9/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.enableRowLevelSecurity({ schema: 'public', table: 'app_user' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'auth_identity' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'login_token' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
