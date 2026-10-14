import { callFn } from './api';

// Opens the official Instagram OAuth page in a popup. Resolves with the username once the
// server callback posts back. No Instagram credentials are ever handled by SHIWA.
export async function connectInstagram() {
  const { url } = await callFn('instagram-oauth', { action: 'start' });
  const popup = window.open(url, 'shiwa-instagram', 'width=520,height=720');
  if (!popup) throw new Error('Allow popups to connect Instagram.');

  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => { window.removeEventListener('message', onMessage); clearInterval(timer); };
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'shiwa:instagram') return;
      cleanup();
      e.data.ok ? resolve(e.data.username) : reject(new Error('Instagram connection failed.'));
    };
    window.addEventListener('message', onMessage);
    timer = setInterval(() => {
      if (popup.closed) { cleanup(); reject(new Error('Connection window was closed.')); }
    }, 500);
  });
}

