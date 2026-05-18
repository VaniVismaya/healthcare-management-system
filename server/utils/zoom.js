let cachedToken = null;
let tokenExpiresAt = 0;

const getZoomToken = async () => {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  if (!accountId || !clientId || !clientSecret) {
    throw new Error('Zoom is not configured');
  }

  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60000) return cachedToken;

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoom token error: ${text}`);
  }
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 0) * 1000;
  return cachedToken;
};

const createZoomMeeting = async ({ topic, startTime, durationMinutes, timezone }) => {
  const token = await getZoomToken();
  const hostId = process.env.ZOOM_USER_ID || process.env.ZOOM_HOST_EMAIL || 'me';

  const body = {
    topic: topic || 'Video Consultation',
    type: 2,
    start_time: startTime,
    duration: durationMinutes || 30,
    timezone: timezone || process.env.APP_TIMEZONE || 'Asia/Kolkata',
    settings: {
      waiting_room: true,
      join_before_host: false
    }
  };

  const res = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(hostId)}/meetings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoom meeting error: ${text}`);
  }
  const data = await res.json();
  return {
    id: data.id,
    join_url: data.join_url,
    start_url: data.start_url
  };
};

module.exports = { createZoomMeeting };
