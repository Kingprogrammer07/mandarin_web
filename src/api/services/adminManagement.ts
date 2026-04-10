import { apiClient } from '../client';

// ---------------------------------------------------------------------------
// Nested types
// ---------------------------------------------------------------------------

export interface ClientBriefResponse {
  id: number;
  telegram_id: number | null;
  full_name: string;
  phone: string | null;
  username: string | null;
  client_code: string | null;
}

export interface PermissionResponse {
  id: number;
  resource: string;
  action: string;
}

export interface RoleResponse {
  id: number;
  name: string;
  description: string | null;
  is_custom: boolean;
  home_page: string | null;
  permissions: PermissionResponse[];
}

// ---------------------------------------------------------------------------
// Admin Accounts
// ---------------------------------------------------------------------------

export interface AdminAccountResponse {
  id: number;
  system_username: string;
  is_active: boolean;
  failed_login_attempts: number;
  role_id: number;
  role_name: string;
  client: ClientBriefResponse;
  created_at: string;
}

export interface AdminAccountListResponse {
  items: AdminAccountResponse[];
  total_count: number;
  total_pages: number;
  page: number;
  size: number;
}

export interface CreateAdminAccountRequest {
  /** Client code (extra_code / client_code / legacy_code) used to look up the client. */
  client_code: string;
  role_id: number;
  system_username: string;
  pin: string;
}

export interface UpdateAdminAccountRequest {
  system_username?: string;
  /** Plain-text PIN — will be bcrypt-hashed server-side. */
  pin?: string;
  role_id?: number;
}

