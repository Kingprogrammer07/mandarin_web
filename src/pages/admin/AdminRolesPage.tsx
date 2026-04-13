import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Loader2, Plus, Shield, Lock, FileText, Check, Pencil, Trash2,
  AlertTriangle, Home, Sparkles, Info,
} from 'lucide-react';
import { motion } from 'framer-motion';

import {
  getRoles,
  getPermissions,
  createRole,
  updateRole,
  updateRolePermissions,
  deleteRole,
} from '../../api/services/adminManagement';
import type { RoleResponse, PermissionResponse, CreateRoleRequest } from '../../api/services/adminManagement';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '../../components/ui/drawer';
import { Skeleton } from '../../components/ui/skeleton';
import LightSelect from '../../components/ui/LightSelect';
import type { LightSelectOption } from '../../components/ui/LightSelect';

// ─── Permission label translations ────────────────────────────────────────────

const RESOURCE_MAP: Record<string, string> = {
  admin_accounts:  'Adminlar',
  roles:           'Rollar',
  audit_logs:      'Audit Jurnali',
  clients:         'Mijozlar',
  cargo:           'Yuklar',
  payments:        "To'lovlar",
  flights:         'Reyslar',
  stats:           'Statistika',
  pos:             'Kassa (POS)',
  carousel:        'Karusel',
  warehouse:       'Omborxona',
  expected_cargo:  'Kutilayotgan yuklar',
};

const ACTION_MAP: Record<string, string> = {
  read:    "Ko'rish",
  create:  "Qo'shish",
  update:  'Tahrirlash',
  delete:  "O'chirish",
  manage:  'Boshqarish',
  process: "To'lov qabul qilish",
  adjust:  'Balans tahriri',
  export:  'Eksport',
  block:   'Bloklash',
  ban:     'Bloklash',
  verify:  'Tasdiqlash',
  approve: 'Ruxsat berish',
  reject:  'Rad etish',
};

// ─── Home page constants ───────────────────────────────────────────────────────

/**
 * Exhaustive list of valid admin home pages.
 * Defined as a `const` tuple so z.enum() can derive a union type from it —
 * this means Zod rejects any value that isn't in this list even if the
 * client-side JS is tampered with before form submission.
 */
const VALID_HOME_PAGES = [
  '/admin/accounts',
  '/admin/roles',
  '/admin/audit',
  '/admin/profile',
  '/admin/carousel',
  '/pos',
  '/admin/flights',
  '/admin/warehouse',
  '/admin/clients',
  '/admin/expected-cargo',
] as const;

type ValidHomePage = (typeof VALID_HOME_PAGES)[number];

const HOME_PAGE_OPTIONS: LightSelectOption[] = [
  // { value: '/admin/accounts',       label: 'Admin Hisoblar' },
  { value: '/admin/flights',          label: 'Ishchi sahifasi (Reyslar)' },
  { value: '/admin/warehouse',        label: 'Omborxona' },
  { value: '/admin/expected-cargo',   label: 'Kutilayotgan yuklar' },
  { value: '/admin/clients',          label: 'Menedjer Sahifasi' },
  // { value: '/admin/carousel',       label: 'Karusel boshqaruvi' },
  // { value: '/admin/roles',          label: 'Rollar va Huquqlar' },
  // { value: '/admin/audit',          label: 'Audit Tarixi' },
  // { value: '/admin/profile',        label: 'Profil' },
  { value: '/pos',                    label: 'Kassa (POS)' },
];

/**
 * Defines which permission resource-groups are relevant for each home page.
 * Isolating permissions per role type helps admins avoid accidentally granting
 * unrelated access (e.g. a warehouse worker shouldn't see POS permissions).
 *
 * `null` means "show everything" — used for fully privileged pages.
 */
const HOME_PAGE_RESOURCE_PACKS: Record<ValidHomePage, string[] | null> = {
  '/admin/accounts':       ['admin_accounts', 'roles', 'audit_logs', 'stats'],
  '/admin/roles':          ['roles', 'audit_logs'],
  '/admin/audit':          ['audit_logs'],
  '/admin/profile':        null,
  '/admin/carousel':       ['carousel'],
  '/pos':                  ['pos', 'payments', 'cargo'],
  '/admin/flights':        ['flights', 'cargo', 'expected_cargo'],
  '/admin/warehouse':      ['warehouse', 'expected_cargo'],
  '/admin/clients':        ['clients', 'carousel'],
  '/admin/expected-cargo': ['expected_cargo'],
};

