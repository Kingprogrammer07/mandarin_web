import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface CameraUploadProps {
  label: string;
  value?: File | null;

  onChange: (file: File | null) => void;
  error?: string;
  onCameraClose?: () => void; // Callback when camera closes after capture
}

export default function CameraUpload({
  label,
  onChange,
  error,
  onCameraClose
}: CameraUploadProps) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false); // State for UI updates
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Handle file selection from gallery
  const handleFileChange = useCallback((file: File | null) => {

    if (file && file.type.startsWith('image/')) {
      onChange(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, [onChange]);


  /**
   * CRITICAL: Stop all media tracks to prevent memory leaks and camera lock
   * This must be called on component unmount, camera close, and before opening new stream
   */
  const stopMediaStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
  }, []);

  /**
   * Open camera using getUserMedia API
   *
   * WHY THIS APPROACH:
   * - Telegram WebApp on Android/iOS doesn't reliably support <input capture>
   * - getUserMedia gives direct access to camera stream
   * - We can control when to capture, ensuring fresh photos
   *
   * TELEGRAM ANDROID WEBVIEW FIX:
   * - onLoadedMetadata is UNRELIABLE in Telegram WebView
   * - We MUST explicitly call video.play()
   * - We MUST poll using requestAnimationFrame until videoWidth > 0
   *
   * iOS-SPECIFIC HANDLING:
   * - playsInline is REQUIRED (without it, iOS opens fullscreen native player)
   * - muted is REQUIRED (iOS won't autoplay videos with audio)
   * - facingMode: 'environment' may fail on some iOS devices → we fallback to 'user'
   * - Must be triggered by user interaction (button click)
   */
  const openCamera = useCallback(async () => {
    try {
      // Stop any existing stream first
      stopMediaStream();

      // Try rear camera first (environment)
      let stream: MediaStream | null = null;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Rear camera (preferred for cargo photos)
            width: { ideal: 3840, min: 1920 }, // 4K ideal, minimum 1080p
            height: { ideal: 2160, min: 1080 }
          },
          audio: false // No audio needed
        });
      } catch (envError) {
        // iOS FALLBACK: If environment camera fails, try user (front) camera
        console.warn('Environment camera failed, trying user camera:', envError);
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user', // Front camera fallback
            width: { ideal: 3840, min: 1920 },
            height: { ideal: 2160, min: 1080 }
          },
          audio: false
        });
      }

      if (!stream) {
        throw new Error('Kamera ochilmadi');
      }

      streamRef.current = stream;
      setIsCameraOpen(true);

      // CRITICAL FIX FOR TELEGRAM ANDROID WEBVIEW:
      // We cannot rely on onLoadedMetadata event - it's unreliable in WebView
      // Instead, we explicitly:
      // 1. Wait for video element to render
      // 2. Set srcObject
      // 3. Explicitly call play()
      // 4. Poll with requestAnimationFrame until videoWidth > 0

      requestAnimationFrame(() => {
        const video = videoRef.current;
        if (!video || !streamRef.current) return;

        // Set video source
        video.srcObject = streamRef.current;

        // CRITICAL: Explicitly call play() - WebView won't autoplay reliably
        video.play().catch(err => {
          console.warn('Video play() failed:', err);
        });

        // POLLING LOOP: Wait until video dimensions are available
        // This is the ONLY reliable method in Telegram Android WebView
        let pollAttempts = 0;
        const maxPollAttempts = 120; // ~2 seconds at 60fps

        const pollVideoReady = () => {
          pollAttempts++;

          if (!video || !streamRef.current) {
            // Stream was stopped, abort polling
            return;
          }

          // SUCCESS: Video is ready when dimensions are available
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            console.log('✅ Camera ready:', video.videoWidth, 'x', video.videoHeight);
            setIsCameraReady(true); // Update state to hide loader

            return; // Stop polling
          }

          // TIMEOUT: Prevent infinite polling
          if (pollAttempts >= maxPollAttempts) {
            console.error('❌ Camera ready timeout after', maxPollAttempts, 'attempts');
            setIsCameraReady(false);

            // Show error to user
            if (window.Telegram?.WebApp) {
              window.Telegram.WebApp.showAlert(
                'Kamera tayyorlanishda xatolik. Qaytadan urinib ko\'ring.'
              );
            }

            // Clean up
            stopMediaStream();
            setIsCameraOpen(false);
            return;
          }

          // CONTINUE POLLING: Schedule next check
          requestAnimationFrame(pollVideoReady);
        };

        // Start polling
        pollVideoReady();
      });

    } catch (error) {
      console.error('Camera access error:', error);

      // User-friendly error messages
      let errorMessage = 'Kameraga ruxsat berilmadi. Sozlamalarni tekshiring.';

      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Kameraga ruxsat berilmadi. Telegram sozlamalarida kamera ruxsatini yoqing.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'Kamera topilmadi. Qurilmangizda kamera borligini tekshiring.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Kamera band. Boshqa ilova kamerani ishlatayotgan bo\'lishi mumkin.';
        }
      }

      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(errorMessage);
      } else {
        alert(errorMessage);
      }

      // Clean up on error
      stopMediaStream();
      setIsCameraOpen(false);
    }
  }, [stopMediaStream]);

  /**
   * Close camera and clean up resources
   */
  const closeCamera = useCallback(() => {
    stopMediaStream();
    setIsCameraOpen(false);
  }, [stopMediaStream]);

  /**
   * Capture photo from video stream
   *
   * CRITICAL STEPS TO PREVENT BLACK SCREEN:
   * 1. Verify video element exists and has valid dimensions
   * 2. Set canvas size to EXACT video dimensions
   * 3. Draw current frame from video to canvas
   * 4. Convert canvas to JPEG blob (quality 0.92 for good quality/size balance)
   * 5. Create File object from blob
   *
   * WHY THIS WORKS:
   * - Canvas captures the CURRENT frame from live video stream
   * - We ensure video is ready (videoWidth > 0) before capture
   * - toBlob is async and non-blocking
   */
  const capturePhoto = useCallback(() => {
    if (isCapturing) return; // Prevent double-capture

    setIsCapturing(true);

    // Verify video is ready
    if (!videoRef.current || !canvasRef.current || !isCameraReady) {
      console.error('Video not ready for capture');
      setIsCapturing(false);

      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('Kamera hali tayyor emas. Bir oz kuting va qayta urinib ko\'ring.');
      }
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Verify video has valid dimensions (prevents black screen)
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('Video dimensions are 0');
      setIsCapturing(false);

      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('Kamera hali tayyor emas. Yana bir bor urinib ko\'ring.');
      }
      return;
    }

    // Set canvas to exact video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsCapturing(false);
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob and create File
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `cargo-${Date.now()}.jpg`, {
            type: 'image/jpeg'
          });

          // Update parent component
          handleFileChange(file);

          // Close camera
          closeCamera();

          // Notify parent that camera closed (for auto-focus logic)
          if (onCameraClose) {
            onCameraClose();
          }
        }
        setIsCapturing(false);
      },
      'image/jpeg',
      0.95 // Quality: 0.95 for high quality cargo photos
    );
  }, [isCapturing, handleFileChange, closeCamera, onCameraClose, isCameraReady]);

  /**
   * Remove photo and reset
   */
  const handleRemove = useCallback(() => {
    onChange(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    closeCamera();
  }, [onChange, closeCamera]);

  /**
   * CRITICAL: Cleanup on component unmount
   * Without this, camera stays locked and causes issues
   */
  useEffect(() => {
    return () => {
      stopMediaStream();
    };
  }, [stopMediaStream]);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>

      {/* Camera View - Real-time video stream */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Video Stream */}
          <div className="flex-1 relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline // CRITICAL for iOS: prevents fullscreen native player
              muted // CRITICAL for iOS: allows autoplay
              className="w-full h-full object-cover"
            />

            {/* Loading indicator while video initializes */}
            {!isCameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-white text-sm">{t('camera.preparingCamera')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Camera Controls - Fixed at bottom */}
          <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent flex items-center justify-center gap-4 z-50">
            <Button
              type="button"
              onClick={closeCamera}
              variant="outline"
              size="lg"
              className="bg-white/10 text-white border-white/30 hover:bg-white/20 backdrop-blur-sm"
              disabled={isCapturing}
            >
              {t('camera.cancel')}
            </Button>
            <Button
              type="button"
              onClick={capturePhoto}
              size="lg"
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 shadow-lg"
              disabled={isCapturing || !isCameraReady}
            >
              {isCapturing ? (
                <>
                  <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('cargo.saving')}
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5 mr-2" />
                  {t('camera.takePhoto')}
                </>
              )}
            </Button>
          </div>

          {/* Hidden canvas for capturing - MUST be in DOM for drawImage */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Photo selection buttons (when no preview) */}
      {!preview && !isCameraOpen && (
        <div className="grid grid-cols-2 gap-3">
          {/* Camera Button - opens real camera */}
          <button
            type="button"
            onClick={openCamera}
            className="relative border-2 border-dashed border-orange-300 rounded-lg p-8 cursor-pointer transition-all duration-300 hover:border-orange-500 hover:bg-orange-50 active:scale-95"
          >
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="p-3 rounded-full bg-orange-100">
                <Camera className="w-8 h-8 text-orange-500" />
              </div>
              <p className="text-sm font-medium text-gray-700">{t('camera.openCamera')}</p>
            </div>
          </button>

          {/* Gallery Button - opens file picker */}
          <label
            htmlFor="gallery-input"
            className="relative border-2 border-dashed border-gray-300 rounded-lg p-8 cursor-pointer transition-all duration-300 hover:border-gray-500 hover:bg-gray-50 active:scale-95"
          >
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="p-3 rounded-full bg-gray-100">
                <Upload className="w-8 h-8 text-gray-500" />
              </div>
              <p className="text-sm font-medium text-gray-700">{t('camera.selectFromGallery')}</p>
            </div>
          </label>

          {/* Gallery Input - file picker */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            className="hidden"
            id="gallery-input"
          />
        </div>
      )}

      {/* Photo preview (after capture or selection) */}
      {preview && !isCameraOpen && (
        <div className="relative group rounded-lg overflow-hidden border-2 border-orange-200 hover:border-orange-400 transition-all duration-300 h-[280px]">
          <img
            src={preview}
            alt={label}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={openCamera}
              className="cursor-pointer"
            >
              <div className="rounded-full bg-white p-2 transform scale-90 group-hover:scale-100 transition-transform hover:bg-gray-100">
                <Camera className="w-5 h-5 text-gray-700" />
              </div>
            </button>
            <Button
              type="button"
              onClick={handleRemove}
              variant="destructive"
              size="icon"
              className="rounded-full transform scale-90 group-hover:scale-100 transition-transform"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-600 animate-in fade-in slide-in-from-top-2 duration-300">
          {error}
        </p>
      )}
    </div>
  );
}
