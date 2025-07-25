/**
 * Rectangle Manager for OSM Objects
 * Handles division of map areas into evenly distributed rectangles for efficient data loading
 */

// Configuration for rectangle grid
const RECTANGLE_CONFIG = {
    // Grid size in degrees (roughly 1km at equator)
    GRID_SIZE_DEG: 0.01,
    // Maximum retry attempts for failed rectangles
    MAX_RETRY_ATTEMPTS: 3,
    // Retry delay in milliseconds
    RETRY_DELAY_MS: 5000
};

// Configuration for localStorage caching
const CACHE_CONFIG = {
    // Maximum cache size in MB (default 50MB)
    MAX_CACHE_SIZE_MB: 50,
    // Cache expiry time in milliseconds (default 7 days)
    CACHE_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000,
    // localStorage key prefix
    CACHE_KEY_PREFIX: 'osmobjects_cache_',
    // Cache metadata key
    CACHE_METADATA_KEY: 'osmobjects_cache_metadata'
};

// Global cache for loaded rectangles
let loadedRectangles = new Map(); // rectangleId -> {bounds, data, timestamp, status}
let loadingRectangles = new Set(); // currently loading rectangle IDs
let failedRectangles = new Map(); // rectangleId -> {attempts, lastFailTime}

/**
 * Generates a consistent rectangle ID based on grid coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} gridSize - Grid size in degrees
 * @returns {string} Rectangle ID
 */
function getRectangleId(lat, lng, gridSize = RECTANGLE_CONFIG.GRID_SIZE_DEG) {
    const gridLat = Math.floor(lat / gridSize) * gridSize;
    const gridLng = Math.floor(lng / gridSize) * gridSize;
    return `rect_${gridLat.toFixed(4)}_${gridLng.toFixed(4)}`;
}

/**
 * Gets the bounds for a rectangle based on its ID
 * @param {string} rectangleId - Rectangle ID (e.g., "rect_52.5000_13.4000")
 * @param {number} gridSize - Grid size in degrees
 * @returns {object} Rectangle bounds {north, south, east, west}
 */
function getRectangleBounds(rectangleId, gridSize = RECTANGLE_CONFIG.GRID_SIZE_DEG) {
    const parts = rectangleId.split('_');
    if (parts.length !== 3) {
        throw new Error(`Invalid rectangle ID: ${rectangleId}`);
    }
    
    const baseLat = parseFloat(parts[1]);
    const baseLng = parseFloat(parts[2]);
    
    return {
        north: baseLat + gridSize,
        south: baseLat,
        east: baseLng + gridSize,
        west: baseLng
    };
}

/**
 * Divides a map area into evenly distributed rectangles
 * @param {object} bounds - Map bounds {north, south, east, west}
 * @param {number} gridSize - Grid size in degrees
 * @returns {Array} Array of rectangle IDs covering the bounds
 */
function divideAreaIntoRectangles(bounds, gridSize = RECTANGLE_CONFIG.GRID_SIZE_DEG) {
    const rectangles = [];
    
    // Align to grid boundaries
    const startLat = Math.floor(bounds.south / gridSize) * gridSize;
    const endLat = Math.ceil(bounds.north / gridSize) * gridSize;
    const startLng = Math.floor(bounds.west / gridSize) * gridSize;
    const endLng = Math.ceil(bounds.east / gridSize) * gridSize;
    
    // Generate rectangles
    for (let lat = startLat; lat < endLat; lat += gridSize) {
        for (let lng = startLng; lng < endLng; lng += gridSize) {
            rectangles.push(getRectangleId(lat, lng, gridSize));
        }
    }
    
    return rectangles;
}

/**
 * Gets all rectangles that intersect with the current map view
 * @param {object} mapBounds - Leaflet map bounds object
 * @param {number} gridSize - Grid size in degrees
 * @returns {Array} Array of rectangle IDs in view
 */
function getRectanglesInView(mapBounds, gridSize = RECTANGLE_CONFIG.GRID_SIZE_DEG) {
    const bounds = {
        north: mapBounds.getNorth(),
        south: mapBounds.getSouth(),
        east: mapBounds.getEast(),
        west: mapBounds.getWest()
    };
    
    return divideAreaIntoRectangles(bounds, gridSize);
}

/**
 * Checks if a rectangle has been loaded and cached (check both memory and localStorage)
 * @param {string} rectangleId - Rectangle ID
 * @returns {boolean} True if rectangle is loaded
 */
