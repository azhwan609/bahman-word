import { callFn } from './api';

// Opens the official Instagram OAuth page in a popup that was opened synchronously
// from the user's click. The callback uses the existing shiwa:instagram postMessage contract.
export async function connectInstagram(existingPopup) {
  const popup = existingPopup || window.open('about:blank', 'shiwa-instagram', 'popup=yes,width=520,height=720');
  if (!popup) throw new Error('Popup blocked. Allow popups for this site, then try connecting Instagram again.');

  try {
    const { url } = await callFn('instagram-oauth', { action: 'start' });
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error('Instagram returned an invalid authorization link.'); }
    if (parsed.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(parsed.hostname) || !parsed.pathname.includes('/oauth/authorize')) {
      throw new Error('Authorization link did not point to the official Instagram website.');
    }

    return await new Promise((resolve, reject) => {
      let timer;
      let timeout;
      const cleanup = () => {
        window.removeEventListener('message', onMessage);
        if (timer) clearInterval(timer);
        if (timeout) clearTimeout(timeout);
      };
      const onMessage = (e) => {
        if (e.origin !== window.location.origin || e.data?.type !== 'shiwa:instagram') return;
        cleanup();
        if (e.data.ok && e.data.username) resolve(e.data.username);
        else reject(new Error('Instagram connection failed. Close the window and try again.'));
      };
      window.addEventListener('message', onMessage);
      timer = setInterval(() => {
        if (popup.closed) {
          cleanup();
          reject(new Error('Instagram connection window was closed before completion.'));
        }
      }, 500);
      timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Instagram authorization timed out. Please try again.'));
      }, 5 * 60 * 1000);
      popup.location.href = parsed.href;
      popup.focus?.();
    });
  } catch (error) {
    if (popup && !popup.closed) popup.close();
    throw error;
  }
}
