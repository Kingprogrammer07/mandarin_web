import { apiClient } from '../client';

// ── Response Types ─────────────────────────────────────────────────────────

export interface AdminUsernameCheckResponse {
  role_name: string;
  has_passkey: boolean;
}

export interface AdminLoginResponse {
  access_token: string;
  token_type: string;
  role_name: string;
  admin_id: number;
}

export interface WebAuthnBeginResponse {
  options: PublicKeyCredentialCreationOptionsJSON;
}

export interface WebAuthnCompleteResponse {
  message: string;
}

export interface WebAuthnLoginBeginResponse {
  options: PublicKeyCredentialRequestOptionsJSON;
}

export interface PasskeyItem {
  id: number;
  device_name: string | null;
  credential_id: string;
}

export interface MyPasskeysResponse {
  has_current_device_passkey: boolean;
  total_passkeys: number;
  passkeys: PasskeyItem[];
}

// ── WebAuthn JSON types (matches py_webauthn's JSON serialization) ─────────

interface PublicKeyCredentialCreationOptionsJSON {
  rp: { name: string; id: string };
  user: { id: string; name: string; displayName: string };
  challenge: string;
  pubKeyCredParams: Array<{ type: string; alg: number }>;
  timeout?: number;
  excludeCredentials?: Array<{ id: string; type: string; transports?: string[] }>;
  authenticatorSelection?: Record<string, unknown>;
  attestation?: string;
}

interface PublicKeyCredentialRequestOptionsJSON {
  challenge: string;
  timeout?: number;
  rpId?: string;
  allowCredentials?: Array<{ id: string; type: string; transports?: string[] }>;
  userVerification?: string;
}

// ── Attestation/Assertion payloads (from native WebAuthn API → server) ─────

export interface WebAuthnAttestationPayload {
  id: string;
  rawId: string;
  type: string;
  response: {
    clientDataJSON: string;
    attestationObject: string;
  };
}

export interface WebAuthnAssertionPayload {
  id: string;
  rawId: string;
  type: string;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle: string | null;
  };
}

// ── API Functions ──────────────────────────────────────────────────────────

export async function checkAdminUsername(system_username: string): Promise<AdminUsernameCheckResponse> {
  const response = await apiClient.post<AdminUsernameCheckResponse>('/admin/auth/check-username', { system_username });
  return response.data;
}

export async function loginAdminPin(system_username: string, pin: string, device_info: string): Promise<AdminLoginResponse> {
  const response = await apiClient.post<AdminLoginResponse>('/admin/auth/login-pin', {
    system_username,
    pin,
    device_info
  });
  return response.data;
}

/**
 * Revoke the current staff JWT server-side.
 *
 * The endpoint drops the token's `jti` into the Redis blocklist that
 * `get_admin_from_jwt` consults on every staff request, and writes a LOGOUT
 * audit row. Until this was wired up, "Chiqish" only cleared `localStorage`:
 * the token stayed valid for the rest of `API_JWT_EXPIRE_MINUTES` (8h in
 * production), so anyone who had copied it — or picked it out of the nginx
 * access log, where the SSE streams put it — kept full staff access after the
 * cashier had signed off the shared till.
 *
 * The body is not optional in practice. `AdminLogoutRequest` is a required body
 * parameter (admin_auth.py:202), so a bodiless POST is rejected 422 — which is
 * the second reason this call could never have worked as it was written.
 * `device_info` also fills the audit row.
 *
 * The 5s timeout is deliberate: the client default is 30s, and a cashier on a
 * flaky link must not be held on a dead "Chiqish" button. The caller signs them
 * out locally regardless of what happens here.
 */
export async function logoutAdmin(
  deviceInfo: string = navigator.userAgent,
): Promise<void> {
  await apiClient.post(
    '/admin/auth/logout',
    { device_info: deviceInfo },
    { timeout: 5000 },
  );
}

