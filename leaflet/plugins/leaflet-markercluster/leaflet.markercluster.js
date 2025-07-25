/**
 * Simple Marker Clustering Implementation for OSM Objects
 * Based on Leaflet MarkerCluster concepts
 */

L.MarkerClusterGroup = L.FeatureGroup.extend({
    options: {
        maxClusterRadius: 80,
        iconCreateFunction: null,
        maxZoom: 18,
        disableClusteringAtZoom: null,
        removeOutsideVisibleBounds: true,
        animateAddingMarkers: false
    },

    initialize: function (options) {
        L.Util.setOptions(this, options);
        L.FeatureGroup.prototype.initialize.call(this, []);
        
        this._featureGroup = L.featureGroup();
        this._clusters = [];
        this._markersMap = new Map();
        this._updating = false; // Prevent circular updates
        
        if (!this.options.iconCreateFunction) {
            this.options.iconCreateFunction = this._defaultIconCreateFunction;
        }
    },

    onAdd: function (map) {
        this._map = map;
        
        L.FeatureGroup.prototype.onAdd.call(this, map);
        
        this._map.on('viewreset', this._reset, this);
        this._map.on('moveend', this._update, this);
        this._map.on('zoomend', this._update, this);
        
        this._reset();
        return this;
    },

    onRemove: function (map) {
        this._map.off('viewreset', this._reset, this);
        this._map.off('moveend', this._update, this);
        this._map.off('zoomend', this._update, this);
        
        L.FeatureGroup.prototype.onRemove.call(this, map);
        this._map = null;
    },

    addLayer: function (layer) {
        if (this._updating) return this; // Prevent circular calls
        
        if (layer instanceof L.LayerGroup) {
            return this.addLayers(layer);
        }
        
        const id = L.Util.stamp(layer);
        this._markersMap.set(id, layer);
        
        if (this._map) {
            this._update();
        }
        
        return this;
    },

    removeLayer: function (layer) {
        if (this._updating) return this; // Prevent circular calls
        
        const id = L.Util.stamp(layer);
        this._markersMap.delete(id);
        
        if (this._map) {
            this._update();
        }
        
        return this;
    },

    addLayers: function (layers) {
        if (this._updating) return this; // Prevent circular calls
        
        const markers = [];
        
        if (layers.eachLayer) {
            layers.eachLayer(function(layer) {
                markers.push(layer);
            });
        } else if (Array.isArray(layers)) {
            markers.push(...layers);
        } else {
            markers.push(layers);
        }
        
        markers.forEach(marker => {
            const id = L.Util.stamp(marker);
            this._markersMap.set(id, marker);
        });
        
        if (this._map) {
            this._update();
        }
        
        return this;
    },

    clearLayers: function () {
        this._markersMap.clear();
        this._featureGroup.clearLayers();
        this._clusters = [];
        return this;
    },

    _reset: function () {
        this._update();
    },

    _update: function () {
        if (!this._map || this._updating) return;
        
        this._updating = true; // Set flag to prevent circular calls
        
        try {
            const zoom = this._map.getZoom();
            const bounds = this._map.getBounds();
            
            // Clear existing clusters
            this._featureGroup.clearLayers();
            this._clusters = [];
            
            // Don't cluster at high zoom levels
            if (this.options.disableClusteringAtZoom && zoom >= this.options.disableClusteringAtZoom) {
                this._markersMap.forEach(marker => {
                    if (bounds.contains(marker.getLatLng())) {
                        this._featureGroup.addLayer(marker);
                    }
                });
            } else {
                // Get visible markers
                const visibleMarkers = [];
                this._markersMap.forEach(marker => {
                    if (bounds.contains(marker.getLatLng())) {
                        visibleMarkers.push(marker);
                    }
                });
                
                // Create clusters
                const clusters = this._createClusters(visibleMarkers);
                
                // Add clusters to map
                clusters.forEach(cluster => {
                    if (cluster.markers.length === 1) {
                        this._featureGroup.addLayer(cluster.markers[0]);
                    } else {
                        const clusterMarker = this._createClusterMarker(cluster);
                        this._featureGroup.addLayer(clusterMarker);
                    }
                });
            }
            
            // Add feature group to this layer if not already added
            if (!this.hasLayer(this._featureGroup)) {
                this.addLayer(this._featureGroup);
            }
        } finally {
            this._updating = false; // Always reset the flag
        }
    },

    _createClusters: function (markers) {
        const clusters = [];
        const processed = new Set();
        const maxDistance = this.options.maxClusterRadius;
        
        markers.forEach(marker => {
            if (processed.has(marker)) return;
            
            const cluster = {
                center: marker.getLatLng(),
                markers: [marker]
            };
            
            processed.add(marker);
            
            // Find nearby markers
            markers.forEach(otherMarker => {
                if (processed.has(otherMarker) || marker === otherMarker) return;
                
                const distance = this._map.distance(marker.getLatLng(), otherMarker.getLatLng());
                const pixelDistance = this._map.project(marker.getLatLng()).distanceTo(this._map.project(otherMarker.getLatLng()));
                
                if (pixelDistance <= maxDistance) {
                    cluster.markers.push(otherMarker);
                    processed.add(otherMarker);
                }
            });
            
            // Update cluster center to average position
            if (cluster.markers.length > 1) {
                let totalLat = 0, totalLng = 0;
                cluster.markers.forEach(m => {
                    const latlng = m.getLatLng();
                    totalLat += latlng.lat;
                    totalLng += latlng.lng;
                });
                cluster.center = L.latLng(
                    totalLat / cluster.markers.length,
                    totalLng / cluster.markers.length
                );
            }
            
            clusters.push(cluster);
        });
        
        this._clusters = clusters;
        return clusters;
    },

    _createClusterMarker: function (cluster) {
        const icon = this.options.iconCreateFunction(cluster);
        const marker = L.marker(cluster.center, { icon: icon });
        
        // Add click event to show cluster contents
        marker.on('click', () => {
            this._showClusterContents(cluster);
        });
        
        return marker;
    },

    _showClusterContents: function (cluster) {
        // Zoom in or show popup with cluster info
        const bounds = L.latLngBounds(cluster.markers.map(m => m.getLatLng()));
        
        if (this._map.getZoom() >= this.options.maxZoom) {
            // Show popup at max zoom
            const popup = L.popup()
                .setLatLng(cluster.center)
                .setContent(`Cluster of ${cluster.markers.length} items`)
                .openOn(this._map);
        } else {
            // Zoom to fit cluster
            this._map.fitBounds(bounds, { padding: [20, 20] });
        }
    },

    _defaultIconCreateFunction: function (cluster) {
        const count = cluster.markers.length;
        let className = 'marker-cluster-';
        
        if (count < 10) {
            className += 'small';
        } else if (count < 100) {
            className += 'medium';
        } else {
            className += 'large';
        }
        
        return L.divIcon({
            html: '<div><span>' + count + '</span></div>',
            className: 'marker-cluster ' + className,
            iconSize: L.point(40, 40)
        });
    }
});

L.markerClusterGroup = function (options) {
    return new L.MarkerClusterGroup(options);
};