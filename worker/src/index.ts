/**
 * OpenCreche Serverless Cloudflare Worker (`worker/src/index.ts`)
 *
 * Responsibilities:
 * 1. `POST /api/vault/unlock` -> Validates Cloudflare Turnstile token & returns AES-256-GCM `VAULT_MASTER_KEY`
 * 2. `POST /api/contact/send` -> Validates Turnstile token & forwards contact form message via Resend API
 * 3. `GET /api/oauth/auth` & `/api/oauth/callback` -> GitHub OAuth proxy for Sveltia CMS (`/admin`)
 */

export interface Env {
  ALLOWED_ORIGIN: string;
  FROM_EMAIL: string;
  VAULT_MASTER_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  RESEND_API_KEY: string;
  CONTACT_RECIPIENT_EMAIL: string;
  GITHUB_OAUTH_CLIENT_ID?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: string;
}

function corsHeaders(origin: string | null, allowedOrigin: string): Record<string, string> {
  const allow =
    origin && (origin === allowedOrigin || origin.startsWith('http://localhost:'))
      ? origin
      : allowedOrigin;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

async function verifyTurnstileToken(token: string, secretKey: string, remoteIp?: string | null): Promise<boolean> {
  if (!token) return false;
  const formData = new FormData();
  formData.append('secret', secretKey);
  formData.append('response', token);
  if (remoteIp) formData.append('remoteip', remoteIp);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) return false;
  const outcome = (await res.json()) as { success: boolean };
  return outcome.success === true;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const headers = corsHeaders(origin, env.ALLOWED_ORIGIN);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    // 1. Unlock Privacy Vault (Exchange Turnstile token for AES-256-GCM key)
    if (url.pathname === '/api/vault/unlock' && request.method === 'POST') {
      try {
        const body = (await request.json()) as { turnstileToken?: string };
        const ip = request.headers.get('CF-Connecting-IP');
        const isHuman = await verifyTurnstileToken(body.turnstileToken || '', env.TURNSTILE_SECRET_KEY, ip);

        if (!isHuman) {
          return new Response(JSON.stringify({ ok: false, error: 'Invalid Turnstile verification' }), {
            status: 403,
            headers: { ...headers, 'Content-Type': 'application/json' },
          });
        }

        return new Response(
          JSON.stringify({
            ok: true,
            key: env.VAULT_MASTER_KEY,
          }),
          {
            status: 200,
            headers: { ...headers, 'Content-Type': 'application/json' },
          }
        );
      } catch {
        return new Response(JSON.stringify({ ok: false, error: 'Bad Request' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }
    }

    // 2. Contact Form Relay via Resend API (Zero Email Exposure)
    if (url.pathname === '/api/contact/send' && request.method === 'POST') {
      try {
        const body = (await request.json()) as {
          turnstileToken?: string;
          parentName?: string;
          parentEmail?: string;
          parentPhone?: string;
          childAge?: string;
          subject?: string;
          message?: string;
        };

        if (body.turnstileToken && env.TURNSTILE_SECRET_KEY) {
          const ip = request.headers.get('CF-Connecting-IP');
          const valid = await verifyTurnstileToken(body.turnstileToken, env.TURNSTILE_SECRET_KEY, ip);
          if (!valid) {
            return new Response(JSON.stringify({ ok: false, error: 'Turnstile check failed' }), {
              status: 403,
              headers: { ...headers, 'Content-Type': 'application/json' },
            });
          }
        }

        const parentName = String(body.parentName || '').slice(0, 120);
        const parentEmail = String(body.parentEmail || '').slice(0, 150);
        const parentPhone = String(body.parentPhone || '-').slice(0, 50);
        const childAge = String(body.childAge || '-').slice(0, 50);
        const subject = String(body.subject || 'New Inquiry').slice(0, 160);
        const message = String(body.message || '').slice(0, 4000);

        if (!parentName || !parentEmail || !message) {
          return new Response(JSON.stringify({ ok: false, error: 'Missing required fields' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' },
          });
        }

        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: env.FROM_EMAIL,
            to: [env.CONTACT_RECIPIENT_EMAIL],
            reply_to: parentEmail,
            subject: `[OpenCreche] ${subject} (${parentName})`,
            text: [
              `Parent / Guardian: ${parentName}`,
              `Email: ${parentEmail}`,
              `Phone: ${parentPhone}`,
              `Child Age: ${childAge}`,
              `---`,
              message,
            ].join('\n'),
          }),
        });

        if (!emailRes.ok) {
          return new Response(JSON.stringify({ ok: false, error: 'Email delivery failed' }), {
            status: 502,
            headers: { ...headers, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({ ok: false, error: 'Invalid request payload' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }
    }

    // 3. GitHub OAuth Proxy for Sveltia CMS / Decap CMS
    if (url.pathname === '/api/oauth/auth' && env.GITHUB_OAUTH_CLIENT_ID) {
      const redirectUrl = new URL('https://github.com/login/oauth/authorize');
      redirectUrl.searchParams.set('client_id', env.GITHUB_OAUTH_CLIENT_ID);
      redirectUrl.searchParams.set('scope', 'public_repo,user');
      return Response.redirect(redirectUrl.toString(), 302);
    }

    if (url.pathname === '/api/oauth/callback' && env.GITHUB_OAUTH_CLIENT_ID && env.GITHUB_OAUTH_CLIENT_SECRET) {
      const code = url.searchParams.get('code');
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: env.GITHUB_OAUTH_CLIENT_ID,
          client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
          code,
        }),
      });
      const tokenData = (await tokenRes.json()) as { access_token?: string };
      const html = `<!doctype html><html><body><script>
        (function() {
          function receiveMessage(e) {
            window.opener.postMessage(
              'authorization:github:success:' + JSON.stringify({ token: "${tokenData.access_token || ''}", provider: "github" }),
              e.origin
            );
          }
          window.addEventListener("message", receiveMessage, false);
          window.opener.postMessage("authorizing:github", "*");
        })();
      </script></body></html>`;
      return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    }

    return new Response(JSON.stringify({ service: 'open-creche-worker', status: 'ok' }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  },
};