function isRectangleLoaded(rectangleId) {
    // First check memory cache
    if (loadedRectangles.has(rectangleId) && 
        loadedRectangles.get(rectangleId).status === 'loaded') {
        return true;
    }
    
    // Then check localStorage cache
    if (isInLocalStorageCache(rectangleId)) {
        // Load from localStorage into memory for faster future access
        const cachedData = loadFromLocalStorageCache(rectangleId);
        if (cachedData) {
            loadedRectangles.set(rectangleId, {
                bounds: getRectangleBounds(rectangleId.replace('_lowzoom', '')),
                data: cachedData,
                timestamp: Date.now(),
                status: 'loaded'
            });
            console.log(`Loaded rectangle ${rectangleId} from localStorage into memory cache`);
            return true;
        }
    }
    
    return false;
}

/**
 * Checks if a rectangle is currently being loaded
 * @param {string} rectangleId - Rectangle ID
 * @returns {boolean} True if rectangle is being loaded
 */
function isRectangleLoading(rectangleId) {
    return loadingRectangles.has(rectangleId);
}

/**
 * Determines if a failed rectangle should be retried
 * @param {string} rectangleId - Rectangle ID
 * @returns {boolean} True if rectangle should be retried
 */
function shouldRetryRectangle(rectangleId) {
    if (!failedRectangles.has(rectangleId)) {
        return true; // First attempt
    }
    
    const failInfo = failedRectangles.get(rectangleId);
    const now = Date.now();
    
    // Check retry attempts and delay
    return failInfo.attempts < RECTANGLE_CONFIG.MAX_RETRY_ATTEMPTS &&
           (now - failInfo.lastFailTime) > RECTANGLE_CONFIG.RETRY_DELAY_MS;
}

/**
 * Marks a rectangle as loading
 * @param {string} rectangleId - Rectangle ID
 */
function markRectangleLoading(rectangleId) {
    loadingRectangles.add(rectangleId);
    updateLoadingOverlays();
}

/**
 * Marks a rectangle as loaded with data (save to both memory and localStorage)
 * @param {string} rectangleId - Rectangle ID
 * @param {object} data - Loaded OSM data
 */
function markRectangleLoaded(rectangleId, data) {
    loadingRectangles.delete(rectangleId);
    failedRectangles.delete(rectangleId);
    
    // Save to memory cache
    loadedRectangles.set(rectangleId, {
        bounds: getRectangleBounds(rectangleId.replace('_lowzoom', '')),
        data: data,
        timestamp: Date.now(),
        status: 'loaded'
    });
    
    // Save to localStorage cache
    saveToLocalStorageCache(rectangleId, data);
    
    updateLoadingOverlays();
}

/**
 * Marks a rectangle as failed
 * @param {string} rectangleId - Rectangle ID
 */
function markRectangleFailed(rectangleId) {
    loadingRectangles.delete(rectangleId);
    
    const current = failedRectangles.get(rectangleId) || { attempts: 0, lastFailTime: 0 };
    failedRectangles.set(rectangleId, {
        attempts: current.attempts + 1,
        lastFailTime: Date.now()
    });
    
    updateLoadingOverlays();
}

/**
 * Gets the data for loaded rectangles
 * @param {Array} rectangleIds - Array of rectangle IDs
 * @returns {Array} Array of data objects from loaded rectangles
 */
function getRectangleData(rectangleIds) {
    const dataArray = [];
    
    for (const rectangleId of rectangleIds) {
        if (isRectangleLoaded(rectangleId)) {
            const rectangleInfo = loadedRectangles.get(rectangleId);
            if (rectangleInfo.data) {
                dataArray.push(rectangleInfo.data);
            }
        }
    }
    
    return dataArray;
}

/**
 * Clears all cached rectangle data (both memory and localStorage)
 */
function clearRectangleCache() {
    loadedRectangles.clear();
    loadingRectangles.clear();
    failedRectangles.clear();
    clearLocalStorageCache();
}

/**
 * Gets statistics about the rectangle cache (both memory and localStorage)
 * @returns {object} Cache statistics
 */
function getRectangleCacheStats() {
    const memoryStats = {
        loaded: loadedRectangles.size,
        loading: loadingRectangles.size,
        failed: failedRectangles.size
    };

    const localStorageStats = getLocalStorageCacheStats();
    
    return {
        memory: memoryStats,
        localStorage: localStorageStats,
        total: {
            loaded: memoryStats.loaded,
            loading: memoryStats.loading,
            failed: memoryStats.failed,
            cached: localStorageStats.count,
            sizeMB: localStorageStats.sizeMB
        }
    };
}

