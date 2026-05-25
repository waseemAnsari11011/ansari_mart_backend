const express = require('express');
const router = express.Router();
const { getCategories, getHomeCategories, createCategory, deleteCategory, getCategoryById, updateCategory } = require('./controller');
const { protect } = require('../Middleware/authMiddleware');

router.route('/home')
    .get(getHomeCategories);

router.route('/')
    .get(getCategories)
    .post(protect, createCategory);

router.route('/:id')
    .get(getCategoryById)
    .put(protect, updateCategory)
    .delete(protect, deleteCategory);

module.exports = router;
