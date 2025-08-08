/**
 * Optimized data loading with performance improvements
 */

// Cache for processed data to avoid reprocessing
const dataCache = new Map();
const requestCache = new Map();

// Request debouncing to prevent too many API calls
let requestTimeout = null;
const REQUEST_DEBOUNCE_MS = 300;

// Optimize MoveCall with debouncing and caching
function optimizedMoveCall(action) {
    if (requestTimeout) {
        clearTimeout(requestTimeout);
    }
    
    requestTimeout = setTimeout(() => {
        const coords = map.getBounds();
        const lefttop = coords.getNorthWest();
        const rightbottom = coords.getSouthEast();
        
        // Create cache key for this view
        const cacheKey = `${lefttop.lat.toFixed(4)},${lefttop.lng.toFixed(4)},${rightbottom.lat.toFixed(4)},${rightbottom.lng.toFixed(4)},${map.getZoom()}`;
        
        // Check cache first
        if (dataCache.has(cacheKey) && action === 0) {
            // Use cached data for map movements
            const cachedData = dataCache.get(cacheKey);
            applyCachedData(cachedData);
            return;
        }
        
        loadXML(lefttop.lat, lefttop.lng, rightbottom.lat, rightbottom.lng, action);
    }, REQUEST_DEBOUNCE_MS);
}

// Batch DOM updates for better performance
function batchDOMUpdates(updates) {
    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
        updates.forEach(update => {
            try {
                update();
            } catch (e) {
                console.warn('DOM update failed:', e);
            }
        });
    });
}

// Optimize XML request with failover and caching
function optimizedLoadData(bbox) {
    const cacheKey = bbox;
    
    // Check request cache to prevent duplicate requests
    if (requestCache.has(cacheKey)) {
        return requestCache.get(cacheKey);
    }
    
    const updates = [
        () => $("#loading_text").text(""),
        () => $("#loading").attr("class", ""),
        () => $("#loading_icon").attr("class", "loading_spinner"),
        () => $("#loading_cont").fadeIn(100)
    ];
    batchDOMUpdates(updates);
    
    loadingcounter++;

    // Build request text
    let XMLRequestText = bbox + '( node["highway"="street_lamp"]; node["light_source"]; node["tower:type"="lighting"]; node["aeroway"="navigationaid"];';

    if (map.hasLayer(BenchesLayer)) {
        XMLRequestText += 'node["amenity"="bench"];';
    }

    const today = new Date();
    if (today.getMonth() == 11) { // show christmas trees only in December
        XMLRequestText += 'node["xmas:feature"="tree"];';
    }

    if (map.hasLayer(LitStreetsLayer) || map.hasLayer(UnLitStreetsLayer)) {
        XMLRequestText += '(way["highway"][!area]["lit"]; >;); ' +
            '(way["highway"][area]["lit"]; >;); ';
    }
    XMLRequestText += '); out qt; ';

    // URL encode
    XMLRequestText = encodeURIComponent(XMLRequestText);

    const protocol = location.protocol === 'https:' ? "https://" : "http://";
    
    // Use endpoint rotation for better reliability
    const endpoint = getNextOverpassEndpoint();
    const RequestURL = protocol + endpoint + "?data=" + XMLRequestText;

    // Create promise for this request
    const requestPromise = new Promise((resolve, reject) => {
        $.ajax({
            url: RequestURL,
            type: 'GET',
            crossDomain: true,
            timeout: 15000, // 15 second timeout
            success: function(data) {
                // Cache the response
                dataCache.set(cacheKey, data);
                resolve(data);
            },
            error: function(xhr, status, error) {
                console.warn(`Request failed to ${endpoint}:`, error);
                reject(error);
            }
        });
    });

    // Cache the promise to prevent duplicate requests
    requestCache.set(cacheKey, requestPromise);
    
    // Clean up cache after some time
    setTimeout(() => {
        requestCache.delete(cacheKey);
    }, 30000);

    return requestPromise;
}

// Endpoint rotation for better reliability
let currentEndpointIndex = 0;
function getNextOverpassEndpoint() {
    const endpoint = OVERPASS_ENDPOINTS[currentEndpointIndex];
    currentEndpointIndex = (currentEndpointIndex + 1) % OVERPASS_ENDPOINTS.length;
    return endpoint;
}

