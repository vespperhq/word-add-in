const GET_FILE_TIMEOUT_MS = 45_000;

function formatOfficeError(err?: Office.Error): string {
  if (!err) return "Unknown Office.js error";
  const parts = [err.name, err.message, err.code].filter(Boolean);
  return parts.length ? parts.join(" — ") : String(err);
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function closeFileAsync(file: Office.File): Promise<void> {
  return new Promise((resolve, reject) => {
    file.closeAsync((result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) resolve();
      else reject(new Error(formatOfficeError(result.error)));
    });
  });
}

function toUint8Array(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (Array.isArray(data)) return Uint8Array.from(data);
  throw new Error("Unexpected slice payload from Office.js");
}

export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function getDocumentBytes(): Promise<Uint8Array<ArrayBuffer>> {
  return withTimeout(
    new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
      if (!Office.context?.document?.getFileAsync) {
        reject(
          new Error("Office.context.document.getFileAsync is unavailable")
        );
        return;
      }

      Office.context.document.getFileAsync(
        Office.FileType.Compressed,
        { sliceSize: 65536 },
        (result) => {
          if (result.status !== Office.AsyncResultStatus.Succeeded) {
            reject(new Error(formatOfficeError(result.error)));
            return;
          }

          const file = result.value;
          if (file.sliceCount === 0) {
            closeFileAsync(file)
              .then(() =>
                reject(
                  new Error(
                    "Document export returned 0 slices — save the file and retry."
                  )
                )
              )
              .catch(reject);
            return;
          }

          const parts: Uint8Array[] = [];
          let index = 0;

          function readSlice(): void {
            file.getSliceAsync(index, (sliceResult) => {
              if (sliceResult.status !== Office.AsyncResultStatus.Succeeded) {
                closeFileAsync(file).finally(() =>
                  reject(new Error(formatOfficeError(sliceResult.error)))
                );
                return;
              }

              parts.push(toUint8Array(sliceResult.value.data));
              index += 1;

              if (index < file.sliceCount) {
                readSlice();
              } else {
                closeFileAsync(file)
                  .then(() => {
                    const total = parts.reduce(
                      (sum, part) => sum + part.byteLength,
                      0
                    );
                    const merged = new Uint8Array(total);
                    let offset = 0;
                    for (const part of parts) {
                      merged.set(part, offset);
                      offset += part.byteLength;
                    }
                    resolve(merged);
                  })
                  .catch(reject);
              }
            });
          }

          readSlice();
        }
      );
    }),
    GET_FILE_TIMEOUT_MS,
    "getFileAsync"
  );
}

export type TrackingMode = Word.Document["changeTrackingMode"];

export async function applyDocxToWord(
  data: ArrayBuffer | Uint8Array,
  restoreMode?: TrackingMode | null
): Promise<void> {
  const base64 = arrayBufferToBase64(data);
  await Word.run(async (context) => {
    const doc = context.document;
    if (restoreMode == null) {
      doc.load("changeTrackingMode");
      await context.sync();
    }
    const previousMode: TrackingMode = restoreMode ?? doc.changeTrackingMode;
    doc.changeTrackingMode = Word.ChangeTrackingMode.off;
    doc.body.insertFileFromBase64(base64, Word.InsertLocation.replace);
    await context.sync();
    doc.changeTrackingMode =
      previousMode === Word.ChangeTrackingMode.off
        ? Word.ChangeTrackingMode.trackAll
        : previousMode;
    await context.sync();
  });
}
