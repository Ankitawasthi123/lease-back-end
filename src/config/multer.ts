import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure uploads directory exists
const uploadDir = "uploads/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Shared storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${file.originalname}`;
    cb(null, filename);
  },
});

export const upload = multer({ storage });

// For auth endpoints (visiting card, digital signature, profile image)
export const cpUpload = upload.fields([
  { name: "visiting_card_file", maxCount: 1 },
  { name: "digital_signature_file", maxCount: 1 },
  { name: "profile_image", maxCount: 1 },
]);
