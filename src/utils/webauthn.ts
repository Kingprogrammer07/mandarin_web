import type { WebAuthnAttestationPayload, WebAuthnAssertionPayload } from '../api/services/adminAuth';

// ── Helpers ────────────────────────────────────────────────────────────────

function base64urlToBuffer(b64: string): ArrayBuffer {
  const b = b64.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}

function bufferToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Server returns JSON-serialized WebAuthn options with base64url-encoded binary fields.
// We deep-clone and decode them before passing to the native browser API,
// so the exact shape doesn't matter — we just need to accept whatever the server sends.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServerWebAuthnOptions = any;

// ── Registration (create) ──────────────────────────────────────────────────

export async function webauthnCreate(options: ServerWebAuthnOptions): Promise<WebAuthnAttestationPayload> {
  if (!navigator.credentials?.create) {
    throw new Error("WebAuthn bu qurilmada/brauzrda qo'llab-quvvatlanmaydi");
  }

  const opts = JSON.parse(JSON.stringify(options));
  opts.challenge = base64urlToBuffer(opts.challenge);
  opts.user.id = base64urlToBuffer(opts.user.id);
  if (opts.excludeCredentials) {
    opts.excludeCredentials = opts.excludeCredentials.map((c: { id: string }) => ({
      ...c,
      id: base64urlToBuffer(c.id),
    }));
  }

  const cred = (await navigator.credentials.create({ publicKey: opts })) as PublicKeyCredential;
  const resp = cred.response as AuthenticatorAttestationResponse;

  return {
    id: cred.id,
    rawId: bufferToBase64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToBase64url(resp.clientDataJSON),
      attestationObject: bufferToBase64url(resp.attestationObject),
    },
  };
}

// ── Authentication (get) ───────────────────────────────────────────────────

export async function webauthnGet(options: ServerWebAuthnOptions): Promise<WebAuthnAssertionPayload> {
  if (!navigator.credentials?.get) {
    throw new Error("WebAuthn bu qurilmada/brauzrda qo'llab-quvvatlanmaydi");
  }

  const opts = JSON.parse(JSON.stringify(options));
  opts.challenge = base64urlToBuffer(opts.challenge);
  if (opts.allowCredentials) {
    opts.allowCredentials = opts.allowCredentials.map((c: { id: string }) => ({
      ...c,
      id: base64urlToBuffer(c.id),
    }));
  }

  const cred = (await navigator.credentials.get({ publicKey: opts })) as PublicKeyCredential;
  const resp = cred.response as AuthenticatorAssertionResponse;

  return {
    id: cred.id,
    rawId: bufferToBase64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufferToBase64url(resp.clientDataJSON),
      authenticatorData: bufferToBase64url(resp.authenticatorData),
      signature: bufferToBase64url(resp.signature),
      userHandle: resp.userHandle ? bufferToBase64url(resp.userHandle) : null,
    },
  };
}