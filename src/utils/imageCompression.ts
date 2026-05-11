export interface ImageCompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  wasCompressed: boolean;
}

interface ImageCompressionOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
}

const DEFAULT_IMAGE_COMPRESSION: ImageCompressionOptions = {
  maxWidth: 1280,
  maxHeight: 720,
  quality: 0.82,
};

function getCompressedFileName(fileName: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'passport-image';
  return `${baseName}.jpg`;
}

function loadImageFromObjectUrl(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image could not be decoded'));
    image.src = objectUrl;
  });
}

function calculateContainSize(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number,
) {
  const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight, 1);

  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale)),
  };
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality);
  });
}

export async function compressImageFile(
  file: File,
  options: ImageCompressionOptions = DEFAULT_IMAGE_COMPRESSION,
): Promise<ImageCompressionResult> {
  if (!file.type.startsWith('image/')) {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      wasCompressed: false,
    };
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageFromObjectUrl(objectUrl);
    const { width, height } = calculateContainSize(
      image.naturalWidth,
      image.naturalHeight,
      options.maxWidth,
      options.maxHeight,
    );

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Canvas context is not available');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const compressedBlob = await canvasToJpegBlob(canvas, options.quality);
    if (!compressedBlob) {
      throw new Error('Image compression failed');
    }

    if (compressedBlob.size >= file.size) {
      return {
        file,
        originalSize: file.size,
        compressedSize: file.size,
        wasCompressed: false,
      };
    }

    const compressedFile = new File([compressedBlob], getCompressedFileName(file.name), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    return {
      file: compressedFile,
      originalSize: file.size,
      compressedSize: compressedFile.size,
      wasCompressed: true,
    };
  } catch {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      wasCompressed: false,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
