const Product = require('./model');
const Category = require('../Category/model');
const mongoose = require('mongoose');

// @desc    Get all products
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res) => {
    try {
        let query = {};
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        if (req.query.category && req.query.category !== 'All Products') {
            const categoryName = req.query.category.trim();
            const escapedCategoryName = categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const categoryObj = await Category.findOne({ 
                name: { $regex: new RegExp('^' + escapedCategoryName + '$', 'i') } 
            });
            if (categoryObj) {
                query.category = categoryObj._id;
            } else {
                return res.json({ products: [], page, pages: 0, total: 0 }); // No matching category found
            }
        }

        if (req.query.userType === 'retail') {
            query.retailStatus = 'Active';
        } else if (req.query.userType === 'business') {
            query.businessStatus = 'Active';
        }

        if (req.query.search) {
            const search = req.query.search.trim();
            const searchRegex = new RegExp(search, 'i');
            
            const orConditions = [
                { name: searchRegex },
                { brand: searchRegex }
            ];

            // If search is a valid ObjectId, search by _id too
            if (mongoose.Types.ObjectId.isValid(search)) {
                orConditions.push({ _id: search });
            }

            query.$and = query.$and || [];
            query.$and.push({ $or: orConditions });
        }

        // Optimization: Lean queries and field selection to reduce payload
        const total = await Product.countDocuments(query);
        const products = await Product.find(query)
            .select('name stock category images brand retailStatus businessStatus retailPricing businessPricing isHot isCombo weight')
            .populate('category', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
            
        res.json({
            products,
            page,
            pages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get product by ID
// @route   GET /api/products/:id
// @access  Public
exports.getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('category', 'name')
            .populate('admin', 'name');

        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
exports.createProduct = async (req, res) => {
    try {
        const { 
            name, description, category, stock, images,
            brand, retailStatus, businessStatus, retailPricing, businessPricing
        } = req.body;

        const product = await Product.create({
            name,
            description,
            category,
            admin: req.user._id,
            stock,
            images,
            brand,
            retailStatus: retailStatus || 'Active',
            businessStatus: businessStatus || 'Active',
            retailPricing,
            businessPricing
        });

        res.status(201).json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
exports.updateProduct = async (req, res) => {
    try {
        const { 
            name, description, category, stock, images,
            brand, retailStatus, businessStatus, retailPricing, businessPricing
        } = req.body;

        const product = await Product.findById(req.params.id);

        if (product) {
            product.name = name || product.name;
            product.description = description || product.description;
            product.category = category || product.category;
            product.stock = stock !== undefined ? stock : product.stock;
            product.images = images || product.images;
            product.brand = brand !== undefined ? brand : product.brand;
            product.retailStatus = retailStatus !== undefined ? retailStatus : product.retailStatus;
            product.businessStatus = businessStatus !== undefined ? businessStatus : product.businessStatus;
            product.retailPricing = retailPricing !== undefined ? retailPricing : product.retailPricing;
            product.businessPricing = businessPricing !== undefined ? businessPricing : product.businessPricing;

            const updatedProduct = await product.save();
            res.json(updatedProduct);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (product) {
            await product.deleteOne();
            res.json({ message: 'Product removed' });
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
