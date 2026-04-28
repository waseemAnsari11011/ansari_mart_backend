exports.uploadImage = async (req, res) => {
  try {
    // Handle both .single() (req.file) and .any()/.array() (req.files)
    const file = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // After S3 middleware, the URL is in file.location
    const fileUrl = file.location;
    const s3Key = file.key;
    
    console.log("Upload successful, returning URL:", fileUrl);

    res.status(200).json({
      message: "File uploaded successfully to S3",
      url: fileUrl,
      path: fileUrl, // Keep 'path' for backward compatibility with frontend
      key: s3Key,
      filename: file.originalname
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ message: "Server error during S3 upload", error: error.message });
  }
};
