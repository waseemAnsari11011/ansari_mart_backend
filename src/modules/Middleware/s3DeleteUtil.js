const { S3Client, DeleteObjectsCommand } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Extracts the S3 object key from a full S3 URL.
 */
const extractS3KeyFromUrl = (url) => {
  if (typeof url !== "string" || !url.includes("amazonaws.com")) return null;
  try {
    const { pathname } = new URL(url);
    return pathname.substring(1); // Remove leading '/'
  } catch (error) {
    console.error("Invalid URL for S3 key extraction:", url);
    return null;
  }
};

/**
 * Deletes multiple objects from an S3 bucket.
 * @param {string[]} keys - Array of S3 keys
 */
const deleteS3Objects = async (keys) => {
  if (!keys || keys.length === 0) return;

  const deleteParams = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Delete: {
      Objects: keys.map((key) => ({ Key: key })),
      Quiet: false,
    },
  };

  try {
    const command = new DeleteObjectsCommand(deleteParams);
    await s3Client.send(command);
    console.log("Successfully deleted from S3:", keys);
  } catch (error) {
    console.error("Failed to delete from S3:", error);
  }
};

module.exports = {
  extractS3KeyFromUrl,
  deleteS3Objects,
};
