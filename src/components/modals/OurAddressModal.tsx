import { memo, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import {
  Clock,
  ExternalLink,
  Instagram,
  MapPin,
  MessageCircle,
  Send,
  X,
} from 'lucide-react';
import {
  OfficeContacts,
  OfficeHoursTable,
  OfficeOpenBadge,
} from '@/components/office/OfficeStatus';
import { useOfficeInfo } from '@/hooks/useOfficeInfo';
import YandexMap, { type YandexMarker } from '@/components/map/YandexMap';
import { CHANNEL_TELEGRAM_URL, SUPPORT_TELEGRAM_URL } from '@/config/contacts';

const MANDARIN_LOCATION = {
  latitude: 41.284025,
  longitude: 69.232782,
};

const YANDEX_MAP_URL = 'https://yandex.uz/maps/-/CPcXuW7w';
const INSTAGRAM_URL = 'https://www.instagram.com/mandarin_cargo?igsh=MTE1bGF0cTg0N3AxeA==';

interface OurAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function createPinIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    html: `
      <div style="
        width:38px;
        height:38px;
        border-radius:9999px 9999px 9999px 0;
        transform:rotate(-45deg);
        background:var(--mc-brand);
        border:3px solid var(--mc-surface);
        box-shadow:0 10px 20px rgba(15,23,42,.32);
        display:flex;
        align-items:center;
        justify-content:center;
      ">
        <span style="
          width:11px;
          height:11px;
          border-radius:9999px;
          background:var(--mc-surface);
          display:block;
          transform:rotate(45deg);
        "></span>
      </div>
    `,
  });
}

function SocialLink({
  href,
  icon,
  label,
  description,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  description: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="
        group flex items-center gap-2.5 rounded-mc-md border border-mc-border bg-mc-surface-2 p-2.5
        transition active:scale-[0.98]
      "
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-mc-sm bg-mc-brand-soft text-mc-brand">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-extrabold text-mc-text">
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] font-medium text-mc-text-2">
          {description}
        </span>
      </span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-mc-text-3" />
    </a>
  );
}

