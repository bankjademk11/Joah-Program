/**
 * productImageUtils.js
 * 
 * Centralized utility for resolving product image URLs from Supabase Storage.
 * Supports multiple formats: png, jpeg, jpg, webp.
 * 
 * Usage:
 *   import { getProductImageUrl, handleImageError } from '../../utils/productImageUtils';
 */

const SUPABASE_BUCKET_BASE = 'https://avqdpddpomlapxcqxnmk.supabase.co/storage/v1/object/public/product-images';

// All supported extensions in order of priority
const IMAGE_EXTENSIONS = ['png', 'jpeg', 'jpg', 'webp'];

/**
 * Returns the primary image URL for a barcode (tries .png first by default).
 * The <img> tag should use handleImageError to fallback to other extensions.
 */
export const getProductImageUrl = (barcode) => {
    if (!barcode) return null;
    return `${SUPABASE_BUCKET_BASE}/${encodeURIComponent(barcode)}.png`;
};

/**
 * Returns a full list of fallback URLs for a given barcode (all extensions).
 */
export const getProductImageFallbacks = (barcode) => {
    if (!barcode) return [];
    return IMAGE_EXTENSIONS.map(ext => `${SUPABASE_BUCKET_BASE}/${encodeURIComponent(barcode)}.${ext}`);
};

/**
 * onError handler for <img> tags.
 * Automatically tries the next extension when the current one fails.
 * 
 * Usage:
 *   <img src={getProductImageUrl(barcode)} onError={(e) => handleImageError(e, barcode)} />
 */
export const handleImageError = (e, barcode) => {
    const currentSrc = e.target.src;
    const fallbacks = getProductImageFallbacks(barcode);
    
    // Find which extension we are currently trying
    const currentIndex = fallbacks.findIndex(url => currentSrc === url);
    const nextIndex = currentIndex + 1;

    if (nextIndex < fallbacks.length) {
        // Try next extension
        e.target.src = fallbacks[nextIndex];
    } else {
        // All extensions exhausted — hide img and show fallback sibling if exists
        e.target.style.display = 'none';
        const nextSibling = e.target.nextSibling;
        if (nextSibling) {
            nextSibling.style.display = 'flex';
        }
    }
};

/**
 * For use in getProductImageUrl logic inside JS functions (not JSX img tags).
 * Returns the .png URL as a default. Use handleImageError in JSX for fallback.
 */
export const buildImageUrl = (barcode) => {
    if (!barcode) return null;
    return `${SUPABASE_BUCKET_BASE}/${barcode}.png`;
};
