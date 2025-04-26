const { Product } = require("../model/Product");
const upload = require("../utils/uploadFileMiddleware");

exports.createProduct = async (req, res) => {
  try {
    // 1. Validate required fields
    const requiredFields = [
      "title",
      "description",
      "brand",
      "category",
      "thumbnail",
    ];
    const missingFields = requiredFields.filter(
      (field) => !req.body[field] && !req.files?.[field]
    );

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "ValidationError",
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    // 2. Process files
    const thumbnail = req.files?.thumbnail?.[0];
    const images = req.files?.images || [];

    // 3. Create product
    const product = new Product({
      title: req.body.title,
      description: req.body.description,
      brand: req.body.brand,
      category: req.body.category,
      price: parseFloat(req.body.price),
      stock: parseInt(req.body.stock),
      discountPercentage: Math.min(parseFloat(req.body.discountPercentage), 99),
      discountPrice: Math.round(
        req.body.price * (1 - req.body.discountPercentage / 100)
      ),
      thumbnail: {
        data: thumbnail.buffer,
        contentType: thumbnail.mimetype,
      },
      images: images.map((img) => ({
        data: img.buffer,
        contentType: img.mimetype,
      })),
    });

    // 4. Save to database
    await product.save();

    res.status(201).json(product);
  } catch (error) {
    console.error("Create product error:", error);
    res.status(400).json({
      error: "ValidationError",
      message: error.message,
      details: error.errors,
    });
  }
};

exports.fetchAllProducts = async (req, res) => {
  // filter = {"category":["smartphone","laptops"]}
  // sort = {_sort:"price",_order="desc"}
  // pagination = {_page:1,_limit=10}
  let condition = {};
  if (!req.query.admin) {
    condition.deleted = { $ne: true };
  }

  let query = Product.find(condition);
  let totalProductsQuery = Product.find(condition);

  console.log(req.query.category);

  if (req.query.category) {
    query = query.find({ category: { $in: req.query.category.split(",") } });
    totalProductsQuery = totalProductsQuery.find({
      category: { $in: req.query.category.split(",") },
    });
  }
  if (req.query.brand) {
    query = query.find({ brand: { $in: req.query.brand.split(",") } });
    totalProductsQuery = totalProductsQuery.find({
      brand: { $in: req.query.brand.split(",") },
    });
  }
  if (req.query._sort && req.query._order) {
    query = query.sort({ [req.query._sort]: req.query._order });
  }

  const totalDocs = await totalProductsQuery.count().exec();
  console.log({ totalDocs });

  if (req.query._page && req.query._limit) {
    const pageSize = req.query._limit;
    const page = req.query._page;
    query = query.skip(pageSize * (page - 1)).limit(pageSize);
  }

  try {
    const docs = await query.exec();
    res.set("X-Total-Count", totalDocs);
    res.status(200).json(docs);
  } catch (err) {
    res.status(400).json(err);
  }
};

exports.fetchProductById = async (req, res) => {
  const { id } = req.params;

  try {
    const product = await Product.findById(id);
    res.status(200).json(product);
  } catch (err) {
    res.status(400).json(err);
  }
};

exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const product = await Product.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    product.discountPrice = Math.round(
      product.price * (1 - product.discountPercentage / 100)
    );
    const updatedProduct = await product.save();
    res.status(200).json(updatedProduct);
  } catch (err) {
    res.status(400).json(err);
  }
};
