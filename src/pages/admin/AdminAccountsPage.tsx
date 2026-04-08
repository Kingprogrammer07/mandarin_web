import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Loader2, Plus, Shield, UserCircle, ChevronLeft, ChevronRight,
  AlertTriangle, Trash2, KeyRound, Info, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import LightSelect from '../../components/ui/LightSelect';
import type { LightSelectOption as SelectOption } from '../../components/ui/LightSelect';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '../../components/ui/drawer';
import { Switch } from '../../components/ui/switch';
import { Skeleton } from '../../components/ui/skeleton';

import {
  getAdminAccounts,
  updateAdminStatus,
  getRoles,
  createAdminAccount,
  updateAdminAccount,
  resetAdminPin,
  deleteAdminAccount,
} from '../../api/services/adminManagement';
import type {
  AdminAccountResponse,
  AdminAccountListResponse,
  RoleResponse,
} from '../../api/services/adminManagement';

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isDesktop;
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createAdminSchema = z.object({
  client_code: z.string().min(1, "Mijoz kodini kiriting"),
  system_username: z.string().min(3, "Kamida 3 ta belgi"),
  pin: z.string().min(4, "Kamida 4 ta raqam").max(64),
  role_id: z.string().min(1, "Rolni tanlang"),
});

const editAdminSchema = z.object({
  system_username: z.string().min(3, "Kamida 3 ta belgi"),
  role_id: z.string().min(1, "Rolni tanlang"),
});

const pinResetSchema = z.object({
  new_pin: z.string().min(4, "Kamida 4 ta raqam").max(64),
});

type CreateAdminFormValues = z.infer<typeof createAdminSchema>;
type EditAdminFormValues = z.infer<typeof editAdminSchema>;
type PinResetFormValues = z.infer<typeof pinResetSchema>;

type DetailTab = 'info' | 'pin' | 'danger';

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uz-UZ', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge = memo(({ isActive }: { isActive: boolean }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
    isActive
      ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      : 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400'
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
    {isActive ? 'Faol' : 'Bloklangan'}
  </span>
));
StatusBadge.displayName = 'StatusBadge';

// ─── Desktop Table Row ────────────────────────────────────────────────────────

interface AdminTableRowProps {
  admin: AdminAccountResponse;
  onRowClick: (admin: AdminAccountResponse) => void;
  onToggleStatus: (admin: AdminAccountResponse) => void;
  isToggling: boolean;
}

const AdminTableRow = memo(({
  admin, onRowClick, onToggleStatus, isToggling
}: AdminTableRowProps) => (
  <tr
    className="border-b border-black/[0.04] dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
    onClick={() => onRowClick(admin)}
  >
    <td className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center flex-shrink-0">
          <UserCircle className="w-4 h-4 text-orange-500" />
        </div>
        <div>
          <p className="text-[13px] font-medium text-gray-900 dark:text-white">
            {admin.system_username}
          </p>
          {admin.client?.full_name && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500">{admin.client.full_name}</p>
          )}
        </div>
      </div>
    </td>
    <td className="px-4 py-3 text-[13px] text-gray-600 dark:text-gray-400">
      {admin.client?.client_code ?? '—'}
    </td>
    <td className="px-4 py-3">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400">
        <Shield className="w-3 h-3" />
        {admin.role_name ?? '—'}
      </span>
    </td>
    <td className="px-4 py-3">
      <StatusBadge isActive={admin.is_active} />
    </td>
    <td className="px-4 py-3 text-[13px] text-gray-500 dark:text-gray-500">
      {formatDate(admin.created_at)}
    </td>
    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
      <Switch
        checked={admin.is_active}
        onCheckedChange={() => onToggleStatus(admin)}
        disabled={isToggling}
        className="scale-90"
      />
    </td>
  </tr>
));
AdminTableRow.displayName = 'AdminTableRow';

// ─── Mobile Card ──────────────────────────────────────────────────────────────

interface AdminMobileCardProps {
  admin: AdminAccountResponse;
  onCardClick: (admin: AdminAccountResponse) => void;
  onToggleStatus: (admin: AdminAccountResponse) => void;
  isToggling: boolean;
}

