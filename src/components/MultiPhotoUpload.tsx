import { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Camera,
  X,
  Upload,
  Plus,
  ChevronLeft,
  ChevronRight,
  Flashlight,
  FlashlightOff,
  ZoomIn,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Maximum output canvas width — caps the captured image to 1280px
 * to reduce RAM pressure in Telegram WebView.
 */
const MAX_CANVAS_WIDTH = 1280;

/** Ideal getUserMedia resolution (720p, optimized for Telegram) */
const IDEAL_WIDTH = 1280;
const IDEAL_HEIGHT = 720;

/** JPEG blob quality */
const JPEG_QUALITY = 0.7;

/** Hardware sync delay before requesting a new stream (ms) */
const HARDWARE_SYNC_DELAY = 100;

const DEFAULT_ZOOM_STEP = 0.1;

interface CameraNumericCapability {
  min?: number;
  max?: number;
  step?: number;
}

interface CameraZoomCapability {
  min: number;
  max: number;
  step: number;
}

type CameraSupportedConstraints = MediaTrackSupportedConstraints & {
  torch?: boolean;
};

type CameraTrackCapabilities = Omit<MediaTrackCapabilities, 'torch' | 'zoom'> & {
  torch?: boolean | boolean[];
  zoom?: CameraNumericCapability;
};

type CameraTrackSettings = Omit<MediaTrackSettings, 'torch' | 'zoom'> & {
  torch?: boolean;
  zoom?: number;
};

type CameraConstraintSet = MediaTrackConstraintSet & {
  torch?: boolean;
  zoom?: number;
};

type CameraMediaTrackConstraints = MediaTrackConstraints & {
  torch?: boolean;
  zoom?: number;
  advanced?: CameraConstraintSet[];
};

const normalizeZoomCapability = (
  range: CameraNumericCapability | undefined
): CameraZoomCapability | null => {
  if (!range) return null;

  const min = typeof range.min === 'number' && Number.isFinite(range.min) ? range.min : 1;
  const max = typeof range.max === 'number' && Number.isFinite(range.max) ? range.max : min;

  if (max <= min) return null;

  const step =
    typeof range.step === 'number' && Number.isFinite(range.step) && range.step > 0
      ? range.step
      : DEFAULT_ZOOM_STEP;

  return { min, max, step };
};

const clampZoom = (value: number, range: CameraZoomCapability): number => {
  return Math.min(range.max, Math.max(range.min, value));
};

const formatZoomValue = (value: number): string => {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
};

const isTorchCapabilityEnabled = (capabilities: CameraTrackCapabilities): boolean => {
  const torch = capabilities.torch;
  if (Array.isArray(torch)) return torch.includes(true);
  return torch === true;
};

const canAttemptTorch = (capabilities: CameraTrackCapabilities): boolean => {
  if (isTorchCapabilityEnabled(capabilities)) return true;
  if (capabilities.torch === false) return false;

  const supportedConstraints =
    typeof navigator !== 'undefined' && navigator.mediaDevices?.getSupportedConstraints
      ? (navigator.mediaDevices.getSupportedConstraints() as CameraSupportedConstraints)
      : null;

  return supportedConstraints?.torch === true;
};

// ─── Public API exposed via ref ───────────────────────────────────────
export interface MultiPhotoUploadHandle {
  openCamera: () => void;
  prepareStream: () => void;
}

interface MultiPhotoUploadProps {
  label: string;
  value: File[];
  onChange: (files: File[]) => void;
  error?: string;
  maxPhotos?: number;
  fastMode?: boolean;
  onCameraClose?: () => void;
}

const MultiPhotoUpload = forwardRef<MultiPhotoUploadHandle, MultiPhotoUploadProps>(
  function MultiPhotoUpload(
    {
      label,
      value,
      onChange,
      error,
      maxPhotos = 10,
      fastMode = false,
      onCameraClose,
    },
    ref
  ) {
    const { t } = useTranslation();

    // ─── State ─────────────────────────────────────────────────────────
    const [isCameraVisible, setIsCameraVisible] = useState(false);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [zoomCapability, setZoomCapability] = useState<CameraZoomCapability | null>(null);
    const [zoomValue, setZoomValue] = useState(1);
    const [isTorchSupported, setIsTorchSupported] = useState(false);
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [isTorchChanging, setIsTorchChanging] = useState(false);
    const [cameraControlError, setCameraControlError] = useState<string | null>(null);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    // ─── Refs ──────────────────────────────────────────────────────────
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const mountedRef = useRef(true);

    // Track preview URLs for memory cleanup
    const previewUrlsRef = useRef<Map<File, string>>(new Map());

    // ─── Mount guard ───────────────────────────────────────────────────
    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
      };
    }, []);

    // ─── Lightbox keyboard navigation ─────────────────────────────────
    useEffect(() => {
      if (lightboxIndex === null) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setLightboxIndex(null);
        } else if (e.key === 'ArrowRight') {
          setLightboxIndex((prev) => (prev === null ? null : (prev + 1) % value.length));
        } else if (e.key === 'ArrowLeft') {
          setLightboxIndex((prev) => (prev === null ? null : (prev - 1 + value.length) % value.length));
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightboxIndex, value.length]);

    // ─── Preview URL management ────────────────────────────────────────

    const getPreviewUrl = useCallback((file: File): string => {
      const existing = previewUrlsRef.current.get(file);
      if (existing) return existing;
      const url = URL.createObjectURL(file);
      previewUrlsRef.current.set(file, url);
      return url;
    }, []);

    const revokePreviewUrl = useCallback((file: File) => {
      const url = previewUrlsRef.current.get(file);
      if (url) {
        URL.revokeObjectURL(url);
        previewUrlsRef.current.delete(file);
      }
    }, []);

    // Revoke ALL preview URLs on unmount
    useEffect(() => {
      const urls = previewUrlsRef;
      return () => {
        urls.current.forEach((url) => URL.revokeObjectURL(url));
        urls.current.clear();
      };
    }, []);

    // ─── Stream helpers ────────────────────────────────────────────────

    const isStreamAlive = useCallback((): boolean => {
      if (!streamRef.current) return false;
      return streamRef.current.getTracks().some((t) => t.readyState === 'live');
    }, []);

    const getActiveVideoTrack = useCallback((): MediaStreamTrack | null => {
      return streamRef.current?.getVideoTracks().find((track) => track.readyState === 'live') ?? null;
    }, []);

    const resetCameraControls = useCallback(() => {
      setZoomCapability(null);
      setZoomValue(1);
      setIsTorchSupported(false);
      setIsTorchOn(false);
      setIsTorchChanging(false);
      setCameraControlError(null);
    }, []);

    const syncCameraControls = useCallback(
      (stream: MediaStream) => {
        const track = stream.getVideoTracks().find((candidate) => candidate.readyState === 'live');

        if (!track || typeof track.getCapabilities !== 'function') {
          resetCameraControls();
          return;
        }

        const capabilities = track.getCapabilities() as CameraTrackCapabilities;
        const settings = track.getSettings() as CameraTrackSettings;
        const nextZoomCapability = normalizeZoomCapability(capabilities.zoom);

        setZoomCapability(nextZoomCapability);
        if (nextZoomCapability) {
          const nextZoom =
            typeof settings.zoom === 'number' && Number.isFinite(settings.zoom)
              ? clampZoom(settings.zoom, nextZoomCapability)
              : nextZoomCapability.min;
          setZoomValue(nextZoom);
        } else {
          setZoomValue(1);
        }

        setIsTorchSupported(canAttemptTorch(capabilities));
        setIsTorchOn(Boolean(settings.torch));
        setIsTorchChanging(false);
        setCameraControlError(null);
      },
      [resetCameraControls]
    );

    const stopMediaStream = useCallback(() => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsCameraReady(false);
      resetCameraControls();
    }, [resetCameraControls]);

    // ─── Core stream initializer (reusable) ───────────────────────────

    /**
     * Acquires the camera stream and attaches it to the video element.
     * Does NOT control modal visibility — callers decide that.
     * Returns true if stream was successfully initialized.
     */
    const initStream = useCallback(async (): Promise<boolean> => {
      if (!mountedRef.current) return false;

      try {
        stopMediaStream();

        // Hardware sync — let OS release the camera hardware
        await new Promise((resolve) => setTimeout(resolve, HARDWARE_SYNC_DELAY));
        if (!mountedRef.current) return false;

        let stream: MediaStream | null = null;

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'environment',
              width: { ideal: IDEAL_WIDTH },
              height: { ideal: IDEAL_HEIGHT },
            },
            audio: false,
          });
        } catch {

          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: IDEAL_WIDTH },
              height: { ideal: IDEAL_HEIGHT },
            },
            audio: false,
          });
        }

        if (!stream) throw new Error('Kamera ochilmadi');

        if (!mountedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return false;
        }

        streamRef.current = stream;
        syncCameraControls(stream);

        // Attach to video element after DOM paint
        return new Promise<boolean>((resolve) => {
          requestAnimationFrame(() => {
            const video = videoRef.current;
            if (!video || !streamRef.current || !mountedRef.current) {
              resolve(false);
              return;
            }

            video.srcObject = streamRef.current;
            video.play().catch((err) => console.warn('Video play() failed:', err));

            let pollAttempts = 0;
            const maxPollAttempts = 120;

            const pollVideoReady = () => {
              pollAttempts++;
              if (!video || !streamRef.current || !mountedRef.current) {
                resolve(false);
                return;
              }

              if (video.videoWidth > 0 && video.videoHeight > 0) {
                setIsCameraReady(true);
                if (streamRef.current) {
                  syncCameraControls(streamRef.current);
                }
                resolve(true);
                return;
              }

              if (pollAttempts >= maxPollAttempts) {
                stopMediaStream();
                resolve(false);
                return;
              }

              requestAnimationFrame(pollVideoReady);
            };

            pollVideoReady();
          });
        });
      } catch (error) {
        console.error('Camera error:', error);

        let msg = 'Kameraga ruxsat berilmadi';
        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            msg = 'Kameraga ruxsat berilmadi. Telegram sozlamalarida kamera ruxsatini yoqing.';
          } else if (error.name === 'NotReadableError') {
            msg = "Kamera band. Boshqa ilova kamerani ishlatayotgan bo'lishi mumkin.";
          } else if (error.name === 'NotFoundError') {
            msg = 'Kamera topilmadi.';
          }
        }

        alert(msg);
        stopMediaStream();
        return false;
      }
    }, [stopMediaStream, syncCameraControls]);

    // ─── Open camera (warm-start aware) ────────────────────────────────

    const openCamera = useCallback(async () => {
      if (!mountedRef.current) return;

      // WARM START: If stream is still alive, re-show the modal
      if (fastMode && isStreamAlive()) {
        setIsCameraVisible(true);
        document.body.style.overflow = 'hidden';

        // FIX: Re-attach srcObject if missing (e.g. after fastMode OFF→ON)
        const video = videoRef.current;
        const stream = streamRef.current;
        if (stream) {
          syncCameraControls(stream);
        }
        if (video && stream && !video.srcObject) {
          video.srcObject = stream;
          video.play().catch((err) => console.warn('Video play() failed:', err));

          let pollAttempts = 0;
          const maxPollAttempts = 120;
          const pollVideoReady = () => {
            pollAttempts++;
            if (!video || !streamRef.current || !mountedRef.current) return;
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              setIsCameraReady(true);
              if (streamRef.current) {
                syncCameraControls(streamRef.current);
              }
              return;
            }
            if (pollAttempts >= maxPollAttempts) {
              stopMediaStream();
              setIsCameraVisible(false);
              document.body.style.overflow = '';
              return;
            }
            requestAnimationFrame(pollVideoReady);
          };
          requestAnimationFrame(pollVideoReady);
        }

        return;
      }

      // COLD START: acquire stream and show modal
      setIsCameraVisible(true);
      document.body.style.overflow = 'hidden';

      const success = await initStream();
      if (!success && mountedRef.current) {
        setIsCameraVisible(false);
        document.body.style.overflow = '';
      }
    }, [fastMode, isStreamAlive, stopMediaStream, initStream, syncCameraControls]);

    // ─── Prepare stream (background, no modal) ─────────────────────────

    const prepareStream = useCallback(async () => {
      if (!mountedRef.current) return;
      // Only acquire if not already alive
      if (isStreamAlive()) return;
      await initStream();
    }, [isStreamAlive, initStream]);

    const applyTorch = useCallback(
      async (enabled: boolean): Promise<boolean> => {
        const track = getActiveVideoTrack();
        if (!track || !isTorchSupported) return false;

        const attempts: CameraMediaTrackConstraints[] = [
          { advanced: [{ torch: enabled }] },
          { torch: enabled },
        ];
        setIsTorchChanging(true);
        setCameraControlError(null);

        try {
          let lastError: unknown = null;

          for (const constraints of attempts) {
            try {
              await track.applyConstraints(constraints);
              const settings = track.getSettings() as CameraTrackSettings;
              if (mountedRef.current) {
                setIsTorchOn(typeof settings.torch === 'boolean' ? settings.torch : enabled);
              }
              return true;
            } catch (error) {
              lastError = error;
            }
          }

          throw lastError;
        } catch (error) {
          console.warn('Torch toggle failed:', error);
          if (mountedRef.current) {
            const settings = track.getSettings() as CameraTrackSettings;
            setIsTorchOn(Boolean(settings.torch));
            setCameraControlError(
              t('camera.flashError', {
                defaultValue: "Chiroqni yoqib bo'lmadi. Browser yoki qurilma qo'llamasligi mumkin.",
              })
            );
          }
          return false;
        } finally {
          if (mountedRef.current) {
            setIsTorchChanging(false);
          }
        }
      },
      [getActiveVideoTrack, isTorchSupported, t]
    );

    const toggleTorch = useCallback(() => {
      void applyTorch(!isTorchOn);
    }, [applyTorch, isTorchOn]);

    const applyZoom = useCallback(
      async (nextValue: number) => {
        const track = getActiveVideoTrack();
        if (!track || !zoomCapability) return;

        const nextZoom = clampZoom(nextValue, zoomCapability);
        setZoomValue(nextZoom);

        const advanced: CameraConstraintSet[] = [{ zoom: nextZoom }];

        try {
          await track.applyConstraints({ advanced });
          const settings = track.getSettings() as CameraTrackSettings;
          if (mountedRef.current && typeof settings.zoom === 'number' && Number.isFinite(settings.zoom)) {
            setZoomValue(clampZoom(settings.zoom, zoomCapability));
          }
        } catch (error) {
          console.warn('Camera zoom failed:', error);
          const settings = track.getSettings() as CameraTrackSettings;
          if (mountedRef.current && typeof settings.zoom === 'number' && Number.isFinite(settings.zoom)) {
            setZoomValue(clampZoom(settings.zoom, zoomCapability));
          }
        }
      },
      [getActiveVideoTrack, zoomCapability]
    );

    const handleZoomChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        void applyZoom(Number(event.target.value));
      },
      [applyZoom]
    );

    // ─── Close / hide camera ───────────────────────────────────────────

    const closeCamera = useCallback(() => {
      if (fastMode) {
        if (isTorchOn) {
          void applyTorch(false);
        }
        // WARM START: hide modal, keep stream alive
        setIsCameraVisible(false);
        document.body.style.overflow = '';
      } else {
        // Standard: fully stop stream
        stopMediaStream();
        setIsCameraVisible(false);
        document.body.style.overflow = '';
      }
    }, [applyTorch, fastMode, isTorchOn, stopMediaStream]);

    // ─── Capture photo ─────────────────────────────────────────────────

    const capturePhoto = useCallback(() => {
      if (isCapturing || !videoRef.current || !canvasRef.current || !isCameraReady) return;

      setIsCapturing(true);

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        setIsCapturing(false);
        return;
      }

      // Scale canvas to MAX_CANVAS_WIDTH to reduce RAM pressure
      const aspectRatio = video.videoHeight / video.videoWidth;
      const outputWidth = Math.min(video.videoWidth, MAX_CANVAS_WIDTH);
      const outputHeight = Math.round(outputWidth * aspectRatio);

      canvas.width = outputWidth;
      canvas.height = outputHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsCapturing(false);
        return;
      }

      ctx.drawImage(video, 0, 0, outputWidth, outputHeight);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], `cargo-${Date.now()}.jpg`, { type: 'image/jpeg' });
            const newFiles = [...value, file];
            if (newFiles.length <= maxPhotos) {
              onChange(newFiles);
            }

            // Hide modal (stream stays alive in fastMode)
            closeCamera();

            // Notify parent (focus input, etc.)
            if (onCameraClose) {
              onCameraClose();
            }
          }
          setIsCapturing(false);
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    }, [isCapturing, isCameraReady, value, maxPhotos, onChange, closeCamera, onCameraClose]);

    // ─── Expose openCamera to parent via ref ───────────────────────────

    useImperativeHandle(ref, () => ({
      openCamera,
      prepareStream,
    }), [openCamera, prepareStream]);

    // ─── Cleanup: stop stream when fastMode is toggled OFF ─────────────

    useEffect(() => {
      if (!fastMode && streamRef.current) {
        stopMediaStream();
      }
    }, [fastMode, stopMediaStream]);

    // ─── Cleanup: stop everything on unmount ───────────────────────────

    useEffect(() => {
      const urlsMap = previewUrlsRef.current;

      return () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        document.body.style.overflow = '';

        urlsMap.forEach((url) => URL.revokeObjectURL(url));
        urlsMap.clear();

      };
    }, []);

    // ─── Gallery select ────────────────────────────────────────────────

    const handleGallerySelect = (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      const validFiles = files.filter((f) => f.type.startsWith('image/'));

      if (validFiles.length > 0) {
        const newFiles = [...value, ...validFiles].slice(0, maxPhotos);
        onChange(newFiles);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    // ─── Remove photo ──────────────────────────────────────────────────

    const handleRemove = (index: number) => {
      const removed = value[index];
      if (removed) revokePreviewUrl(removed);
      const newFiles = value.filter((_, i) => i !== index);
      onChange(newFiles);
    };

    const canAddMore = value.length < maxPhotos;

    // ─── Render ────────────────────────────────────────────────────────

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">{label}</label>
          <span className="text-xs text-gray-500">
            {value.length} / {maxPhotos}
          </span>
        </div>

        {/*
          Camera Modal — always in DOM when stream is alive (warm start).
          Hidden: opacity-0, pointer-events-none, z-index -1.
          Visible: opacity-100, z-index 9999.
          Video element MUST stay in DOM so the browser doesn't GC the stream.
        */}
        {(isCameraVisible || (fastMode && isStreamAlive())) && (
          <div
            className="fixed inset-0 bg-black flex flex-col transition-opacity duration-100"
            style={{
              zIndex: isCameraVisible ? 9999 : -1,
              opacity: isCameraVisible ? 1 : 0,
              pointerEvents: isCameraVisible ? 'auto' : 'none',
            }}
          >
            <div className="flex-1 relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {!isCameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white text-sm">{t('camera.preparingCamera')}</p>
                  </div>
                </div>
              )}

              {isCameraReady && (
                <div className="absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-20 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleTorch}
                    disabled={!isTorchSupported || isTorchChanging}
                    aria-label={
                      !isTorchSupported
                        ? t('camera.flashNotSupported')
                        : isTorchOn
                          ? t('camera.flashOff')
                          : t('camera.flashOn')
                    }
                    title={
                      !isTorchSupported
                        ? t('camera.flashNotSupported')
                        : isTorchOn
                          ? t('camera.flashOff')
                          : t('camera.flashOn')
                    }
                    className={[
                      "flex min-h-11 min-w-11 items-center justify-center rounded-full border backdrop-blur-sm transition-all",
                      isTorchOn
                        ? "border-yellow-200 bg-yellow-400 text-black shadow-lg shadow-yellow-400/30"
                        : "border-white/30 bg-white/10 text-white hover:bg-white/20",
                      !isTorchSupported || isTorchChanging
                        ? "cursor-not-allowed opacity-45"
                        : "active:scale-95",
                    ].join(" ")}
                  >
                    {isTorchOn ? (
                      <FlashlightOff className="h-5 w-5" />
                    ) : (
                      <Flashlight className="h-5 w-5" />
                    )}
                  </button>
                </div>
              )}

              {isCameraReady && zoomCapability && (
                <div className="absolute left-4 right-4 bottom-28 z-20 rounded-2xl border border-white/15 bg-black/55 px-4 py-3 text-white shadow-2xl backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <ZoomIn className="h-5 w-5 shrink-0 text-white/90" />
                    <input
                      type="range"
                      min={zoomCapability.min}
                      max={zoomCapability.max}
                      step={zoomCapability.step}
                      value={zoomValue}
                      onChange={handleZoomChange}
                      aria-label={t('camera.zoom')}
                      className="h-2 flex-1 accent-orange-500"
                    />
                    <span className="w-12 text-right text-sm font-semibold tabular-nums">
                      {formatZoomValue(zoomValue)}x
                    </span>
                  </div>
                </div>
              )}

              {isCameraReady && cameraControlError && (
                <div className="absolute left-4 right-4 bottom-44 z-20 rounded-xl border border-yellow-300/30 bg-black/70 px-3 py-2 text-center text-xs font-semibold text-yellow-100 shadow-xl backdrop-blur-md">
                  {cameraControlError}
                </div>
              )}
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent flex items-center justify-center gap-4 z-50">
              <button
                onClick={closeCamera}
                className="bg-white/10 text-white border border-white/30 hover:bg-white/20 backdrop-blur-sm px-6 py-3 rounded-lg font-medium"
                disabled={isCapturing}
              >
                {t('camera.cancel')}
              </button>
              <button
                onClick={capturePhoto}
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-3 rounded-lg shadow-lg disabled:opacity-50"
                disabled={isCapturing || !isCameraReady}
              >
                {isCapturing ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{t('cargo.saving')}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Camera className="w-5 h-5" />
                    <span>{t('camera.takePhoto')}</span>
                  </div>
                )}
              </button>
            </div>

            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {/* Lightbox */}
        {lightboxIndex !== null && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95"
            onClick={() => setLightboxIndex(null)}
          >
            {/* Close button */}
            <button
              type="button"
              className="absolute top-4 right-4 z-10 bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Photo counter */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-black/50 text-white text-sm font-semibold px-3 py-1 rounded-full">
              {lightboxIndex + 1} / {value.length}
            </div>

            {/* Left nav */}
            {value.length > 1 && (
              <button
                type="button"
                className="absolute left-3 z-10 bg-white/10 hover:bg-white/25 text-white p-3 rounded-full transition-colors"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + value.length) % value.length); }}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Photo */}
            <img
              src={getPreviewUrl(value[lightboxIndex])}
              alt={`Photo ${lightboxIndex + 1}`}
              className="max-w-full max-h-full object-contain select-none"
              style={{ maxHeight: '90dvh' }}
              onClick={(e) => e.stopPropagation()}
            />

            {/* Right nav */}
            {value.length > 1 && (
              <button
                type="button"
                className="absolute right-3 z-10 bg-white/10 hover:bg-white/25 text-white p-3 rounded-full transition-colors"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % value.length); }}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>
        )}

        {/* Photo Grid */}
        <div className="grid grid-cols-3 gap-3">
          {value.map((file, index) => (
            <div
              key={index}
              className="relative group aspect-square rounded-lg overflow-hidden border-2 border-orange-200 hover:border-orange-400 transition-all"
            >
              <img
                src={getPreviewUrl(file)}
                alt={`Photo ${index + 1}`}
                className="w-full h-full object-cover cursor-zoom-in"
                onClick={() => setLightboxIndex(index)}
              />

              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="absolute top-1 right-1 bg-red-500/90 text-white p-2 rounded-full min-w-[36px] min-h-[36px] flex items-center justify-center shadow-md active:scale-90 transition-transform"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                {index + 1}
              </div>
            </div>
          ))}

          {canAddMore && (
            <>
              <button
                type="button"
                onClick={openCamera}
                className="aspect-square border-2 border-dashed border-orange-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-orange-500 hover:bg-orange-50 transition-all active:scale-95"
              >
                <Camera className="w-6 h-6 text-orange-500" />
                <span className="text-xs text-gray-600 text-center px-1">{t('camera.openCamera')}</span>
              </button>

              <label
                htmlFor="multi-gallery-input"
                className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-gray-500 hover:bg-gray-50 transition-all active:scale-95 cursor-pointer"
              >
                <Upload className="w-6 h-6 text-gray-500" />
                <span className="text-xs text-gray-600 text-center px-1">{t('camera.selectFromGallery')}</span>
              </label>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          id="multi-gallery-input"
          type="file"
          accept="image/*"
          multiple
          onChange={handleGallerySelect}
          className="hidden"
        />

        {value.length > 0 && canAddMore && (
          <p className="text-xs text-gray-500 text-center mt-2">
            <Plus className="w-3 h-3 inline mr-1" />
            {t('cargo.addMorePhotos')}
          </p>
        )}

        {!canAddMore && value.length > 0 && (
          <p className="text-xs text-orange-600 text-center mt-2">
            {t('cargo.maxPhotosReached')} {maxPhotos} {t('cargo.photosAdded')}
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600 animate-in fade-in slide-in-from-top-2 duration-300">
            {error}
          </p>
        )}
      </div>
    );
  }
);

export default MultiPhotoUpload;
