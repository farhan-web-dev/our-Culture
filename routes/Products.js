const express = require("express");
const multer = require("multer");
const {
  createProduct,
  fetchAllProducts,
  fetchProductById,
  updateProduct,
} = require("../controller/Product");
const { Product } = require("../model/Product"); // 🧠 Needed for serving image

const router = express.Router();

// Configure multer to store uploads in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Routes
router
  .post(
    "/",
    upload.fields([
      { name: "thumbnail", maxCount: 1 },
      { name: "images", maxCount: 5 },
    ]),
    createProduct
  )
  .get("/", fetchAllProducts)
  .get("/:id", fetchProductById)
  .patch("/:id", updateProduct);

// ✅ Serve thumbnail image
router.get("/:id/thumbnail", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || !product.thumbnail || !product.thumbnail.data) {
      return res.status(404).send("Thumbnail not found");
    }

    res.set("Content-Type", product.thumbnail.contentType);
    res.send(product.thumbnail.data);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error retrieving thumbnail");
  }
});

router.get("/:productId/images/:imageId", async (req, res) => {
  try {
    const { productId, imageId } = req.params;
    const product = await Product.findById(productId);

    if (!product || !product.images || product.images.length === 0) {
      return res.status(404).send("Product or images not found");
    }

    const image = product.images.find((img) => img._id.toString() === imageId);
    if (!image || !image.data) {
      return res.status(404).send("Image not found");
    }

    res.set("Content-Type", image.contentType);
    res.send(image.data);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error retrieving image");
  }
});

// Export
exports.router = router;
