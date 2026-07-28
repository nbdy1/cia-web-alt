/** Compress an uploaded image before it reaches Storage. Browser-only. */
export async function compressImage(file: File, maxDimension = 768): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.78),
  );
  if (!blob) return file;

  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}