const AdminMobileCard = memo(({
  admin, onCardClick, onToggleStatus, isToggling
}: AdminMobileCardProps) => (
  <div
    className="bg-white dark:bg-[#111] rounded-[18px] border border-black/[0.05] dark:border-white/[0.06] p-4 cursor-pointer active:opacity-80 transition-opacity"
    onClick={() => onCardClick(admin)}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center flex-shrink-0">
          <UserCircle className="w-5 h-5 text-orange-500" />
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-gray-900 dark:text-white truncate">
            {admin.system_username}
          </p>
          {admin.client?.full_name && (
            <p className="text-[12px] text-gray-400 dark:text-gray-500 truncate">
              {admin.client.full_name}
            </p>
          )}
        </div>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <Switch
          checked={admin.is_active}
          onCheckedChange={() => onToggleStatus(admin)}
          disabled={isToggling}
          className="scale-90 flex-shrink-0"
        />
      </div>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400">
        <Shield className="w-3 h-3" />
        {admin.role_name ?? '—'}
      </span>
      <StatusBadge isActive={admin.is_active} />
      {admin.client?.client_code && (
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          #{admin.client.client_code}
        </span>
      )}
    </div>
    <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-600">
      {formatDate(admin.created_at)}
    </p>
  </div>
));
AdminMobileCard.displayName = 'AdminMobileCard';

// ─── Create Admin Form ────────────────────────────────────────────────────────

interface CreateAdminFormProps {
  roles: RoleResponse[];
  onSuccess: () => void;
  onClose: () => void;
}

