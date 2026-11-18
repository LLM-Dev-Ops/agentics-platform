/** Cloud Run transport identity; application policy/tenant headers remain separate. */
const cache = new Map<string, { token: string; until: number }>();

export async function serviceIdentityHeaders(baseUrl: string): Promise<Record<string, string>> {
  if (!process.env.K_SERVICE && process.env.NODE_ENV !== 'production') return {};
  const target = new URL(baseUrl);
  if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash) {
    throw new Error('Production upstream requires a configured HTTPS service URL');
  }
  const audience = baseUrl.replace(/\/$/, '');
  const current = cache.get(audience);
  if (current && current.until > Date.now()) return { 'X-Serverless-Authorization': `Bearer ${current.token}` };
  const metadata = new URL('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity');
  metadata.searchParams.set('audience', audience);
  metadata.searchParams.set('format', 'full');
  const response = await fetch(metadata, {
    headers: { 'Metadata-Flavor': 'Google' },
    redirect: 'error', signal: AbortSignal.timeout(2000),
  });
  if (!response.ok) throw new Error('Service identity token unavailable');
  const token = (await response.text()).trim();
  if (token.length > 16384 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) throw new Error('Invalid metadata identity-token response');
  // Ephemeral token cache, not application persistence. Renew well before expiry.
  cache.set(audience, { token, until: Date.now() + 300000 });
  return { 'X-Serverless-Authorization': `Bearer ${token}` };
}
