/**
 * Cache Manager for OSM Objects
 * Provides local caching for Overpass API responses with TTL support
 */

// Cache configuration
const CACHE_CONFIG = {
    // Cache TTL in milliseconds (24 hours)
    TTL_MS: 24 * 60 * 60 * 1000,
    // Cache key prefix for localStorage
    KEY_PREFIX: 'osm_cache_',
    // Maximum cache entries to prevent localStorage overflow
    MAX_ENTRIES: 1000,
    // Cache version for invalidating old cache formats
    CACHE_VERSION: '1.0'
};

/**
 * Generate a cache key for a rectangle
 * @param {string} rectangleId - Rectangle ID
 * @param {boolean} isLowZoom - Whether this is low zoom data
 * @returns {string} Cache key
 */
function getCacheKey(rectangleId, isLowZoom = false) {
    const suffix = isLowZoom ? '_lowzoom' : '';
    return `${CACHE_CONFIG.KEY_PREFIX}v${CACHE_CONFIG.CACHE_VERSION}_${rectangleId}${suffix}`;
}

/**
 * Check if localStorage is available
 * @returns {boolean} True if localStorage is available
 */
function isLocalStorageAvailable() {
    try {
        const test = '__localStorage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        console.warn('localStorage not available, caching disabled');
        return false;
    }
}

/**
 * Get cached data for a rectangle
 * @param {string} rectangleId - Rectangle ID
 * @param {boolean} isLowZoom - Whether this is low zoom data
 * @returns {object|null} Cached data or null if not found/expired
 */
function getCachedData(rectangleId, isLowZoom = false) {
    if (!isLocalStorageAvailable()) {
        return null;
    }
    
    try {
        const cacheKey = getCacheKey(rectangleId, isLowZoom);
        const cachedItem = localStorage.getItem(cacheKey);
        
        if (!cachedItem) {
            return null;
        }
        
        const parsed = JSON.parse(cachedItem);
        const now = Date.now();
        
        // Check if cache entry has expired
        if (now - parsed.timestamp > CACHE_CONFIG.TTL_MS) {
            console.log(`Cache expired for ${rectangleId}, removing entry`);
            localStorage.removeItem(cacheKey);
            return null;
        }
        
        console.log(`Cache hit for ${rectangleId} (age: ${Math.round((now - parsed.timestamp) / 1000 / 60)} minutes)`);
        return parsed.data;
        
    } catch (e) {
        console.error('Error reading from cache:', e);
        return null;
    }
}

/**
 * Store data in cache for a rectangle
 * @param {string} rectangleId - Rectangle ID
 * @param {any} data - Data to cache (API response)
 * @param {boolean} isLowZoom - Whether this is low zoom data
 * @returns {boolean} True if successfully cached
 */
function setCachedData(rectangleId, data, isLowZoom = false) {
    if (!isLocalStorageAvailable()) {
        return false;
    }
    
    try {
        const cacheKey = getCacheKey(rectangleId, isLowZoom);
        const cacheEntry = {
            timestamp: Date.now(),
            data: data,
            rectangleId: rectangleId,
            isLowZoom: isLowZoom
        };
        
        // Check cache size before adding
        const cacheSize = getCacheSize();
        if (cacheSize >= CACHE_CONFIG.MAX_ENTRIES) {
            console.warn(`Cache size limit reached (${cacheSize}), cleaning old entries`);
            cleanOldCacheEntries();
        }
        
        const serialized = JSON.stringify(cacheEntry);
        localStorage.setItem(cacheKey, serialized);
        
        console.log(`Cached data for ${rectangleId} (${Math.round(serialized.length / 1024)}KB)`);
        return true;
        
    } catch (e) {
        console.error('Error writing to cache:', e);
        
        // If quota exceeded, try cleaning cache and retry once
        if (e.name === 'QuotaExceededError') {
            console.warn('Storage quota exceeded, cleaning cache and retrying');
            cleanOldCacheEntries();
            try {
                const serialized = JSON.stringify(cacheEntry);
                localStorage.setItem(cacheKey, serialized);
                return true;
            } catch (retryError) {
                console.error('Failed to cache after cleanup:', retryError);
            }
        }
        return false;
    }
}

