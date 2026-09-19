import { useRef, useState } from "react";
import { MAX_IMAGES_PER_MESSAGE, readImageFile } from "../images";
import type { MessageImage } from "../types";

export function useImageAttachments() {
  const [images, setImages] = useState<MessageImage[]>([]);
  const [imageError, setImageError] = useState<string>();
  const [imagesLoading, setImagesLoading] = useState(false);
  const imageReadsRef = useRef(0);

  async function addPastedImages(files: File[]) {
    const available = MAX_IMAGES_PER_MESSAGE - images.length;
    if (available <= 0) {
      setImageError(`You can attach at most ${MAX_IMAGES_PER_MESSAGE} images.`);
      return;
    }

    const selectedFiles = files.slice(0, available);
    setImageError(undefined);
    imageReadsRef.current += 1;
    setImagesLoading(true);
    const results = await Promise.allSettled(
      selectedFiles.map((file) => readImageFile(file))
    );
    imageReadsRef.current -= 1;
    if (imageReadsRef.current === 0) setImagesLoading(false);

    const added = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : []
    );
    setImages((previous) =>
      [...previous, ...added].slice(0, MAX_IMAGES_PER_MESSAGE)
    );

    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    if (failed) {
      setImageError(
        failed.reason instanceof Error
          ? failed.reason.message
          : String(failed.reason)
      );
    } else if (files.length > available) {
      setImageError(`You can attach at most ${MAX_IMAGES_PER_MESSAGE} images.`);
    }
  }

  function removeImage(id: string) {
    setImages((previous) => previous.filter((image) => image.id !== id));
    setImageError(undefined);
  }

  function clearImages() {
    setImages([]);
    setImageError(undefined);
  }

  return {
    images,
    imageError,
    imagesLoading,
    addPastedImages,
    removeImage,
    clearImages,
  };
}
