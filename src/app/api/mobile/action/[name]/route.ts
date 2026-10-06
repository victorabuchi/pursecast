import * as money from '../../../../../lib/money/actions';
import * as bills from '../../../../../lib/money/bill-actions';
import * as debts from '../../../../../lib/money/debt-actions';
import * as wishes from '../../../../../lib/money/wish-actions';
import * as todos from '../../../../../lib/money/todo-actions';
import * as notes from '../../../../../lib/money/note-actions';
import * as account from '../../../../../lib/money/account-actions';
import * as notify from '../../../../../lib/money/notify-actions';
import * as statements from '../../../../../lib/statements/actions';
import * as bank from '../../../../../lib/bank/actions';
import { getViewer } from '../../../../../lib/auth/viewer';
import { redirectOf, redirectResponse } from '../../../../../lib/mobile/redirect';

// The app calls the web's own server actions by name, signed in with its
// bearer token. A JSON body { form: {...} } becomes the FormData the action
// expects (a multipart body is passed through as it is, for photos);
// { args: [...] } is for the few actions that take plain arguments.

type Action = (...args: never[]) => Promise<unknown>;
const ACTIONS = new Map<string, Action>();
for (const set of [money, bills, debts, wishes, todos, notes, account, notify, statements, bank] as Array<Record<string, unknown>>) {
  for (const [key, fn] of Object.entries(set)) if (typeof fn === 'function' && key.endsWith('Action')) ACTIONS.set(key, fn as Action);
}

function formFrom(values: Record<string, unknown>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) form.append(key, String(v));
  }
  return form;
}

export async function POST(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const action = ACTIONS.get(name);
  if (!action) return Response.json({ error: 'Unknown action.' }, { status: 404 });
  if (!(await getViewer())) return Response.json({ error: 'Sign in first.' }, { status: 401 });

  let args: unknown[];
  if (request.headers.get('content-type')?.startsWith('multipart/form-data')) {
    args = [await request.formData()];
  } else {
    const body = (await request.json().catch(() => ({}))) as { form?: Record<string, unknown>; args?: unknown[] };
    args = body.args ?? [formFrom(body.form ?? {})];
  }

  try {
    const result = await (action as (...a: unknown[]) => Promise<unknown>)(...args);
    return Response.json({ ok: true, result: result ?? null });
  } catch (error) {
    const redirected = redirectOf(error);
    if (redirected) return redirectResponse(redirected);
    // refresh() only works inside Server Actions. The actions that use it call
    // it as their last step, after saving, so the work is already done.
    if (error instanceof Error && error.message.startsWith('refresh can only be called from within a Server Action')) return Response.json({ ok: true, result: null });
    throw error;
  }
}
