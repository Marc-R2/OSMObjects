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
    RETRY_DELAY_MS: 5000,
    // TTL for cached rectangles in hours
    CACHE_TTL_HOURS: 24,
    // localStorage key prefix for namespacing
    LOCALSTORAGE_PREFIX: 'osm_rect_cache_'
};

// Global cache for loaded rectangles
let loadedRectangles = new Map(); // rectangleId -> {bounds, data, timestamp, status}
let loadingRectangles = new Set(); // currently loading rectangle IDs
let failedRectangles = new Map(); // rectangleId -> {attempts, lastFailTime}

/**
 * Checks if localStorage is available and functional
 * @returns {boolean} True if localStorage can be used
 */
function isLocalStorageAvailable() {
    try {
        const test = 'test';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Generates localStorage key for a rectangle
 * @param {string} rectangleId - Rectangle ID
 * @returns {string} localStorage key
 */
function getLocalStorageKey(rectangleId) {
    return RECTANGLE_CONFIG.LOCALSTORAGE_PREFIX + rectangleId;
}

/**
 * Checks if a cached rectangle is still valid based on TTL
 * @param {number} timestamp - Cache timestamp in milliseconds
 * @param {number} ttlHours - TTL in hours (default: 24)
 * @returns {boolean} True if cache is still valid
 */
function isRectangleCacheValid(timestamp, ttlHours = RECTANGLE_CONFIG.CACHE_TTL_HOURS) {
    const now = Date.now();
    const ttlMs = ttlHours * 60 * 60 * 1000; // Convert hours to milliseconds
    return (now - timestamp) < ttlMs;
}

/**
 * Saves rectangle data to localStorage
 * @param {string} rectangleId - Rectangle ID
 * @param {object} data - Rectangle data
 * @param {number} timestamp - Cache timestamp
 */
function saveRectangleToLocalStorage(rectangleId, data, timestamp) {
    if (!isLocalStorageAvailable()) {
        return;
    }
    
    try {
        const cacheEntry = {
            data: data,
            timestamp: timestamp,
            bounds: getRectangleBounds(rectangleId.replace('_lowzoom', ''))
        };
        
        const key = getLocalStorageKey(rectangleId);
        localStorage.setItem(key, JSON.stringify(cacheEntry));
    } catch (e) {
        console.warn('Failed to save rectangle to localStorage:', e);
    }
}

/**
 * Loads rectangle data from localStorage if valid
 * @param {string} rectangleId - Rectangle ID
 * @returns {object|null} Rectangle data if valid, null otherwise
 */
function loadRectangleFromLocalStorage(rectangleId) {
    if (!isLocalStorageAvailable()) {
        return null;
    }
    
    try {
        const key = getLocalStorageKey(rectangleId);
        const cached = localStorage.getItem(key);
        
        if (!cached) {
            return null;
        }
        
        const cacheEntry = JSON.parse(cached);
        
        // Check if cache is still valid
        if (!isRectangleCacheValid(cacheEntry.timestamp)) {
            // Remove expired cache entry
            localStorage.removeItem(key);
            return null;
        }
        
        return cacheEntry;
    } catch (e) {
        console.warn('Failed to load rectangle from localStorage:', e);
        return null;
    }
}

/**
 * Removes expired cache entries from localStorage
 * @returns {number} Number of expired entries removed
 */
function cleanExpiredLocalStorage() {
    if (!isLocalStorageAvailable()) {
        return 0;
    }
    
    let removedCount = 0;
    const prefix = RECTANGLE_CONFIG.LOCALSTORAGE_PREFIX;
    
    try {
        // Get all localStorage keys
        const keysToRemove = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                try {
                    const cached = localStorage.getItem(key);
                    if (cached) {
                        const cacheEntry = JSON.parse(cached);
                        if (!isRectangleCacheValid(cacheEntry.timestamp)) {
                            keysToRemove.push(key);
                        }
                    }
                } catch (e) {
                    // If we can't parse it, remove it
                    keysToRemove.push(key);
                }
            }
        }
        
        // Remove expired entries
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            removedCount++;
        });
        
    } catch (e) {
        console.warn('Failed to clean expired localStorage entries:', e);
    }
    
    return removedCount;
}

/**
 * Loads all valid cached rectangles from localStorage into memory
 * @returns {number} Number of rectangles loaded from cache
 */
