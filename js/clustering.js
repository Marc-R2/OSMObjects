/**
 * Simple clustering implementation for markers
 * Groups nearby markers into clusters when zoomed out
 */

/**
 * Create a clustered layer group that automatically clusters markers
 * @param {object} options - Clustering options
 * @returns {object} Clustered layer group
 */
function createClusteredLayerGroup(options = {}) {
    const defaults = {
        maxZoom: CLUSTERING_SETTINGS.CLUSTER_MAX_ZOOM,
        radius: CLUSTERING_SETTINGS.CLUSTER_RADIUS,
        minZoom: CLUSTERING_SETTINGS.CLUSTER_MIN_ZOOM
    };
    
    const settings = Object.assign(defaults, options);
    
    const clusterGroup = L.layerGroup();
    const markers = [];
    let currentClusters = [];
    
    // Custom methods for the cluster group
    clusterGroup.addMarker = function(marker) {
        markers.push(marker);
        this.rebuildClusters();
    };
    
    clusterGroup.removeMarker = function(marker) {
        const index = markers.indexOf(marker);
        if (index > -1) {
            markers.splice(index, 1);
        }
        this.rebuildClusters();
    };
    
    clusterGroup.clearMarkers = function() {
        markers.length = 0;
        this.clearLayers();
        currentClusters = [];
    };
    
    clusterGroup.rebuildClusters = function() {
        if (!this._map) return;
        
        this.clearLayers();
        currentClusters = [];
        
        const zoom = this._map.getZoom();
        
        // If zoom is high enough, show individual markers
        if (zoom > settings.maxZoom) {
            markers.forEach(marker => this.addLayer(marker));
            return;
        }
        
        // Group markers into clusters
        const clusters = clusterMarkers(markers, this._map, settings.radius);
        
        clusters.forEach(cluster => {
            if (cluster.markers.length === 1) {
                // Single marker, add directly
                this.addLayer(cluster.markers[0]);
            } else {
                // Multiple markers, create cluster marker
                const clusterMarker = createClusterMarker(cluster, this._map);
                this.addLayer(clusterMarker);
                currentClusters.push(clusterMarker);
            }
        });
    };
    
    // Rebuild clusters when map zoom changes
    clusterGroup.onAdd = function(map) {
        L.LayerGroup.prototype.onAdd.call(this, map);
        map.on('zoomend', this.rebuildClusters, this);
        this.rebuildClusters();
    };
    
    clusterGroup.onRemove = function(map) {
        map.off('zoomend', this.rebuildClusters, this);
        L.LayerGroup.prototype.onRemove.call(this, map);
    };
    
    return clusterGroup;
}

/**
 * Cluster markers based on distance
 * @param {Array} markers - Array of Leaflet markers
 * @param {object} map - Leaflet map instance
 * @param {number} radius - Clustering radius in pixels
 * @returns {Array} Array of cluster objects
 */
function clusterMarkers(markers, map, radius) {
    const clusters = [];
    const processed = new Set();
    
    markers.forEach((marker, index) => {
        if (processed.has(index)) return;
        
        const cluster = {
            markers: [marker],
            center: marker.getLatLng()
        };
        
        processed.add(index);
        
        // Find nearby markers to include in this cluster
        markers.forEach((otherMarker, otherIndex) => {
            if (processed.has(otherIndex) || index === otherIndex) return;
            
            const markerPoint = map.latLngToContainerPoint(marker.getLatLng());
            const otherPoint = map.latLngToContainerPoint(otherMarker.getLatLng());
            const distance = markerPoint.distanceTo(otherPoint);
            
            if (distance < radius) {
                cluster.markers.push(otherMarker);
                processed.add(otherIndex);
            }
        });
        
        // Calculate cluster center
        if (cluster.markers.length > 1) {
            let latSum = 0, lngSum = 0;
            cluster.markers.forEach(m => {
                const pos = m.getLatLng();
                latSum += pos.lat;
                lngSum += pos.lng;
            });
            cluster.center = L.latLng(
                latSum / cluster.markers.length,
                lngSum / cluster.markers.length
            );
        }
        
        clusters.push(cluster);
    });
    
    return clusters;
}

/**
 * Create a cluster marker
 * @param {object} cluster - Cluster object with markers and center
 * @param {object} map - Leaflet map instance
 * @returns {object} Leaflet marker representing the cluster
 */
function createClusterMarker(cluster, map) {
    const count = cluster.markers.length;
    
    // Create custom cluster icon
    const clusterIcon = L.divIcon({
        html: `<div class="cluster-marker">
                 <div class="cluster-marker-inner">
                   <span class="cluster-count">${count}</span>
                 </div>
               </div>`,
        className: 'cluster-marker-container',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });
    
    const clusterMarker = L.marker(cluster.center, { icon: clusterIcon });
    
    // Add click event to zoom in or expand cluster
    clusterMarker.on('click', function() {
        const zoom = map.getZoom();
        if (zoom < map.getMaxZoom()) {
            map.setView(cluster.center, zoom + 2);
        } else {
            // Show popup with cluster contents at max zoom
            const popupContent = `<div class="cluster-popup">
                <h4>Cluster (${count} items)</h4>
                <ul>
                ${cluster.markers.map((marker, i) => {
                    const popup = marker.getPopup();
                    const content = popup ? popup.getContent() : `Item ${i + 1}`;
                    return `<li>${content}</li>`;
                }).join('')}
                </ul>
            </div>`;
            
            clusterMarker.bindPopup(popupContent).openPopup();
        }
    });
    
    return clusterMarker;
}