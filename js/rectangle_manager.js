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
 * Checks if a rectangle has been loaded and cached
 * @param {string} rectangleId - Rectangle ID
 * @returns {boolean} True if rectangle is loaded
 */
function isRectangleLoaded(rectangleId) {
    return loadedRectangles.has(rectangleId) && 
           loadedRectangles.get(rectangleId).status === 'loaded';
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
    
    loadedRectangles.set(rectangleId, {
        bounds: getRectangleBounds(rectangleId.replace('_lowzoom', '')),
        data: data,
        timestamp: Date.now(),
        status: 'loaded'
    });
    
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
 * Clears all cached rectangle data
 */
function clearRectangleCache() {
    loadedRectangles.clear();
    loadingRectangles.clear();
    failedRectangles.clear();
}

/**
 * Gets statistics about the rectangle cache
 * @returns {object} Cache statistics
 */
function getRectangleCacheStats() {
    return {
        loaded: loadedRectangles.size,
        loading: loadingRectangles.size,
        failed: failedRectangles.size
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