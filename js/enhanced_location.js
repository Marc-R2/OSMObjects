/**
 * Enhanced Location Display for OSM Objects
 * Provides improved user location tracking with visual indicators
 */

// Global variables for location tracking
let currentLocationMarker = null;
let currentLocationCircle = null;
let locationWatchId = null;
let lastKnownPosition = null;
let locationTrackingEnabled = false;

// Configuration for location display
const LOCATION_CONFIG = {
    // Default zoom level when centering on user location
    DEFAULT_ZOOM: 16,
    // Accuracy circle style
    ACCURACY_CIRCLE_STYLE: {
        fillColor: '#3388ff',
        fillOpacity: 0.15,
        color: '#3388ff',
        weight: 2,
        opacity: 0.8
    },
    // Location marker style
    MARKER_STYLE: {
        radius: 8,
        fillColor: '#3388ff',
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.8
    },
    // Continuous tracking options
    WATCH_OPTIONS: {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 60000
    },
    // Minimum distance for location updates (meters)
    MIN_UPDATE_DISTANCE: 10
};

/**
 * Enhanced locate control with better visual feedback and continuous tracking
 * @param {object} map - Leaflet map instance
 * @returns {object} Enhanced locate control
 */
function createEnhancedLocateControl(map) {
    const locateControl = L.control.locate({
        position: 'topleft',
        setView: 'untilPan',
        keepCurrentZoomLevel: false,
        initialZoomLevel: LOCATION_CONFIG.DEFAULT_ZOOM,
        flyTo: true,
        showCompass: true,
        drawCircle: true,
        drawMarker: true,
        follow: false,
        stopFollowingOnDrag: true,
        remainActive: false,
        markerClass: L.CircleMarker,
        circleStyle: LOCATION_CONFIG.ACCURACY_CIRCLE_STYLE,
        markerStyle: LOCATION_CONFIG.MARKER_STYLE,
        followCircleStyle: {
            ...LOCATION_CONFIG.ACCURACY_CIRCLE_STYLE,
            fillOpacity: 0.3
        },
        followMarkerStyle: {
            ...LOCATION_CONFIG.MARKER_STYLE,
            fillColor: '#ff3388'
        },
        icon: 'fa fa-map-marker',
        iconLoading: 'fa fa-spinner fa-spin',
        metric: true,
        onLocationError: function(err) {
            console.warn('Location error:', err.message);
            showLocationNotification('Location access denied or unavailable', 'error');
        },
        onLocationOutsideMapBounds: function(context) {
            console.warn('Location outside map bounds');
            showLocationNotification('Your location is outside the map bounds', 'warning');
        },
        showPopup: true,
        strings: {
            title: "Show me where I am",
            popup: function(options) {
                const location = options.latlng;
                const accuracy = options.accuracy;
                return `You are within ${Math.round(accuracy)} meters from this point<br/>` +
                       `Lat: ${location.lat.toFixed(6)}, Lng: ${location.lng.toFixed(6)}`;
            }
        },
        locateOptions: {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
        }
    });

    // Add enhanced location events using map events
    map.on('locationfound', function(e) {
        updateLocationDisplay(e.latlng, e.accuracy);
        lastKnownPosition = e.latlng;
        showLocationNotification('Location found!', 'success');
    });

    map.on('locationerror', function(e) {
        console.error('Location error:', e.message);
        showLocationNotification(`Location error: ${e.message}`, 'error');
    });

    return locateControl;
}

/**
 * Updates the visual location display with current position
 * @param {object} latlng - Current location coordinates
 * @param {number} accuracy - Location accuracy in meters
 */
function updateLocationDisplay(latlng, accuracy) {
    // Update last known position
    lastKnownPosition = latlng;
    
    // Update location info in UI
    updateLocationInfoDisplay(latlng, accuracy);
    
    console.log(`Location updated: ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)} (±${Math.round(accuracy)}m)`);
}

/**
 * Shows location notification to user
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, error, warning, info)
 */
function showLocationNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notificationDiv = document.getElementById('location_notification');
    if (!notificationDiv) {
        notificationDiv = document.createElement('div');
        notificationDiv.id = 'location_notification';
        notificationDiv.className = 'location-notification';
        document.body.appendChild(notificationDiv);
    }
    
    // Set notification content and style
    notificationDiv.textContent = message;
    notificationDiv.className = `location-notification ${type}`;
    notificationDiv.style.display = 'block';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        notificationDiv.style.display = 'none';
    }, 3000);
}

/**
 * Creates a continuous location tracking toggle
 * @param {object} map - Leaflet map instance
 * @returns {object} Location tracking control
 */
function createLocationTrackingControl(map) {
    const LocationTrackingControl = L.Control.extend({
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            
            this.link = L.DomUtil.create('a', 'location-track-button', container);
            this.link.innerHTML = '🎯';
            this.link.href = '#';
            this.link.title = 'Toggle continuous location tracking';
            
            L.DomEvent.on(this.link, 'click', this._click, this);
            L.DomEvent.disableClickPropagation(container);
            
            return container;
        },
        
        _click: function(e) {
            L.DomEvent.preventDefault(e);
            L.DomEvent.stopPropagation(e);
            
            if (locationTrackingEnabled) {
                stopLocationTracking();
            } else {
                startLocationTracking(map);
            }
        }
    });
    
    return new LocationTrackingControl({ position: 'topleft' });
}

/**
 * Starts continuous location tracking
 * @param {object} map - Leaflet map instance
 */
