const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Admin = require('../Admin/model');
const User = require('../User/model');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            req.user = await Admin.findById(decoded.id).select('-password');
            if(!req.user) {
               return res.status(401).json({ message: 'Not authorized as admin' });
            }

            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const protectUser = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            console.log('[AUTH] Decoded Token:', decoded);
            console.log('[AUTH] DB Connection:', mongoose.connection.name);
            
            req.user = await User.findById(decoded.id).select('-password');
            if(!req.user) {
              console.log(`[AUTH] User not found for ID: ${decoded.id} in collection: ${User.collection.name}`);
              return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            console.log('[AUTH] User authenticated:', req.user.phone);
            next();
        } catch (error) {
            console.error('[AUTH] Token verification failed:', error.message);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        console.log('[AUTH] No token provided in headers');
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const protectAny = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Try Admin first
            let user = await Admin.findById(decoded.id).select('-password');
            if(!user) {
                // If not Admin, try User
                user = await User.findById(decoded.id).select('-password');
            }

            if(!user) {
              return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            req.user = user;
            next();
        } catch (error) {
            console.error('[AUTH] Token verification failed:', error.message);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

module.exports = { protect, protectUser, protectAny };
