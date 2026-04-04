const path = require("path");

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    const relativePath = `/uploads/${req.file.filename}`;
    
    res.status(200).json({
      message: "File uploaded successfully",
      url: fileUrl,
      path: relativePath,
      filename: req.file.filename
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
