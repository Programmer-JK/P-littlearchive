/**
 * Resize an image file to fit within maxSize (long edge), returning a JPEG Blob.
 * Uses step-down halving to avoid quality loss from single large-to-small draws.
 */
export async function resizeImage(
  file: File,
  maxSize: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(1, maxSize / Math.max(w, h));

      let curW = w;
      let curH = h;
      const targetW = Math.round(w * scale);
      const targetH = Math.round(h * scale);

      // Step-down: halve dimensions until within 2x of target
      let source: HTMLCanvasElement | HTMLImageElement = img;
      while (curW * 0.5 > targetW) {
        curW = Math.round(curW * 0.5);
        curH = Math.round(curH * 0.5);
        const step = document.createElement("canvas");
        step.width  = curW;
        step.height = curH;
        const ctx = step.getContext("2d")!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(source, 0, 0, curW, curH);
        source = step;
      }

      // Final draw to exact target size
      const canvas = document.createElement("canvas");
      canvas.width  = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source, 0, 0, targetW, targetH);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        },
        "image/jpeg",
        0.92
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}
