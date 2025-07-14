(function(window) {
	var HAS_HASHCHANGE = (function() {
		var doc_mode = window.documentMode;
		return ('onhashchange' in window) &&
			(doc_mode === undefined || doc_mode > 7);
	})();

	L.Hash = function(map, baseLayers, overlays) {
		this.onHashChange = L.Util.bind(this.onHashChange, this);

		if (map) {
			this.init(map, baseLayers, overlays);
		}
	};

	L.Hash.parseHash = function(hash) {
		if(hash.indexOf('#') === 0) {
			hash = hash.substr(1);
		}
		var args = hash.split('/');
		if (args.length >= 3) {
			var zoom = parseInt(args[0], 10),
			lat = parseFloat(args[1]),
			lon = parseFloat(args[2]),
			layers = args[3];
			if (isNaN(zoom) || isNaN(lat) || isNaN(lon)) {
				return false;
			} else {
				var result = {
					center: new L.LatLng(lat, lon),
					zoom: zoom
				};
				if (layers) {
					result.layers = layers.split(',');
				}
				return result;
			}
		} else {
			return false;
		}
	};

	L.Hash.formatHash = function(map) {
		var center = map.getCenter(),
		    zoom = map.getZoom(),
		    precision = Math.max(0, Math.ceil(Math.log(zoom) / Math.LN2));

		var layers = [];
		// Find active layers
		for (var key in this.overlays) {
			if (map.hasLayer(this.overlays[key])) {
				layers.push(key);
			}
		}

		var params = [
			zoom,
			center.lat.toFixed(precision),
			center.lng.toFixed(precision)
		];
		if (layers.length > 0) {
			params.push(layers.join(','));
		}
		return "#" + params.join("/");
	},

	L.Hash.prototype = {
		map: null,
		lastHash: null,
		baseLayers: null,
		overlays: null,

		parseHash: L.Hash.parseHash,
		formatHash: L.Hash.formatHash,

		init: function(map, baseLayers, overlays) {
			this.map = map;
			this.baseLayers = baseLayers || {};
			this.overlays = overlays || {};

			// reset the hash
			this.lastHash = null;
			this.onHashChange();

			if (!this.isListening) {
				this.startListening();
			}
		},

		removeFrom: function(map) {
			if (this.changeTimeout) {
				clearTimeout(this.changeTimeout);
			}

			if (this.isListening) {
				this.stopListening();
			}

			this.map = null;
		},

		onMapMove: function() {
			// bail if we're moving the map (updating from a hash),
			// or if the map is not yet loaded

			if (this.movingMap || !this.map._loaded) {
				return false;
			}

			var hash = this.formatHash(this.map);
			if (this.lastHash != hash) {
				location.replace(hash);
				this.lastHash = hash;
			}
		},

		movingMap: false,
		update: function() {
			var hash = location.hash;
			if (hash === this.lastHash) {
				return;
			}
			var parsed = this.parseHash(hash);
			if (parsed) {
				this.movingMap = true;

				this.map.setView(parsed.center, parsed.zoom);

				if (parsed.layers) {
					var i, len = parsed.layers.length;
					for (i = 0; i < len; i++) {
						var layerName = parsed.layers[i];
						if (this.overlays[layerName] && !this.map.hasLayer(this.overlays[layerName])) {
							this.map.addLayer(this.overlays[layerName]);
						}
					}
					for (var key in this.overlays) {
						if (parsed.layers.indexOf(key) === -1 && this.map.hasLayer(this.overlays[key])) {
							this.map.removeLayer(this.overlays[key]);
						}
					}
				} else { // No layers in hash, so show default
					this.map.addLayer(this.overlays['street_lights']);
					this.map.addLayer(this.overlays['benches']);
				}


				this.movingMap = false;
			} else {
				this.onMapMove(this.map);
			}
		},

		// defer hash change updates every 100ms
		changeDefer: 100,
		changeTimeout: null,
		onHashChange: function() {
			// throttle calls to update() so that they only happen every
			// `changeDefer` ms
			if (!this.changeTimeout) {
				var that = this;
				this.changeTimeout = setTimeout(function() {
					that.update();
					that.changeTimeout = null;
				}, this.changeDefer);
			}
		},

		isListening: false,
		hashChangeInterval: null,
		startListening: function() {
			this.map.on("moveend", this.onMapMove, this);
			this.map.on('overlayadd overlayremove', this.onMapMove, this);

			if (HAS_HASHCHANGE) {
				L.DomEvent.addListener(window, "hashchange", this.onHashChange);
			} else {
				clearInterval(this.hashChangeInterval);
				this.hashChangeInterval = setInterval(this.onHashChange, 50);
			}
			this.isListening = true;
		},

		stopListening: function() {
			this.map.off("moveend", this.onMapMove, this);
			this.map.off('overlayadd overlayremove', this.onMapMove, this);

			if (HAS_HASHCHANGE) {
				L.DomEvent.removeListener(window, "hashchange", this.onHashChange);
			} else {
				clearInterval(this.hashChangeInterval);
			}
			this.isListening = false;
		}
	};
	L.hash = function(map, baseLayers, overlays) {
		return new L.Hash(map, baseLayers, overlays);
	};
	L.Map.prototype.addHash = function() {
		this._hash = L.hash(this);
	};
	L.Map.prototype.removeHash = function() {
		this._hash.removeFrom();
	};
})(window);