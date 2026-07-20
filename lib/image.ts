/**
 * Crops a region out of a data URL image, given a bounding box expressed
 * as fractions (0-1) of the source image's width/height. Used by bulk
 * multi-item import to split one screenshot into individual item photos.
 *
 * Returns null if the crop fails for any reason (malformed box, decode
 * failure, zero-size region). Callers must NOT fall back to the original
 * full screenshot on null: that would silently mislabel a photo of the
 * entire cart/grid as if it were one item's own thumbnail, which is
 * worse than having no photo at all. Show a clear "couldn't crop this
 * one" state instead and let the person decide whether to keep it.
 */
export function cropDataUrlByBox(
  dataUrl: string,
  box: { x: number; y: number; width: number; height: number }
): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        try {
          const sx = Math.max(0, box.x) * img.width;
          const sy = Math.max(0, box.y) * img.height;
          const sw = Math.min(1 - box.x, box.width) * img.width;
          const sh = Math.min(1 - box.y, box.height) * img.height;

          if (sw <= 0 || sh <= 0) {
            resolve(null);
            return;
          }

          const canvas = document.createElement("canvas");
          canvas.width = sw;
          canvas.height = sh;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        } catch {
          resolve(null);
        }
      };
      img.src = dataUrl;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Resizes an uploaded photo to a reasonable max dimension before it's
 * base64-encoded and stored/sent to Groq. Keeps IndexedDB entries and
 * vision-API payloads small. Falls back to returning the original file
 * as a data URL if canvas resizing fails for any reason (e.g. an
 * unsupported image format), rather than blocking the upload entirely.
 */
export function fileToResizedDataUrl(
  file: File,
  maxDim = 900,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No file provided"));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that photo"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => {
        // Fall back to the raw data URL rather than failing the upload.
        resolve((reader.result as string) || "");
      };
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height >= width && height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve((reader.result as string) || "");
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch {
          resolve((reader.result as string) || "");
        }
      };
      img.src = (reader.result as string) || "";
    };
    reader.readAsDataURL(file);
  });
}
