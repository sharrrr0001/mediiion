/**
 * Shrinks photos on the phone before upload (spec §8: max 1600px, ~300 KB) so slow 3G uploads work.
 * PDFs and non-image files pass through untouched.
 */
const MAX_SIDE = 1600;
const TARGET_BYTES = 300 * 1024;

export async function compressForUpload(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/heic') return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // browser cannot decode it; let the server decide
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let quality = 0.82;
  let blob = await toBlob(canvas, quality);
  while (blob && blob.size > TARGET_BYTES && quality > 0.45) {
    quality -= 0.12;
    blob = await toBlob(canvas, quality);
  }
  return blob && blob.size < file.size ? blob : file;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}
