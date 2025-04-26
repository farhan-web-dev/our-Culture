const multer = require("multer");

const storage = multer.memoryStorage(); // Stores files in memory as buffers
const upload = multer({ storage });

module.exports = upload;
