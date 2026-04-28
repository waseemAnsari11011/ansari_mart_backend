const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const multer = require("multer");
const sharp = require("sharp");

// Configure AWS S3 Client (v3)
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const multerUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      // Allow other files but they won't be compressed
      cb(null, true);
    }
  },
});

const compressAndUpload = (folderName) => async (req, res, next) => {
  // Support both single and multiple file uploads
  const files = req.file ? [req.file] : (req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : []);

  if (files.length === 0) {
    return next();
  }

  try {
    console.log(`Starting S3 upload to folder: ${folderName}, files count: ${files.length}`);
    await Promise.all(
      files.map(async (file) => {
        const originalName = file.originalname.replace(/\s+/g, "_");
        const uniqueName = `${folderName}/${Date.now()}_${originalName}`;
        console.log(`Uploading file: ${originalName} as ${uniqueName}`);
        let processedBuffer = file.buffer;

        // Compress images
        if (file.mimetype.startsWith("image/")) {
          let sharpInstance = sharp(file.buffer).resize(1920, 1080, {
            fit: "inside",
            withoutEnlargement: true,
          });

          if (file.mimetype === "image/jpeg" || file.mimetype === "image/jpg") {
            processedBuffer = await sharpInstance
              .jpeg({ quality: 80, progressive: true, optimizeScans: true })
              .toBuffer();
          } else if (file.mimetype === "image/png") {
            processedBuffer = await sharpInstance
              .png({ quality: 80, compressionLevel: 8 })
              .toBuffer();
          } else {
            // For other image types like webp, gif etc.
            processedBuffer = await sharpInstance
              .webp({ quality: 75 })
              .toBuffer();
          }

          // If still over 5MB, apply more aggressive compression
          if (processedBuffer.length > 5 * 1024 * 1024) {
            processedBuffer = await sharp(processedBuffer)
              .jpeg({ quality: 60 })
              .toBuffer();
          }
        }

        const uploadParams = {
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: uniqueName,
          Body: processedBuffer,
          ContentType: file.mimetype,
        };

        const command = new PutObjectCommand(uploadParams);
        await s3Client.send(command);

        // Attach the S3 URL to the file object
        file.location = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueName}`;
        file.key = uniqueName;
        delete file.buffer; // Free up memory
      })
    );
    next();
  } catch (error) {
    console.error("Error in S3 upload middleware:", error);
    next(error);
  }
};

const createS3Upload = (folderName, config) => {
  // Using .any() is more flexible and prevents 'Unexpected field' errors 
  // if the frontend field name changes or extra fields are sent.
  const uploadMiddleware = multerUpload.any();
  return [uploadMiddleware, compressAndUpload(folderName)];
};

module.exports = createS3Upload;
