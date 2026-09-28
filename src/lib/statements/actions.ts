'use server';

import { redirect } from 'next/navigation';
import { db } from '../../prisma/db';
import { done, str } from '../money/act';
import { getMe } from '../money/load';
import { isStatementCategory } from './types';

export async function deleteStatementAction(formData: FormData) {
  const me = await getMe();
  const row = await db.orm.public.Statement.where({ id: str(formData, 'id', 40), userId: me.id }).delete();
  done('/statements', `${row?.name ?? 'Statement'} removed`);
}

export async function deleteTxnAction(formData: FormData) {
  const me = await getMe();
  await db.orm.public.StatementTxn.where({ id: str(formData, 'id', 40), userId: me.id }).delete();
  redirect(str(formData, 'back', 300).startsWith('/statements') ? str(formData, 'back', 300) : '/statements');
}

// A new category for this transaction and every other one at the same place.
export async function setTxnCategoryAction(formData: FormData) {
  const me = await getMe();
  const category = str(formData, 'category', 40);
  const txn = await db.orm.public.StatementTxn.where({ id: str(formData, 'id', 40), userId: me.id }).first();
  if (txn && isStatementCategory(category)) {
    await db.orm.public.StatementTxn.where({ userId: me.id, place: txn.place }).updateAll({ category });
  }
  redirect(str(formData, 'back', 300).startsWith('/statements') ? str(formData, 'back', 300) : '/statements');
}