function startLocationTracking(map) {
    if (!navigator.geolocation) {
        showLocationNotification('Geolocation is not supported by this browser', 'error');
        return;
    }
    
    locationTrackingEnabled = true;
    updateTrackingButtonState();
    
    locationWatchId = navigator.geolocation.watchPosition(
        function(position) {
            const newPos = L.latLng(position.coords.latitude, position.coords.longitude);
            const accuracy = position.coords.accuracy;
            
            // Check if position has changed significantly
            if (lastKnownPosition) {
                const distance = lastKnownPosition.distanceTo(newPos);
                if (distance < LOCATION_CONFIG.MIN_UPDATE_DISTANCE) {
                    return; // Don't update for small movements
                }
            }
            
            updateLocationDisplay(newPos, accuracy);
            
            // Update or create location marker and circle
            updateLocationMarker(map, newPos, accuracy);
            
            console.log(`Tracking: ${newPos.lat.toFixed(6)}, ${newPos.lng.toFixed(6)} (±${Math.round(accuracy)}m)`);
        },
        function(error) {
            console.error('Location tracking error:', error.message);
            showLocationNotification(`Tracking error: ${error.message}`, 'error');
            stopLocationTracking();
        },
        LOCATION_CONFIG.WATCH_OPTIONS
    );
    
    showLocationNotification('Continuous location tracking started', 'success');
}

/**
 * Stops continuous location tracking
 */
function stopLocationTracking() {
    if (locationWatchId !== null) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
    }
    
    locationTrackingEnabled = false;
    updateTrackingButtonState();
    
    showLocationNotification('Location tracking stopped', 'info');
}

/**
 * Updates the tracking button visual state
 */
function updateTrackingButtonState() {
    const button = document.querySelector('.location-track-button');
    if (button) {
        if (locationTrackingEnabled) {
            button.style.backgroundColor = '#ff6b6b';
            button.style.color = 'white';
            button.title = 'Stop continuous location tracking';
        } else {
            button.style.backgroundColor = '';
            button.style.color = '';
            button.title = 'Start continuous location tracking';
        }
    }
}

/**
 * Updates or creates location marker and accuracy circle
 * @param {object} map - Leaflet map instance
 * @param {object} position - Current position
 * @param {number} accuracy - Location accuracy in meters
 */
function updateLocationMarker(map, position, accuracy) {
    // Remove existing marker and circle
    if (currentLocationMarker) {
        map.removeLayer(currentLocationMarker);
    }
    if (currentLocationCircle) {
        map.removeLayer(currentLocationCircle);
    }
    
    // Create new accuracy circle
    currentLocationCircle = L.circle(position, {
        radius: accuracy,
        ...LOCATION_CONFIG.ACCURACY_CIRCLE_STYLE
    }).addTo(map);
    
    // Create new location marker
    currentLocationMarker = L.circleMarker(position, {
        ...LOCATION_CONFIG.MARKER_STYLE
    }).addTo(map);
    
    // Add popup to marker
    currentLocationMarker.bindPopup(
        `Current Location<br/>` +
        `Lat: ${position.lat.toFixed(6)}<br/>` +
        `Lng: ${position.lng.toFixed(6)}<br/>` +
        `Accuracy: ±${Math.round(accuracy)}m`
    );
}

/**
 * Updates location information display in the UI
 * @param {object} latlng - Current location coordinates
 * @param {number} accuracy - Location accuracy in meters
 */
function updateLocationInfoDisplay(latlng, accuracy) {
    // Create or update location info element
    let locationInfo = document.getElementById('location_info');
    if (!locationInfo) {
        locationInfo = document.createElement('div');
        locationInfo.id = 'location_info';
        locationInfo.className = 'location-info';
        
        // Add to map container
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            mapContainer.appendChild(locationInfo);
        }
    }
    
    locationInfo.innerHTML = `
        <div class="location-coordinates">
            📍 ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}
        </div>
        <div class="location-accuracy">
            ±${Math.round(accuracy)}m
        </div>
    `;
    
    locationInfo.style.display = 'block';
}

/**
 * Gets the current location if available
 * @returns {object|null} Current location or null
 */
function getCurrentLocation() {
    return lastKnownPosition;
}

/**
 * Checks if location tracking is currently active
 * @returns {boolean} True if tracking is active
 */
function isLocationTrackingActive() {
    return locationTrackingEnabled;
}

/**
 * Centers map on current location if available
 * @param {object} map - Leaflet map instance
 * @param {number} zoom - Optional zoom level
 */
function centerOnCurrentLocation(map, zoom = LOCATION_CONFIG.DEFAULT_ZOOM) {
    if (lastKnownPosition) {
        map.setView(lastKnownPosition, zoom);
        showLocationNotification('Centered on current location', 'success');
    } else {
        showLocationNotification('No location available. Please enable location first.', 'warning');
    }
}

/**
 * Initialize enhanced location features
 * @param {object} map - Leaflet map instance
 */
function initializeEnhancedLocation(map) {
    // Replace the basic locate control with enhanced version
    const enhancedLocateControl = createEnhancedLocateControl(map);
    map.addControl(enhancedLocateControl);
    
    // Add continuous tracking control
    const trackingControl = createLocationTrackingControl(map);
    map.addControl(trackingControl);
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl+L or Cmd+L to locate
        if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
            e.preventDefault();
            enhancedLocateControl.start();
        }
        
        // Ctrl+T or Cmd+T to toggle tracking
        if ((e.ctrlKey || e.metaKey) && e.key === 't') {
            e.preventDefault();
            if (locationTrackingEnabled) {
                stopLocationTracking();
            } else {
                startLocationTracking(map);
            }
        }
    });
    
    console.log('Enhanced location features initialized');
    console.log('Keyboard shortcuts: Ctrl+L (locate), Ctrl+T (toggle tracking)');
}