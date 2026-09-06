import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import sharp from 'sharp';
import { authenticate } from '../middleware/auth.js';

const UPLOAD_DIR = path.resolve('uploads');
const MAX_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_DIM = 1920;

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const name = crypto.randomUUID();
    cb(null, name + '.jpg');
  },
});

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/heic', 'image/heif'];

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Accept all image types including HEIC; sharp will convert
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.heic', '.heif'].includes(ext)) {
      return cb(null, true);
    }
    return cb(new Error('Only images (JPEG, PNG, GIF, WebP, HEIC) are allowed.'));
  },
});

const router = Router();

// Upload image — always converts to JPEG via sharp
router.post('/image', authenticate, async (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Max 20MB.' });
      }
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const outputPath = filePath; // overwrite in-place

    try {
      // Convert to JPEG, resize, strip EXIF via sharp
      await sharp(filePath)
        .resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true })
        .toFile(outputPath + '_tmp.jpg');

      // Replace original with converted
      fs.unlinkSync(filePath);
      fs.renameSync(outputPath + '_tmp.jpg', outputPath);

      const stats = fs.statSync(outputPath);
      const protocol = req.protocol;
      const host = req.get('host');
      const baseUrl = `${protocol}://${host}`;
      const url = `${baseUrl}/uploads/${req.file.filename}`;

      res.json({
        url,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: stats.size,
        mime: 'image/jpeg',
      });
    } catch (convErr) {
      console.error('[Upload] Sharp conversion error:', convErr);
      // Fallback: return original file if conversion fails
      const protocol = req.protocol;
      const host = req.get('host');
      const baseUrl = `${protocol}://${host}`;
      const url = `${baseUrl}/uploads/${req.file.filename}`;
      res.json({
        url,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mime: req.file.mimetype,
      });
    }
  });
});

export default router;