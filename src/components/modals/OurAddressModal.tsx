import { memo, useMemo } from 'react';
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

const MANDARIN_LOCATION = {
  latitude: 41.284025,
  longitude: 69.232782,
};

const YANDEX_MAP_URL = 'https://yandex.uz/maps/-/CPcXuW7w';
const TELEGRAM_URL = 'https://t.me/mandarin_cargo';
const INSTAGRAM_URL = 'https://www.instagram.com/mandarin_cargo?igsh=MTE1bGF0cTg0N3AxeA==';
const ADMIN_URL = 'https://t.me/mandarin_admin';

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
        background:#f59e0b;
        border:3px solid white;
        box-shadow:0 10px 20px rgba(15,23,42,.32);
        display:flex;
        align-items:center;
        justify-content:center;
      ">
        <span style="
          width:11px;
          height:11px;
          border-radius:9999px;
          background:white;
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
        group flex items-center gap-3 rounded-2xl border border-gray-200/80 bg-white/85 p-3
        transition active:scale-[0.98] hover:border-orange-200 hover:bg-orange-50/60
        dark:border-white/[0.08] dark:bg-white/[0.045] dark:hover:border-orange-400/20 dark:hover:bg-orange-400/[0.06]
      "
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-orange-50 text-orange-600 ring-1 ring-orange-100 dark:bg-orange-400/10 dark:text-orange-200 dark:ring-orange-400/10">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-gray-950 dark:text-[#fff8ed]">
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] font-semibold text-gray-500 dark:text-white/45">
          {description}
        </span>
      </span>
      <ExternalLink className="h-4 w-4 shrink-0 text-gray-400 transition group-hover:text-orange-500 dark:text-white/30" />
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
    : ADMIN_URL;
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

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="
              relative z-[10000] max-h-[92vh] w-full overflow-hidden rounded-t-[2rem] border border-white/10
              bg-white shadow-2xl sm:max-w-md sm:rounded-[2rem]
              dark:bg-[#0a0e15]
            "
            initial={{ y: 32, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 32, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-orange-200/70 to-transparent" />

            <div className="flex items-center justify-between border-b border-gray-100 bg-white/90 px-5 py-4 backdrop-blur-xl dark:border-white/[0.06] dark:bg-[#0a0e15]/90">
              <div>
                <h2 className="text-lg font-black text-gray-950 dark:text-[#fff8ed]">
                  {t('ourAddress.title')}
                </h2>
                <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-white/45">
                  {t('ourAddress.subtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 transition active:scale-95 hover:text-gray-900 dark:bg-white/[0.06] dark:text-white/55 dark:hover:text-white"
                aria-label={t('ourAddress.close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(92vh-73px)] overflow-y-auto p-5">
              <div className="overflow-hidden rounded-[1.5rem] border border-gray-200 bg-gray-100 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.04]">
                <div className="relative h-[300px]">
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
                    className="absolute bottom-3 left-3 z-[500] inline-flex items-center gap-2 rounded-2xl bg-white/95 px-3 py-2 text-xs font-black text-gray-900 shadow-lg ring-1 ring-black/5 backdrop-blur-md transition active:scale-95 dark:bg-gray-950/95 dark:text-white dark:ring-white/10"
                  >
                    <MapPin className="h-4 w-4 text-orange-500" />
                    {t('ourAddress.openYandex')}
                  </a>
                </div>
              </div>

              <div className="mt-4 rounded-[1.5rem] border border-gray-200/80 bg-white/85 p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.045]">
                <p className="text-[11px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-300">
                  {t('ourAddress.addressLabel')}
                </p>
                <div className="mt-2 flex items-start justify-between gap-2">
                  <p className="text-base font-black text-gray-950 dark:text-[#fff8ed]">
                    {t('ourAddress.locationName')}
                  </p>
                  {office && <OfficeOpenBadge office={office} />}
                </div>
                {/* Admin-managed address; the old hardcoded string had no street
                    or building number, so customers could not find the office. */}
                <p className="mt-1 text-sm font-semibold leading-relaxed text-gray-600 dark:text-white/50">
                  {officeLoading
                    ? t('office.loading')
                    : office?.address_text || t('ourAddress.addressValue')}
                </p>
                {office?.landmark && (
                  <p className="mt-1 text-[13px] font-semibold leading-relaxed text-gray-500 dark:text-white/40">
                    {office.landmark}
                  </p>
                )}
                {office?.notice && (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[13px] font-bold text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
                    {office.notice}
                  </p>
                )}
                <a
                  href={YANDEX_MAP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-300 px-4 text-sm font-black text-[#241406] shadow-lg shadow-orange-500/20 transition active:scale-[0.98]"
                >
                  <MapPin className="h-4 w-4" />
                  {t('ourAddress.openYandex')}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>

              {office && Object.keys(office.working_hours ?? {}).length > 0 && (
                <div className="mt-4 rounded-[1.5rem] border border-gray-200/80 bg-white/85 p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.045]">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-gray-950 dark:text-[#fff8ed]">
                    <Clock className="h-4 w-4 text-orange-500" />
                    {t('office.hoursTitle')}
                  </h3>
                  <OfficeHoursTable office={office} />
                </div>
              )}

              {office && (office.phones.length > 0 || office.telegram_username) && (
                <div className="mt-4">
                  <h3 className="mb-3 text-sm font-black text-gray-950 dark:text-[#fff8ed]">
                    {t('office.contactsTitle')}
                  </h3>
                  <OfficeContacts office={office} />
                </div>
              )}

              <div className="mt-4">
                <h3 className="mb-3 text-sm font-black text-gray-950 dark:text-[#fff8ed]">
                  {t('ourAddress.socialsTitle')}
                </h3>
                <div className="space-y-2.5">
                  <SocialLink
                    href={TELEGRAM_URL}
                    icon={<Send className="h-5 w-5" />}
                    label={t('ourAddress.telegram.label')}
                    description={t('ourAddress.telegram.desc')}
                  />
                  <SocialLink
                    href={INSTAGRAM_URL}
                    icon={<Instagram className="h-5 w-5" />}
                    label={t('ourAddress.instagram.label')}
                    description={t('ourAddress.instagram.desc')}
                  />
                  <SocialLink
                    href={adminUrl}
                    icon={<MessageCircle className="h-5 w-5" />}
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
