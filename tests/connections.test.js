import test from 'node:test';
import assert from 'node:assert/strict';
import { connectProvider, getConnections, validateAuthorizationUrl } from '../src/lib/connections.js';

const validUrl = 'https://connect.composio.dev/link/session';

test('accepts only HTTPS authorization URLs on the Composio connection host', () => {
  assert.equal(validateAuthorizationUrl(validUrl, 'instagram'), validUrl);
  for (const url of [
    'http://connect.composio.dev/link/session',
    'https://evil.example/link/session',
    'https://connect.composio.dev.evil.example/link/session',
    'https://user@connect.composio.dev/link/session',
  ]) {
    assert.throws(() => validateAuthorizationUrl(url, 'telegram'), /untrusted authorization link/);
  }
});

test('popup-blocked connection falls back to same-tab navigation', async () => {
  let navigatedTo = '';
  const windowRef = {
    open: () => null,
    location: { origin: 'https://shiwa-creator-hub-v2.onrender.com', assign: (url) => { navigatedTo = url; } },
  };
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ provider: 'telegram', authorization_url: validUrl }),
  });

  const result = await connectProvider('telegram', {
    getAccessToken: async () => 'test-user-token',
    apiBaseUrl: 'https://deep-shiwa-ai-mcp.onrender.com',
    windowRef,
    fetchImpl,
  });

  assert.deepEqual(result, { redirecting: true });
  assert.equal(navigatedTo, validUrl);
});

test('connection start rejects malformed backend responses and network failures', async () => {
  const windowRef = { open: () => null, location: { assign() {} } };
  await assert.rejects(connectProvider('instagram', {
    getAccessToken: async () => 'token',
    apiBaseUrl: 'https://backend.example',
    windowRef,
    fetchImpl: async () => ({ ok: true, json: async () => ({ provider: 'instagram' }) }),
  }), /invalid authorization link/);
  await assert.rejects(connectProvider('instagram', {
    getAccessToken: async () => 'token',
    apiBaseUrl: 'https://backend.example',
    windowRef,
    fetchImpl: async () => { throw new TypeError('offline'); },
  }), /Could not reach the connection service/);
});

test('expired sessions stop before starting authorization', async () => {
  let requested = false;
  await assert.rejects(connectProvider('instagram', {
    getAccessToken: async () => { throw new Error('Your SHIWA session has expired.'); },
    apiBaseUrl: 'https://backend.example',
    windowRef: { open: () => null, location: { assign() {} } },
    fetchImpl: async () => { requested = true; },
  }), /session has expired/);
  assert.equal(requested, false);
});

test('provider callback cancellation is surfaced without claiming connection', async () => {
  let messageHandler;
  const popup = { closed: false, location: {}, focus() {}, close() { this.closed = true; } };
  const windowRef = {
    open: () => popup,
    location: { origin: 'https://app.example', assign() {} },
    addEventListener: (type, handler) => { messageHandler = handler; },
    removeEventListener: () => { messageHandler = null; },
  };
  const pending = connectProvider('telegram', {
    getAccessToken: async () => 'user-token',
    apiBaseUrl: 'https://backend.example',
    windowRef,
    fetchImpl: async () => ({ ok: true, json: async () => ({ provider: 'telegram', authorization_url: validUrl }) }),
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  messageHandler({
    origin: 'https://app.example',
    source: popup,
    data: { type: 'shiwa:composio', provider: 'telegram', ok: false },
  });
  await assert.rejects(pending, /cancelled or declined/);
});

test('successful popup callback requires a verified active backend account', async () => {
  let messageHandler;
  const popup = { closed: false, location: {}, focus() {}, close() { this.closed = true; } };
  const windowRef = {
    open: () => popup,
    location: { origin: 'https://app.example', assign() {} },
    addEventListener: (type, handler) => { messageHandler = handler; },
    removeEventListener: () => { messageHandler = null; },
  };
  let accountChecks = 0;
  const pending = connectProvider('instagram', {
    getAccessToken: async () => 'user-token',
    apiBaseUrl: 'https://backend.example',
    windowRef,
    fetchImpl: async (url) => {
      if (url.endsWith('/start')) {
        return { ok: true, json: async () => ({ provider: 'instagram', authorization_url: validUrl }) };
      }
      accountChecks += 1;
      return { ok: true, json: async () => ({ accounts: [{ id: 'connected-account', toolkit: 'instagram', connected: true }] }) };
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  messageHandler({
    origin: 'https://app.example',
    source: popup,
    data: { type: 'shiwa:composio', provider: 'instagram', ok: true },
  });

  const account = await pending;
  assert.equal(account.id, 'connected-account');
  assert.equal(accountChecks, 1);
});

test('account status accepts only active accounts returned for the requested provider', async () => {
  const accounts = await getConnections('instagram', 'user-token', 'https://backend.example', async (url, options) => {
    assert.match(url, /\/connect\/instagram\/accounts$/);
    assert.equal(options.headers.Authorization, 'Bearer user-token');
    return {
      ok: true,
      json: async () => ({ accounts: [
        { id: 'verified', toolkit: 'instagram', connected: true },
        { id: 'other-provider', toolkit: 'telegram', connected: true },
        { id: 'inactive', toolkit: 'instagram', connected: false },
      ] }),
    };
  });

  assert.deepEqual(accounts.map((account) => account.id), ['verified']);
});