// Apply cached data efficiently
function applyCachedData(data) {
    // Use web workers if available for heavy processing
    if (window.Worker && data.length > 10000) {
        processDataWithWorker(data);
    } else {
        // Process data in chunks to avoid blocking UI
        processDataInChunks(data);
    }
}

// Process data in chunks to avoid blocking the UI
function processDataInChunks(data, chunkSize = 100) {
    const items = Array.from(data.querySelectorAll('node, way'));
    let index = 0;

    function processChunk() {
        const chunk = items.slice(index, index + chunkSize);
        
        chunk.forEach(item => {
            // Process individual items
            processOSMElement(item);
        });

        index += chunkSize;

        if (index < items.length) {
            // Use requestIdleCallback if available, otherwise setTimeout
            if (window.requestIdleCallback) {
                requestIdleCallback(processChunk);
            } else {
                setTimeout(processChunk, 0);
            }
        } else {
            // Processing complete
            finishDataProcessing();
        }
    }

    processChunk();
}

// Web Worker for heavy data processing (if available)
function processDataWithWorker(data) {
    try {
        const worker = new Worker('/js/data-processor-worker.js');
        
        worker.postMessage(data);
        
        worker.onmessage = function(e) {
            const processedData = e.data;
            applyProcessedData(processedData);
            worker.terminate();
        };

        worker.onerror = function(error) {
            console.warn('Worker error, falling back to main thread:', error);
            processDataInChunks(data);
            worker.terminate();
        };
    } catch (e) {
        console.warn('Worker not available, using main thread:', e);
        processDataInChunks(data);
    }
}

// Optimized element processing
function processOSMElement(element) {
    // Batch similar operations
    const elementType = element.tagName.toLowerCase();
    const tags = getElementTags(element);
    
    // Skip processing if element doesn't match any active layers
    if (!shouldProcessElement(tags)) {
        return;
    }

    switch (elementType) {
        case 'node':
            processNode(element, tags);
            break;
        case 'way':
            processWay(element, tags);
            break;
    }
}

// Check if element should be processed based on active layers
function shouldProcessElement(tags) {
    if (map.hasLayer(StreetLightsLayer) && isStreetLight(tags)) return true;
    if (map.hasLayer(AviationLayer) && isAviationLight(tags)) return true;
    if (map.hasLayer(BenchesLayer) && isBench(tags)) return true;
    if ((map.hasLayer(LitStreetsLayer) || map.hasLayer(UnLitStreetsLayer)) && isLitStreet(tags)) return true;
    
    return false;
}

// Helper functions for element type checking
function isStreetLight(tags) {
    return tags.highway === 'street_lamp' || 
           tags.light_source || 
           tags['tower:type'] === 'lighting';
}

function isAviationLight(tags) {
    return tags.light_source === 'aviation' || 
           tags.light_source === 'warning' ||
           tags.aeroway === 'navigationaid';
}

function isBench(tags) {
    return tags.amenity === 'bench';
}

function isLitStreet(tags) {
    return tags.highway && tags.lit !== undefined;
}

// Get element tags efficiently
function getElementTags(element) {
    const tags = {};
    const tagElements = element.querySelectorAll('tag');
    
    for (let tag of tagElements) {
        tags[tag.getAttribute('k')] = tag.getAttribute('v');
    }
    
    return tags;
}

// Memory cleanup
function cleanupCache() {
    // Keep only recent cache entries
    const maxCacheSize = 50;
    if (dataCache.size > maxCacheSize) {
        const entries = Array.from(dataCache.entries());
        const toDelete = entries.slice(0, entries.length - maxCacheSize);
        toDelete.forEach(([key]) => dataCache.delete(key));
    }
}

// Periodic cache cleanup
setInterval(cleanupCache, 60000); // Clean up every minute

// Replace the original MoveCall function
if (typeof MoveCall !== 'undefined') {
    window.originalMoveCall = MoveCall;
    window.MoveCall = optimizedMoveCall;
}

// Export for testing
window.OptimizedDataLoader = {
    optimizedMoveCall,
    optimizedLoadData,
    processDataInChunks,
    cleanupCache,
    dataCache,
    requestCache
};