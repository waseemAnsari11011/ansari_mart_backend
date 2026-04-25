const DeliveryZone = require('./model');

// @desc    Get all delivery zones
// @route   GET /api/delivery-zones
// @access  Public
exports.getZones = async (req, res) => {
    try {
        const zones = await DeliveryZone.find({}).sort({ createdAt: -1 });
        res.status(200).json(zones);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new delivery zone
// @route   POST /api/delivery-zones
// @access  Private/Admin
exports.createZone = async (req, res) => {
    try {
        const { coordinates, name, isActive } = req.body;

        if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
            return res.status(400).json({ message: 'Invalid coordinates' });
        }

        const zone = await DeliveryZone.create({
            name: name || 'New Delivery Zone',
            area: {
                type: 'Polygon',
                coordinates: coordinates
            },
            isActive: isActive !== undefined ? isActive : true
        });

        res.status(201).json(zone);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update delivery zone
// @route   PUT /api/delivery-zones/:id
// @access  Private/Admin
exports.updateZone = async (req, res) => {
    try {
        const { coordinates, name, isActive } = req.body;
        const zone = await DeliveryZone.findById(req.params.id);

        if (!zone) {
            return res.status(404).json({ message: 'Delivery zone not found' });
        }

        if (name) zone.name = name;
        if (isActive !== undefined) zone.isActive = isActive;
        if (coordinates) {
            zone.area = {
                type: 'Polygon',
                coordinates: coordinates
            };
        }

        const updatedZone = await zone.save();
        res.status(200).json(updatedZone);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete delivery zone
// @route   DELETE /api/delivery-zones/:id
// @access  Private/Admin
exports.deleteZone = async (req, res) => {
    try {
        const zone = await DeliveryZone.findById(req.params.id);
        if (!zone) {
            return res.status(404).json({ message: 'Delivery zone not found' });
        }
        await DeliveryZone.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Delivery area deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Check if a location is within any active delivery area
// @route   POST /api/delivery-zones/check
// @access  Public
exports.checkLocation = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({ message: 'Latitude and Longitude are required' });
        }

        // Check if any zones exist at all
        const anyZones = await DeliveryZone.countDocuments({});
        if (anyZones === 0) {
            return res.status(200).json({ 
                serviceable: true, 
                message: 'No delivery areas defined, allowing all deliveries' 
            });
        }

        // Check if point [lng, lat] is within ANY active polygon area
        const isInside = await DeliveryZone.findOne({
            isActive: true,
            area: {
                $geoIntersects: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [Number(longitude), Number(latitude)] // [lng, lat]
                    }
                }
            }
        });

        if (isInside) {
            res.status(200).json({ 
                serviceable: true, 
                message: `Location is within delivery area: ${isInside.name}` 
            });
        } else {
            res.status(200).json({ 
                serviceable: false, 
                message: 'Location is outside all active delivery areas' 
            });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Internal helper for Order Controller validation
exports.isLocationServiceable = async (latitude, longitude) => {
    try {
        // Rule: If no delivery zones are defined, allow all orders
        const anyZones = await DeliveryZone.countDocuments({});
        if (anyZones === 0) return true;

        const isInside = await DeliveryZone.findOne({
            isActive: true,
            area: {
                $geoIntersects: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [Number(longitude), Number(latitude)]
                    }
                }
            }
        });

        return !!isInside;
    } catch (err) {
        console.error('Error in isLocationServiceable:', err);
        return true; // Default to allow if check fails to prevent blocking orders due to server errors
    }
};
