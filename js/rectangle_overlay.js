/**
 * Rectangle Overlay System for OSM Objects
 * Provides visual indicators for rectangle loading status on the map
 */

// Configuration for rectangle overlays
const RECTANGLE_OVERLAY_CONFIG = {
    // Colors for different states
    LOADING_COLOR: '#FFA500',    // Orange
    ERROR_COLOR: '#FF0000',      // Red
    SUCCESS_COLOR: '#00FF00',    // Green
    
    // Styles
    STROKE_WIDTH: 2,
    FILL_OPACITY: 0.1,
    STROKE_OPACITY: 0.8,
    
    // Animation
    LOADING_ANIMATION_SPEED: 1000, // ms for pulse animation
};

// Global overlay layers - will be initialized when needed
let rectangleOverlayLayers = null;

// Track individual rectangle overlays
let rectangleOverlays = new Map(); // rectangleId -> {loading: polygon, error: polygon, success: polygon}

// Overlay visibility state
let overlayVisibility = {
    loading: true,
    error: true,    // Errors shown by default as requested
    success: false
};

/**
 * Initialize rectangle overlay system
 */
function initializeRectangleOverlays() {
    // Initialize overlay layers now that Leaflet is available
    if (!rectangleOverlayLayers) {
        rectangleOverlayLayers = {
            loading: new L.LayerGroup(),
            error: new L.LayerGroup(), 
            success: new L.LayerGroup()
        };
    }
    
    // Add overlay layers to map (but start hidden except errors)
    map.addLayer(rectangleOverlayLayers.error); // Show errors by default
    
    // Create UI controls for toggling overlays
    createOverlayControls();
    
    console.log('Rectangle overlay system initialized');
}

/**
 * Create UI controls for toggling rectangle overlays
 */