function OurAddressModal({ isOpen, onClose }: OurAddressModalProps) {
  const { t } = useTranslation();
  const pinIcon = useMemo(() => createPinIcon(), []);
  // Address, hours and phones are admin-editable; fall back to the historical
  // constants so the modal still works before staff fill the record in.
  const { data: office, isLoading: officeLoading } = useOfficeInfo();

  const center = useMemo<[number, number]>(
    () => [
      office?.latitude ?? MANDARIN_LOCATION.latitude,
      office?.longitude ?? MANDARIN_LOCATION.longitude,
    ],
    [office?.latitude, office?.longitude],
  );
  const mapUrl = office?.map_url || YANDEX_MAP_URL;
  const adminUrl = office?.telegram_username
    ? `https://t.me/${office.telegram_username.replace(/^@/, '')}`
    : SUPPORT_TELEGRAM_URL;
  const officeMarkers = useMemo<YandexMarker[]>(
    () => [
      {
        id: 'office',
        latitude: center[0],
        longitude: center[1],
        // Red reads as "you are looking for this" against Yandex's warm map.
        color: '#e11d48',
        selected: true,
      },
    ],
    [center],
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="
              relative z-[10000] flex max-h-[92dvh] w-full flex-col overflow-hidden
              rounded-t-mc-xl border border-mc-border bg-mc-surface shadow-2xl
              sm:max-w-md sm:rounded-mc-xl
            "
            initial={{ y: 32, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 32, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="our-address-title"
          >
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-mc-brand/40 to-transparent" />

            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-mc-border bg-mc-surface px-4 py-3">
              <div>
                <h2 id="our-address-title" className="text-[16px] font-extrabold text-mc-text">
                  {t('ourAddress.title')}
                </h2>
                <p className="mt-0.5 text-[11px] font-medium text-mc-text-2">
                  {t('ourAddress.subtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-mc-md bg-mc-surface-2 text-mc-text-2 transition active:scale-95"
                aria-label={t('ourAddress.close')}
              >
                <X className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              <div className="overflow-hidden rounded-mc-xl border border-mc-border bg-mc-surface-2">
                <div className="relative h-[210px]">
                  {/* Yandex when a key is configured (local street data is far
                      better here); OSM/Leaflet stays as the fallback so a missing
                      key or a blocked CDN can never hide the office location. */}
                  <YandexMap
                    center={center}
                    zoom={17}
                    followCenter
                    markers={officeMarkers}
                    className="h-full w-full"
                    fallback={
                      <MapContainer
                        key={`${center[0]},${center[1]}`}
                        center={center}
                        zoom={16}
                        scrollWheelZoom={false}
                        dragging
                        touchZoom
                        doubleClickZoom
                        zoomControl={false}
                        className="h-full w-full"
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <Marker position={center} icon={pinIcon} />
                      </MapContainer>
                    }
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-3 left-3 z-[500] inline-flex items-center gap-1.5 rounded-mc-sm border border-mc-border bg-mc-surface px-2.5 py-1.5 text-[11px] font-extrabold text-mc-text shadow-[var(--mc-shadow-card)] backdrop-blur-md transition active:scale-95"
                  >
                    <MapPin className="h-3.5 w-3.5 text-mc-brand" strokeWidth={2} />
                    {t('ourAddress.openYandex')}
                  </a>
                </div>
              </div>

              <div className="mt-3 rounded-mc-lg border border-mc-border bg-mc-surface-2 p-3.5">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-mc-brand">
                  {t('ourAddress.addressLabel')}
                </p>
                <div className="mt-1.5 flex items-start justify-between gap-2">
                  <p className="min-w-0 text-[15px] font-extrabold leading-tight text-mc-text">
                    {t('ourAddress.locationName')}
                  </p>
                  {office && <OfficeOpenBadge office={office} />}
                </div>
                {/* Admin-managed address; the old hardcoded string had no street
                    or building number, so customers could not find the office. */}
                <p className="mt-1 text-[12px] font-medium leading-snug text-mc-text-2">
                  {officeLoading
                    ? t('office.loading')
                    : office?.address_text || t('ourAddress.addressValue')}
                </p>
                {office?.landmark && (
                  <p className="mt-1 text-[11px] font-medium leading-snug text-mc-text-3">
                    {office.landmark}
                  </p>
                )}
                {office?.notice && (
                  <p className="mt-2.5 rounded-mc-sm bg-mc-warn-soft px-2.5 py-1.5 text-[11px] font-bold text-mc-warn">
                    {office.notice}
                  </p>
                )}
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-mc-md bg-gradient-to-br from-mc-brand to-mc-brand-strong px-4 text-[13px] font-extrabold text-mc-on-brand shadow-[var(--mc-shadow-cta)] transition active:scale-[0.98]"
                >
                  <MapPin className="h-[15px] w-[15px]" strokeWidth={2} />
                  {t('ourAddress.openYandex')}
                  <ExternalLink className="h-[15px] w-[15px]" strokeWidth={2} />
                </a>
              </div>

              {office && Object.keys(office.working_hours ?? {}).length > 0 && (
                <div className="mt-3 rounded-mc-lg border border-mc-border bg-mc-surface-2 p-3.5">
                  <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-extrabold text-mc-text">
                    <Clock className="h-3.5 w-3.5 text-mc-brand" strokeWidth={2} />
                    {t('office.hoursTitle')}
                  </h3>
                  <OfficeHoursTable office={office} />
                </div>
              )}

              {office && (office.phones.length > 0 || office.telegram_username) && (
                <div className="mt-3">
                  <h3 className="mb-2 text-[13px] font-extrabold text-mc-text">
                    {t('office.contactsTitle')}
                  </h3>
                  <OfficeContacts office={office} />
                </div>
              )}

              <div className="mt-3">
                <h3 className="mb-2 text-[13px] font-extrabold text-mc-text">
                  {t('ourAddress.socialsTitle')}
                </h3>
                <div className="space-y-2">
                  <SocialLink
                    href={CHANNEL_TELEGRAM_URL}
                    icon={<Send className="h-[18px] w-[18px]" strokeWidth={2} />}
                    label={t('ourAddress.telegram.label')}
                    description={t('ourAddress.telegram.desc')}
                  />
                  <SocialLink
                    href={INSTAGRAM_URL}
                    icon={<Instagram className="h-[18px] w-[18px]" strokeWidth={2} />}
                    label={t('ourAddress.instagram.label')}
                    description={t('ourAddress.instagram.desc')}
                  />
                  <SocialLink
                    href={adminUrl}
                    icon={<MessageCircle className="h-[18px] w-[18px]" strokeWidth={2} />}
                    label={t('ourAddress.admin.label')}
                    description={t('ourAddress.admin.desc')}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default memo(OurAddressModal);
