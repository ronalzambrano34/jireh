const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_QUALITY = 0.72;
const COMPRESSED_IMAGE_TYPE = 'image/jpeg';

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return file;
    }

    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, COMPRESSED_IMAGE_TYPE, IMAGE_QUALITY);
    });
    if (!blob || blob.type !== COMPRESSED_IMAGE_TYPE || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'imagen';
    return new File([blob], `${baseName}.jpg`, {
      type: COMPRESSED_IMAGE_TYPE,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

export async function compressImagesInFormData(formData: FormData): Promise<FormData> {
  const compressed = new FormData();
  for (const [key, value] of formData.entries()) {
    compressed.append(key, value instanceof File ? await compressImage(value) : value);
  }
  return compressed;
}
