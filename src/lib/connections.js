const PROVIDERS = new Set(['instagram', 'telegram']);
const COMPOSIO_HOST = 'connect.composio.dev';

export function validateAuthorizationUrl(value, provider) {
  if (!PROVIDERS.has(provider) || typeof value !== 'string') {
    throw new Error('The connection service returned an invalid authorization link.');
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('The connection service returned an invalid authorization link.');
  }

  if (url.protocol !== 'https:' || url.hostname !== COMPOSIO_HOST || url.username || url.password || url.port) {
    throw new Error('The connection service returned an untrusted authorization link.');
  }

  return url.href;
}

function backendError(response, body) {
  if (response.status === 401) return 'Your SHIWA session has expired. Sign in again and retry the connection.';
  if (response.status === 503) return body.detail || 'The connection service is not configured yet.';
  return body.detail || `The connection service returned HTTP ${response.status}.`;
}

async function request(path, accessToken, apiBaseUrl, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${apiBaseUrl}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(backendError(response, body || {}));
    if (!body || typeof body !== 'object') throw new Error('The connection service returned an invalid response.');
    return body;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The connection request timed out. Please try again.');
    if (error instanceof TypeError) throw new Error('Could not reach the connection service. Check your connection and try again.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getConnections(provider, accessToken, apiBaseUrl, fetchImpl = fetch) {
  if (!PROVIDERS.has(provider)) throw new Error('Unsupported connection provider.');
  const body = await request(`/connect/${provider}/accounts`, accessToken, apiBaseUrl, fetchImpl, 15000);
  if (!Array.isArray(body.accounts)) throw new Error('The connection service returned an invalid account list.');
  return body.accounts.filter((account) =>
    account?.toolkit === provider && account.connected === true && typeof account.id === 'string'
  );
}

function writePopupMessage(popup, message) {
  try {
    popup.document.title = 'SHIWA account connection';
    popup.document.body.textContent = message;
  } catch {
    // Some mobile browsers do not expose the new window's document immediately.
  }
}

export async function connectProvider(provider, {
  getAccessToken,
  apiBaseUrl,
  windowRef = window,
  fetchImpl = fetch,
  onStatus = () => {},
  timeoutMs = 15000,
} = {}) {
  if (!PROVIDERS.has(provider)) throw new Error('Unsupported connection provider.');

  let popup = null;
  try {
    popup = windowRef.open('', `shiwa-${provider}`, 'popup=yes,width=520,height=720');
  } catch {
    popup = null;
  }
  if (popup) writePopupMessage(popup, 'Preparing your secure SHIWA connection…');

  try {
    onStatus('Preparing secure connection…');
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error('Your SHIWA session has expired. Sign in again and retry the connection.');

    const body = await request(`/connect/${provider}/start`, accessToken, apiBaseUrl, fetchImpl, timeoutMs);
    if (body.provider !== provider) throw new Error('The connection service returned a link for a different provider.');
    const authorizationUrl = validateAuthorizationUrl(body.authorization_url, provider);

    if (!popup || popup.closed) {
      onStatus('Opening the secure connection in this tab…');
      windowRef.location.assign(authorizationUrl);
      return { redirecting: true };
    }

    return await new Promise((resolve, reject) => {
      let closedPoll;
      let deadline;
      const cleanup = () => {
        windowRef.removeEventListener('message', onMessage);
        if (closedPoll) clearInterval(closedPoll);
        if (deadline) clearTimeout(deadline);
      };
      const fail = (error) => {
        cleanup();
        reject(error);
      };
      const onMessage = async (event) => {
        if (event.origin !== windowRef.location.origin || event.source !== popup) return;
        if (event.data?.type !== 'shiwa:composio' || event.data?.provider !== provider) return;
        if (!event.data.ok) {
          fail(new Error('Connection was cancelled or declined. You can try again at any time.'));
          return;
        }

        cleanup();
        try {
          let accounts = [];
          for (let attempt = 0; attempt < 4; attempt += 1) {
            accounts = await getConnections(provider, await getAccessToken(), apiBaseUrl, fetchImpl);
            if (accounts.length) break;
            if (attempt < 3) await new Promise((done) => setTimeout(done, 750));
          }
          if (!accounts.length) throw new Error('SHIWA could not verify an active account. The connection may have been cancelled.');
          resolve(accounts[0]);
        } catch (error) {
          reject(error);
        }
      };

      windowRef.addEventListener('message', onMessage);
      closedPoll = setInterval(() => {
        if (popup.closed) fail(new Error('Connection window closed before verification. You can retry from SHIWA.'));
      }, 500);
      deadline = setTimeout(() => fail(new Error('Connection timed out. The authorization may have expired; please try again.')), 5 * 60 * 1000);
      try {
        popup.location.href = authorizationUrl;
        popup.focus?.();
      } catch {
        cleanup();
        windowRef.location.assign(authorizationUrl);
        resolve({ redirecting: true });
      }
    });
  } catch (error) {
    if (popup && !popup.closed) popup.close();
    throw error;
  }
}

export function connectionApiBaseUrl() {
  return (import.meta.env.VITE_BACKEND_URL || 'https://deep-shiwa-ai-mcp.onrender.com').replace(/\/$/, '');
}