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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { getReferralInfo } from '@/api/services/referralService';
import { triggerSoftHaptic } from '@/utils/haptics';

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
    <div className="min-h-screen bg-gray-50 dark:bg-[#06080d] text-gray-900 dark:text-white pb-24">
      <div className="relative z-10 max-w-2xl mx-auto px-4 pt-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="rounded-full border border-gray-200 bg-white/90 p-2 text-gray-600 active:scale-95 transition dark:border-white/10 dark:bg-white/5 dark:text-white/70 touch-manipulation"
            aria-label={t('referral.back')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-500" />
              {t('referral.title')}
            </h1>
            <p className="text-xs text-gray-500 dark:text-white/50">
              {t('referral.subtitle')}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
            {t('referral.loadError')}
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats */}
            <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 p-5 text-white shadow-lg">
              <div className="flex items-center gap-2 text-sm font-medium opacity-90">
                <Users className="w-4 h-4" />
                {t('referral.stats.invited')}
              </div>
              <div className="mt-1 text-4xl font-extrabold tabular-nums">
                {data?.referral_count ?? 0}
              </div>
            </div>

            {/* Invite link */}
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
              <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
                <Link2 className="w-4 h-4 text-amber-500" />
                {t('referral.yourLink')}
              </h2>

              {inviteLink ? (
                <>
                  {qrCodeUrl && (
                    <div className="mb-3 flex justify-center">
                      <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-200 dark:ring-white/10">
                        <img
                          src={qrCodeUrl}
                          alt={t('referral.yourLink')}
                          className="h-40 w-40 rounded-lg"
                        />
                      </div>
                    </div>
                  )}
                  <div className="rounded-xl bg-gray-100 px-3 py-2.5 text-xs font-mono break-all text-gray-700 dark:bg-white/10 dark:text-white/80">
                    {inviteLink}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold active:scale-[0.98] transition dark:border-white/10 dark:bg-white/5 touch-manipulation"
                    >
                      <Copy className="w-4 h-4" />
                      {t('referral.copy')}
                    </button>
                    <button
                      onClick={handleShare}
                      className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white active:scale-[0.98] transition hover:bg-amber-600 touch-manipulation"
                    >
                      <Share2 className="w-4 h-4" />
                      {t('referral.share')}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-white/50">
                  {t('referral.linkUnavailable')}
                </p>
              )}
            </section>

            {/* How it works */}
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
              <h2 className="text-sm font-bold mb-2">{t('referral.howTitle')}</h2>
              <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-600 dark:text-white/70">
                <li>{t('referral.how1')}</li>
                <li>{t('referral.how2')}</li>
                <li>{t('referral.how3')}</li>
              </ol>
            </section>

            {/* Invited list */}
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
              <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
                <UserPlus className="w-4 h-4 text-amber-500" />
                {t('referral.invitedList')}
              </h2>
              {data && data.invited.length > 0 ? (
                <ul className="divide-y divide-gray-100 dark:divide-white/10">
                  {data.invited.map((c, i) => (
                    <li
                      key={`${c.client_code ?? 'x'}-${i}`}
                      className="flex items-center justify-between py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{c.name}</div>
                          {c.client_code && (
                            <div className="text-[11px] font-mono text-gray-400 dark:text-white/40">
                              {c.client_code}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-gray-400 dark:text-white/40">
                        {c.joined_at}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-4 text-center text-sm text-gray-400 dark:text-white/40">
                  {t('referral.empty')}
                </p>
              )}

              {/* Pager — only when there is more than one page */}
              {data && data.referral_count > pageSize && (
                <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-white/10">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || isFetching}
                    className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 active:scale-95 transition disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-white/80 touch-manipulation"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t('referral.prev')}
                  </button>
                  <span className="text-xs font-medium text-gray-500 dark:text-white/50">
                    {t('referral.pageOf', { page, total: totalPages })}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!data.has_more || isFetching}
                    className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 active:scale-95 transition disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-white/80 touch-manipulation"
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
