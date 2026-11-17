function randomId(prefix: string): string {
  const arr = new Uint8Array(12);
  window.crypto.getRandomValues(arr);
  const hex = Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

export function getOrCreateTrackingIds(): { visitorKey: string; sessionKey: string } {
  let visitorKey = getCookie('_resty_vid');
  if (!visitorKey) {
    visitorKey = randomId('v');
    setCookie('_resty_vid', visitorKey, 60 * 60 * 24 * 365); // 1 year pseudonymous cookie
  }

  let sessionKey = getCookie('_resty_sid');
  if (!sessionKey) {
    sessionKey = randomId('s');
    setCookie('_resty_sid', sessionKey, 60 * 30); // 30 min rolling session
  } else {
    setCookie('_resty_sid', sessionKey, 60 * 30);
  }

  return { visitorKey, sessionKey };
}

export function trackPublicPageView(pathname: string) {
  if (pathname.startsWith('/admin')) return;
  try {
    const { visitorKey, sessionKey } = getOrCreateTrackingIds();
    const params = new URLSearchParams(window.location.search);
    fetch('/api/track/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorKey,
        sessionKey,
        pageUrl: pathname,
        referrer: document.referrer || '',
        utmSource: params.get('utm_source') || '',
        utmMedium: params.get('utm_medium') || '',
        utmCampaign: params.get('utm_campaign') || '',
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Silent fallback for privacy browsers
  }
}

export function sendPublicHeartbeat(pathname: string) {
  if (pathname.startsWith('/admin')) return;
  try {
    const { visitorKey, sessionKey } = getOrCreateTrackingIds();
    fetch('/api/track/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorKey, sessionKey }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Silent
  }
}
