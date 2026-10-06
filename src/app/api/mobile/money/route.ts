import { loadMoney } from '../../../../lib/money/load';
import { redirectOf, redirectResponse } from '../../../../lib/mobile/redirect';

// Everything the app's money pages are drawn from: the same load the web
// pages use, as JSON. ?days= sets how far the forecast runs.
export async function GET(request: Request) {
  const days = Math.min(400, Math.max(7, Number(new URL(request.url).searchParams.get('days')) || 91));
  try {
    return Response.json(await loadMoney(days));
  } catch (error) {
    const redirected = redirectOf(error);
    if (redirected) return redirectResponse(redirected);
    throw error;
  }
}
