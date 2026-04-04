const express = require('express');
const router = express.Router();
const { getProducts, getProductById, createProduct, updateProduct, deleteProduct } = require('./controller');
const { protect } = require('../Middleware/authMiddleware');

router.route('/')
    .get(getProducts)
    .post(protect, createProduct);

router.route('/:id')
    .get(getProductById)
    .put(protect, updateProduct)
    .delete(protect, deleteProduct);

module.exports = router;
