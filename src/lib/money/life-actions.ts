'use server';

import { db } from '../../prisma/db';
import { cents, day, done, str } from './act';
import { exact } from './format';
import { getMe } from './load';
import { ageOn } from './life';

const BACK = '/life';

export async function setBirthdayAction(formData: FormData) {
  const me = await getMe();
  const birthday = day(formData, 'birthday');
  if (!birthday || birthday > me.today || birthday < '1900-01-01') done(BACK, 'Pick your date of birth.', 'error');
  await db.orm.public.User.where({ id: me.id }).update({ birthday });
  const a = ageOn(birthday, me.today);
  done(BACK, a.isBirthday ? `Happy birthday! ${a.years} today` : `Saved · ${a.years} years old`);
}

export async function addGoalAction(formData: FormData) {
  const me = await getMe();
  const name = str(formData, 'name', 60);
  const target = cents(formData, 'target');
  const byDate = day(formData, 'byDate');
  const kind = ['emergency', 'rainy', 'birthday', 'custom'].includes(str(formData, 'kind', 12)) ? str(formData, 'kind', 12) : 'custom';
  if (!name || !target) done(BACK, 'Give the goal a name and an amount.', 'error');
  if (byDate && byDate <= me.today) done(BACK, 'Pick a date in the future.', 'error');
  await db.orm.public.SavingGoal.create({ userId: me.id, name, kind, target, byDate });
  done(BACK, `${name} added · ${exact(target, me.currency)}`);
}

export async function deleteGoalAction(formData: FormData) {
  const me = await getMe();
  const g = await db.orm.public.SavingGoal.where({ id: str(formData, 'id', 40), userId: me.id }).delete();
  done(BACK, `${g?.name ?? 'Goal'} removed · what you saved is kept`);
}

// "I saved it": money moved to savings, counted towards a goal.
export async function saveAction(formData: FormData) {
  const me = await getMe();
  const amount = cents(formData, 'amount');
  if (!amount) done(BACK, 'Enter how much you put aside.', 'error');
  const goalId = str(formData, 'goalId', 40);
  const goal = goalId ? await db.orm.public.SavingGoal.where({ id: goalId, userId: me.id }).first() : null;
  // Taking money out of a pocket (a rainy day came) counts against it.
  if (str(formData, 'direction', 4) === 'out') {
    if (!goal) done(BACK, 'Pick the pocket you took it from.', 'error');
    const inPocket = (await db.orm.public.SavingDeposit.where({ userId: me.id, goalId: goal.id }).all()).reduce((s, d) => s + d.amount, 0);
    if (amount > inPocket) done(BACK, `${goal.name} has ${exact(inPocket, me.currency)}.`, 'error');
    await db.orm.public.SavingDeposit.create({ userId: me.id, goalId: goal.id, date: me.today, amount: -amount, note: str(formData, 'note', 80) || `Taken from ${goal.name}` });
    if (goal.doneAt) await db.orm.public.SavingGoal.where({ id: goal.id, userId: me.id }).update({ doneAt: null });
    done(BACK, `${exact(amount, me.currency)} taken from ${goal.name} · that is what it is for`);
  }
  await db.orm.public.SavingDeposit.create({ userId: me.id, goalId: goal?.id ?? null, date: day(formData, 'date') ?? me.today, amount, note: str(formData, 'note', 80) || null });
  if (goal && !goal.doneAt) {
    const saved = (await db.orm.public.SavingDeposit.where({ userId: me.id, goalId: goal.id }).all()).reduce((s, d) => s + d.amount, 0);
    if (saved >= goal.target) {
      await db.orm.public.SavingGoal.where({ id: goal.id, userId: me.id }).update({ doneAt: new Date().toISOString() });
      done(BACK, `${goal.name} reached · ${exact(saved, me.currency)} saved`);
    }
  }
  done(BACK, `${exact(amount, me.currency)} saved${goal ? ` towards ${goal.name}` : ''}`);
}

export async function deleteSavingAction(formData: FormData) {
  const me = await getMe();
  await db.orm.public.SavingDeposit.where({ id: str(formData, 'id', 40), userId: me.id }).delete();
  done(BACK, 'Removed');
}

// A letter to future you, sealed until the day it opens.
export async function writeCapsuleAction(formData: FormData) {
  const me = await getMe();
  const text = str(formData, 'text', 4000);
  const openOn = day(formData, 'openOn');
  if (!text) done(BACK, 'Write something to future you.', 'error');
  if (!openOn || openOn <= me.today) done(BACK, 'Pick a day in the future for it to open.', 'error');
  await db.orm.public.Capsule.create({ userId: me.id, text, writtenOn: me.today, openOn });
  done(BACK, `Sealed until ${openOn}`);
}

export async function openCapsuleAction(formData: FormData) {
  const me = await getMe();
  const c = await db.orm.public.Capsule.where({ id: str(formData, 'id', 40), userId: me.id }).first();
  if (!c || c.openOn > me.today) done(BACK, 'That letter is still sealed.', 'error');
  await db.orm.public.Capsule.where({ id: c.id, userId: me.id }).update({ openedAt: new Date().toISOString() });
  done(`${BACK}#capsule`, 'Opened');
}
