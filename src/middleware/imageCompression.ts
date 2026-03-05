import fs from "fs";
import path from "path";
import sharp from "sharp";
import { Request, Response, NextFunction } from "express";

const MAX_IMAGE_SIZE_BYTES = 200 * 1024;
const MAX_IMAGE_WIDTH = 1600;
const CONCURRENT_IMAGE_JOBS = 2;
const MIN_IMAGE_WIDTH = 240;

const gatherUploadedFiles = (req: Request): Express.Multer.File[] => {
  const files: Express.Multer.File[] = [];

  if (req.file) {
    files.push(req.file);
  }

  if (Array.isArray(req.files)) {
    files.push(...req.files);
  } else if (req.files && typeof req.files === "object") {
    const groupedFiles = req.files as Record<string, Express.Multer.File[]>;
    Object.values(groupedFiles).forEach((fileGroup) => {
      if (Array.isArray(fileGroup)) {
        files.push(...fileGroup);
      }
    });
  }

  return files;
};

const swapFileExtension = (fileName: string, ext: string): string => {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) {
    return `${fileName}${ext}`;
  }
  return `${fileName.slice(0, dotIndex)}${ext}`;
};

const encodeWithQuality = async (
  source: Buffer,
  format: string,
  width: number | undefined,
  quality: number,
): Promise<Buffer> => {
  let pipeline = sharp(source).rotate();

  if (width) {
    pipeline = pipeline.resize({ width, withoutEnlargement: true });
  }

  if (format === "png") {
    return pipeline
      .png({ quality, compressionLevel: 9, adaptiveFiltering: true, palette: true })
      .toBuffer();
  }

  if (format === "webp") {
    return pipeline.webp({ quality }).toBuffer();
  }

  return pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
};

const persistResult = async (
  file: Express.Multer.File,
  preferredFormat: string,
  format: string,
  content: Buffer,
) => {
  if (format === preferredFormat) {
    await fs.promises.writeFile(file.path, content);
  } else {
    const newExt = format === "jpeg" ? ".jpg" : ".webp";
    const newPath = path.join(path.dirname(file.path), swapFileExtension(file.filename, newExt));
    await fs.promises.writeFile(newPath, content);
    await fs.promises.unlink(file.path).catch(() => undefined);
    file.filename = path.basename(newPath);
    file.path = newPath;
    file.mimetype = format === "jpeg" ? "image/jpeg" : "image/webp";
  }

  file.size = content.length;
};

const compressImageFile = async (file: Express.Multer.File): Promise<void> => {
  if (!file.path || !file.mimetype?.startsWith("image/")) {
    return;
  }

  const currentStat = await fs.promises.stat(file.path);
  if (currentStat.size <= MAX_IMAGE_SIZE_BYTES) {
    return;
  }

  const sourceBuffer = await fs.promises.readFile(file.path);
  const metadata = await sharp(sourceBuffer).metadata();
  const baseWidth = metadata.width;

  const hasAlpha = Boolean(metadata.hasAlpha);
  const preferredFormat = metadata.format === "png" || metadata.format === "webp" ? metadata.format : "jpeg";
  const formatCandidates = [preferredFormat, "jpeg", "webp"].filter(
    (value, index, all) => all.indexOf(value) === index,
  );

  const attempts = [
    { quality: 78, scale: 1 },
    { quality: 70, scale: 0.9 },
    { quality: 62, scale: 0.8 },
    { quality: 54, scale: 0.72 },
    { quality: 46, scale: 0.64 },
    { quality: 38, scale: 0.56 },
    { quality: 32, scale: 0.48 },
    { quality: 28, scale: 0.4 },
  ];

  let bestResult: Buffer | null = null;
  let bestFormat = preferredFormat;

  for (const format of formatCandidates) {
    if (format === "jpeg" && hasAlpha) {
      continue;
    }

    for (const attempt of attempts) {
      const resizedWidth = baseWidth
        ? Math.max(MIN_IMAGE_WIDTH, Math.min(MAX_IMAGE_WIDTH, Math.floor(baseWidth * attempt.scale)))
        : undefined;

      const candidate = await encodeWithQuality(
        sourceBuffer,
        format,
        resizedWidth,
        attempt.quality,
      );

      if (!bestResult || candidate.length < bestResult.length) {
        bestResult = candidate;
        bestFormat = format;
      }

      if (candidate.length <= MAX_IMAGE_SIZE_BYTES) {
        await persistResult(file, preferredFormat, format, candidate);
        return;
      }
    }
  }

  if (bestResult && bestResult.length < currentStat.size) {
    await persistResult(file, preferredFormat, bestFormat, bestResult);
    return;
  }
};

const runWithConcurrencyLimit = async (
  files: Express.Multer.File[],
  worker: (file: Express.Multer.File) => Promise<void>,
) => {
  let currentIndex = 0;

  const runWorker = async (): Promise<void> => {
    if (currentIndex >= files.length) {
      return;
    }

    const file = files[currentIndex];
    currentIndex += 1;
    await worker(file);
    await runWorker();
  };

  const workers = Array.from(
    { length: Math.min(CONCURRENT_IMAGE_JOBS, files.length) },
    () => runWorker(),
  );

  await Promise.all(workers);
};

export const minifyUploadedImages = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const uploadedFiles = gatherUploadedFiles(req);
    await runWithConcurrencyLimit(uploadedFiles, compressImageFile);

    next();
  } catch (error) {
    next(error);
  }
};
