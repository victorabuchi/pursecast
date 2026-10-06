// Where the web callback hands a bank connection back to the phone app: a
// redirect to its own address (pursecast://banks), which closes the in-app
// browser and shows the message.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const target = new URL('pursecast://banks');
  for (const key of ['toast', 'error']) {
    const value = params.get(key);
    if (value) target.searchParams.set(key, value.slice(0, 300));
  }
  return new Response(null, { status: 302, headers: { Location: target.toString() } });
}