// Visual overlay layers for loading states
let loadingOverlayLayer = null;
let loadedOverlayLayer = null; 
let errorOverlayLayer = null;

/**
 * Initialize loading state overlay layers
 * @param {object} map - Leaflet map instance
 */
function initLoadingOverlays(map) {
    loadingOverlayLayer = new L.LayerGroup([], {
        maxZoom: 19,
        minZoom: MIN_ZOOM
    });
    
    loadedOverlayLayer = new L.LayerGroup([], {
        maxZoom: 19,
        minZoom: MIN_ZOOM
    });
    
    errorOverlayLayer = new L.LayerGroup([], {
        maxZoom: 19,
        minZoom: MIN_ZOOM
    });
    
    // Add error overlay by default (as per requirements)
    if (LOADING_OVERLAY_SETTINGS.SHOW_ERROR_OVERLAYS) {
        map.addLayer(errorOverlayLayer);
    }
    
    // Add loading overlay if enabled
    if (LOADING_OVERLAY_SETTINGS.SHOW_LOADING_OVERLAYS) {
        map.addLayer(loadingOverlayLayer);
    }
    
    // Add loaded overlay if enabled
    if (LOADING_OVERLAY_SETTINGS.SHOW_LOADED_OVERLAYS) {
        map.addLayer(loadedOverlayLayer);
    }
}

/**
 * Updates visual overlays for rectangle loading states
 */
function updateLoadingOverlays() {
    if (!loadingOverlayLayer || !loadedOverlayLayer || !errorOverlayLayer) {
        return; // Overlays not initialized
    }
    
    // Clear existing overlays
    loadingOverlayLayer.clearLayers();
    loadedOverlayLayer.clearLayers();
    errorOverlayLayer.clearLayers();
    
    // Add loading rectangles
    loadingRectangles.forEach(rectangleId => {
        const baseRectId = rectangleId.replace('_lowzoom', '');
        const bounds = getRectangleBounds(baseRectId);
        const rectangle = L.rectangle([
            [bounds.south, bounds.west],
            [bounds.north, bounds.east]
        ], LOADING_OVERLAY_SETTINGS.LOADING_STYLE);
        
        rectangle.bindTooltip(`Loading: ${baseRectId}`, {permanent: false});
        loadingOverlayLayer.addLayer(rectangle);
    });
    
    // Add loaded rectangles  
    loadedRectangles.forEach((rectData, rectangleId) => {
        if (rectData.status === 'loaded') {
            const baseRectId = rectangleId.replace('_lowzoom', '');
            const bounds = getRectangleBounds(baseRectId);
            const rectangle = L.rectangle([
                [bounds.south, bounds.west],
                [bounds.north, bounds.east]
            ], LOADING_OVERLAY_SETTINGS.LOADED_STYLE);
            
            rectangle.bindTooltip(`Loaded: ${baseRectId}`, {permanent: false});
            loadedOverlayLayer.addLayer(rectangle);
        }
    });
    
    // Add failed rectangles with click-to-retry functionality
    failedRectangles.forEach((failInfo, rectangleId) => {
        const baseRectId = rectangleId.replace('_lowzoom', '');
        const bounds = getRectangleBounds(baseRectId);
        const rectangle = L.rectangle([
            [bounds.south, bounds.west], 
            [bounds.north, bounds.east]
        ], LOADING_OVERLAY_SETTINGS.ERROR_STYLE);
        
        rectangle.bindTooltip(`Failed: ${baseRectId} (attempts: ${failInfo.attempts}) - Click to retry`, {permanent: false});
        
        // Add click-to-retry functionality
        rectangle.on('click', function() {
            if (shouldRetryRectangle(rectangleId)) {
                console.log(`Retrying failed rectangle: ${rectangleId}`);
                const isLowZoom = rectangleId.includes('_lowzoom');
                loadSingleRectangleData(rectangleId, isLowZoom);
            } else {
                console.log(`Rectangle ${rectangleId} has exceeded max retry attempts`);
            }
        });
        
        errorOverlayLayer.addLayer(rectangle);
    });
}

/**
 * Get the overlay layers for layer control
 * @returns {object} Object with overlay layer names and instances
 */
function getLoadingOverlayLayers() {
    return {
        loadingOverlayLayer,
        loadedOverlayLayer,
        errorOverlayLayer
    };
}