export interface RefreshTokenResponse {
  access_token: string;
  token_type: string;
}

// Coalesce simultaneous refresh calls and skip near-duplicate calls inside
// a short window. Every admin page mounts an effect that calls this; with
// 5+ admin routes, navigating between them used to fire as many refreshes
// in seconds. The window is short enough that a freshly-rotated permission
// set still propagates within ~30 s.
const REFRESH_COOLDOWN_MS = 30_000;
let inFlightRefresh: Promise<RefreshTokenResponse> | null = null;
let lastRefreshAt = 0;
let lastRefreshResult: RefreshTokenResponse | null = null;

export async function refreshAdminToken(): Promise<RefreshTokenResponse> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No token available for refresh');

  if (inFlightRefresh) return inFlightRefresh;

  const now = Date.now();
  if (lastRefreshResult && now - lastRefreshAt < REFRESH_COOLDOWN_MS) {
    return lastRefreshResult;
  }

  inFlightRefresh = (async () => {
    try {
      const response = await apiClient.post<RefreshTokenResponse>(
        '/admin/auth/refresh',
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Admin-Authorization': `Bearer ${token}`,
          },
        },
      );
      lastRefreshAt = Date.now();
      lastRefreshResult = response.data;
      return response.data;
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}

export interface SwitchRoleResponse {
  access_token: string;
  token_type: string;
  role_name: string;
  admin_id: number;
  home_page: string | null;
}

export async function switchAdminRole(role_name: string): Promise<SwitchRoleResponse> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No token available for role switch');

  const response = await apiClient.post<SwitchRoleResponse>(
    '/admin/auth/switch-role',
    { role_name },
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Admin-Authorization': `Bearer ${token}`,
      },
    },
  );
  return response.data;
}

export async function webauthnLoginBegin(system_username: string): Promise<WebAuthnLoginBeginResponse> {
  const response = await apiClient.post<WebAuthnLoginBeginResponse>('/admin/auth/webauthn/login/begin', { system_username });
  return response.data;
}

export async function webauthnLoginComplete(
  system_username: string,
  assertion_response: WebAuthnAssertionPayload,
  device_info: string = navigator.userAgent
): Promise<AdminLoginResponse> {
  const response = await apiClient.post<AdminLoginResponse>('/admin/auth/webauthn/login/complete', {
    system_username,
    device_info,
    assertion_response
  });
  return response.data;
}

export async function webauthnRegisterBegin(device_name: string): Promise<WebAuthnBeginResponse> {
  const token = localStorage.getItem('access_token');
  const response = await apiClient.post<WebAuthnBeginResponse>('/admin/auth/webauthn/register/begin',
    { device_name },
    {
      headers: { 'X-Admin-Authorization': 'Bearer ' + token }
    }
  );
  return response.data;
}

export async function webauthnRegisterComplete(
  device_name: string,
  attestation_response: WebAuthnAttestationPayload
): Promise<WebAuthnCompleteResponse> {
  const token = localStorage.getItem('access_token');
  const response = await apiClient.post<WebAuthnCompleteResponse>('/admin/auth/webauthn/register/complete',
    {
      device_name,
      attestation_response
    },
    {
      headers: { 'X-Admin-Authorization': 'Bearer ' + token }
    }
  );
  return response.data;
}

export async function fetchMyPasskeys(device_name: string): Promise<MyPasskeysResponse> {
  const token = localStorage.getItem('access_token');
  const response = await apiClient.get<MyPasskeysResponse>('/admin/auth/webauthn/my-passkeys', {
    params: { device_name },
    headers: { 'X-Admin-Authorization': 'Bearer ' + token }
  });
  return response.data;
}

export async function deletePasskey(passkey_id: number): Promise<void> {
  const token = localStorage.getItem('access_token');
  await apiClient.delete(`/admin/auth/webauthn/passkeys/${passkey_id}`, {
    headers: { 'X-Admin-Authorization': 'Bearer ' + token }
  });
}