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

export interface MyPasskeysResponse {
  has_current_device_passkey: boolean;
  total_passkeys: number;
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

export async function logoutAdmin(): Promise<void> {
  await apiClient.post('/admin/auth/logout');
}

export interface RefreshTokenResponse {
  access_token: string;
  token_type: string;
}

export async function refreshAdminToken(): Promise<RefreshTokenResponse> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No token available for refresh');

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