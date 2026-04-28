const createS3Upload = require("./s3UploadMiddleware");

/**
 * Helper to handle S3 uploads in routes
 * @param {string} folderName - S3 folder path (e.g., 'products', 'categories')
 * @param {string|array|'single'} config - Multer config ('single', array name, or fields array)
 */
const handleS3Upload = (folderName, config) => {
  return createS3Upload(folderName, config);
};

module.exports = handleS3Upload;
