import {
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_MESSAGE,
  SUPPORTED_IMAGE_MIME_TYPES,
  type ImageMimeType,
  type MessageImage,
} from "../../shared/messages";

export { MAX_IMAGES_PER_MESSAGE };

function getImageMimeType(file: File): ImageMimeType {
  const mimeType =
    file.type.toLowerCase() === "image/jpg"
      ? "image/jpeg"
      : file.type.toLowerCase();
  if (!SUPPORTED_IMAGE_MIME_TYPES.includes(mimeType as ImageMimeType)) {
    throw new Error(`unsupported image type: ${mimeType || "missing"}`);
  }
  return mimeType as ImageMimeType;
}

export function getPastedImageFiles(clipboard: DataTransfer): File[] {
  const files = [...clipboard.files].filter((file) =>
    file.type.toLowerCase().startsWith("image/")
  );
  const itemFiles = [...clipboard.items]
    .filter(
      (item) =>
        item.kind === "file" && item.type.toLowerCase().startsWith("image/")
    )
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
  const seen = new Set<string>();

  return [...files, ...itemFiles].filter((file) => {
    const key = `${file.type}:${file.size}:${file.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function readImageFile(file: File): Promise<MessageImage> {
  return new Promise((resolve, reject) => {
    let mimeType: ImageMimeType;
    try {
      mimeType = getImageMimeType(file);
    } catch (error) {
      reject(error);
      return;
    }
    if (!file.size) {
      reject(new Error("image is empty"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error(`image exceeds ${MAX_IMAGE_BYTES / (1024 * 1024)} MB`));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const separator = dataUrl.indexOf(",");
      const base64 = separator >= 0 ? dataUrl.slice(separator + 1) : "";
      if (!base64) {
        reject(new Error("image could not be encoded"));
        return;
      }
      resolve({
        id: crypto.randomUUID(),
        name: file.name.trim() || "image.png",
        mimeType,
        base64,
      });
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("image could not be read"));
    };
    reader.readAsDataURL(file);
  });
}

export function getImageDataUrl(image: MessageImage): string {
  return `data:${image.mimeType};base64,${image.base64}`;
}

export function getImageTypeLabel(image: MessageImage): string {
  return image.mimeType === "image/jpeg"
    ? "JPEG"
    : image.mimeType.split("/")[1].toUpperCase();
}