function createOverlayControls() {
    // Find the existing cache controls container or create one
    let controlsContainer = document.getElementById('rectangle-controls');
    if (!controlsContainer) {
        controlsContainer = document.createElement('div');
        controlsContainer.id = 'rectangle-controls';
        controlsContainer.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            background: rgba(255, 255, 255, 0.9);
            padding: 10px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            font-size: 12px;
            z-index: 1000;
        `;
        document.body.appendChild(controlsContainer);
    }
    
    // Add overlay toggle controls
    const overlayControlsHTML = `
        <div style="margin-bottom: 10px;">
            <strong>Rectangle Status Overlays:</strong><br>
            <label style="display: block; margin: 2px 0;">
                <input type="checkbox" id="toggle-loading-overlay" ${overlayVisibility.loading ? 'checked' : ''}> 
                <span style="color: ${RECTANGLE_OVERLAY_CONFIG.LOADING_COLOR};">●</span> Loading
            </label>
            <label style="display: block; margin: 2px 0;">
                <input type="checkbox" id="toggle-error-overlay" ${overlayVisibility.error ? 'checked' : ''}> 
                <span style="color: ${RECTANGLE_OVERLAY_CONFIG.ERROR_COLOR};">●</span> Errors (click to retry)
            </label>
            <label style="display: block; margin: 2px 0;">
                <input type="checkbox" id="toggle-success-overlay" ${overlayVisibility.success ? 'checked' : ''}> 
                <span style="color: ${RECTANGLE_OVERLAY_CONFIG.SUCCESS_COLOR};">●</span> Success
            </label>
        </div>
    `;
    
    // Insert overlay controls before existing cache controls
    const existingControls = controlsContainer.innerHTML;
    controlsContainer.innerHTML = overlayControlsHTML + existingControls;
    
    // Add event listeners
    document.getElementById('toggle-loading-overlay').addEventListener('change', function() {
        toggleOverlayVisibility('loading', this.checked);
    });
    
    document.getElementById('toggle-error-overlay').addEventListener('change', function() {
        toggleOverlayVisibility('error', this.checked);
    });
    
    document.getElementById('toggle-success-overlay').addEventListener('change', function() {
        toggleOverlayVisibility('success', this.checked);
    });
}

/**
 * Toggle visibility of overlay type
 */
function toggleOverlayVisibility(overlayType, visible) {
    if (!rectangleOverlayLayers) return; // Not initialized yet
    
    overlayVisibility[overlayType] = visible;
    
    if (visible) {
        if (!map.hasLayer(rectangleOverlayLayers[overlayType])) {
            map.addLayer(rectangleOverlayLayers[overlayType]);
        }
    } else {
        if (map.hasLayer(rectangleOverlayLayers[overlayType])) {
            map.removeLayer(rectangleOverlayLayers[overlayType]);
        }
    }
}

/**
 * Create a rectangle polygon overlay for a given rectangle ID and status
 */
function createRectangleOverlay(rectangleId, status) {
    const baseRectId = rectangleId.replace('_lowzoom', '');
    const bounds = getRectangleBounds(baseRectId);
    
    // Convert bounds to Leaflet bounds
    const leafletBounds = [
        [bounds.south, bounds.west],
        [bounds.north, bounds.east]
    ];
    
    let color, fillOpacity, strokeOpacity;
    
    switch (status) {
        case 'loading':
            color = RECTANGLE_OVERLAY_CONFIG.LOADING_COLOR;
            fillOpacity = RECTANGLE_OVERLAY_CONFIG.FILL_OPACITY;
            strokeOpacity = RECTANGLE_OVERLAY_CONFIG.STROKE_OPACITY;
            break;
        case 'error':
            color = RECTANGLE_OVERLAY_CONFIG.ERROR_COLOR;
            fillOpacity = RECTANGLE_OVERLAY_CONFIG.FILL_OPACITY * 2; // More visible for errors
            strokeOpacity = RECTANGLE_OVERLAY_CONFIG.STROKE_OPACITY;
            break;
        case 'success':
            color = RECTANGLE_OVERLAY_CONFIG.SUCCESS_COLOR;
            fillOpacity = RECTANGLE_OVERLAY_CONFIG.FILL_OPACITY;
            strokeOpacity = RECTANGLE_OVERLAY_CONFIG.STROKE_OPACITY;
            break;
        default:
            return null;
    }
    
    const rectangle = L.rectangle(leafletBounds, {
        color: color,
        weight: RECTANGLE_OVERLAY_CONFIG.STROKE_WIDTH,
        fillOpacity: fillOpacity,
        opacity: strokeOpacity,
        interactive: status === 'error' // Only error rectangles are clickable
    });
    
    // Add click handler for error rectangles to retry loading
    if (status === 'error') {
        rectangle.on('click', function() {
            console.log(`Retrying failed rectangle: ${rectangleId}`);
            retryFailedRectangle(rectangleId);
        });
        
        // Add tooltip
        rectangle.bindTooltip(`Rectangle failed to load. Click to retry.<br>ID: ${rectangleId}`, {
            permanent: false,
            direction: 'top'
        });
    }
    
    // Add loading animation for loading rectangles
    if (status === 'loading') {
        animateLoadingRectangle(rectangle);
    }
    
    return rectangle;
}

/**
 * Animate loading rectangle with pulsing effect
 */
function animateLoadingRectangle(rectangle) {
    let pulseDirection = 1;
    let currentOpacity = RECTANGLE_OVERLAY_CONFIG.FILL_OPACITY;
    
    const pulseInterval = setInterval(() => {
        // Only animate if the rectangle is still on the map
        if (!map.hasLayer(rectangleOverlayLayers.loading) || 
            !rectangleOverlayLayers.loading.hasLayer(rectangle)) {
            clearInterval(pulseInterval);
            return;
        }
        
        currentOpacity += pulseDirection * 0.02;
        
        if (currentOpacity >= 0.3) {
            pulseDirection = -1;
        } else if (currentOpacity <= 0.05) {
            pulseDirection = 1;
        }
        
        rectangle.setStyle({ fillOpacity: currentOpacity });
    }, 50);
    
    // Store interval reference for cleanup
    rectangle._pulseInterval = pulseInterval;
}

/**
 * Update rectangle overlay status
 */
function updateRectangleOverlay(rectangleId, newStatus, removeOldStatus = null) {
    if (!rectangleOverlayLayers) return; // Not initialized yet
    
    // Remove old status overlay if specified
    if (removeOldStatus && rectangleOverlays.has(rectangleId)) {
        const overlays = rectangleOverlays.get(rectangleId);
        if (overlays[removeOldStatus]) {
            rectangleOverlayLayers[removeOldStatus].removeLayer(overlays[removeOldStatus]);
            
            // Clear animation interval if it's a loading rectangle
            if (removeOldStatus === 'loading' && overlays[removeOldStatus]._pulseInterval) {
                clearInterval(overlays[removeOldStatus]._pulseInterval);
            }
            
            delete overlays[removeOldStatus];
        }
    }
    
    // Create new overlay for new status
    const overlay = createRectangleOverlay(rectangleId, newStatus);
    if (!overlay) return;
    
    // Store overlay reference
    if (!rectangleOverlays.has(rectangleId)) {
        rectangleOverlays.set(rectangleId, {});
    }
    rectangleOverlays.get(rectangleId)[newStatus] = overlay;
    
    // Add to appropriate layer if visible
    if (overlayVisibility[newStatus]) {
        rectangleOverlayLayers[newStatus].addLayer(overlay);
    }
}

/**
 * Remove all overlays for a rectangle
 */
function removeRectangleOverlays(rectangleId) {
    if (!rectangleOverlays.has(rectangleId)) return;
    
    const overlays = rectangleOverlays.get(rectangleId);
    
    ['loading', 'error', 'success'].forEach(status => {
        if (overlays[status]) {
            rectangleOverlayLayers[status].removeLayer(overlays[status]);
            
            // Clear animation interval if it's a loading rectangle
            if (status === 'loading' && overlays[status]._pulseInterval) {
                clearInterval(overlays[status]._pulseInterval);
            }
        }
    });
    
    rectangleOverlays.delete(rectangleId);
}

/**
 * Retry a failed rectangle
 */
function retryFailedRectangle(rectangleId) {
    // Remove error overlay
    updateRectangleOverlay(rectangleId, 'loading', 'error');
    
    // Reset failure state in rectangle manager
    if (failedRectangles.has(rectangleId)) {
        failedRectangles.delete(rectangleId);
    }
    
    // Determine if it's low zoom based on ID
    const isLowZoom = rectangleId.includes('_lowzoom');
    
    // Retry loading
    loadSingleRectangleData(rectangleId, isLowZoom);
}

/**
 * Clear all rectangle overlays
 */
function clearAllRectangleOverlays() {
    if (!rectangleOverlayLayers) return; // Not initialized yet
    
    ['loading', 'error', 'success'].forEach(status => {
        if (rectangleOverlayLayers[status]) {
            rectangleOverlayLayers[status].clearLayers();
        }
    });
    
    // Clear all animation intervals
    rectangleOverlays.forEach((overlays, rectangleId) => {
        if (overlays.loading && overlays.loading._pulseInterval) {
            clearInterval(overlays.loading._pulseInterval);
        }
    });
    
    rectangleOverlays.clear();
}

/**
 * Update overlays based on current rectangle cache state
 */
function refreshRectangleOverlays() {
    if (!rectangleOverlayLayers) return; // Not initialized yet
    
    // Clear existing overlays
    clearAllRectangleOverlays();
    
    // Get current view rectangles
    const currentBounds = map.getBounds();
    const rectanglesInView = getRectanglesInView(currentBounds);
    
    // Add overlays for rectangles in view
    rectanglesInView.forEach(rectId => {
        // Check high zoom status
        if (isRectangleLoaded(rectId)) {
            updateRectangleOverlay(rectId, 'success');
        } else if (isRectangleLoading(rectId)) {
            updateRectangleOverlay(rectId, 'loading');
        } else if (failedRectangles.has(rectId)) {
            updateRectangleOverlay(rectId, 'error');
        }
        
        // Check low zoom status
        const lowZoomId = rectId + '_lowzoom';
        if (isRectangleLoaded(lowZoomId)) {
            updateRectangleOverlay(lowZoomId, 'success');
        } else if (isRectangleLoading(lowZoomId)) {
            updateRectangleOverlay(lowZoomId, 'loading');
        } else if (failedRectangles.has(lowZoomId)) {
            updateRectangleOverlay(lowZoomId, 'error');
        }
    });
}

// Export functions for integration with existing rectangle manager
window.initializeRectangleOverlays = initializeRectangleOverlays;
window.updateRectangleOverlay = updateRectangleOverlay;
window.removeRectangleOverlays = removeRectangleOverlays;
window.clearAllRectangleOverlays = clearAllRectangleOverlays;
window.refreshRectangleOverlays = refreshRectangleOverlays;
window.retryFailedRectangle = retryFailedRectangle;