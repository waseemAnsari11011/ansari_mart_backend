const Category = require('./model');
const mongoose = require('mongoose');

// @desc    Get all categories with product count
// @route   GET /api/categories
// @access  Public
exports.getCategories = async (req, res) => {
    try {
        const categories = await Category.aggregate([
            {
                $lookup: {
                    from: 'products',
                    let: { catId: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$category', '$$catId'] } } },
                        { $project: { _id: 1 } } // Only need IDs for count
                    ],
                    as: 'products'
                }
            },
            {
                $project: {
                    name: 1,
                    description: 1,
                    image: 1,
                    status: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    productCount: { $size: '$products' }
                }
            },
            {
                $sort: { createdAt: -1 }
            }
        ]);
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @route   GET /api/categories/:id
// @access  Public
exports.getCategoryById = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id).lean();
        if (category) {
            res.json(category);
        } else {
            res.status(404).json({ message: 'Category not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a category
// @route   POST /api/categories
// @access  Private/Admin
exports.createCategory = async (req, res) => {
    try {
        const { name, description, image, status } = req.body;

        const categoryExists = await Category.findOne({ name });

        if (categoryExists) {
            return res.status(400).json({ message: 'Category already exists' });
        }

        const category = await Category.create({
            name,
            description,
            image,
            status
        });

        res.status(201).json(category);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a category
// @route   PUT /api/categories/:id
// @access  Private/Admin
exports.updateCategory = async (req, res) => {
    try {
        const { name, description, image, status } = req.body;
        const category = await Category.findById(req.params.id);

        if (category) {
            category.name = name || category.name;
            category.description = description || category.description;
            category.image = image || category.image;
            category.status = status || category.status;

            const updatedCategory = await category.save();
            res.json(updatedCategory);
        } else {
            res.status(404).json({ message: 'Category not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
exports.deleteCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);

        if (category) {
            await category.deleteOne();
            res.json({ message: 'Category removed' });
        } else {
            res.status(404).json({ message: 'Category not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