export interface ResetAdminPinRequest {
  /** New plain-text PIN — will be bcrypt-hashed server-side. */
  new_pin: string;
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export interface CreateRoleRequest {
  name: string;
  description?: string;
  home_page?: string;
  permission_ids?: number[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string | null;
  home_page?: string | null;
}

// ---------------------------------------------------------------------------
// Audit Logs
// ---------------------------------------------------------------------------

export interface AuditLogResponse {
  id: number;
  admin_account_id: number | null;
  role_snapshot: string | null;
  action: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogListResponse {
  items: AuditLogResponse[];
  total_count: number;
  total_pages: number;
  page: number;
  size: number;
}

export interface GetAuditLogsParams {
  admin_account_id?: number;
  role_snapshot?: string;
  action?: string;
  page?: number;
  size?: number;
}

// ---------------------------------------------------------------------------
// JWT claims (client-side decode)
// ---------------------------------------------------------------------------

export interface AdminJwtClaims {
  /** "resource:action" permission slugs from the JWT. Empty for super-admins. */
  permissions: Set<string>;
  /** Role name stored in the token (e.g. "super-admin", "cashier"). */
  role_name: string;
  /** Default home page path from the role config (e.g. "/pos", "/admin/accounts"). */
  home_page: string | null;
  /**
   * True when the role is a super-admin variant.
   * Super-admins bypass all explicit permission checks — the backend omits
   * individual permissions from their JWT.
   */
  isSuperAdmin: boolean;
  /**
   * The Admin DB primary key — stored as `sub` (or `admin_id`) in the JWT.
   * Used to identify which cashier log entries belong to the current user.
   */
  admin_id: number | null;
}

/**
 * Decodes the admin access token from localStorage and extracts the JWT claims
 * needed for client-side RBAC and post-login routing.
 * Returns a safe empty-state object on any decode failure.
 */
export function getAdminJwtClaims(): AdminJwtClaims {
  const empty: AdminJwtClaims = {
    permissions: new Set(),
    role_name: '',
    home_page: null,
    isSuperAdmin: false,
    admin_id: null,
  };

  const token = localStorage.getItem('access_token');
  if (!token) return empty;

  try {
    const [, payloadB64] = token.split('.');
    // base64url → standard base64 → JSON
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as Record<string, unknown>;

    const role_name = String(payload.role_name ?? payload.role ?? '');
    const isSuperAdmin = role_name === 'super_admin' || role_name === 'super-admin';

    // admin_id lives in `sub` (standard JWT subject) or directly as `admin_id`
    const rawAdminId = payload.admin_id ?? payload.sub;
    const admin_id = rawAdminId != null ? Number(rawAdminId) : null;

    return {
      permissions: new Set((payload.permissions as string[] | undefined) ?? []),
      role_name,
      home_page: (payload.home_page as string | undefined) ?? null,
      isSuperAdmin,
      admin_id: Number.isFinite(admin_id) ? admin_id : null,
    };
  } catch {
    return empty;
  }
}

/** Convenience wrapper — use `getAdminJwtClaims()` when you also need role/home_page. */
export function getAdminPermissionSet(): Set<string> {
  return getAdminJwtClaims().permissions;
}

// ---------------------------------------------------------------------------
// Admin account endpoints
// ---------------------------------------------------------------------------

export interface GetAdminAccountsParams {
  role_id?: number;
  is_active?: boolean;
  page?: number;
  size?: number;
}

export async function getAdminAccounts(
  params: GetAdminAccountsParams = {},
): Promise<AdminAccountListResponse> {
  const res = await apiClient.get<AdminAccountListResponse>(
    '/api/v1/admin/manage/admin-accounts',
    { params },
  );
  return res.data;
}

export async function getAdminAccount(admin_account_id: number): Promise<AdminAccountResponse> {
  const res = await apiClient.get<AdminAccountResponse>(
    `/api/v1/admin/manage/admin-accounts/${admin_account_id}`,
  );
  return res.data;
}

export async function createAdminAccount(
  data: CreateAdminAccountRequest,
): Promise<AdminAccountResponse> {
  const res = await apiClient.post<AdminAccountResponse>(
    '/api/v1/admin/manage/admin-accounts',
    data,
  );
  return res.data;
}

export async function updateAdminAccount(
  admin_account_id: number,
  data: UpdateAdminAccountRequest,
): Promise<AdminAccountResponse> {
  const res = await apiClient.patch<AdminAccountResponse>(
    `/api/v1/admin/manage/admin-accounts/${admin_account_id}`,
    data,
  );
  return res.data;
}

export async function updateAdminStatus(
  admin_account_id: number,
  is_active: boolean,
): Promise<AdminAccountResponse> {
  const res = await apiClient.patch<AdminAccountResponse>(
    `/api/v1/admin/manage/admin-accounts/${admin_account_id}/status`,
    { is_active },
  );
  return res.data;
}

export async function resetAdminPin(
  admin_account_id: number,
  new_pin: string,
): Promise<AdminAccountResponse> {
  const res = await apiClient.post<AdminAccountResponse>(
    `/api/v1/admin/manage/admin-accounts/${admin_account_id}/reset-pin`,
    { new_pin } satisfies ResetAdminPinRequest,
  );
  return res.data;
}

export async function deleteAdminAccount(admin_account_id: number): Promise<void> {
  await apiClient.delete(`/api/v1/admin/manage/admin-accounts/${admin_account_id}`);
}

// ---------------------------------------------------------------------------
// Role endpoints
// ---------------------------------------------------------------------------

export async function getRoles(): Promise<RoleResponse[]> {
  const res = await apiClient.get<RoleResponse[]>('/api/v1/admin/manage/system-roles');
  return res.data;
}

export async function createRole(data: CreateRoleRequest): Promise<RoleResponse> {
  const res = await apiClient.post<RoleResponse>('/api/v1/admin/manage/system-roles', data);
  return res.data;
}

export async function updateRolePermissions(
  role_id: number,
  permission_ids: number[],
): Promise<RoleResponse> {
  const res = await apiClient.put<RoleResponse>(
    `/api/v1/admin/manage/system-roles/${role_id}/permissions`,
    { permission_ids },
  );
  return res.data;
}

export async function updateRole(role_id: number, data: UpdateRoleRequest): Promise<RoleResponse> {
  const res = await apiClient.patch<RoleResponse>(
    `/api/v1/admin/manage/system-roles/${role_id}`,
    data,
  );
  return res.data;
}

export async function deleteRole(role_id: number): Promise<void> {
  await apiClient.delete(`/api/v1/admin/manage/system-roles/${role_id}`);
}

// ---------------------------------------------------------------------------
// Permission endpoints
// ---------------------------------------------------------------------------

export async function getPermissions(): Promise<PermissionResponse[]> {
  const res = await apiClient.get<PermissionResponse[]>(
    '/api/v1/admin/manage/system-permissions',
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Audit log endpoints
// ---------------------------------------------------------------------------

export async function getAuditLogs(
  params: GetAuditLogsParams = {},
): Promise<AuditLogListResponse> {
  const res = await apiClient.get<AuditLogListResponse>(
    '/api/v1/admin/manage/system-audit-logs',
    { params },
  );
  return res.data;
}

export async function getAdminAuditLogs(
  admin_account_id: number,
  params: Pick<GetAuditLogsParams, 'action' | 'page' | 'size'> = {},
): Promise<AuditLogListResponse> {
  const res = await apiClient.get<AuditLogListResponse>(
    `/api/v1/admin/manage/admin-accounts/${admin_account_id}/audit-logs`,
    { params },
  );
  return res.data;
}