// ─── Schema ────────────────────────────────────────────────────────────────────

const formSchema = z.object({
  name: z.string().min(3, 'Kamida 3 ta belgi').max(64),
  description: z.string().optional(),
  // z.enum enforces the whitelist — rejects arbitrary strings even if someone
  // bypasses the UI and submits a crafted payload from the browser console.
  home_page: z.enum(VALID_HOME_PAGES, {
    message: "Ro'yxatdan sahifa tanlang",
  }),
  permission_ids: z.array(z.number()),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY_FORM: FormValues = {
  name: '',
  description: '',
  home_page: '/admin/accounts',
  permission_ids: [],
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  useEffect(() => {
    const fn = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return isDesktop;
}

/** Returns true if the role is a super-admin variant that bypasses all RBAC checks. */
function isSuperAdminRole(role: RoleResponse): boolean {
  const name = role.name.toLowerCase();
  return name === 'super-admin' || name === 'super_admin' || name === 'superadmin';
}

// ─── Shared styles ──────────────────────────────────────────────────────────────

const labelClass =
  'block text-[12px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5';
const inputClass =
  'w-full p-3 bg-gray-50/80 dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/[0.08] rounded-xl text-[14px] focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600';

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function AdminRolesPage() {
  const queryClient = useQueryClient();
  const isDesktop = useIsDesktop();
  const [isOpen, setIsOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleResponse | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: roles, isLoading: rolesLoading } = useQuery<RoleResponse[]>({
    queryKey: ['system-roles'],
    queryFn: getRoles,
  });

  const { data: permissions, isLoading: permsLoading } = useQuery<PermissionResponse[]>({
    queryKey: ['system-permissions'],
    queryFn: getPermissions,
  });

  // ── Form ───────────────────────────────────────────────────────────────────

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_FORM,
  });

  // Drive permission pack filtering reactively from the selected home_page
  const watchedHomePage = useWatch({
    control,
    name: 'home_page',
  }) ?? EMPTY_FORM.home_page;

  /**
   * Groups all permissions by resource, then filters to only the resources
   * relevant to the currently selected home_page.  When the pack is null
   * (e.g. /admin/profile), all groups are shown.
   */
  const filteredGroupedPermissions = useMemo(() => {
    if (!permissions) return null;

    const grouped = permissions.reduce(
      (acc, p) => {
        if (!acc[p.resource]) acc[p.resource] = [];
        acc[p.resource].push(p);
        return acc;
      },
      {} as Record<string, PermissionResponse[]>,
    );

    const pack = HOME_PAGE_RESOURCE_PACKS[watchedHomePage] ?? null;
    if (!pack) return grouped; // null → show all

    return Object.fromEntries(
      Object.entries(grouped).filter(([resource]) => pack.includes(resource)),
    );
  }, [permissions, watchedHomePage]);

  const handleModalOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (!open) {
        setEditingRole(null);
        reset(EMPTY_FORM);
      }
    },
    [reset],
  );

  const handleEditRole = useCallback(
    (role: RoleResponse) => {
      setEditingRole(role);
      reset({
        name: role.name,
        description: role.description ?? '',
        // Fallback to the first valid option if the stored value is somehow not in the list
        home_page: (VALID_HOME_PAGES as readonly string[]).includes(role.home_page ?? '')
          ? (role.home_page as ValidHomePage)
          : '/admin/accounts',
        permission_ids: role.permissions.map((p) => p.id),
      });
      setIsOpen(true);
    },
    [reset],
  );

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addRoleMut = useMutation({
    mutationFn: (data: CreateRoleRequest) => createRole(data),
    onSuccess: () => {
      toast.success('Yangi rol muvaffaqiyatli yaratildi');
      queryClient.invalidateQueries({ queryKey: ['system-roles'] });
      handleModalOpenChange(false);
    },
    onError: (err: unknown) => {
      const error = err as { message?: string };
      toast.error(error.message || "Rol qo'shishda xatolik yuz berdi");
    },
  });

  // Edit calls updateRole (name/description/home_page) then updateRolePermissions sequentially
  const editRoleMut = useMutation({
    mutationFn: async ({ role_id, data }: { role_id: number; data: FormValues }) => {
      await updateRole(role_id, {
        name: data.name,
        description: data.description || null,
        home_page: data.home_page,
      });
      return updateRolePermissions(role_id, data.permission_ids);
    },
    onSuccess: () => {
      toast.success('Rol muvaffaqiyatli yangilandi');
      queryClient.invalidateQueries({ queryKey: ['system-roles'] });
      handleModalOpenChange(false);
    },
    onError: (err: unknown) => {
      const error = err as { message?: string };
      toast.error(error.message || 'Rol yangilashda xatolik yuz berdi');
    },
  });

  const deleteRoleMut = useMutation({
    mutationFn: (role_id: number) => deleteRole(role_id),
    onSuccess: () => {
      toast.success("Rol muvaffaqiyatli o'chirildi");
      queryClient.invalidateQueries({ queryKey: ['system-roles'] });
      setPendingDeleteId(null);
    },
    onError: (err: unknown) => {
      const error = err as { message?: string };
      toast.error(error.message || "Rolni o'chirishda xatolik yuz berdi");
      setPendingDeleteId(null);
    },
  });

  const onSubmit = (data: FormValues) => {
    if (editingRole) {
      editRoleMut.mutate({ role_id: editingRole.id, data });
    } else {
      addRoleMut.mutate({
        name: data.name,
        description: data.description || undefined,
        home_page: data.home_page,
        permission_ids: data.permission_ids,
      });
    }
  };

  const isPending = addRoleMut.isPending || editRoleMut.isPending;
  const modalTitle = editingRole ? 'Rolni Tahrirlash' : 'Yangi Rol Yaratish';

  // Portal container for LightSelect dropdowns — a div inside the modal DOM tree
  // so Radix FocusScope does not block pointer events on the dropdown.
  // useState (not useRef) so the component re-renders when the node is mounted.
  const [lsPortalEl, setLsPortalEl] = useState<HTMLDivElement | null>(null);
  const lsPortalCallbackRef = useCallback((node: HTMLDivElement | null) => {
    setLsPortalEl(node);
  }, []);

  /**
   * Determines if the role being edited is a super-admin type — if so we show a
   * "full access" banner instead of the permission checkboxes, because super-admin
   * roles bypass RBAC entirely on the backend (no individual permissions stored).
   */
  const isEditingSuperAdmin = editingRole ? isSuperAdminRole(editingRole) : false;

  // How many resources the current pack covers — shown as a hint below the selector
  const packHint = useMemo(() => {
    const pack = HOME_PAGE_RESOURCE_PACKS[watchedHomePage];
    if (pack === null) return null;
    return pack
      .map((r) => RESOURCE_MAP[r] ?? r)
      .join(', ');
  }, [watchedHomePage]);

  // ── Form body (fields only — button is rendered separately and associated
  //    via form="role-form" so it can live outside the scroll container) ──────

  const FormBody = (
    <form id="role-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">

      {/* Name */}
      <div>
        <label className={labelClass}>Rol nomi</label>
        <input
          type="text"
          {...register('name')}
          className={inputClass}
          placeholder="Masalan: Moderator"
        />
        {errors.name && (
          <p className="text-red-500 text-[12px] mt-1.5 font-medium">{errors.name.message}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className={labelClass}>
          Tavsif{' '}
          <span className="text-gray-400 dark:text-gray-600 normal-case">(ixtiyoriy)</span>
        </label>
        <input
          type="text"
          {...register('description')}
          className={inputClass}
          placeholder="Qisqacha izoh"
        />
      </div>

      {/* Home page — LightSelect enforces the whitelist in the UI;
          z.enum enforces it at the Zod validation layer */}
      <div>
        <label className={labelClass}>Bosh sahifa</label>
        <Controller
          name="home_page"
          control={control}
          render={({ field }) => (
            <LightSelect
              options={HOME_PAGE_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              placeholder="Sahifani tanlang..."
              error={!!errors.home_page}
              portalContainer={lsPortalEl}
            />
          )}
        />
        {errors.home_page && (
          <p className="text-red-500 text-[12px] mt-1.5 font-medium">{errors.home_page.message}</p>
        )}
        {/* Pack hint — shows which resource groups will be visible */}
        {packHint && (
          <div className="flex items-start gap-1.5 mt-2 px-3 py-2 bg-blue-50/80 dark:bg-blue-500/[0.06] border border-blue-100 dark:border-blue-500/20 rounded-xl">
            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-600 dark:text-blue-400 leading-relaxed">
              Bu sahifa uchun faqat quyidagi bo'limlar ko'rsatiladi: <strong>{packHint}</strong>
            </p>
          </div>
        )}
      </div>

      {/* Permissions */}
      <div className="space-y-4">
        <label className={labelClass}>Huquqlar</label>

        {/* Super-admin full-access banner — replaces the checkbox list */}
        {isEditingSuperAdmin ? (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-500/[0.08] dark:to-amber-500/[0.06] border border-orange-200/60 dark:border-orange-500/20">
            <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-orange-700 dark:text-orange-300">
                Barcha huquqlar berilgan
              </p>
              <p className="text-[11px] text-orange-500/80 dark:text-orange-400/70 mt-0.5 leading-relaxed">
                Super-admin rollari tizim darajasida barcha amallarni bajarishga ruxsat oladi.
                Alohida huquqlar belgilanmaydi.
              </p>
            </div>
          </div>
        ) : permsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : (
          <Controller
            name="permission_ids"
            control={control}
            render={({ field }) => (
              <div className="space-y-4">
                {filteredGroupedPermissions &&
                  Object.entries(filteredGroupedPermissions).map(([resource, perms]) => (
                    <div
                      key={resource}
                      className="rounded-2xl border border-gray-100 dark:border-white/[0.06] overflow-hidden"
                    >
                      <div className="px-4 py-2.5 bg-gray-50/80 dark:bg-white/[0.03] border-b border-gray-100 dark:border-white/[0.06]">
                        <h3 className="text-[12px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                          {RESOURCE_MAP[resource] ?? resource.replace('_', ' ')}
                        </h3>
                      </div>
                      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {perms.map((p) => {
                          const isChecked = field.value.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                                isChecked
                                  ? 'bg-orange-50 dark:bg-orange-500/[0.08]'
                                  : 'hover:bg-gray-50 dark:hover:bg-white/[0.02]'
                              }`}
                            >
                              <div className="relative flex items-center">
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const val = field.value || [];
                                    if (e.target.checked) field.onChange([...val, p.id]);
                                    else field.onChange(val.filter((id) => id !== p.id));
                                  }}
                                />
                                <div
                                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                    isChecked
                                      ? 'bg-orange-500 border-orange-500 shadow-sm shadow-orange-500/20'
                                      : 'border-gray-300 dark:border-gray-600'
                                  }`}
                                >
                                  {isChecked && (
                                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                  )}
                                </div>
                              </div>
                              <span
                                className={`text-[13px] transition-colors ${
                                  isChecked
                                    ? 'text-orange-700 dark:text-orange-300 font-medium'
                                    : 'text-gray-600 dark:text-gray-400'
                                }`}
                              >
                                {ACTION_MAP[p.action] ?? p.action}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                {/* Empty state when the pack has no matching resources yet */}
                {filteredGroupedPermissions &&
                  Object.keys(filteredGroupedPermissions).length === 0 && (
                    <div className="flex flex-col items-center py-8 text-gray-400 dark:text-gray-600 bg-gray-50/60 dark:bg-white/[0.02] rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/[0.06]">
                      <Lock className="w-7 h-7 mb-2 text-gray-300 dark:text-gray-700" strokeWidth={1.5} />
                      <p className="text-[13px] font-medium">Huquqlar mavjud emas</p>
                      <p className="text-[11px] mt-0.5">
                        Bu sahifa uchun alohida huquqlar belgilanmagan
                      </p>
                    </div>
                  )}
              </div>
            )}
          />
        )}
        {errors.permission_ids && (
          <p className="text-red-500 text-[12px] mt-1">{errors.permission_ids.message}</p>
        )}
      </div>
    </form>
  );

  // Submit button lives outside the scroll container but targets the form via id
  const SubmitButton = (
    <motion.button
      type="submit"
      form="role-form"
      disabled={isPending}
      whileTap={{ scale: 0.97 }}
      className="w-full flex justify-center py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl transition-all font-semibold text-[14px] shadow-lg shadow-orange-500/20 disabled:opacity-60"
    >
      {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Saqlash'}
    </motion.button>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-row items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">
            Rollar va Huquqlar
          </h1>
          <p className="text-[13px] text-gray-500 dark:text-gray-500 mt-1">
            Tizimdagi rollar va ruxsatnomalar
          </p>
        </div>
        <motion.button
          onClick={() => setIsOpen(true)}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-orange-500/20 text-[13px] font-semibold"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Yangi Rol</span>
        </motion.button>
      </div>

      {/* Roles Grid */}
      {rolesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-[20px] dark:bg-white/5" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
          {roles?.map((role, index) => {
            const superAdmin = isSuperAdminRole(role);
            const permissionCount = role.permissions?.length ?? 0;

            return (
              <motion.div
                key={role.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="bg-white dark:bg-[#111] rounded-[20px] p-5 shadow-sm border border-black/[0.05] dark:border-white/[0.06] flex flex-col relative overflow-hidden group hover:shadow-md hover:border-orange-200/50 dark:hover:border-orange-500/20 transition-all"
              >
                {/* System role badge */}
                {!role.is_custom && (
                  <div className="absolute top-4 right-4">
                    <div
                      className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/[0.06] text-gray-400 dark:text-gray-500"
                      title="Tizim roli"
                    >
                      <Lock className="w-3 h-3" />
                      <span className="text-[10px] font-medium">Tizim</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform ${
                    superAdmin
                      ? 'bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-500/20 dark:to-amber-500/15'
                      : 'bg-orange-50 dark:bg-orange-500/[0.1]'
                  }`}>
                    {superAdmin
                      ? <Sparkles className="w-5 h-5 text-orange-500" strokeWidth={1.8} />
                      : <Shield className="w-5 h-5 text-orange-500" strokeWidth={1.8} />
                    }
                  </div>
                  <h3 className="text-[15px] font-bold text-gray-900 dark:text-white tracking-tight">
                    {role.name}
                  </h3>
                </div>

                <p className="text-[12px] text-gray-500 dark:text-gray-500 mb-3 flex-1 leading-relaxed">
                  {role.description || 'Tavsif kiritilmagan'}
                </p>

                {/* Home page indicator */}
                {role.home_page && (
                  <div className="flex items-center gap-1.5 mb-4 text-[11px] text-gray-400 dark:text-gray-500">
                    <Home className="w-3 h-3 shrink-0" />
                    <span className="font-mono truncate">{role.home_page}</span>
                  </div>
                )}

                <div className="border-t border-gray-100 dark:border-white/[0.05] pt-4 space-y-3">
                  <div className="flex items-center justify-between">

                    {/* Permission count — super-admin shows "Barcha huquqlar" */}
                    {superAdmin ? (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-orange-500 dark:text-orange-400">
                        <Sparkles className="w-3 h-3" />
                        Barcha huquqlar
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        <FileText className="w-3 h-3" />
                        {permissionCount} ta huquq
                      </div>
                    )}

                    {/* Edit & Delete — custom roles only */}
                    {role.is_custom && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditRole(role)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/[0.08] transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                          Tahrirlash
                        </button>
                        <button
                          onClick={() => setPendingDeleteId(role.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/[0.08] transition-colors"
                          title="O'chirish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Inline delete confirmation */}
                  {pendingDeleteId === role.id && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-500/[0.08] border border-red-200/60 dark:border-red-500/20"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span className="text-[11px] text-red-600 dark:text-red-400 font-medium flex-1">
                        O'chirilsinmi?
                      </span>
                      <button
                        onClick={() => deleteRoleMut.mutate(role.id)}
                        disabled={deleteRoleMut.isPending}
                        className="px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[11px] font-semibold transition-colors disabled:opacity-60"
                      >
                        {deleteRoleMut.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          'Ha'
                        )}
                      </button>
                      <button
                        onClick={() => setPendingDeleteId(null)}
                        disabled={deleteRoleMut.isPending}
                        className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/[0.1] text-gray-600 dark:text-gray-400 text-[11px] font-semibold transition-colors disabled:opacity-60"
                      >
                        Yo'q
                      </button>
                    </motion.div>
                  )}

                  {/* Permission badges — skip for super-admin */}
                  {!superAdmin && (
                    <div className="flex flex-wrap gap-1.5">
                      {role.permissions?.slice(0, 4).map((p) => (
                        <span
                          key={p.id}
                          title={`${p.resource}:${p.action}`}
                          className="inline-block px-2 py-[3px] rounded-md text-[10px] font-medium bg-gray-50 dark:bg-white/[0.05] text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-white/[0.05]"
                        >
                          {RESOURCE_MAP[p.resource] ?? p.resource}:{ACTION_MAP[p.action] ?? p.action}
                        </span>
                      ))}
                      {role.permissions && role.permissions.length > 4 && (
                        <span className="inline-block px-2 py-[3px] rounded-md text-[10px] font-semibold bg-orange-50 dark:bg-orange-500/[0.08] text-orange-500">
                          +{role.permissions.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}

          {(!roles || roles.length === 0) && (
            <div className="col-span-full text-center py-16 text-gray-400 bg-white/50 dark:bg-white/[0.02] rounded-[20px] border-2 border-dashed border-gray-200 dark:border-white/[0.08]">
              <Shield
                className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600"
                strokeWidth={1.5}
              />
              <p className="text-[14px] font-medium">Hech qanday rol topilmadi</p>
              <p className="text-[12px] text-gray-400 mt-1">Yangi rol qo'shish tugmasini bosing</p>
            </div>
          )}
        </div>
      )}

      {/* ── Add / Edit Role Modal ──
          The form body and submit button are separated:
          - FormBody renders <form id="role-form"> (no button inside)
          - SubmitButton uses form="role-form" to associate with it
          This guarantees the button is always visible outside the scroll area. */}

      {isDesktop ? (
        <Dialog open={isOpen} onOpenChange={handleModalOpenChange}>
          <DialogContent className="sm:max-w-[500px] flex flex-col gap-0 max-h-[88vh] p-0 overflow-hidden">
            {/* LightSelect dropdown portal target — must be inside DialogContent
                so Radix FocusScope does not block pointer events on the dropdown */}
            <div ref={lsPortalCallbackRef} />

            <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b border-gray-100 dark:border-white/[0.06]">
              <DialogTitle>{modalTitle}</DialogTitle>
              <DialogDescription className="sr-only">
                Rol huquqlarini boshqarish uchun quyidagi formani to'ldiring.
              </DialogDescription>
            </DialogHeader>

            {/* Scrollable fields */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {FormBody}
            </div>

            {/* Always-visible submit button */}
            <div className="shrink-0 px-6 pb-6 pt-4 border-t border-gray-100 dark:border-white/[0.06]">
              {SubmitButton}
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={isOpen} onOpenChange={handleModalOpenChange}>
          <DrawerContent className="flex flex-col max-h-[92vh]">
            {/* LightSelect dropdown portal target — must be inside DrawerContent */}
            <div ref={lsPortalCallbackRef} />

            <DrawerHeader className="shrink-0 text-left px-4 pt-4 pb-3 border-b border-gray-100 dark:border-white/[0.06]">
              <DrawerTitle>{modalTitle}</DrawerTitle>
              <DrawerDescription className="sr-only">
                Rol huquqlarini boshqarish uchun quyidagi formani to'ldiring.
              </DrawerDescription>
            </DrawerHeader>

            {/* Scrollable fields */}
            <div className="flex-1 overflow-y-auto px-4 py-5">
              {FormBody}
            </div>

            {/* Always-visible submit button — pb accounts for iOS home indicator */}
            <div className="shrink-0 px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] border-t border-gray-100 dark:border-white/[0.06]">
              {SubmitButton}
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
