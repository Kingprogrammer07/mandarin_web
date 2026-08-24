import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  Pencil,
  Phone,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOfficeInfo } from '@/hooks/useOfficeInfo';
import { askConfirm } from '@/utils/askConfirm';
import ApplicationEditForm from './ApplicationEditForm';
import {
  applicationService,
  MY_APPLICATION_QUERY_KEY,
  type MyApplication,
} from '@/api/services/application';

interface RegistrationPendingScreenProps {
  /** Dismiss and continue to the login screen. */
  onContinue: () => void;
  /** Called after a withdrawal, so the caller can show a blank form again. */
  onWithdrawn?: () => void;
}

/**
 * What a registrant sees while a human decides on their application.
 *
 * Previously the form flashed a toast and redirected to login, where the new
 * user tried to sign in, failed, and had no idea why — several then submitted
 * again. Beyond explaining the wait, this screen now lets them act on the
 * application itself: fix a typo or a blurry photo, or withdraw it entirely and
 * start over. That replaces the earlier idea of auto-deleting stale
 * applications, which would have destroyed real ones.
 */

/** While waiting, re-check occasionally so approval flips the screen by itself. */
const PENDING_POLL_MS = 30_000;

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <span className="shrink-0 text-[12px] font-bold text-mc-text-2 dark:text-white/45">
        {label}
      </span>
      <span className="text-right text-[13px] font-black text-mc-text">
        {value}
      </span>
    </div>
  );
}

