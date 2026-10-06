const money = value => Math.round((value + Number.EPSILON) * 100) / 100;

function validateDiscountRules(rules) {
    if (!Array.isArray(rules) || rules.length > 50) throw new Error('Provide at most 50 discount rules');
    return rules.map(rule => {
        if (!rule || typeof rule.name !== 'string' || !rule.name.trim() || rule.name.length > 100) throw new Error('Each offer needs a name (maximum 100 characters)');
        if (!['All', 'Retail', 'Business'].includes(rule.customerType)) throw new Error('Invalid customer type');
        if (!['fixed', 'percentage', 'product_price'].includes(rule.discountType)) throw new Error('Invalid discount type');
        const numeric = (value, label) => {
            if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10000000) throw new Error(`${label} must be a valid non-negative amount`);
            return money(value);
        };
        const minSubtotal = rule.discountType === 'product_price' ? 0 : numeric(rule.minSubtotal === undefined ? 0 : rule.minSubtotal, 'Minimum subtotal');
        const maxSubtotal = rule.discountType === 'product_price' || rule.maxSubtotal == null ? null : numeric(rule.maxSubtotal, 'Maximum subtotal');
        const threshold = rule.discountType === 'product_price' ? 0 : numeric(rule.threshold ?? rule.maxSubtotal ?? rule.minSubtotal ?? 0, 'Order value threshold');
        const value = rule.discountType === 'product_price' ? 0 : numeric(rule.value, 'Discount');
        if ((rule.discountType !== 'product_price' && value <= 0) || (rule.discountType === 'percentage' && value > 100)) throw new Error('Discount must be positive; percentage cannot exceed 100');
        if (maxSubtotal !== null && maxSubtotal < minSubtotal) throw new Error('Maximum subtotal cannot be below minimum subtotal');
        if (typeof rule.active !== 'boolean' || typeof rule.firstOrderOnly !== 'boolean') throw new Error('Offer flags must be true or false');
        const productPrices = rule.discountType === 'product_price' ? rule.productPrices : [];
        if (!Array.isArray(productPrices) || (rule.discountType === 'product_price' && (!productPrices.length || productPrices.length > 100))) throw new Error('Select between 1 and 100 product options');
        const seen = new Set();
        const validatedProducts = productPrices.map(item => {
            if (!item || typeof item.product !== 'string' || !/^[a-f0-9]{24}$/i.test(item.product) || !Number.isInteger(item.tierIndex) || item.tierIndex < 0) throw new Error('Select a valid product and option');
            const key = `${item.product.toLowerCase()}:${item.tierIndex}`;
            if (seen.has(key)) throw new Error('A product option can only appear once per offer');
            seen.add(key);
            return { product: item.product.toLowerCase(), tierIndex: item.tierIndex, offerPrice: numeric(item.offerPrice, 'Offer price') };
        });
        return { productOfferMode: 'single_unit', threshold, productPrices: validatedProducts, name: rule.name.trim(), customerType: rule.customerType, discountType: rule.discountType, value, minSubtotal, maxSubtotal, active: rule.active, firstOrderOnly: rule.firstOrderOnly };
    });
}

function calculateDiscount(rules, subtotal, customerType, isFirstOrder, items = []) {
    let discountAmount = 0;
    let discountName = '';
    let discountProducts = [];
    for (const rule of rules || []) {
        if (!rule.active || (rule.customerType !== 'All' && rule.customerType !== customerType) || (rule.firstOrderOnly && !isFirstOrder)) continue;
        const isProductOffer = rule.discountType === 'product_price';
        const legacyProductOffer = isProductOffer && rule.productOfferMode === 'all_units';
        // Only amount offers (and historical product snapshots) use a spend threshold.
        if ((!isProductOffer || legacyProductOffer) && (rule.threshold != null ? subtotal <= rule.threshold : (subtotal < rule.minSubtotal || (rule.maxSubtotal != null && subtotal > rule.maxSubtotal)))) continue;
        let productSavings = 0;
        let products = [];
        if (isProductOffer) {
            for (const item of items) {
                if (item.qty < 1) continue;
                const selected = rule.productPrices?.find(entry => String(entry.product) === String(item.product?._id || item.product) && entry.tierIndex === (item.tierIndex || 0));
                const savings = selected ? money(Math.max(0, item.price - selected.offerPrice)) : 0;
                if (!savings) continue;
                const discountedProduct = { product: String(item.product?._id || item.product), tierIndex: item.tierIndex || 0, offerPrice: selected.offerPrice, qty: legacyProductOffer ? item.qty : 1 };
                if (legacyProductOffer) {
                    productSavings += savings * item.qty;
                    products.push(discountedProduct);
                } else if (savings > productSavings) {
                    productSavings = savings;
                    products = [discountedProduct];
                }
            }
        }
        const amount = money(Math.min(subtotal, rule.discountType === 'product_price' ? productSavings : rule.discountType === 'percentage' ? subtotal * rule.value / 100 : rule.value));
        if (amount > discountAmount) {
            discountAmount = amount;
            discountName = rule.name;
            discountProducts = products;
        }
    }
    return { discountAmount, discountName, ...(discountProducts.length ? { discountProducts } : {}) };
}

function priceOrder(subtotal, deliveryFee, rules, customerType, isFirstOrder, items = []) {
    const discount = calculateDiscount(rules, subtotal, customerType, isFirstOrder, items);
    return { subtotal: money(subtotal), deliveryFee, ...discount, totalPrice: money(subtotal + deliveryFee - discount.discountAmount) };
}
// Convert saved settings (including the former maximum field) for all new checkouts.
function normalizeLiveRules(rules = []) {
    return rules.map(rule => {
        const plain = rule.toObject ? rule.toObject() : rule;
        return { ...plain, productOfferMode: 'single_unit', threshold: plain.discountType === 'product_price' ? 0 : plain.threshold ?? plain.maxSubtotal ?? plain.minSubtotal ?? 0 };
    });
}
function normalizeSnapshotRules(rules = []) {
    return rules.map(rule => {
        const plain = rule.toObject ? rule.toObject() : rule;
        return { ...plain, productOfferMode: plain.productOfferMode || 'all_units' };
    });
}
module.exports = { normalizeSnapshotRules, normalizeLiveRules, validateDiscountRules, calculateDiscount, priceOrder };