function loadCacheFromLocalStorage() {
    if (!isLocalStorageAvailable()) {
        return 0;
    }
    
    let loadedCount = 0;
    const prefix = RECTANGLE_CONFIG.LOCALSTORAGE_PREFIX;
    
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                const rectangleId = key.substring(prefix.length);
                const cacheEntry = loadRectangleFromLocalStorage(rectangleId);
                
                if (cacheEntry) {
                    // Load into memory cache
                    loadedRectangles.set(rectangleId, {
                        bounds: cacheEntry.bounds,
                        data: cacheEntry.data,
                        timestamp: cacheEntry.timestamp,
                        status: 'loaded'
                    });
                    loadedCount++;
                }
            }
        }
    } catch (e) {
        console.warn('Failed to load cache from localStorage:', e);
    }
    
    return loadedCount;
}

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
 * Checks if a rectangle has been loaded and cached (memory or localStorage)
 * @param {string} rectangleId - Rectangle ID
 * @returns {boolean} True if rectangle is loaded
 */
function isRectangleLoaded(rectangleId) {
    // First check memory cache
    if (loadedRectangles.has(rectangleId) && 
        loadedRectangles.get(rectangleId).status === 'loaded') {
        return true;
    }
    
    // Check localStorage if not in memory
    const cacheEntry = loadRectangleFromLocalStorage(rectangleId);
    if (cacheEntry) {
        // Load into memory cache for faster future access
        loadedRectangles.set(rectangleId, {
            bounds: cacheEntry.bounds,
            data: cacheEntry.data,
            timestamp: cacheEntry.timestamp,
            status: 'loaded'
        });
        return true;
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
 * Marks a rectangle as loaded with data
 * @param {string} rectangleId - Rectangle ID
 * @param {object} data - Loaded OSM data
 */
function markRectangleLoaded(rectangleId, data) {
    loadingRectangles.delete(rectangleId);
    failedRectangles.delete(rectangleId);
    
    const timestamp = Date.now();
    const rectangleInfo = {
        bounds: getRectangleBounds(rectangleId.replace('_lowzoom', '')),
        data: data,
        timestamp: timestamp,
        status: 'loaded'
    };
    
    // Save to memory cache
    loadedRectangles.set(rectangleId, rectangleInfo);
    
    // Save to localStorage for persistence
    saveRectangleToLocalStorage(rectangleId, data, timestamp);
    
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
 * Clears all cached rectangle data (memory and localStorage)
 * @param {boolean} clearLocalStorage - Whether to clear localStorage too (default: true)
 */
function clearRectangleCache(clearLocalStorage = true) {
    loadedRectangles.clear();
    loadingRectangles.clear();
    failedRectangles.clear();
    
    if (clearLocalStorage && isLocalStorageAvailable()) {
        try {
            const prefix = RECTANGLE_CONFIG.LOCALSTORAGE_PREFIX;
            const keysToRemove = [];
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    keysToRemove.push(key);
                }
            }
            
            keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch (e) {
            console.warn('Failed to clear localStorage cache:', e);
        }
    }
}

/**
 * Gets statistics about the rectangle cache (memory and localStorage)
 * @returns {object} Cache statistics
 */
function getRectangleCacheStats() {
    let localStorageCount = 0;
    let localStorageSize = 0;
    
    if (isLocalStorageAvailable()) {
        try {
            const prefix = RECTANGLE_CONFIG.LOCALSTORAGE_PREFIX;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    localStorageCount++;
                    const value = localStorage.getItem(key);
                    if (value) {
                        localStorageSize += value.length;
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to get localStorage stats:', e);
        }
    }
    
    return {
        memory: {
            loaded: loadedRectangles.size,
            loading: loadingRectangles.size,
            failed: failedRectangles.size
        },
        localStorage: {
            count: localStorageCount,
            sizeBytes: localStorageSize,
            available: isLocalStorageAvailable()
        },
        total: {
            loaded: loadedRectangles.size,
            loading: loadingRectangles.size,
            failed: failedRectangles.size
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

/**
 * Initialize the rectangle cache system
 * Loads cached data from localStorage and cleans expired entries
 * Should be called on page load
 */
function initializeRectangleCache() {
    console.log('Initializing rectangle cache system...');
    
    // Clean expired entries first
    const expiredCount = cleanExpiredLocalStorage();
    if (expiredCount > 0) {
        console.log(`Cleaned ${expiredCount} expired cache entries`);
    }
    
    // Load valid cache entries into memory
    const loadedCount = loadCacheFromLocalStorage();
    if (loadedCount > 0) {
        console.log(`Loaded ${loadedCount} rectangles from localStorage cache`);
    }
    
    // Set up periodic cleanup (every hour)
    setInterval(() => {
        const cleaned = cleanExpiredLocalStorage();
        if (cleaned > 0) {
            console.log(`Periodic cleanup: removed ${cleaned} expired cache entries`);
        }
    }, 60 * 60 * 1000); // 1 hour
    
    console.log('Rectangle cache system initialized');
}