// ===============================
// LOCAL STORAGE CACHING FUNCTIONS
// ===============================

/**
 * Saves rectangle data to localStorage
 * @param {string} rectangleId - Rectangle ID
 * @param {object} data - Rectangle data to cache
 */
function saveToLocalStorageCache(rectangleId, data) {
    try {
        const cacheEntry = {
            rectangleId: rectangleId,
            data: data,
            timestamp: Date.now(),
            size: calculateDataSize(data)
        };

        const key = CACHE_CONFIG.CACHE_KEY_PREFIX + rectangleId;
        localStorage.setItem(key, JSON.stringify(cacheEntry));
        
        // Update cache metadata
        updateCacheMetadata(rectangleId, cacheEntry.size);
        
        // Check cache size and clean if necessary
        manageCacheSize();
        
        console.log(`Cached rectangle ${rectangleId} to localStorage (${cacheEntry.size} bytes)`);
    } catch (error) {
        console.warn(`Failed to cache rectangle ${rectangleId} to localStorage:`, error);
    }
}

/**
 * Loads rectangle data from localStorage
 * @param {string} rectangleId - Rectangle ID
 * @returns {object|null} Cached data or null if not found/expired
 */
function loadFromLocalStorageCache(rectangleId) {
    try {
        const key = CACHE_CONFIG.CACHE_KEY_PREFIX + rectangleId;
        const cached = localStorage.getItem(key);
        
        if (!cached) {
            return null;
        }

        const cacheEntry = JSON.parse(cached);
        
        // Check if cache entry has expired
        if (Date.now() - cacheEntry.timestamp > CACHE_CONFIG.CACHE_EXPIRY_MS) {
            localStorage.removeItem(key);
            removeCacheMetadata(rectangleId);
            console.log(`Expired cache entry removed for rectangle ${rectangleId}`);
            return null;
        }

        console.log(`Loaded rectangle ${rectangleId} from localStorage cache`);
        return cacheEntry.data;
    } catch (error) {
        console.warn(`Failed to load rectangle ${rectangleId} from localStorage:`, error);
        return null;
    }
}

/**
 * Checks if rectangle data exists in localStorage cache
 * @param {string} rectangleId - Rectangle ID
 * @returns {boolean} True if cached and not expired
 */
function isInLocalStorageCache(rectangleId) {
    const key = CACHE_CONFIG.CACHE_KEY_PREFIX + rectangleId;
    const cached = localStorage.getItem(key);
    
    if (!cached) {
        return false;
    }

    try {
        const cacheEntry = JSON.parse(cached);
        return (Date.now() - cacheEntry.timestamp) <= CACHE_CONFIG.CACHE_EXPIRY_MS;
    } catch (error) {
        return false;
    }
}

/**
 * Clears all localStorage cache entries
 */
function clearLocalStorageCache() {
    try {
        const keys = Object.keys(localStorage);
        let cleared = 0;
        
        for (const key of keys) {
            if (key.startsWith(CACHE_CONFIG.CACHE_KEY_PREFIX)) {
                localStorage.removeItem(key);
                cleared++;
            }
        }
        
        // Clear metadata
        localStorage.removeItem(CACHE_CONFIG.CACHE_METADATA_KEY);
        
        console.log(`Cleared ${cleared} cache entries from localStorage`);
    } catch (error) {
        console.warn('Failed to clear localStorage cache:', error);
    }
}

/**
 * Gets statistics about localStorage cache
 * @returns {object} Cache statistics
 */
function getLocalStorageCacheStats() {
    try {
        const metadata = getCacheMetadata();
        const keys = Object.keys(localStorage);
        let count = 0;
        let totalSize = 0;
        
        for (const key of keys) {
            if (key.startsWith(CACHE_CONFIG.CACHE_KEY_PREFIX)) {
                count++;
                try {
                    const entry = JSON.parse(localStorage.getItem(key));
                    totalSize += entry.size || 0;
                } catch (e) {
                    // Skip corrupted entries
                }
            }
        }
        
        return {
            count: count,
            sizeMB: (totalSize / (1024 * 1024)).toFixed(2),
            sizeBytes: totalSize,
            maxSizeMB: CACHE_CONFIG.MAX_CACHE_SIZE_MB,
            expiryDays: CACHE_CONFIG.CACHE_EXPIRY_MS / (24 * 60 * 60 * 1000)
        };
    } catch (error) {
        console.warn('Failed to get localStorage cache stats:', error);
        return { count: 0, sizeMB: 0, sizeBytes: 0 };
    }
}

