import React from 'react';
import { Image, Video, Film } from 'lucide-react';
import * as z from 'zod';
import type { CarouselMediaItemResponse, CarouselMediaUploadResponse } from '../../../api/services/adminCarousel';

export const ITEM_TYPE_OPTIONS = [
  { value: 'ad',      label: 'Reklama' },
  { value: 'feature', label: 'Yangilik' },
];

export const MEDIA_TYPE_OPTIONS = [
  { value: 'image', label: 'Rasm' },
  { value: 'video', label: 'Video' },
  { value: 'gif',   label: 'GIF' },
];

export const MEDIA_TYPE_ICON: Record<string, React.ReactNode> = {
  image: React.createElement(Image, { className: 'w-4 h-4' }),
  video: React.createElement(Video, { className: 'w-4 h-4' }),
  gif:   React.createElement(Film,  { className: 'w-4 h-4' }),
};

/** Named colours displayed as swatches — ordinary users don't need to know hex. */
export const PRESET_COLORS: { hex: string; name: string }[] = [
  { hex: '#ffffff', name: "Oq" },
  { hex: '#f8fafc', name: "Oppoq" },
  { hex: '#9ca3af', name: "Kulrang" },
  { hex: '#1e293b', name: "Tungi" },
  { hex: '#000000', name: "Qora" },
  { hex: '#3b82f6', name: "Ko'k" },
  { hex: '#06b6d4', name: "Moviy" },
  { hex: '#22c55e', name: "Yashil" },
  { hex: '#84cc16', name: "Limon" },
  { hex: '#fbbf24', name: "Sariq" },
  { hex: '#f97316', name: "To'q sariq" },
  { hex: '#ef4444', name: "Qizil" },
  { hex: '#ec4899', name: "Pushti" },
  { hex: '#a855f7', name: "Binafsha" },
];

export const ACCEPTED_MIME_TYPES =
  'image/jpeg,image/png,image/webp,image/heic,image/gif,video/mp4,video/quicktime,video/webm,video/x-msvideo,video/mpeg';

export const carouselFormSchema = z
  .object({
    type:         z.string().min(1, "Turini tanlang"),
    title:        z.string().optional(),
    sub_title:    z.string().optional(),
    media_type:   z.string().min(1, "Media turini tanlang"),
    // Internal hidden fields populated by upload or URL input
    media_url:    z.string().optional(),
    media_s3_key: z.string().optional(),
    action_url:   z.string().url("To'g'ri URL kiriting").optional().or(z.literal('')),
    text_color:   z.string().regex(/^#[0-9a-fA-F]{6}$/, "Hex rang (#rrggbb)"),
    gradient:     z.string().optional(),
    order:        z.number().int().min(0),
    is_active:    z.boolean(),
  })
  .refine(
    (d) => !!(d.media_url || d.media_s3_key),
    { message: "Media URL yoki fayl yuklash kerak", path: ['media_url'] },
  );

export type CarouselFormValues = z.infer<typeof carouselFormSchema>;

export const EMPTY_FORM: CarouselFormValues = {
  type:         'ad',
  title:        '',
  sub_title:    '',
  media_type:   'image',
  media_url:    '',
  media_s3_key: '',
  action_url:   '',
  text_color:   '#ffffff',
  gradient:     '',
  order:        0,
  is_active:    true,
};

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export interface UploadState {
  status:   UploadStatus;
  progress: number; // 0–100
  file:     File | null;
  result:   CarouselMediaUploadResponse | null;
  errorMsg: string | null;
}

export const UPLOAD_IDLE: UploadState = {
  status: 'idle', progress: 0, file: null, result: null, errorMsg: null,
};

export interface GalleryItemState {
  /** Local React key — not related to API id */
  localId: string;
  /** API id — only present when editing an existing media item */
  id?: number;
  uploadState: UploadState;
  order: number;
}

export function galleryItemFromApiMedia(media: CarouselMediaItemResponse): GalleryItemState {
  return {
    localId: `existing-${media.id}`,
    id: media.id,
    uploadState: {
      status: 'success',
      progress: 100,
      file: null,
      result: {
        s3_key:     media.media_s3_key ?? '',
        media_url:  media.media_url,
        media_type: media.media_type,
        size_bytes: 0,
      },
      errorMsg: null,
    },
    order: media.order,
  };
}

export type MediaInputMode = 'upload' | 'url';
