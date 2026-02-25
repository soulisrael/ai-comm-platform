import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { DocxConverter } from '../../services/docx-converter';
import { BrainManager } from '../../brain/brain-manager';
import { BrainLoader } from '../../brain/brain-loader';
import { BrainCategory } from '../../types/brain';
import { AppError } from '../middleware/error-handler';
import logger from '../../services/logger';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.docx')) {
      cb(null, true);
    } else {
      cb(new Error('Only .docx files are accepted'));
    }
  },
});

const validCategories: BrainCategory[] = ['sales', 'support', 'company'];

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function createUploadRouter(
  converter: DocxConverter,
  brainManager: BrainManager,
  brainLoader: BrainLoader
): Router {
  const router = Router();

  router.post(
    '/',
    (req: Request, res: Response, next: NextFunction) => {
      upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          return next(new AppError(
            err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 10MB)' : err.message,
            400,
            'UPLOAD_ERROR'
          ));
        }
        if (err) {
          return next(new AppError(err.message, 400, 'UPLOAD_ERROR'));
        }
        next();
      });
    },
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const file = req.file;
        if (!file) {
          throw new AppError('No file uploaded', 400, 'VALIDATION_ERROR');
        }

        const category = req.body.category as BrainCategory;
        if (!category || !validCategories.includes(category)) {
          throw new AppError(
            `Invalid category. Must be one of: ${validCategories.join(', ')}`,
            400,
            'VALIDATION_ERROR'
          );
        }

        const preview = req.body.preview === 'true';
        const rawName = req.body.moduleName || path.basename(file.originalname, '.docx');
        const moduleName = `uploaded-${toKebabCase(rawName)}`;

        // Convert .docx → JSON via Claude
        const result = await converter.convert(file.buffer, category, moduleName);

        if (preview) {
          res.json({
            preview: true,
            moduleName,
            category,
            convertedData: result.convertedData,
            extractedText: result.extractedText.slice(0, 500),
            tokenUsage: result.tokenUsage,
          });
          return;
        }

        // Save to brain
        const brainPath = path.resolve(process.cwd(), 'brain');
        const categoryPath = path.join(brainPath, category);
        if (!fs.existsSync(categoryPath)) {
          fs.mkdirSync(categoryPath, { recursive: true });
        }

        const filePath = path.join(categoryPath, `${moduleName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(result.convertedData, null, 2) + '\n', 'utf-8');

        // Reload brain so agents have access immediately
        brainLoader.loadCategory(category);

        logger.info('Document uploaded and saved to brain', { category, moduleName });

        res.status(201).json({
          success: true,
          moduleName,
          category,
          module: `${category}/${moduleName}`,
          tokenUsage: result.tokenUsage,
        });
      } catch (err) {
        if (err instanceof AppError) return next(err);
        let message = err instanceof Error ? err.message : 'Upload failed';
        // Extract readable message from Claude API errors
        const creditMatch = message.match(/credit balance is too low/i);
        if (creditMatch) {
          message = 'Anthropic API credit balance is too low. Please top up your credits at console.anthropic.com.';
        } else if (message.includes('Failed to parse Claude response as JSON')) {
          message = 'Claude returned an invalid response. Please try again.';
        }
        next(new AppError(message, 500, 'UPLOAD_CONVERSION_ERROR'));
      }
    }
  );

  return router;
}