/**
 * Check if data is cached for a rectangle
 * @param {string} rectangleId - Rectangle ID  
 * @param {boolean} isLowZoom - Whether this is low zoom data
 * @returns {boolean} True if cached and not expired
 */
function isCached(rectangleId, isLowZoom = false) {
    return getCachedData(rectangleId, isLowZoom) !== null;
}

/**
 * Get cache statistics
 * @returns {object} Cache statistics
 */
function getCacheStats() {
    if (!isLocalStorageAvailable()) {
        return {
            available: false,
            entries: 0,
            totalSize: 0,
            oldEntries: 0
        };
    }
    
    let entries = 0;
    let totalSize = 0;
    let oldEntries = 0;
    const now = Date.now();
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_CONFIG.KEY_PREFIX)) {
            entries++;
            
            try {
                const value = localStorage.getItem(key);
                if (value) {
                    totalSize += value.length;
                    
                    const parsed = JSON.parse(value);
                    if (now - parsed.timestamp > CACHE_CONFIG.TTL_MS) {
                        oldEntries++;
                    }
                }
            } catch (e) {
                // Ignore parsing errors for stats
            }
        }
    }
    
    return {
        available: true,
        entries: entries,
        totalSize: totalSize,
        totalSizeKB: Math.round(totalSize / 1024),
        oldEntries: oldEntries,
        maxEntries: CACHE_CONFIG.MAX_ENTRIES,
        ttlHours: CACHE_CONFIG.TTL_MS / (1000 * 60 * 60)
    };
}

/**
 * Get the current number of cache entries
 * @returns {number} Number of cache entries
 */
function getCacheSize() {
    if (!isLocalStorageAvailable()) {
        return 0;
    }
    
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_CONFIG.KEY_PREFIX)) {
            count++;
        }
    }
    return count;
}

/**
 * Clean expired and oldest cache entries
 * @param {number} maxToRemove - Maximum number of entries to remove
 * @returns {number} Number of entries removed
 */
function cleanOldCacheEntries(maxToRemove = Math.floor(CACHE_CONFIG.MAX_ENTRIES * 0.3)) {
    if (!isLocalStorageAvailable()) {
        return 0;
    }
    
    const now = Date.now();
    const entries = [];
    
    // Collect all cache entries with metadata
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_CONFIG.KEY_PREFIX)) {
            try {
                const value = localStorage.getItem(key);
                if (value) {
                    const parsed = JSON.parse(value);
                    entries.push({
                        key: key,
                        timestamp: parsed.timestamp,
                        isExpired: now - parsed.timestamp > CACHE_CONFIG.TTL_MS
                    });
                }
            } catch (e) {
                // Remove invalid entries
                entries.push({
                    key: key,
                    timestamp: 0,
                    isExpired: true
                });
            }
        }
    }
    
    // Sort by timestamp (oldest first) and mark expired entries
    entries.sort((a, b) => a.timestamp - b.timestamp);
    
    let removed = 0;
    
    // First remove expired entries
    for (const entry of entries) {
        if (entry.isExpired && removed < maxToRemove) {
            localStorage.removeItem(entry.key);
            removed++;
        }
    }
    
    // Then remove oldest entries if we still need space
    for (const entry of entries) {
        if (!entry.isExpired && removed < maxToRemove) {
            localStorage.removeItem(entry.key);
            removed++;
        }
    }
    
    console.log(`Cleaned ${removed} cache entries`);
    return removed;
}

/**
 * Clear all cache entries
 * @returns {number} Number of entries removed
 */
function clearCache() {
    if (!isLocalStorageAvailable()) {
        return 0;
    }
    
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_CONFIG.KEY_PREFIX)) {
            keysToRemove.push(key);
        }
    }
    
    for (const key of keysToRemove) {
        localStorage.removeItem(key);
    }
    
    console.log(`Cleared ${keysToRemove.length} cache entries`);
    return keysToRemove.length;
}

/**
 * Get all cached rectangle IDs
 * @returns {Array} Array of cached rectangle IDs
 */
