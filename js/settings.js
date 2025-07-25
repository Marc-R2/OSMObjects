// Disable Geolocate button e.g. for non-SSL servers
const SHOW_GEOLOCATE_BUTTON = true;

// Limit the number of lights shown per light_source to reduce clutter e.g. for big flood lights
const LIGHT_COUNT_MAX = 10;

// Set minimum zoom levels for rendering street lights and the lowzoom street lights layer			
const MIN_ZOOM = 13;  // Reduced from 15 to start loading earlier
const MIN_ZOOM_LOW_ZOOM = 9;  // Reduced from 11 to start loading earlier

// set default opacity levels;
const OPACITY_NO_DATA = 1.0;
const OPACITY_HAS_DATA = 0.2;