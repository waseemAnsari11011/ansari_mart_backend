const validatePricing = (pricing, type, status, units) => {
    if (!Array.isArray(pricing)) return `${type}: Pricing tiers must be an array.`;
    if (status === 'Active' && pricing.length === 0) return `${type}: Add at least one valid pricing tier.`;
    for (const [index, tier] of pricing.entries()) {
        const prefix = `${type} Tier ${index + 1}: `;
        if (!tier || tier.price == null || tier.stock == null || String(tier.price).trim() === '' || String(tier.stock).trim() === '') return prefix + 'Enter price and stock.';
        if (typeof tier.price !== 'number' || !Number.isFinite(tier.price) || tier.price <= 0) return prefix + 'Price must be greater than 0.';
        if (!Number.isSafeInteger(tier.stock) || tier.stock < 0) return prefix + 'Stock must be a whole number of 0 or more.';
        if (typeof tier.unit !== 'string' || !units.includes(tier.unit)) return prefix + 'Select a valid unit.';
    }
    return null;
};

module.exports = { validatePricing };