function getCachedRectangleIds() {
    if (!isLocalStorageAvailable()) {
        return [];
    }
    
    const rectangleIds = [];
    const now = Date.now();
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_CONFIG.KEY_PREFIX)) {
            try {
                const value = localStorage.getItem(key);
                if (value) {
                    const parsed = JSON.parse(value);
                    // Only include non-expired entries
                    if (now - parsed.timestamp <= CACHE_CONFIG.TTL_MS) {
                        rectangleIds.push(parsed.rectangleId + (parsed.isLowZoom ? '_lowzoom' : ''));
                    }
                }
            } catch (e) {
                // Ignore parsing errors
            }
        }
    }
    
    return rectangleIds;
}

/**
 * Initialize cache manager
 * Perform startup cleanup and validation
 */
function initializeCacheManager() {
    if (!isLocalStorageAvailable()) {
        console.warn('Cache Manager: localStorage not available, caching disabled');
        return false;
    }
    
    console.log('Cache Manager: Initializing...');
    
    // Clean expired entries on startup
    const cleaned = cleanOldCacheEntries(CACHE_CONFIG.MAX_ENTRIES);
    
    const stats = getCacheStats();
    console.log(`Cache Manager: Initialized with ${stats.entries} entries (${stats.totalSizeKB}KB), cleaned ${cleaned} old entries`);
    
    return true;
}

// Initialize cache manager when script loads
document.addEventListener('DOMContentLoaded', function() {
    initializeCacheManager();
});

// Expose cache functions globally
window.CacheManager = {
    getCachedData,
    setCachedData,
    isCached,
    getCacheStats,
    clearCache,
    cleanOldCacheEntries,
    getCachedRectangleIds,
    initializeCacheManager
};

/**
 * Clear both rectangle cache and persistent cache
 * This function is called from the UI
 */
function clearAllCaches() {
    let clearedCount = 0;
    
    // Clear rectangle cache (in-memory)
    if (typeof clearRectangleCache === 'function') {
        clearRectangleCache();
        console.log('Rectangle cache cleared');
    }
    
    // Clear persistent cache
    if (window.CacheManager) {
        clearedCount = window.CacheManager.clearCache();
    }
    
    alert(`Cache cleared!\n\nRemoved ${clearedCount} persistent cache entries.\nIn-memory rectangle cache also cleared.`);
    console.log(`Cache management: Cleared ${clearedCount} persistent cache entries`);
}

/**
 * Show cache statistics
 * This function is called from the UI
 */
function showCacheStats() {
    let statsMessage = "Cache Statistics:\n\n";
    
    // Rectangle cache stats (in-memory)
    if (typeof getRectangleCacheStats === 'function') {
        const rectStats = getRectangleCacheStats();
        statsMessage += `Rectangle Cache (in-memory):\n`;
        statsMessage += `- Loaded: ${rectStats.loaded}\n`;
        statsMessage += `- Loading: ${rectStats.loading}\n`;
        statsMessage += `- Failed: ${rectStats.failed}\n\n`;
    }
    
    // Persistent cache stats
    if (window.CacheManager) {
        const persistStats = window.CacheManager.getCacheStats();
        if (persistStats.available) {
            statsMessage += `Persistent Cache (localStorage):\n`;
            statsMessage += `- Entries: ${persistStats.entries}\n`;
            statsMessage += `- Total Size: ${persistStats.totalSizeKB} KB\n`;
            statsMessage += `- Old Entries: ${persistStats.oldEntries}\n`;
            statsMessage += `- TTL: ${persistStats.ttlHours} hours\n`;
            statsMessage += `- Max Entries: ${persistStats.maxEntries}\n`;
        } else {
            statsMessage += `Persistent Cache: Not available\n`;
        }
    }
    
    console.log('Cache Statistics:', {
        rectangle: typeof getRectangleCacheStats === 'function' ? getRectangleCacheStats() : 'not available',
        persistent: window.CacheManager ? window.CacheManager.getCacheStats() : 'not available'
    });
    
    alert(statsMessage);
}

// Make functions available globally for the UI
window.clearAllCaches = clearAllCaches;
window.showCacheStats = showCacheStats;