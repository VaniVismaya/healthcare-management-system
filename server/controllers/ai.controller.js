const https = require('https');

const callOpenAI = (payload, apiKey) => new Promise((resolve, reject) => {
  const data = JSON.stringify(payload);
  const req = https.request(
    {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(data)
      }
    },
    (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error(body));
        }
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    }
  );
  req.on('error', reject);
  req.write(data);
  req.end();
});

exports.assist = async (req, res) => {
  const { message } = req.body || {};
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const payload = {
    model,
    temperature: 0.4,
    max_tokens: 300,
    messages: [
      {
        role: 'system',
        content:
          'You are a medical triage assistant for a clinic booking app. ' +
          'Ask 1-2 quick clarifying questions if needed. ' +
          'Suggest the likely specialty/department and next steps, but do not diagnose. ' +
          'Always include a short safety note to seek urgent care for severe symptoms.'
      },
      { role: 'user', content: String(message) }
    ]
  };

  try {
    const data = await callOpenAI(payload, apiKey);
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return res.status(500).json({ error: 'Empty response from AI' });
    }
    return res.json({ reply });
  } catch (err) {
    return res.status(500).json({ error: 'AI request failed' });
  }
};