export default function RegistrationPendingScreen({
  onContinue,
  onWithdrawn,
}: RegistrationPendingScreenProps) {
  const { t } = useTranslation();
  const { data: office } = useOfficeInfo();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const {
    data: application,
    isPending: isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: MY_APPLICATION_QUERY_KEY,
    queryFn: () => applicationService.get(),
    refetchInterval: (query) =>
      query.state.data?.status === 'pending' ? PENDING_POLL_MS : false,
  });

  const withdrawMutation = useMutation({
    mutationFn: () => applicationService.withdraw(),
    onSuccess: (result) => {
      queryClient.setQueryData<MyApplication>(MY_APPLICATION_QUERY_KEY, {
        status: 'none',
        editable: false,
        client_code: null,
        full_name: null,
        phone: null,
        passport_series: null,
        pinfl: null,
        date_of_birth: null,
        region: null,
        region_label: null,
        district: null,
        district_label: null,
        address: null,
        submitted_at: null,
        passport_image_urls: [],
      });
      toast.success(result.message);
      onWithdrawn?.();
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message?: string }).message
          : undefined;
      toast.error(message || t('application.withdraw.failed'));
    },
  });

  const handleWithdraw = async () => {
    const confirmed = await askConfirm(t('application.withdraw.confirm'));
    if (confirmed) withdrawMutation.mutate();
  };

  const adminUrl = office?.telegram_username
    ? `https://t.me/${office.telegram_username.replace(/^@/, '')}`
    : null;
  const phone = office?.phones?.[0] ?? null;

  const shell = 'mx-auto flex w-full max-w-md flex-col items-center px-5 py-10 text-center';

  if (isLoading) {
    return (
      <div className={shell}>
        <Loader2 className="h-8 w-8 animate-spin text-mc-brand" />
        <p className="mt-3 text-sm font-bold text-mc-text-2 dark:text-white/45">
          {t('common.loading')}
        </p>
      </div>
    );
  }

  // A failed status check must not hide the wait message — the application was
  // submitted either way, and the contact details below are the actionable part.
  if (isError || !application) {
    return (
      <div className={shell}>
        <AlertTriangle className="h-9 w-9 text-mc-brand" />
        <h1 className="mt-3 text-xl font-black text-mc-text">
          {t('registrationPending.title')}
        </h1>
        <p className="mt-2 text-sm font-medium text-mc-text-2 dark:text-white/55">
          {t('application.statusUnavailable')}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-mc-lg border border-mc-border px-5 text-sm font-black text-mc-text dark:text-white"
        >
          <RotateCcw className="h-4 w-4" />
          {t('common.retry')}
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="mt-3 h-12 w-full rounded-mc-lg bg-gradient-to-r from-mc-brand to-mc-brand-strong text-sm font-black text-white"
        >
          {t('registrationPending.continue')}
        </button>
      </div>
    );
  }

  if (application.status === 'approved') {
    return (
      <div className={shell}>
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-mc-success/12">
          <CheckCircle2 className="h-10 w-10 text-mc-success" />
        </div>
        <h1 className="text-2xl font-black text-mc-text">
          {t('application.approved.title')}
        </h1>
        <p className="mt-2 text-sm font-medium text-mc-text-2 dark:text-white/55">
          {t('application.approved.body', { code: application.client_code ?? '' })}
        </p>
        <button
          type="button"
          onClick={onContinue}
          className="mt-6 h-12 w-full rounded-mc-lg bg-gradient-to-r from-mc-brand to-mc-brand-strong text-sm font-black text-white"
        >
          {t('application.approved.login')}
        </button>
      </div>
    );
  }

  if (application.status === 'none') {
    return (
      <div className={shell}>
        <AlertTriangle className="h-9 w-9 text-mc-brand" />
        <h1 className="mt-3 text-xl font-black text-mc-text">
          {t('application.none.title')}
        </h1>
        <p className="mt-2 text-sm font-medium text-mc-text-2 dark:text-white/55">
          {t('application.none.body')}
        </p>
        <button
          type="button"
          onClick={() => (onWithdrawn ? onWithdrawn() : onContinue())}
          className="mt-6 h-12 w-full rounded-mc-lg bg-gradient-to-r from-mc-brand to-mc-brand-strong text-sm font-black text-white"
        >
          {t('application.none.register')}
        </button>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-8">
        <h2 className="mb-1 text-xl font-black text-mc-text">
          {t('application.edit.title')}
        </h2>
        <p className="mb-5 text-[13px] font-medium text-mc-text-2 dark:text-white/55">
          {t('application.edit.body')}
        </p>
        <ApplicationEditForm
          application={application}
          onCancel={() => setIsEditing(false)}
          onSaved={(updated) => {
            queryClient.setQueryData(MY_APPLICATION_QUERY_KEY, updated);
            setIsEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className={shell}>
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-mc-success/12">
        <ShieldCheck className="h-10 w-10 text-mc-success" />
      </div>

      <h1 className="text-2xl font-black text-mc-text">
        {t('registrationPending.title')}
      </h1>
      <p className="mt-2 text-sm font-medium leading-relaxed text-mc-text-2 dark:text-white/55">
        {t('registrationPending.body')}
      </p>

      <div className="mt-5 flex w-full items-start gap-3 rounded-mc-lg border border-mc-warn/25 bg-mc-warn-soft p-3.5 text-left">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-mc-warn" />
        <div>
          <p className="text-sm font-black text-mc-warn">
            {t('registrationPending.etaTitle')}
          </p>
          <p className="mt-0.5 text-[13px] font-medium text-mc-warn">
            {t('registrationPending.etaBody')}
          </p>
        </div>
      </div>

      {/* What the admin is looking at — so a mistake is visible before approval. */}
      <div className="mt-4 w-full rounded-mc-lg border border-mc-border p-4 text-left dark:border-white/10">
        <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-mc-text-2 dark:text-white/45">
          {t('application.submittedData')}
        </p>
        <InfoRow label={t('form.fullName')} value={application.full_name} />
        <InfoRow label={t('form.phoneNumber')} value={application.phone} />
        <InfoRow label={t('form.passportSeries')} value={application.passport_series} />
        <InfoRow label={t('form.dateOfBirth')} value={application.date_of_birth} />
        <InfoRow
          label={t('form.address')}
          value={
            [application.region_label, application.district_label, application.address]
              .filter(Boolean)
              .join(', ') || null
          }
        />

        {application.passport_image_urls.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {application.passport_image_urls.map((url, index) => (
              <img
                key={url}
                src={url}
                alt={t(index === 0 ? 'form.passportImagesFront' : 'form.passportImagesBack')}
                className="h-24 w-full rounded-mc-md object-cover"
              />
            ))}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-mc-md border border-mc-brand/25 bg-mc-brand-soft text-[13px] font-extrabold text-mc-brand"
          >
            <Pencil className="h-3.5 w-3.5" />
            {t('application.edit.action')}
          </button>
          <button
            type="button"
            onClick={() => void handleWithdraw()}
            disabled={withdrawMutation.isPending}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-mc-md border border-mc-danger/25 bg-mc-danger-soft text-[13px] font-extrabold text-mc-danger disabled:opacity-50"
          >
            {withdrawMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            {t('application.withdraw.action')}
          </button>
        </div>
      </div>

      <p className="mt-5 text-[13px] font-semibold text-mc-text-2 dark:text-white/45">
        {t('registrationPending.contactHint')}
      </p>

      <div className="mt-3 w-full space-y-2">
        {adminUrl && (
          <a
            href={adminUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-mc-lg border border-mc-brand/25 bg-mc-brand-soft text-[14px] font-extrabold text-mc-brand"
          >
            <MessageCircle className="h-4 w-4" />
            {t('registrationPending.contactAdmin')}
          </a>
        )}
        {phone && (
          <a
            href={`tel:${phone.replace(/[^+\d]/g, '')}`}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-mc-lg border border-mc-success/25 bg-mc-success/12 text-[14px] font-extrabold text-mc-success"
          >
            <Phone className="h-4 w-4" />
            {phone}
          </a>
        )}
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="mt-6 h-12 w-full rounded-mc-lg bg-gradient-to-r from-mc-brand to-mc-brand-strong text-sm font-black text-white shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all"
      >
        {t('registrationPending.continue')}
      </button>
    </div>
  );
}