const CreateAdminForm = memo(({ roles, onSuccess, onClose }: CreateAdminFormProps) => {
  const queryClient = useQueryClient();

  const roleOptions: SelectOption[] = useMemo(() =>
    roles.map((r) => ({ value: String(r.id), label: r.name })),
    [roles]
  );

  const { register, handleSubmit, control, formState: { errors } } = useForm<CreateAdminFormValues>({
    resolver: zodResolver(createAdminSchema),
  });

  // Portal target for LightSelect — must be inside this component's DOM so
  // Radix FocusScope (used by the surrounding Dialog/Drawer) does not block it.
  const [lsPortalEl, setLsPortalEl] = useState<HTMLDivElement | null>(null);

  const { mutate: create, isPending } = useMutation({
    mutationFn: createAdminAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
      toast.success("Admin muvaffaqiyatli yaratildi");
      onSuccess();
    },
    onError: () => {
      toast.error("Admin yaratishda xatolik yuz berdi");
    },
  });

  const onSubmit = (values: CreateAdminFormValues) => {
    create({ ...values, role_id: Number(values.role_id) });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      <div ref={setLsPortalEl} />
      <div>
        <label className="block text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1">
          Mijoz kodi
        </label>
        <input
          {...register('client_code')}
          placeholder="M-000000"
          className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 text-[13px] transition-all"
        />
        {errors.client_code && (
          <p className="mt-1 text-[11px] text-red-500">{errors.client_code.message}</p>
        )}
      </div>

      <div>
        <label className="block text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1">
          Foydalanuvchi nomi
        </label>
        <input
          {...register('system_username')}
          placeholder="username"
          className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 text-[13px] transition-all"
        />
        {errors.system_username && (
          <p className="mt-1 text-[11px] text-red-500">{errors.system_username.message}</p>
        )}
      </div>

      <div>
        <label className="block text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1">
          PIN kod
        </label>
        <input
          {...register('pin')}
          type="password"
          placeholder="••••"
          className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 text-[13px] transition-all"
        />
        {errors.pin && (
          <p className="mt-1 text-[11px] text-red-500">{errors.pin.message}</p>
        )}
      </div>

      <div>
        <label className="block text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1">
          Rol
        </label>
        <Controller
          name="role_id"
          control={control}
          render={({ field }) => (
            <LightSelect
              options={roleOptions}
              value={field.value}
              onChange={field.onChange}
              placeholder="Rolni tanlang"
              portalContainer={lsPortalEl}
            />
          )}
        />
        {errors.role_id && (
          <p className="mt-1 text-[11px] text-red-500">{errors.role_id.message}</p>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-10 rounded-xl border border-gray-200 dark:border-white/[0.08] text-[13px] font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
        >
          Bekor qilish
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 h-10 rounded-xl bg-orange-500 text-white text-[13px] font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Yaratish
        </button>
      </div>
    </form>
  );
});
CreateAdminForm.displayName = 'CreateAdminForm';

// ─── Detail Sheet ─────────────────────────────────────────────────────────────

interface AdminDetailSheetProps {
  admin: AdminAccountResponse | null;
  roles: RoleResponse[];
  isOpen: boolean;
  onClose: () => void;
}

const AdminDetailSheet = memo(({ admin, roles, isOpen, onClose }: AdminDetailSheetProps) => {
  const isDesktop = useIsDesktop();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<DetailTab>('info');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Portal target for LightSelect dropdowns inside this Sheet/Dialog.
  const [lsPortalEl, setLsPortalEl] = useState<HTMLDivElement | null>(null);

  const roleOptions: SelectOption[] = useMemo(() =>
    roles.map((r) => ({ value: String(r.id), label: r.name })),
    [roles]
  );

  // ── Edit form ──
  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    control: editControl,
    reset: resetEditForm,
    formState: { errors: editErrors },
  } = useForm<EditAdminFormValues>({
    resolver: zodResolver(editAdminSchema),
    defaultValues: {
      system_username: admin?.system_username ?? '',
      role_id: String(admin?.role_id ?? ''),
    },
  });

  // ── PIN form ──
  const {
    register: registerPin,
    handleSubmit: handlePinSubmit,
    reset: resetPinForm,
    formState: { errors: pinErrors },
  } = useForm<PinResetFormValues>({
    resolver: zodResolver(pinResetSchema),
  });

  // Sync form when admin changes
  useEffect(() => {
    if (admin) {
      resetEditForm({
        system_username: admin.system_username,
        role_id: String(admin.role_id ?? ''),
      });
    }
  }, [admin, resetEditForm]);

  // Reset tab/confirm state when sheet opens with a different admin
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setActiveTab('info');
      setIsConfirmingDelete(false);
      onClose();
    }
  }, [onClose]);

  // ── Mutations ──
  const { mutate: updateAdmin, isPending: isUpdatingAdmin } = useMutation({
    mutationFn: (values: EditAdminFormValues) =>
      updateAdminAccount(admin!.id, {
        system_username: values.system_username,
        role_id: Number(values.role_id),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
      toast.success("Ma'lumotlar yangilandi");
    },
    onError: () => {
      toast.error("Yangilashda xatolik yuz berdi");
    },
  });

  const { mutate: toggleStatus, isPending: isTogglingStatus } = useMutation({
    mutationFn: () => updateAdminStatus(admin!.id, !admin!.is_active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
      toast.success(`Status ${admin?.is_active ? "bloklandi" : "faollashtirildi"}`);
    },
    onError: () => {
      toast.error("Status o'zgartirishda xatolik");
    },
  });

  const { mutate: resetPin, isPending: isResettingPin } = useMutation({
    mutationFn: (values: PinResetFormValues) => resetAdminPin(admin!.id, values.new_pin),
    onSuccess: () => {
      resetPinForm();
      toast.success("PIN muvaffaqiyatli yangilandi");
    },
    onError: () => {
      toast.error("PIN yangilashda xatolik yuz berdi");
    },
  });

  const { mutate: deleteAdmin, isPending: isDeletingAdmin } = useMutation({
    mutationFn: () => deleteAdminAccount(admin!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
      toast.success("Admin o'chirildi");
      handleOpenChange(false);
    },
    onError: () => {
      toast.error("O'chirishda xatolik yuz berdi");
    },
  });

  if (!admin) return null;

  const tabs: { key: DetailTab; label: string; icon: React.ReactNode }[] = [
    { key: 'info', label: "Ma'lumotlar", icon: <Info className="w-3.5 h-3.5" /> },
    { key: 'pin', label: 'PIN', icon: <KeyRound className="w-3.5 h-3.5" /> },
    { key: 'danger', label: 'Xavfli zona', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  ];

  const sheetContent = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex gap-1 px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.06] flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[12px] font-medium transition-all ${
              activeTab === tab.key
                ? tab.key === 'danger'
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                  : 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                : 'text-gray-500 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.04]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'info' && (
            <motion.div
              key="info"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="p-4 space-y-5"
            >
              {/* Read-only info */}
              <div className="bg-gray-50 dark:bg-white/[0.03] rounded-2xl p-4 space-y-3 border border-gray-100 dark:border-white/[0.06]">
                <h3 className="text-[12px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Asosiy ma'lumotlar
                </h3>
                {[
                  { label: "To'liq ism", value: admin.client?.full_name ?? '—' },
                  { label: "Mijoz kodi", value: admin.client?.client_code ?? '—' },
                  { label: "Yaratilgan", value: formatDate(admin.created_at) },
                  {
                    label: "Muvaffaqiyatsiz urinishlar",
                    value: (
                      <span className={`font-semibold ${
                        (admin.failed_login_attempts ?? 0) > 0
                          ? 'text-red-500'
                          : 'text-gray-600 dark:text-gray-300'
                      }`}>
                        {admin.failed_login_attempts ?? 0}
                      </span>
                    ),
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-4">
                    <span className="text-[12px] text-gray-500 dark:text-gray-500">{label}</span>
                    <span className="text-[13px] text-gray-800 dark:text-gray-200 text-right">
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Edit form */}
              <form onSubmit={handleEditSubmit((v) => updateAdmin(v))} className="space-y-3">
                <h3 className="text-[12px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Tahrirlash
                </h3>

                <div>
                  <label className="block text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Foydalanuvchi nomi
                  </label>
                  <input
                    {...registerEdit('system_username')}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 text-[13px] transition-all"
                  />
                  {editErrors.system_username && (
                    <p className="mt-1 text-[11px] text-red-500">{editErrors.system_username.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Rol
                  </label>
                  <Controller
                    name="role_id"
                    control={editControl}
                    render={({ field }) => (
                      <LightSelect
                        options={roleOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Rolni tanlang"
                        portalContainer={lsPortalEl}
                      />
                    )}
                  />
                  {editErrors.role_id && (
                    <p className="mt-1 text-[11px] text-red-500">{editErrors.role_id.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingAdmin}
                  className="w-full h-10 rounded-xl bg-orange-500 text-white text-[13px] font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUpdatingAdmin && <Loader2 className="w-4 h-4 animate-spin" />}
                  Saqlash
                </button>
              </form>

              {/* Status toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/[0.03] rounded-2xl border border-gray-100 dark:border-white/[0.06]">
                <div>
                  <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200">
                    Hisob holati
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                    {admin.is_active ? 'Hozirda faol' : 'Bloklangan'}
                  </p>
                </div>
                <Switch
                  checked={admin.is_active}
                  onCheckedChange={() => toggleStatus()}
                  disabled={isTogglingStatus}
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'pin' && (
            <motion.div
              key="pin"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="p-4 space-y-4"
            >
              {(admin.failed_login_attempts ?? 0) > 0 && (
                <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-500/10 rounded-2xl border border-red-100 dark:border-red-500/20">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <div>
                    <p className="text-[12px] font-semibold text-red-700 dark:text-red-400">
                      Bloklangan urinishlar
                    </p>
                    <p className="text-[11px] text-red-500 dark:text-red-400/80 mt-0.5">
                      {admin.failed_login_attempts} ta muvaffaqiyatsiz urinish qayd etildi
                    </p>
                  </div>
                  <span className="ml-auto text-[20px] font-bold text-red-500">
                    {admin.failed_login_attempts}
                  </span>
                </div>
              )}

              <form onSubmit={handlePinSubmit((v) => resetPin(v))} className="space-y-3">
                <h3 className="text-[12px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Yangi PIN
                </h3>

                <div>
                  <label className="block text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Yangi PIN kod
                  </label>
                  <input
                    {...registerPin('new_pin')}
                    type="password"
                    placeholder="••••"
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 text-[13px] transition-all"
                  />
                  {pinErrors.new_pin && (
                    <p className="mt-1 text-[11px] text-red-500">{pinErrors.new_pin.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isResettingPin}
                  className="w-full h-10 rounded-xl bg-orange-500 text-white text-[13px] font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isResettingPin && <Loader2 className="w-4 h-4 animate-spin" />}
                  PIN yangilash
                </button>
              </form>
            </motion.div>
          )}

          {activeTab === 'danger' && (
            <motion.div
              key="danger"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="p-4 space-y-4"
            >
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-500/[0.06] rounded-2xl border border-red-100 dark:border-red-500/20">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-semibold text-red-700 dark:text-red-400">
                    Ehtiyot bo'ling
                  </p>
                  <p className="text-[12px] text-red-500 dark:text-red-400/80 mt-1 leading-relaxed">
                    Quyidagi amallar qaytarib bo'lmaydi. Admin hisobini o'chirish barcha bog'liq
                    ma'lumotlarni ham o'chirishi mumkin.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-white/[0.03] rounded-2xl border border-gray-100 dark:border-white/[0.06] space-y-3">
                <div>
                  <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">
                    Admin hisobini o'chirish
                  </p>
                  <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                    <span className="font-medium text-gray-600 dark:text-gray-300">
                      @{admin.system_username}
                    </span>{' '}
                    hisobi butunlay o'chiriladi.
                  </p>
                </div>

                <AnimatePresence mode="wait">
                  {!isConfirmingDelete ? (
                    <motion.button
                      key="delete-btn"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsConfirmingDelete(true)}
                      className="w-full h-10 rounded-xl bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-[13px] font-semibold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Admin hisobini o'chirish
                    </motion.button>
                  ) : (
                    <motion.div
                      key="confirm-section"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="space-y-2"
                    >
                      <p className="text-[12px] text-center text-red-500 dark:text-red-400 font-medium">
                        Haqiqatan ham o'chirmoqchimisiz?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsConfirmingDelete(false)}
                          className="flex-1 h-9 rounded-xl border border-gray-200 dark:border-white/[0.08] text-[13px] font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
                        >
                          Bekor qilish
                        </button>
                        <button
                          onClick={() => deleteAdmin()}
                          disabled={isDeletingAdmin}
                          className="flex-1 h-9 rounded-xl bg-red-500 text-white text-[13px] font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isDeletingAdmin && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Tasdiqlash
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className={`p-0 flex flex-col bg-white dark:bg-[#111] border-l border-black/[0.06] dark:border-white/[0.06] ${
          isDesktop ? 'max-w-lg' : 'w-full'
        }`}
      >
        {/* LightSelect dropdown portal target — inside SheetContent so Radix
            FocusScope does not intercept pointer events on the dropdown. */}
        <div ref={setLsPortalEl} />
        <SheetHeader className="px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.06] flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
                <UserCircle className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <SheetTitle className="text-[15px] font-semibold text-gray-900 dark:text-white">
                  @{admin.system_username}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Admin hisobi tafsilotlari va boshqaruv
                </SheetDescription>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                  {admin.role_name ?? 'Rol yo\u02bcq'}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleOpenChange(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </SheetHeader>
        {sheetContent}
      </SheetContent>
    </Sheet>
  );
});
AdminDetailSheet.displayName = 'AdminDetailSheet';

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminAccountsPage() {
  const isDesktop = useIsDesktop();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminAccountResponse | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { data: accountsData, isLoading: isLoadingAccounts } = useQuery<AdminAccountListResponse>({
    queryKey: ['admin-accounts', page],
    queryFn: () => getAdminAccounts({ page }),
  });

  const { data: rolesData, isLoading: isLoadingRoles } = useQuery<RoleResponse[]>({
    queryKey: ['roles'],
    queryFn: getRoles,
  });

  const roles = rolesData ?? [];
  const admins = accountsData?.items ?? [];
  const totalPages = accountsData?.total_pages ?? 0;

  const { mutate: toggleStatus, isPending: isTogglingStatus } = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      updateAdminStatus(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
      toast.success("Status yangilandi");
    },
    onError: () => {
      toast.error("Xatolik yuz berdi");
    },
  });

  const handleToggleStatus = useCallback((admin: AdminAccountResponse) => {
    toggleStatus({ id: admin.id, isActive: !admin.is_active });
  }, [toggleStatus]);

  const handleRowClick = useCallback((admin: AdminAccountResponse) => {
    setSelectedAdmin(admin);
    setIsDetailOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setIsDetailOpen(false);
    // Keep selectedAdmin briefly so the sheet close animation doesn't flicker
    setTimeout(() => setSelectedAdmin(null), 300);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setIsCreateOpen(false);
  }, []);

  const CreateWrapper = isDesktop ? Dialog : Drawer;
  const CreateContent = isDesktop ? DialogContent : DrawerContent;
  const CreateHeader = isDesktop ? DialogHeader : DrawerHeader;
  const CreateTitle = isDesktop ? DialogTitle : DrawerTitle;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">
            Admin hisoblar
          </h1>
          <p className="text-[13px] text-gray-500 dark:text-gray-500 mt-1">
            {accountsData?.total_count ?? 0} ta admin
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="self-start sm:self-auto flex items-center gap-2 h-9 px-4 rounded-xl bg-orange-500 text-white text-[13px] font-semibold hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Yangi Admin
        </button>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* Desktop table */}
        <div className="hidden md:block bg-white dark:bg-[#111] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black/[0.06] dark:border-white/[0.06]">
                {['Admin', 'Mijoz kodi', 'Rol', 'Status', 'Yaratilgan', 'Holat'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoadingAccounts
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-black/[0.04] dark:border-white/[0.04]">
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-full rounded-lg" />
                        </td>
                      ))}
                    </tr>
                  ))
                : admins.map((admin) => (
                    <AdminTableRow
                      key={admin.id}
                      admin={admin}
                      onRowClick={handleRowClick}
                      onToggleStatus={handleToggleStatus}
                      isToggling={isTogglingStatus}
                    />
                  ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {isLoadingAccounts
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-[#111] rounded-[18px] border border-black/[0.05] dark:border-white/[0.06] p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-9 h-9 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-32 rounded" />
                      <Skeleton className="h-3 w-20 rounded" />
                    </div>
                  </div>
                </div>
              ))
            : admins.map((admin) => (
                <AdminMobileCard
                  key={admin.id}
                  admin={admin}
                  onCardClick={handleRowClick}
                  onToggleStatus={handleToggleStatus}
                  isToggling={isTogglingStatus}
                />
              ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-9 h-9 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[13px] text-gray-500 dark:text-gray-400">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-9 h-9 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#111] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Detail Sheet */}
      <AdminDetailSheet
        admin={selectedAdmin}
        roles={roles}
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
      />

      {/* Create Admin Modal */}
      <CreateWrapper open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        {/* showCloseButton={false} prevents the built-in X from duplicating our custom one */}
        <CreateContent
          className="bg-white dark:bg-[#111] border-black/[0.06] dark:border-white/[0.06] p-0 overflow-hidden"
          {...(isDesktop ? { showCloseButton: false } : {})}
        >
          <CreateHeader className="px-4 pt-4 pb-0">
            <CreateTitle className="text-[15px] font-bold text-gray-900 dark:text-white">
              Yangi Admin Qo&apos;shish
            </CreateTitle>
            {/* Required by Radix UI to silence the aria-describedby warning */}
            {isDesktop && (
              <DialogDescription className="sr-only">
                Yangi admin yaratish formasi
              </DialogDescription>
            )}
          </CreateHeader>
          {isLoadingRoles ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
            </div>
          ) : (
            <CreateAdminForm
              roles={roles}
              onSuccess={handleCreateSuccess}
              onClose={() => setIsCreateOpen(false)}
            />
          )}
        </CreateContent>
      </CreateWrapper>
    </div>
  );
}