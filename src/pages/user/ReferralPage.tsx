import { useCallback, useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toDataURL } from 'qrcode';
import {
  ArrowLeft,
  Copy,
  Share2,
  Users,
  Gift,
  Link2,
  Loader2,
  UserPlus,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { getReferralInfo } from '@/api/services/referralService';
import { triggerSoftHaptic } from '@/utils/haptics';
import { SUPPORT_TELEGRAM_URL } from '@/config/contacts';

interface ReferralPageProps {
  onBack: () => void;
}

/**
 * User-facing referral page — share + statistics (no monetary reward).
 *
 * Shows the personal invite deep-link with copy/share actions, how many people
 * the user invited, and the list of those people (privacy-trimmed by the API).
 *
 * TODO(codex): add an optional leaderboard.
 */
export default function ReferralPage({ onBack }: ReferralPageProps) {
  const { t } = useTranslation();
  const [qrCode, setQrCode] = useState<{ link: string; url: string } | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['referral-info', page],
    queryFn: () => getReferralInfo(page),
    staleTime: 60_000,
    placeholderData: keepPreviousData, // keep the old page visible while the next loads
  });

  const inviteLink = data?.invite_link ?? '';
  const pageSize = data?.page_size ?? 15;
  const totalPages = data ? Math.max(1, Math.ceil(data.referral_count / pageSize)) : 1;

  useEffect(() => {
    let active = true;

    if (!inviteLink) return undefined;

    toDataURL(inviteLink, {
      width: 160,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (active) setQrCode({ link: inviteLink, url });
      })
      .catch(() => {
        if (active) setQrCode(null);
      });

    return () => {
      active = false;
    };
  }, [inviteLink]);

  const handleCopy = useCallback(async () => {
    if (!inviteLink) return;
    triggerSoftHaptic();
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success(t('referral.copied'));
    } catch {
      toast.error(t('referral.copyFailed'));
    }
  }, [inviteLink, t]);

  const handleShare = useCallback(() => {
    if (!inviteLink) return;
    triggerSoftHaptic();
    const shareText = t('referral.shareText');
    const tgShare = `https://t.me/share/url?url=${encodeURIComponent(
      inviteLink,
    )}&text=${encodeURIComponent(shareText)}`;
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(tgShare);
    } else {
      window.open(tgShare, '_blank');
    }
  }, [inviteLink, t]);

  const qrCodeUrl = qrCode?.link === inviteLink ? qrCode.url : '';

  return (
    <div className="min-h-dvh bg-mc-bg text-mc-text pb-5">
      <div className="relative z-10 mx-auto max-w-lg px-4 pt-3">
        {/* Header */}
        <div className="mb-3 flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-mc-sm bg-mc-surface-2 text-mc-text transition-transform duration-150 active:scale-95"
            aria-label={t('referral.back')}
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-1.5 text-[16px] font-extrabold text-mc-text">
              <Gift className="h-[18px] w-[18px] text-mc-brand" strokeWidth={2} />
              {t('referral.title')}
            </h1>
            <p className="truncate text-[11px] font-medium text-mc-text-2">
              {t('referral.subtitle')}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-mc-brand" />
          </div>
        ) : isError ? (
          <div className="rounded-mc-lg border border-mc-danger/25 bg-mc-danger-soft p-5 text-center text-[12px] font-medium text-mc-danger">
            {t('referral.loadError')}
          </div>
        ) : (
          <div className="space-y-2.5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats */}
            {/* A label stacked on a number read as a form field. The medallion
                gives the count something to sit in, and the two washes keep the
                flat gradient from looking like an empty band. */}
            <div className="relative overflow-hidden rounded-mc-lg bg-gradient-to-br from-mc-brand to-mc-brand-strong px-4 py-4 text-mc-on-brand shadow-[var(--mc-shadow-cta)]">
              <div
                className="pointer-events-none absolute -right-7 -top-9 h-28 w-28 rounded-full bg-mc-on-brand/[0.07]"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute -right-2 top-7 h-16 w-16 rounded-full bg-mc-on-brand/[0.07]"
                aria-hidden="true"
              />
              <div className="relative flex items-center gap-3.5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-mc-on-brand/[0.12]">
                  <Users className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.09em] opacity-75">
                    {t('referral.stats.invited')}
                  </p>
                  <p className="mt-0.5 text-[34px] font-extrabold leading-none tabular-nums">
                    {data?.referral_count ?? 0}
                  </p>
                </div>
              </div>
            </div>

            {/* Rewards exist but are negotiated per case, so the card states that
                they exist and hands the client to the staff chat rather than
                promising an amount the app cannot compute. */}
            <section className="rounded-mc-lg border border-mc-warn/25 bg-mc-warn-soft p-3.5">
              <div className="flex items-start gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-mc-sm bg-mc-warn/15 text-mc-warn">
                  <Gift className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[13px] font-extrabold text-mc-warn">
                    {t('referral.rewards.title')}
                  </h2>
                  <p className="mt-0.5 text-[12px] font-medium leading-snug text-mc-text-2">
                    {t('referral.rewards.desc')}
                  </p>
                </div>
              </div>
              <a
                href={SUPPORT_TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => triggerSoftHaptic()}
                className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-mc-md
                           border border-mc-warn/30 bg-mc-surface text-[12px] font-extrabold
                           text-mc-warn transition-transform active:scale-[0.98]"
              >
                <MessageCircle className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                {t('referral.rewards.cta')}
              </a>
            </section>

            {/* Invite link */}
            <section className="rounded-mc-lg border border-mc-border bg-mc-surface p-3.5 shadow-[var(--mc-shadow-card)]">
              <h2 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-extrabold text-mc-text">
                <Link2 className="h-4 w-4 text-mc-brand" strokeWidth={2} />
                {t('referral.yourLink')}
              </h2>

              {inviteLink ? (
                <>
                  {qrCodeUrl && (
                    <div className="mb-3 flex justify-center">
                      <div className="rounded-mc-lg bg-white p-3 shadow-[var(--mc-shadow-card)] ring-1 ring-mc-border">
                        <img
                          src={qrCodeUrl}
                          alt={t('referral.yourLink')}
                          className="h-36 w-36 rounded-mc-sm"
                        />
                      </div>
                    </div>
                  )}
                  <div className="rounded-mc-sm bg-mc-surface-2 px-3 py-2 font-mono text-[11px] break-all text-mc-text-2">
                    {inviteLink}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex h-11 items-center justify-center gap-1.5 rounded-mc-md border border-mc-border bg-mc-surface-2 text-[13px] font-extrabold text-mc-text active:scale-[0.98] transition-transform"
                    >
                      <Copy className="h-4 w-4" strokeWidth={2} />
                      {t('referral.copy')}
                    </button>
                    <button
                      onClick={handleShare}
                      className="flex h-11 items-center justify-center gap-1.5 rounded-mc-md bg-gradient-to-r from-mc-brand to-mc-brand-strong text-[13px] font-extrabold text-mc-on-brand shadow-[var(--mc-shadow-cta)] active:scale-[0.98] transition-transform"
                    >
                      <Share2 className="h-4 w-4" strokeWidth={2} />
                      {t('referral.share')}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-[12px] font-medium text-mc-text-2">
                  {t('referral.linkUnavailable')}
                </p>
              )}
            </section>

            {/* How it works */}
            <section className="rounded-mc-lg border border-mc-border bg-mc-surface p-3.5 shadow-[var(--mc-shadow-card)]">
              <h2 className="mb-1.5 text-[13px] font-extrabold text-mc-text">{t('referral.howTitle')}</h2>
              <ol className="list-decimal space-y-1 pl-5 text-[12px] leading-snug text-mc-text-2">
                <li>{t('referral.how1')}</li>
                <li>{t('referral.how2')}</li>
                <li>{t('referral.how3')}</li>
              </ol>
            </section>

            {/* Invited list */}
            <section className="rounded-mc-lg border border-mc-border bg-mc-surface p-3.5 shadow-[var(--mc-shadow-card)]">
              <h2 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-extrabold text-mc-text">
                <UserPlus className="h-4 w-4 text-mc-brand" strokeWidth={2} />
                {t('referral.invitedList')}
              </h2>
              {data && data.invited.length > 0 ? (
                <ul className="divide-y divide-mc-border">
                  {data.invited.map((c, i) => (
                    <li
                      key={`${c.client_code ?? 'x'}-${i}`}
                      className="flex items-center justify-between py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mc-brand-soft text-[13px] font-extrabold text-mc-brand">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-[13px] font-extrabold text-mc-text">{c.name}</div>
                          {c.client_code && (
                            <div className="font-mono text-[11px] font-medium text-mc-text-3">
                              {c.client_code}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-[11px] font-medium text-mc-text-3">
                        {c.joined_at}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-4 text-center text-[12px] font-medium text-mc-text-3">
                  {t('referral.empty')}
                </p>
              )}

              {/* Pager — only when there is more than one page */}
              {data && data.referral_count > pageSize && (
                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-mc-border pt-2.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || isFetching}
                    className="flex h-9 items-center gap-1 rounded-mc-sm border border-mc-border bg-mc-surface-2 px-3 text-[12px] font-extrabold text-mc-text active:scale-95 transition-transform disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t('referral.prev')}
                  </button>
                  <span className="text-[11px] font-medium text-mc-text-2">
                    {t('referral.pageOf', { page, total: totalPages })}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!data.has_more || isFetching}
                    className="flex h-9 items-center gap-1 rounded-mc-sm border border-mc-border bg-mc-surface-2 px-3 text-[12px] font-extrabold text-mc-text active:scale-95 transition-transform disabled:opacity-40"
                  >
                    {t('referral.next')}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