/**
 * Calculates the estimated size of data in bytes
 * @param {any} data - Data to measure
 * @returns {number} Estimated size in bytes
 */
function calculateDataSize(data) {
    try {
        return new Blob([JSON.stringify(data)]).size;
    } catch (error) {
        // Fallback estimation
        return JSON.stringify(data).length * 2; // Rough UTF-16 estimate
    }
}

/**
 * Updates cache metadata
 * @param {string} rectangleId - Rectangle ID
 * @param {number} size - Entry size in bytes
 */
function updateCacheMetadata(rectangleId, size) {
    try {
        const metadata = getCacheMetadata();
        metadata.entries[rectangleId] = {
            size: size,
            timestamp: Date.now()
        };
        metadata.totalSize += size;
        
        localStorage.setItem(CACHE_CONFIG.CACHE_METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
        console.warn('Failed to update cache metadata:', error);
    }
}

/**
 * Removes entry from cache metadata
 * @param {string} rectangleId - Rectangle ID
 */
function removeCacheMetadata(rectangleId) {
    try {
        const metadata = getCacheMetadata();
        if (metadata.entries[rectangleId]) {
            metadata.totalSize -= metadata.entries[rectangleId].size || 0;
            delete metadata.entries[rectangleId];
            localStorage.setItem(CACHE_CONFIG.CACHE_METADATA_KEY, JSON.stringify(metadata));
        }
    } catch (error) {
        console.warn('Failed to remove cache metadata:', error);
    }
}

/**
 * Gets cache metadata from localStorage
 * @returns {object} Cache metadata
 */
function getCacheMetadata() {
    try {
        const metadata = localStorage.getItem(CACHE_CONFIG.CACHE_METADATA_KEY);
        if (metadata) {
            return JSON.parse(metadata);
        }
    } catch (error) {
        console.warn('Failed to get cache metadata:', error);
    }
    
    // Return default metadata structure
    return {
        entries: {},
        totalSize: 0,
        created: Date.now()
    };
}

/**
 * Manages cache size by removing oldest entries if over limit
 */
function manageCacheSize() {
    try {
        const stats = getLocalStorageCacheStats();
        const maxSizeBytes = CACHE_CONFIG.MAX_CACHE_SIZE_MB * 1024 * 1024;
        
        if (stats.sizeBytes > maxSizeBytes) {
            const metadata = getCacheMetadata();
            const entries = Object.entries(metadata.entries);
            
            // Sort by timestamp (oldest first)
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            
            let removedSize = 0;
            let removedCount = 0;
            
            for (const [rectangleId, entryMeta] of entries) {
                if (stats.sizeBytes - removedSize <= maxSizeBytes * 0.8) {
                    break; // Keep cache at 80% of max size
                }
                
                const key = CACHE_CONFIG.CACHE_KEY_PREFIX + rectangleId;
                localStorage.removeItem(key);
                removedSize += entryMeta.size || 0;
                removedCount++;
                removeCacheMetadata(rectangleId);
            }
            
            if (removedCount > 0) {
                console.log(`Cache size management: removed ${removedCount} entries (${(removedSize / (1024 * 1024)).toFixed(2)}MB)`);
            }
        }
    } catch (error) {
        console.warn('Failed to manage cache size:', error);
    }
}

/**
 * Initialize localStorage cache (load existing cache entries into memory)
 */
function initializeLocalStorageCache() {
    try {
        const keys = Object.keys(localStorage);
        let loadedCount = 0;
        
        for (const key of keys) {
            if (key.startsWith(CACHE_CONFIG.CACHE_KEY_PREFIX)) {
                const rectangleId = key.replace(CACHE_CONFIG.CACHE_KEY_PREFIX, '');
                const cachedData = loadFromLocalStorageCache(rectangleId);
                
                if (cachedData) {
                    // Load into memory cache for immediate access
                    loadedRectangles.set(rectangleId, {
                        bounds: getRectangleBounds(rectangleId.replace('_lowzoom', '')),
                        data: cachedData,
                        timestamp: Date.now(),
                        status: 'loaded'
                    });
                    loadedCount++;
                }
            }
        }
        
        if (loadedCount > 0) {
            console.log(`Initialized localStorage cache: loaded ${loadedCount} cached rectangles into memory`);
        }
    } catch (error) {
        console.warn('Failed to initialize localStorage cache:', error);
    }
}