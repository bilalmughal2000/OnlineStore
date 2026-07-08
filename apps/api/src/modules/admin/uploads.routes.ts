import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { asyncHandler } from '../../lib/asyncHandler';
import { badRequest } from '../../lib/errors';

export const adminUploadsRouter = Router();

// Accept images up to 5 MB, kept in memory so we can forward to Cloudinary
// (or write to disk in dev) without a temp-file step.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

const cloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET,
);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
} else if (process.env.NODE_ENV === 'production') {
  // Guard against shipping disk storage: images on the VPS have no CDN/redundancy.
  console.warn(
    '[uploads] Cloudinary is NOT configured — uploads will be stored on local disk. ' +
      'Set CLOUDINARY_* in production so images live on a CDN.',
  );
}

// Local dev fallback directory (served statically at /uploads). NOT for production
// — production must set Cloudinary creds so images live on a CDN, not the VPS disk.
const uploadsDir = path.resolve(process.cwd(), 'uploads');

function uploadToCloudinary(buffer: Buffer, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `clothing-store/${folder}`, resource_type: 'image' },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error('Upload failed'));
        resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });
}

function saveToDisk(buffer: Buffer, originalName: string, req: import('express').Request): string {
  fs.mkdirSync(uploadsDir, { recursive: true });
  const ext = (path.extname(originalName) || '.jpg').toLowerCase();
  const name = `${crypto.randomBytes(12).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(uploadsDir, name), buffer);
  return `${req.protocol}://${req.get('host')}/uploads/${name}`;
}

/**
 * POST /admin/uploads?folder=products|size-charts
 * Multipart form field: `file`. Returns { url }.
 * Used for BOTH product images and size-chart images.
 */
adminUploadsRouter.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('No file uploaded (field "file")');
    const folder = req.query.folder === 'size-charts' ? 'size-charts' : 'products';

    const url = cloudinaryConfigured
      ? await uploadToCloudinary(req.file.buffer, folder)
      : saveToDisk(req.file.buffer, req.file.originalname, req);

    res.status(201).json({ url, provider: cloudinaryConfigured ? 'cloudinary' : 'local' });
  }),
);
