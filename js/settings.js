// Disable Geolocate button e.g. for non-SSL servers
const SHOW_GEOLOCATE_BUTTON = true;

// Limit the number of lights shown per light_source to reduce clutter e.g. for big flood lights
const LIGHT_COUNT_MAX = 10;

// Set minimum zoom levels for rendering street lights and the lowzoom street lights layer			
const MIN_ZOOM = 15;
const MIN_ZOOM_LOW_ZOOM = 11;

// set default opacity levels;
const OPACITY_NO_DATA = 1.0;
const OPACITY_HAS_DATA = 0.2;

// Multiple Overpass API endpoints for failover resilience
const OVERPASS_ENDPOINTS = [
    "overpass-api.de/api/interpreter",
    "lz4.overpass-api.de/api/interpreter", 
    "z.overpass-api.de/api/interpreter",
    "overpass.openstreetmap.ru/api/interpreter"
];

// Loading state overlay settings
const LOADING_OVERLAY_SETTINGS = {
    // Show loading state overlays by default (errors always shown)
    SHOW_LOADING_OVERLAYS: true,
    SHOW_LOADED_OVERLAYS: false,
    SHOW_ERROR_OVERLAYS: true,
    
    // Visual styles for loading state rectangles
    LOADING_STYLE: {
        fillColor: '#ffff00',
        fillOpacity: 0.3,
        color: '#ffaa00',
        weight: 2,
        dashArray: '5, 5'
    },
    LOADED_STYLE: {
        fillColor: '#00ff00',
        fillOpacity: 0.2,
        color: '#00aa00',
        weight: 1
    },
    ERROR_STYLE: {
        fillColor: '#ff0000',
        fillOpacity: 0.4,
        color: '#aa0000',
        weight: 2
    }
};

// Clustering settings for benches
const CLUSTERING_SETTINGS = {
    // Enable clustering for benches
    CLUSTER_BENCHES: true,
    // Maximum zoom level where clustering is applied
    CLUSTER_MAX_ZOOM: 17,
    // Cluster radius in pixels
    CLUSTER_RADIUS: 50,
    // Minimum zoom level to show clusters
    CLUSTER_MIN_ZOOM: MIN_ZOOM
};