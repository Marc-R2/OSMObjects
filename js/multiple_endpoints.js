/**
 * Multiple Overpass API Endpoints for Enhanced Reliability
 * Handles fallback to alternative endpoints when main endpoint fails
 */

// Available Overpass API endpoints
const OVERPASS_ENDPOINTS = [
    'overpass-api.de/api/interpreter',
    'overpass.kumi.systems/api/interpreter',
    'overpass.openstreetmap.ru/api/interpreter',
    'overpass.private.coffee/api/interpreter'
];

// Track endpoint health
let endpointHealth = new Map();
let currentEndpointIndex = 0;

/**
 * Initialize endpoint health tracking
 */
function initializeEndpointHealth() {
    OVERPASS_ENDPOINTS.forEach((endpoint, index) => {
        endpointHealth.set(endpoint, {
            failures: 0,
            lastSuccess: Date.now(),
            lastFailure: 0,
            isHealthy: true,
            consecutiveFailures: 0
        });
    });
}

/**
 * Get the next healthy endpoint to try
 */
function getNextHealthyEndpoint() {
    // Try to find a healthy endpoint starting from current index
    for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
        const index = (currentEndpointIndex + i) % OVERPASS_ENDPOINTS.length;
        const endpoint = OVERPASS_ENDPOINTS[index];
        const health = endpointHealth.get(endpoint);
        
        // Consider endpoint healthy if:
        // - It hasn't failed consecutively more than 3 times
        // - OR it's been more than 5 minutes since last failure
        const timeSinceFailure = Date.now() - health.lastFailure;
        const isRecovered = timeSinceFailure > 5 * 60 * 1000; // 5 minutes
        
        if (health.isHealthy || health.consecutiveFailures < 3 || isRecovered) {
            currentEndpointIndex = index;
            return endpoint;
        }
    }
    
    // If all endpoints are unhealthy, return the first one (fallback)
    currentEndpointIndex = 0;
    return OVERPASS_ENDPOINTS[0];
}

/**
 * Mark endpoint as successful
 */
function markEndpointSuccess(endpoint) {
    const health = endpointHealth.get(endpoint);
    if (health) {
        health.lastSuccess = Date.now();
        health.isHealthy = true;
        health.consecutiveFailures = 0;
        console.log(`Endpoint ${endpoint} marked as healthy`);
    }
}

/**
 * Mark endpoint as failed
 */
function markEndpointFailure(endpoint, errorType) {
    const health = endpointHealth.get(endpoint);
    if (health) {
        health.failures++;
        health.lastFailure = Date.now();
        health.consecutiveFailures++;
        
        // Mark as unhealthy if too many consecutive failures
        if (health.consecutiveFailures >= 3) {
            health.isHealthy = false;
        }
        
        console.log(`Endpoint ${endpoint} failed (${errorType}), consecutive failures: ${health.consecutiveFailures}`);
    }
}

/**
 * Enhanced AJAX request with multiple endpoint fallback
 */
function makeOverpassRequest(xmlRequestText, isLowZoom = false, rectangleId = null, maxRetries = 3) {
    return new Promise((resolve, reject) => {
        let attemptCount = 0;
        let lastError = null;
        
        function tryRequest() {
            attemptCount++;
            const endpoint = getNextHealthyEndpoint();
            
            const protocol = location.protocol === 'https:' ? 'https://' : 'http://';
            const requestURL = protocol + endpoint + '?data=' + encodeURIComponent(xmlRequestText);
            
            console.log(`Attempt ${attemptCount}/${maxRetries} using endpoint: ${endpoint}${rectangleId ? ' for rectangle: ' + rectangleId : ''}`);
            
            $.ajax({
                url: requestURL,
                type: 'GET',
                crossDomain: true,
                timeout: 15000, // Increased timeout for reliability
                success: function(data) {
                    markEndpointSuccess(endpoint);
                    resolve({
                        data: data,
                        endpoint: endpoint,
                        attempt: attemptCount
                    });
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    lastError = {
                        jqXHR: jqXHR,
                        textStatus: textStatus,
                        errorThrown: errorThrown,
                        endpoint: endpoint,
                        status: jqXHR.status
                    };
                    
                    // Determine if this is a server error that might benefit from trying another endpoint
                    const shouldTryNextEndpoint = (
                        textStatus === 'timeout' ||
                        textStatus === 'error' ||
                        jqXHR.status === 429 || // Too Many Requests
                        jqXHR.status === 503 || // Service Unavailable
                        jqXHR.status === 502 || // Bad Gateway
                        jqXHR.status === 504    // Gateway Timeout
                    );
                    
                    markEndpointFailure(endpoint, textStatus);
                    
                    // Try next endpoint if we haven't exhausted our attempts and it's a suitable error
                    if (attemptCount < maxRetries && shouldTryNextEndpoint) {
                        console.log(`Trying next endpoint due to ${textStatus} (status: ${jqXHR.status})`);
                        // Move to next endpoint for retry
                        currentEndpointIndex = (currentEndpointIndex + 1) % OVERPASS_ENDPOINTS.length;
                        setTimeout(tryRequest, 1000); // Small delay before retry
                    } else {
                        reject(lastError);
                    }
                }
            });
        }
        
        tryRequest();
    });
}

/**
 * Get current endpoint health status for debugging
 */
function getEndpointHealthStatus() {
    const status = {};
    endpointHealth.forEach((health, endpoint) => {
        status[endpoint] = {
            isHealthy: health.isHealthy,
            failures: health.failures,
            consecutiveFailures: health.consecutiveFailures,
            lastSuccess: new Date(health.lastSuccess).toLocaleString(),
            lastFailure: health.lastFailure ? new Date(health.lastFailure).toLocaleString() : 'Never'
        };
    });
    return status;
}

// Initialize endpoint health tracking
initializeEndpointHealth();

// Export functions
window.makeOverpassRequest = makeOverpassRequest;
window.getEndpointHealthStatus = getEndpointHealthStatus;
window.OVERPASS_ENDPOINTS = OVERPASS_ENDPOINTS;