// Performance-optimized MoveCall with moderate throttling for responsive feel
let moveCallTimeout = null;
let lastMoveCallTime = 0;
const MOVE_CALL_THROTTLE_MS = 250; // Moderate throttling for balanced performance and responsiveness
const VIEWPORT_OPTIMIZATION_THRESHOLD = 0.05; // Only reload if viewport changed significantly

function MoveCall(action) { //action: 0: map moved, 1: high zoom layer added, 2: low zoom layer added, 3: layer removed, 4: streetlights layer removed, 5: language updated
    // For immediate actions (layer changes), process immediately
    if (action !== 0) {
        const coords = map.getBounds();
        const lefttop = coords.getNorthWest();
        const rightbottom = coords.getSouthEast();
        loadXML(lefttop.lat, lefttop.lng, rightbottom.lat, rightbottom.lng, action);
        return;
    }
    
    // For map movements, use moderate throttling
    const now = Date.now();
    
    // Clear any pending timeout
    if (moveCallTimeout) {
        clearTimeout(moveCallTimeout);
    }
    
    // If too recent, just update the timeout
    if (now - lastMoveCallTime < MOVE_CALL_THROTTLE_MS) {
        moveCallTimeout = setTimeout(() => {
            executeMoveCall(action);
        }, MOVE_CALL_THROTTLE_MS);
        return;
    }
    
    // Execute immediately if enough time has passed
    executeMoveCall(action);
}

function executeMoveCall(action) {
    lastMoveCallTime = Date.now();
    moveCallTimeout = null;
    
    const coords = map.getBounds();
    const lefttop = coords.getNorthWest();
    const rightbottom = coords.getSouthEast();
    
    // Viewport optimization - only reload if view changed significantly
    if (action === 0 && window.lastViewport) {
        const viewportChange = Math.abs(lefttop.lat - window.lastViewport.lat1) + 
                              Math.abs(lefttop.lng - window.lastViewport.lng1) +
                              Math.abs(rightbottom.lat - window.lastViewport.lat2) + 
                              Math.abs(rightbottom.lng - window.lastViewport.lng2);
        
        if (viewportChange < VIEWPORT_OPTIMIZATION_THRESHOLD) {
            return; // Skip if viewport didn't change much
        }
    }
    
    // Store current viewport for next comparison
    window.lastViewport = {
        lat1: lefttop.lat,
        lng1: lefttop.lng,
        lat2: rightbottom.lat,
        lng2: rightbottom.lng
    };
    
    loadXML(lefttop.lat, lefttop.lng, rightbottom.lat, rightbottom.lng, action);
}

function loadXML(lat1, lon1, lat2, lon2, action) { //action: 0: map moved, 1: high zoom layer added, 2: low zoom layer added, 3: layer removed, 4: streetlights layer removed, 5: language updated

    let hasHighZoomLayer = false, hasLowZoomLayer = false, zoomWarning = 1;
    let hasLightLayer = map.hasLayer(StreetLightsLayer) || map.hasLayer(AviationLayer) || map.hasLayer(LitStreetsLayer) || map.hasLayer(UnLitStreetsLayer) || map.hasLayer(StreetLightsLowZoomLayer) || map.hasLayer(BenchesLayer);

    // Special case: Low Zoom data loaded once
	if (g_showStreetLightsLowZoomOnce && map.getZoom() < MIN_ZOOM_LOW_ZOOM) {
		hasHighZoomLayer = false;
		hasLowZoomLayer = false;
		zoomWarning = 4
	} else {
		if (map.getZoom() >= MIN_ZOOM) {
			zoomWarning = 0

			if (map.hasLayer(StreetLightsLayer) || map.hasLayer(AviationLayer) || map.hasLayer(LitStreetsLayer) || map.hasLayer(UnLitStreetsLayer) || map.hasLayer(BenchesLayer)) {
				if (!map.hasLayer(StreetLightsLayer) && map.hasLayer(StreetLightsLowZoomLayer)) {
					hasLowZoomLayer = true;
				} else {
					hasLowZoomLayer = false;
				}
				hasHighZoomLayer = true;
			} else if (map.hasLayer(StreetLightsLowZoomLayer)) {
				hasHighZoomLayer = false;
				hasLowZoomLayer = true;
			} else { // no map layers loaded
				hasHighZoomLayer = false;
				hasLowZoomLayer = false;
				zoomWarning = 2
			}
		} else {
			hasLowZoomLayer = false;
			if (map.hasLayer(StreetLightsLowZoomLayer)) {
				if (map.getZoom() >= MIN_ZOOM_LOW_ZOOM) {
					hasLowZoomLayer = true;
					zoomWarning = 0;
				} else {
					hasLowZoomLayer = false;
					zoomWarning = 3;
				}
			} else {
				hasHighZoomLayer = false;
				zoomWarning = 1
				if (map.getZoom() < MIN_ZOOM_LOW_ZOOM) {
					zoomWarning = 3;
				}
			}
		}
	}
	// load data if map moved or layer added
	if (hasHighZoomLayer && (action == 0 || action == 1)) {
		loadDataRectangles(lat1, lon1, lat2, lon2);
	}
	if (hasLowZoomLayer && (action == 0 || action == 2 || action == 4)) {
		loadDataLowZoomRectangles(lat1, lon1, lat2, lon2);
	}

	//remove data:
	if (!hasHighZoomLayer) {
		parseOSM(false);
	}
	if(!hasLowZoomLayer && zoomWarning!=4) {
		parseOSMlowZoom(false);
		g_showStreetLightsLowZoomOnce = false;
	}
	if(!hasHighZoomLayer && !hasLowZoomLayer && zoomWarning!=4) {
		// reset loading counter
		loadingcounter = 0;		
		g_showData = false;
		//update opacity
		if (hasLightLayer) {
			current_layer.setOpacity(g_opacityNoData);
			$("#opacity_slider").slider("option", "value", g_opacityNoData * 100);
		} else {
			current_layer.setOpacity(1); // Full opacity
			$("#opacity_slider").slider("option", "value", 100);
		}
	}

	//handle zoom warning
	if (zoomWarning)
	{
		//update zoomtext
		let textZoom = "Zoom in to load data";
		if(i18next.isInitialized && zoomWarning < 4){
			textZoom = i18next.t("zoomtext_" + zoomWarning);
		}
		$( "#zoomtext" ).text(textZoom)

		//show load update and clear low zoom data buttons
		if (zoomWarning == 3) {
			$( "#zoomtext" ).show();
			$( "#load_lowzoom_data" ).show();
			$( "#update_lowzoom_data" ).hide();
			$( "#clear_lowzoom_data" ).hide();

		} else if (zoomWarning == 4) {
			$( "#zoomtext" ).hide();
			$( "#load_lowzoom_data" ).hide();
			$( "#update_lowzoom_data" ).show();
			$( "#clear_lowzoom_data" ).show();

		} else {
			$( "#zoomtext" ).show();
			$( "#load_lowzoom_data" ).hide();
			$( "#update_lowzoom_data" ).hide();
			$( "#clear_lowzoom_data" ).hide();

		}

		// fade in zoom warning
		$( "#zoomwarning_cont" ).fadeIn(500);

	} else {
		g_showData = true;
		$( "#zoomwarning_cont" ).fadeOut(500);
		if (hasLightLayer) {
			current_layer.setOpacity(g_opacityHasData);
			$("#opacity_slider").slider("option", "value", g_opacityHasData * 100);
		} else {
			current_layer.setOpacity(1); // Full opacity
			$("#opacity_slider").slider("option", "value", 100);
		}
	}

}

function loadLowZoomDataOnce() {

	g_showStreetLightsLowZoomOnce = true;
	g_showData = true;
	let coords = map.getBounds();
	let lefttop = coords.getNorthWest(), rightbottom = coords.getSouthEast();
	let lat1 = lefttop.lat, lon1 = lefttop.lng, lat2 = rightbottom.lat, lon2 = rightbottom.lng;

	map.addLayer(StreetLightsLowZoomLayer);
	loadDataLowZoom('[bbox:' + lat2 + ',' + lon1 + ',' + lat1 + ',' + lon2 + '];');

	$( "#zoomwarning_cont" ).fadeOut(500);
	current_layer.setOpacity(g_opacityHasData);
	$("#opacity_slider").slider("option", "value", g_opacityHasData * 100);
}

function clearLowZoomData() {
	g_showStreetLightsLowZoomOnce = false;
	g_showData = false;
	map.removeLayer(StreetLightsLowZoomLayer)
}

// Optimized data loading with request coalescing and failover
let pendingRequests = new Map();
let requestCoalescingTimeout = null;
const REQUEST_COALESCING_DELAY = 100; // Coalesce requests within 100ms

// Multiple Overpass API endpoints for better reliability
const OVERPASS_ENDPOINTS = [
    'overpass-api.de/api/interpreter',
    'lz4.overpass-api.de/api/interpreter',
    'z.overpass-api.de/api/interpreter'
];
let currentEndpointIndex = 0;

function loadData(bbox) {
    // Request coalescing - combine rapid successive requests
    const requestKey = bbox + map.getZoom();
    
    if (pendingRequests.has(requestKey)) {
        return; // Request already pending
    }
    
    // Mark request as pending
    pendingRequests.set(requestKey, true);
    
    // Clear any existing coalescing timeout
    if (requestCoalescingTimeout) {
        clearTimeout(requestCoalescingTimeout);
    }
    
    // Coalesce requests to avoid overwhelming the API
    requestCoalescingTimeout = setTimeout(() => {
        executeLoadData(bbox, requestKey);
    }, REQUEST_COALESCING_DELAY);
}

function executeLoadData(bbox, requestKey) {
    // Optimized UI updates using requestAnimationFrame
    requestAnimationFrame(() => {
        $("#loading_text").text("");
        $("#loading").attr("class", "");
        $("#loading_icon").attr("class", "loading_spinner");
        $("#loading_cont").fadeIn(50); // Faster animation
    });
    
    loadingcounter++;

    // Build request efficiently
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
    
    // Try multiple endpoints for better reliability
    tryLoadWithFailover(protocol, XMLRequestText, requestKey, 0);
}

function tryLoadWithFailover(protocol, XMLRequestText, requestKey, attemptIndex) {
    const endpoint = OVERPASS_ENDPOINTS[attemptIndex % OVERPASS_ENDPOINTS.length];
    const RequestURL = protocol + endpoint + "?data=" + XMLRequestText;

    $.ajax({
        url: RequestURL,
        type: 'GET',
        crossDomain: true,
        timeout: 8000, // Reduced timeout for faster failover
        success: function(data) {
            // Clean up request tracking
            pendingRequests.delete(requestKey);
            
            // Update UI with success state
            if (loadingcounter === 1) {
                requestAnimationFrame(() => {
                    $("#loading_text").html("");
                    $("#loading").attr("class", "success");
                    $("#loading_icon").attr("class", "loading_success");
                });
            }
            loadingcounter--;
            
            // Process data with chunking for better performance
            parseOSMOptimized(data);
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.warn(`Request failed to ${endpoint}:`, textStatus);
            
            // Try next endpoint if available
            if (attemptIndex < OVERPASS_ENDPOINTS.length - 1) {
                console.log(`Trying failover endpoint ${attemptIndex + 1}`);
                tryLoadWithFailover(protocol, XMLRequestText, requestKey, attemptIndex + 1);
                return;
            }
            
            // All endpoints failed
            pendingRequests.delete(requestKey);
            
            let textStatus_value;
            if (i18next.isInitialized) {
                if (textStatus == "timeout" || textStatus == "error" || textStatus == "abort" || textStatus == "parseerror") {
                    textStatus_value = i18next.t("ajaxerror_" + textStatus);
                } else {
                    textStatus_value = i18next.t("ajaxerror_unknown");
                }
            } else {
                textStatus_value = "Error while loading data";
            }

            requestAnimationFrame(() => {
                $("#loading").attr("class", "error");
                $("#loading_icon").attr("class", "loading_error");
                $("#loading_text").html("&nbsp;" + textStatus_value);
            });
            loadingcounter--;
        }
    });
}
function loadDataLowZoom(bbox)
{
	$( "#loading_text" ).text("")
	$( "#loading" ).attr("class", "");
	$( "#loading_icon" ).attr("class", "loading_spinner")
	$( "#loading_cont" ).fadeIn(100)
	loadingcounter++;

	//CrossoverAPI XML request
	if (location.protocol == 'https:') {
		RequestProtocol = "https://";
	}
	else {
		RequestProtocol = "http://";
	}

	XMLRequestTextLowZoom = bbox + '( node["highway"="street_lamp"]; node["light_source"];); out skel;'
	RequestURLlowZoom = RequestProtocol + "overpass-api.de/api/interpreter?data=" + XMLRequestTextLowZoom;

	//AJAX REQUEST
	$.ajax({
		url: RequestURLlowZoom,
		type: 'GET',
		crossDomain: true,
		success: function(data){
			if (loadingcounter==1) {
				$( "#loading_text" ).html("")
				$( "#loading" ).attr("class", "success");
				$( "#loading_icon" ).attr("class", "loading_success")
			}
			loadingcounter--;
			parseOSMlowZoom(data);
		},
		error: function(jqXHR, textStatus, errorThrown) {

			if (i18next.isInitialized) {

				if (textStatus == "timeout" || textStatus == "error" || textStatus == "abort" || textStatus == "parseerror") {
					textStatus_value = i18next.t("ajaxerror_" + textStatus);
				} else {
					textStatus_value = i18next.t("ajaxerror_unknown");
				}
			} else { // fallback in case i18next is not initalized yet.
				textStatus_value = "Error while loading data";
			}

			$( "#loading" ).attr("class", "error");
			$( "#loading_icon" ).attr("class", "loading_error")
			$( "#loading_text" ).html("&nbsp;" + textStatus_value)
			loadingcounter--;
		},
		timeout: 10000 // timeout after 10s
	});
}

// Optimized parseOSM function with chunked processing
function parseOSMOptimized(data) {
    // Clear layers immediately for responsiveness
    requestAnimationFrame(() => {
        StreetLightsLayer.clearLayers();
        AviationLayer.clearLayers();
        LitStreetsLayer.clearLayers();
        UnLitStreetsLayer.clearLayers();
        
        // Clear benches layer - handle both clustered and regular layers
        if (CLUSTERING_SETTINGS.CLUSTER_BENCHES && BenchesLayer.clearMarkers) {
            BenchesLayer.clearMarkers();
        } else {
            BenchesLayer.clearLayers();
        }
    });

    // Convert to array for chunked processing
    const elements = Array.from($(data).find('node,way'));
    
    if (elements.length === 0) {
        finishDataProcessing();
        return;
    }

    // Process in smaller chunks for better performance
    const CHUNK_SIZE = 25; // Reduced chunk size for smoother UI
    let MarkerArray = new Array();
    let CoordObj = new Object();
    let currentIndex = 0;

    function processNextChunk() {
        const endIndex = Math.min(currentIndex + CHUNK_SIZE, elements.length);
        const chunk = elements.slice(currentIndex, endIndex);
        
        // Process this chunk
        processElementChunk(chunk, MarkerArray, CoordObj);
        
        currentIndex = endIndex;
        
        // Update progress
        const progress = (currentIndex / elements.length) * 100;
        requestAnimationFrame(() => {
            $("#loading_text").text(`Processing... ${Math.round(progress)}%`);
        });
        
        if (currentIndex < elements.length) {
            // Continue processing with next chunk
            if (window.requestIdleCallback) {
                requestIdleCallback(processNextChunk, { timeout: 50 });
            } else {
                setTimeout(processNextChunk, 5); // Smaller delay for responsiveness
            }
        } else {
            // All chunks processed
            finishDataProcessing();
        }
    }

    // Start processing
    processNextChunk();
}

function processElementChunk(elements, MarkerArray, CoordObj) {
    elements.forEach(element => {
        const $element = $(element);
        processOSMElement($element, MarkerArray, CoordObj);
    });
}

function processOSMElement($element, MarkerArray, CoordObj) {
    let EleID = $element.attr("id");
    let EleCoordArray = new Array();
    let EleType = "";
    let EleLat, EleLon, EleObj;

    if ($element.attr("lat")) { // Node
        EleType = "node"
        EleLat = $element.attr("lat");
        EleLon = $element.attr("lon");
        EleObj = new Object();
        EleObj["lat"] = EleLat;
        EleObj["lon"] = EleLon;
        CoordObj[EleID] = EleObj;
    } else { // Way
        EleType = "way";
        $element.find('nd').each(function() {
            let NdRefID = $(this).attr("ref");
            if (CoordObj[NdRefID]) {
                EleCoordArray.push([CoordObj[NdRefID]["lat"], CoordObj[NdRefID]["lon"]]);
            }
        });
    }

    // Parse tags efficiently
    const tags = {};
    $element.find('tag').each(function(){
        const key = $(this).attr("k");
        const value = $(this).attr("v");
        tags[key] = value;
    });

    // Process based on element type
    if (tags.highway === "street_lamp" || tags.light_source || (tags["tower:type"] === "lighting") || tags.aeroway === "navigationaid" || tags["xmas:feature"]) {
        processLightElement($element, tags, EleType, EleID, EleLat, EleLon, MarkerArray);
    } else if (tags.amenity === "bench") {
        processBenchElement($element, tags, EleType, EleID, EleLat, EleLon);
    } else if (tags.lit) {
        processStreetElement($element, tags, EleCoordArray);
    }
}

function processLightElement($element, tags, EleType, EleID, EleLat, EleLon, MarkerArray) {
    // Optimized light processing logic (simplified for performance)
    const tagLightSource = tags.light_source || (tags.highway === "street_lamp" ? "lantern" : 
                          (tags["tower:type"] === "lighting" ? "floodlight" : 
                          (tags.aeroway === "navigationaid" ? "aviation" : 
                          (tags["xmas:feature"] ? "xmas" : null))));
    
    if (!tagLightSource) return;

    const tagLightCount = parseInt(tags["light:count"]) || 1;
    const tagRef = tags.ref || tags.lamp_ref || "";
    
    // Simplified popup creation for performance
    const EleText = createLightPopup(tags, EleType, EleID, tagLightSource);
    
    if ($.inArray(EleID, MarkerArray) === -1) {
        // Create marker with optimized icon
        const markerLocation = new L.LatLng(EleLat, EleLon);
        const Icon = getMarkerIcon(L, tagLightSource, tags["light:method"], tags["light:colour"], 
                                  tags["light:flash"], tags["light:direction"], tags["light:shape"], 
                                  tags["light:height"], tags.navigationaid, tagRef, null, null, null, null, null, null);
        const marker = new L.Marker(markerLocation, {icon: Icon});
        
        if (EleText) {
            marker.bindPopup(EleText);
        }

        // Add to appropriate layer with batching
        if (tagLightSource === "aviation" || tagLightSource === "warning") {
            AviationLayer.addLayer(marker);
        } else {
            StreetLightsLayer.addLayer(marker);
        }

        MarkerArray.push(EleID);
    }
}

function processBenchElement($element, tags, EleType, EleID, EleLat, EleLon) {
    // Simplified bench processing for performance
    const EleText = createBenchPopup(tags, EleType, EleID);
    const markerLocation = new L.LatLng(EleLat, EleLon);
    const Icon = getMarkerIcon(L, "bench", null, null, null, null, null, null, null, null, 
                              tags.backrest, tags.material, tags.seats, tags.colour || tags.color, 
                              tags.lit, tags.bin);
    const marker = new L.Marker(markerLocation, {icon: Icon});
    marker.bindPopup(EleText);
    
    // Use clustering if enabled
    if (CLUSTERING_SETTINGS.CLUSTER_BENCHES && BenchesLayer.addMarker) {
        BenchesLayer.addMarker(marker);
    } else {
        BenchesLayer.addLayer(marker);
    }
}

function processStreetElement($element, tags, EleCoordArray) {
    if (EleCoordArray.length === 0) return;
    
    const tagLit = tags.lit;
    const tagArea = tags.area;
    
    // Optimized street rendering
    if (tagLit === "no" || tagLit === "disused") {
        addStreetToLayer(EleCoordArray, tagArea, UnLitStreetsLayer, '#000000', '#111111');
    } else if (["yes", "24/7", "automatic", "limited", "sunset-sunrise", "dusk-dawn", "interval"].includes(tagLit)) {
        const strokeColor = "#BBBBBB";
        const strokeDashArray = tagLit === "automatic" ? "2 3" : (tagLit === "limited" || tagLit === "interval" ? "8" : "0");
        addStreetToLayer(EleCoordArray, tagArea, LitStreetsLayer, strokeColor, strokeColor, strokeDashArray, tagLit === "24/7");
    }
}

function addStreetToLayer(coords, isArea, layer, fillColor, strokeColor, dashArray = "0", is24_7 = false) {
    const latLngs = coords.map(p => new L.LatLng(p[0], p[1]));
    
    if (isArea) {
        const shape = L.polygon(latLngs, {
            stroke: false, 
            fillColor: fillColor, 
            fillOpacity: 0.4,
            weight: 3,
            dashArray: dashArray
        });
        layer.addLayer(shape);
    } else {
        const line = L.polyline(latLngs, {
            color: strokeColor,
            weight: 3,
            dashArray: dashArray
        });
        layer.addLayer(line);
        
        if (is24_7) {
            const dottedLine = L.polyline(latLngs, {
                color: strokeColor,
                weight: 5,
                dashArray: "1 6"
            });
            layer.addLayer(dottedLine);
        }
    }
}

function createLightPopup(tags, EleType, EleID, tagLightSource) {
    // Simplified popup creation for performance
    const tagOperator = tags.operator || tags.lamp_operator || "<i>" + i18next.t("unknown") + "</i>";
    const tagRef = tags.ref || tags.lamp_ref || "";
    
    let textLightType = i18next.t("lamp_unknown");
    if (tagLightSource === "lantern") textLightType = i18next.t("lamp_lantern");
    else if (tagLightSource === "floodlight") textLightType = i18next.t("lamp_floodlight");
    else if (tagLightSource === "aviation") textLightType = i18next.t("lamp_aviation");
    
    return `<b>${textLightType} ${tagRef}</b><br>
            <div class='infoblock'><table>
            <tr><td><b>${i18next.t("lamp_operator")}: </b></td><td>${tagOperator}</td></tr>
            </table></div>
            <br><a href='#' onclick='openinJOSM("${EleType}","${EleID}")'>edit in JOSM</a> | 
            <a href='https://www.openstreetmap.org/${EleType}/${EleID}'>show in OSM</a>`;
}

function createBenchPopup(tags, EleType, EleID) {
    const attributes = [];
    if (tags.backrest) attributes.push(`<tr><td><b>${i18next.t("bench_backrest")}: </b></td><td>${tags.backrest}</td></tr>`);
    if (tags.material) attributes.push(`<tr><td><b>${i18next.t("bench_material")}: </b></td><td>${tags.material}</td></tr>`);
    if (tags.seats) attributes.push(`<tr><td><b>${i18next.t("bench_seats")}: </b></td><td>${tags.seats}</td></tr>`);
    
    return `<b>${i18next.t("bench")}</b><br>
            <div class='infoblock'><table>${attributes.join('')}</table></div>
            <br><a href='#' onclick='openinJOSM("${EleType}","${EleID}")'>edit in JOSM</a> | 
            <a href='https://www.openstreetmap.org/${EleType}/${EleID}'>show in OSM</a>`;
}

function finishDataProcessing() {
    requestAnimationFrame(() => {
        $("#loading_text").text("");
        if (loadingcounter <= 0) {
            loadingcounter = 0;
            $("#loading_cont").delay(300).fadeOut(50); // Faster animation
        }
    });
}

function parseOSM(data) {
    // Handle the case when called with false to clear layers
    if (data === false) {
        requestAnimationFrame(() => {
            StreetLightsLayer.clearLayers();
            AviationLayer.clearLayers();
            LitStreetsLayer.clearLayers();
            UnLitStreetsLayer.clearLayers();
            
            // Clear benches layer - handle both clustered and regular layers
            if (CLUSTERING_SETTINGS.CLUSTER_BENCHES && BenchesLayer.clearMarkers) {
                BenchesLayer.clearMarkers();
            } else {
                BenchesLayer.clearLayers();
            }
        });
        return;
    }
    
    // Use optimized parser for actual data
    parseOSMOptimized(data);
}
}


function parseOSMlowZoom(data)
{
	// Handle the case when called with false to clear the low zoom layer
	if (data === false) {
		StreetLightsLowZoomLayer.setData({max: 8, data:[]});
		return;
	}
	
	StreetLightsLowZoomLayer.setData({max: 8, data:[]});
	//console.log(data);
	let MarkerArray = new Array();
	let CoordObj = new Object();

	let iconClass = "light_13";
	let iconSize = 8;
	let LightsData = []

	$(data).find('node').each(function(){
		let EleID = $(this).attr("id");
		let EleCoordArray = new Array();
		let EleLat, EleLon, EleType;
		let EleObj = new Object();

		//Node
		if ($(this).attr("lat"))
		{
			EleLat = $(this).attr("lat");
			EleLon = $(this).attr("lon");
			EleType = "node";
			EleObj["lat"] = EleLat;
			EleObj["lon"] = EleLon;
			CoordObj[EleID] = EleObj;
			let markerLocation = new L.LatLng(EleLat,EleLon);
			let markerIcon = L.divIcon({
				className: iconClass,
				html: '<div style="background-image: url(\'./img/electric_white.svg\');background-repeat: no-repeat;"> </div>',
				iconSize: [iconSize, iconSize],
				iconAnchor:   [0, 0],
				});
			let marker = new L.Marker(markerLocation,{icon : markerIcon});

		}

		LightsData.push({"lat" : EleLat, "lng" : EleLon, "count" : 1});
	});

	//console.log(LightsData)
	let lowZoomData = {
    max: 8,
    data: LightsData
    };
	StreetLightsLowZoomLayer.setData(lowZoomData)

	// fadeout loading icon and reset loading counter
	if (loadingcounter<=0) {
		loadingcounter = 0;
		$( "#loading_cont" ).delay(500).fadeOut(100);
	};
}

function addLatLngDistanceM(EleLat,EleLon,angleDeg,distance) {
	const latRad = EleLat * Math.PI / 180;
	const degLatPerM = 1 / ( 111132.92 - 559.82 * Math.cos( 2 * latRad ) + 1.175 * Math.cos( 4 * latRad ) - 0.0023 * Math.cos( 6 * latRad ) );
	const degLonPerM = 1 / ( 111412.84 * Math.cos ( latRad ) - 93.5 * Math.cos ( 3 * latRad ) + 0.118 * Math.cos ( 5 * latRad ) );
	const angleRad = angleDeg * Math.PI / 180;

	let latDistM = 0, lonDistM = 0; // Default fallback values


	latDistM = Math.cos ( angleRad ) * distance;
	lonDistM = Math.sin ( angleRad ) * distance;

	EleLat = EleLat * 1 + latDistM * degLatPerM;
	EleLon = EleLon * 1 + lonDistM * degLonPerM;

	return [EleLat , EleLon];
}

function isNumeric(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}

function getLightLit(value) {
	let result;
	if (value == "dusk-dawn") {
		result = i18next.t("lamp_time_duskdawn");
	} else if (value == "demand") {
		result = i18next.t("lamp_time_demand");
	} else {
		result = value;
	}
	return result;
}

function getLightMethod(value) {
	let result;
	if (value == "high_pressure_sodium" || value == "high-pressure_sodium" || value == "HPSV" || value == "SON") {
		result =  i18next.t("lamp_method_high_presssure_sodium");
	} else if (value == "low_pressure_sodium" || value == "low-pressure_sodium" || value == "SOX") {
		result =  i18next.t("lamp_method_low_presssure_sodium");
	} else if (value == "sodium" || value == "sodium_vapor") {
		result =  i18next.t("lamp_method_sodium");
	} else if (value == "LED" || value == "led") {
		result =  i18next.t("lamp_method_led");
	} else if (value == "metal_halide" || value == "metal-halide") {
		result =  i18next.t("lamp_method_metal_halide");
	} else if (value == "fluorescent") {
		result =  i18next.t("lamp_method_fluorescent");
	} else if (value == "incandescent") {
		result =  i18next.t("lamp_method_incandescent");
	} else if (value == "mercury") {
		result =  i18next.t("lamp_method_mercury");
	} else if (value == "electric" || value == "electrical") {
		result =  i18next.t("lamp_method_electric");
	} else if (value == "gas" || value == "gaslight") {
		result =  i18next.t("lamp_method_gas");
	} else {
		result = value;
	}
	return result;
}

function getLightMount(value) {
	let result;
	if (value == "straight mast" || value == "straight_mast") {
		result =  i18next.t("lamp_mount_straight_mast");
	} else if (value == "bent mast" || value == "bent_mast") {
		result =  i18next.t("lamp_mount_bent_mast");
	} else if (value == "cast steel mast" || value == "cast_steel_mast") {
		result =  i18next.t("lamp_mount_cast_steel_mast");
	} else if (value == "mast" || value == "pole") {
		result =  i18next.t("lamp_mount_mast");
	} else if (value == "power_pole") {
		result =  i18next.t("lamp_mount_power_pole");
	} else if (value == "wall_mounted" || value == "wall") {
		result =  i18next.t("lamp_mount_wall");
	} else if (value == "suspended" || value == "wire") {
		result =  i18next.t("lamp_mount_wire");
	} else if (value == "ceiling") {
		result =  i18next.t("lamp_mount_ceiling");
	} else if (value == "ground") {
		result =  i18next.t("lamp_mount_ground");
	} else {
		result = value;
	}
	return result;
}

function getMarkerIcon(L,lightSource,lightMethod,lightColour,lightFlash,lightDirection,lightShape,lightHeight,navigationaid,ref,benchBackrest,benchMaterial,benchSeats,benchColour,benchLit,benchBin) {
	let symbolURL = "electric";
	if (lightSource == "bench") {
		// Select bench icon based on attributes with enhanced combination logic
		// Priority: lighting > bin > material > backrest
		if (benchLit == "yes") {
			if (benchMaterial == "wood") {
				symbolURL = "bench_wood_lit";
			} else if (benchMaterial == "metal" || benchMaterial == "steel") {
				symbolURL = "bench_metal_lit";
			} else {
				symbolURL = "bench_lit";
			}
		} else if (benchBin == "yes") {
			if (benchMaterial == "wood") {
				symbolURL = "bench_wood_bin";
			} else if (benchMaterial == "metal" || benchMaterial == "steel") {
				symbolURL = "bench_metal_bin";
			} else {
				symbolURL = "bench_bin";
			}
		} else if (benchMaterial == "wood") {
			symbolURL = "bench_wood";
		} else if (benchMaterial == "metal" || benchMaterial == "steel") {
			symbolURL = "bench_metal";
		} else if (benchBackrest == "yes") {
			symbolURL = "bench_backrest";
		} else if (benchBackrest == "no") {
			symbolURL = "bench_no_backrest";
		} else {
			symbolURL = "bench"; // default bench icon
		}
	} else if (lightSource == "xmas") {
		symbolURL = "xmastree";
	} else if (navigationaid == "beacon") {
		symbolURL = "beacon";
	} else if (lightSource == "floodlight") {
		symbolURL = "floodlight";
		if (lightDirection) {
			symbolURL = "floodlight_directed";
		}
	} else if ((lightSource == "lantern" || lightSource == "aviation") && lightShape == "directed" && lightDirection) {
		symbolURL = "electric_directed";
		if (lightFlash && lightFlash != "no") {
			symbolURL = "electric_directed_flashing";
		}
	} else {
		if (lightFlash && lightFlash != "no") {
			symbolURL = "electric_flashing";
		}
	}

	let colourURL = "";
    if (lightSource !== "bench") {
		if (lightColour) {
			// convert Kelvin light temperatures to colour values
			if (lightColour.substr(-1) == "K") {
				let KelvinLength = lightColour.indexOf("K");
				let lightColourK = Number(lightColour.substr(0,KelvinLength));
				if (!lightColourK.isNaN) {
					if (lightColourK < 2000) {
						colourURL = "_gas";
					} else if (lightColourK < 2600) {
						colourURL = "_orange";
					} else if (lightColourK < 3000) {
						colourURL = "_fluorescent";
					} else if (lightColourK < 4000) {
						colourURL = "_led";
					} else if (lightColourK > 5600) {
						colourURL = "_mercury";
					} else {
						colourURL = "_white";
					}
				}
			}
			// add verbal colours:
			if (lightColour == "white") {
				colourURL = "_white";
			} else if (lightColour == "orange") {
				colourURL = "_orange";
			} else if (lightColour == "blue") {
				colourURL = "_blue";
			} else if (lightColour == "red") {
				colourURL = "_red";
			} else if (lightColour == "green") {
				colourURL = "_green";
			} else if (lightColour == "yellow") {
				colourURL = "_yellow";
			}
		}
    }

	// default/adapted light colours for different light methods:
	if (lightMethod == "LED" || lightMethod == "led") {
		if (!colourURL || colourURL == "_white") {
			colourURL = "_led";
		}
	} else if (lightMethod == "fluorescent") {
		if (!colourURL || colourURL == "_white") {
			colourURL = "_fluorescent"
		}
	} else if (lightMethod == "gas" || lightMethod == "gaslight") {
		if (!colourURL || colourURL == "_orange" || colourURL == "_red") {
			colourURL = "_gas";
		}
	} else if (lightMethod == "metal_halide" || lightMethod == "metal-halide") {
		if (!colourURL) {
			colourURL = "_white";
		}
	} else if (lightMethod == "incandescent") {
		if (!colourURL) {
			colourURL = "_white";
		}
	} else if (lightMethod == "high_pressure_sodium" || lightMethod == "high-pressure_sodium" || lightMethod == "sodium_vapor" || lightMethod == "sodium") {
		if (!colourURL) {
			colourURL = "_orange";
		}
	} else if (lightMethod == "mercury") {
		if (!colourURL && colourURL!="white") {
			colourURL = "_mercury";
		}
	}
	// default light colour for warning lights if unset:
	if (lightSource == "warning") {
		if (!colourURL) {
			colourURL = "_red";
		}
	}
	// default light colours for aviation lights if unset:
	if(navigationaid == "txe") {
		if (!colourURL) {
			colourURL = "_blue";
		}
	} else if(navigationaid == "txc") {
		if (!colourURL) {
			colourURL = "_green";
		}
	} else if(navigationaid == "rwe") {
		if (!colourURL) {
			colourURL = "_white";
		}
	} else if(navigationaid == "rwc") {
		if (!colourURL) {
			colourURL = "_white";
		}
	} else if(navigationaid == "tdz") {
		if (!colourURL) {
			colourURL = "_white";
		}
	} else if(navigationaid == "rgl") {
		if (!colourURL) {
			colourURL = "_yellow";
		}
	} else if(navigationaid == "vasi" || navigationaid == "papi") {
		if (!colourURL) {
			colourURL = "_redwhite";
		}
	} else if(navigationaid == "beacon") {
		colourURL = "_white";
	}

	let directionCSS, directionDeg;
	let rotate = 0;
	let iconOffset = 0, iconSize = 0, iconClass = "";
	let zoomClass = 0;
	let refClass = "";

	if (map.getZoom() == 19) {
		//if (lightHeight > 10)
		zoomClass = 19;
		refClass = "lamp_ref_19_text";
		if (navigationaid == "beacon") {
			zoomClass = 21;
		} else if (navigationaid == "als" || navigationaid == "papi" || navigationaid == "vasi" || navigationaid == "rwe" || navigationaid == "rwc" || navigationaid == "tdz" || navigationaid == "rgl" || lightSource == "warning") {
			zoomClass = 17;
		} else if (navigationaid) {
			zoomClass = 16
		} else if (lightHeight >= 10) {
			zoomClass = 21;
		} else if (lightHeight >= 7) {
			zoomClass = 20;
		} else if (lightHeight <= 4) {
			zoomClass = 18;
		} else if (lightHeight <= 2) {
			zoomClass = 17;
		}
	} else if (map.getZoom() == 18) {
		zoomClass = 18;
		refClass = "lamp_ref_18_text";
		if (navigationaid == "beacon") {
			zoomClass = 21;
		} else if (navigationaid == "als" || navigationaid == "papi" || navigationaid == "vasi" || navigationaid == "rwe" || navigationaid == "rwc" || navigationaid == "tdz" || navigationaid == "rgl" || lightSource == "warning") {
			zoomClass = 16;
		} else if (navigationaid) {
			zoomClass = 15
		} else if (lightHeight >= 10) {
			zoomClass = 20;
		} else if (lightHeight >= 7) {
			zoomClass = 19;
		} else if (lightHeight <= 4) {
			zoomClass = 17;
		} else if (lightHeight <= 2) {
			zoomClass = 16;
		}
	} else if (map.getZoom() == 17) {
		zoomClass = 17;
		refClass = "lamp_ref_17_text";
		if (navigationaid == "beacon") {
			zoomClass = 20;
		} else if (navigationaid == "als" || navigationaid == "papi" || navigationaid == "vasi" || navigationaid == "rwe" || navigationaid == "rwc" || navigationaid == "tdz" || navigationaid == "rgl" || lightSource == "warning") {
			zoomClass = 15;
		} else if (navigationaid) {
			zoomClass = 14;
		} else if (lightHeight >= 10) {
			zoomClass = 19;
		} else if (lightHeight >= 7) {
			zoomClass = 18;
		} else if (lightHeight <= 4) {
			zoomClass = 16;
		} else if (lightHeight <= 2) {
			zoomClass = 15;
		}
	} else if (map.getZoom() == 16) {
		zoomClass = 16;
		refClass = "lamp_ref_none";
		if (navigationaid == "beacon") {
			zoomClass = 19;
		} else if (navigationaid == "als" || navigationaid == "papi" || navigationaid == "vasi" || navigationaid == "rwe" || navigationaid == "rwc" || navigationaid == "tdz" || navigationaid == "rgl" || lightSource == "warning") {
			zoomClass = 14;
		} else if (navigationaid) {
			zoomClass = 13;
		} else if (lightHeight >= 10) {
			zoomClass = 18;
		} else if (lightHeight >= 7) {
			zoomClass = 17;
		} else if (lightHeight <= 4) {
			zoomClass = 15;
		} else if (lightHeight <= 2) {
			zoomClass = 14;
		}
	} else if (map.getZoom() <= 15) {
		zoomClass = 15;
		refClass = "lamp_ref_none";
		if (navigationaid == "beacon") {
			zoomClass = 18;
		} else if (navigationaid == "als" || navigationaid == "papi" || navigationaid == "vasi" || navigationaid == "rwe" || navigationaid == "rwc" || navigationaid == "tdz" || navigationaid == "rgl" || lightSource == "warning") {
			zoomClass = 13;
		} else if (navigationaid) {
			zoomClass = 12;
		} else if (lightHeight > 0) {
			if (lightHeight >= 10) {
				zoomClass = 17;
			} else if (lightHeight >= 7) {
				zoomClass = 16;
			} else if (lightHeight <= 4) {
				zoomClass = 14;
			} else if (lightHeight <= 2) {
				zoomClass = 13;
			}
		}
	}
	if (zoomClass == 21) {
		iconClass = "light_21 " + iconClass;
		iconOffset = 52;
		iconSize = 104;
		refClass = "lamp_ref_21 " + refClass;
	} else if (zoomClass == 20) {
		iconClass = "light_20 " + iconClass;
		iconOffset = 46;
		iconSize = 92;
		refClass = "lamp_ref_20 " + refClass;
	} else if (zoomClass == 19) {
		iconClass = "light_19 " + iconClass;
		iconOffset = 40;
		iconSize = 80;
		refClass = "lamp_ref_19 " + refClass;
	} else if (zoomClass == 18) {
		iconClass = "light_18 " + iconClass;
		iconOffset = 34;
		iconSize = 68;
		refClass = "lamp_ref_18 " + refClass;
	} else if (zoomClass == 17) {
		iconClass = "light_17 " + iconClass;
		iconOffset = 28;
		iconSize = 56;
		refClass = "lamp_ref_17 " + refClass;
	} else if (zoomClass == 16) {
		iconClass = "light_16 " + iconClass;
		iconOffset = 22;
		iconSize = 44;
		refClass = "lamp_ref_16 " + refClass;
	} else if (zoomClass == 15) {
		iconClass = "light_15 " + iconClass;
		iconOffset = 16;
		iconSize = 32;
		refClass = "lamp_ref_15 " + refClass;
	} else if (zoomClass == 14) {
		iconClass = "light_14 " + iconClass;
		iconOffset = 10;
		iconSize = 20;
		refClass = "lamp_ref_14 " + refClass;
	} else if (zoomClass == 13) {
		iconClass = "light_13 " + iconClass;
		iconOffset = 4;
		iconSize = 8;
		refClass = "lamp_ref_13 " + refClass;
	}

	if (lightDirection || lightDirection === 0) {
		let cardinal = new Object();
		cardinal['N'] = 0;
		cardinal['NNE'] = 22.5;
		cardinal['NE'] = 45;
		cardinal['ENE'] = 67.5;
		cardinal['E'] = 90;
		cardinal['ESE'] = 112.5;
		cardinal['SE'] = 135;
		cardinal['SSE'] = 157.5;
		cardinal['S'] = 180;
		cardinal['SSW'] = 202.5;
		cardinal['SW'] = 225;
		cardinal['WSW'] = 247.5;
		cardinal['W'] = 270;
		cardinal['WNW'] = 292.5;
		cardinal['NW'] = 315;
		cardinal['NNW'] = 337.5;

		if (cardinal.hasOwnProperty(lightDirection)) {
			directionDeg = cardinal[lightDirection];
		} else if (lightDirection > 0 && lightDirection <= 360) { // exclude 0 as it is used as fallback anyway
			directionDeg = lightDirection;
		} else {/* ignore to_street  to_crossing */
			directionDeg = 0
		}
	}
	if (directionDeg >= 0 && lightSource == "floodlight") {
		if(directionDeg >= 135 && directionDeg <=360) {
			rotate = directionDeg - 135;
		} else if(directionDeg >= 0 && directionDeg < 135) {
			rotate = directionDeg - 135 + 360;
		}
		let translateX = Math.cos( ( 45 + rotate ) * 2 * Math.PI / 360 ) * Math.sqrt( 2 * iconOffset * iconOffset );
		let translateY = Math.sin( ( 45 + rotate ) * 2 * Math.PI / 360 ) * Math.sqrt( 2 * iconOffset * iconOffset );
		directionCSS = '-ms-transform: translate(' + translateX + 'px,' + translateY + 'px) rotate(' + rotate + 'deg); -webkit-transform: translate(' + translateX + 'px,' + translateY + 'px) rotate(' + rotate + 'deg); transform: translate(' + translateX + 'px,' + translateY + 'px) rotate(' + rotate + 'deg); ';
	} else if (directionDeg >= 0 && (lightSource == "lantern" || lightSource == "aviation")){
		if(directionDeg >= 0 && directionDeg <=360) {
				rotate = directionDeg - 0;
		}
		let translateX = 0;//Math.cos( ( 45 + rotate ) * 2 * Math.PI / 360 ) * Math.sqrt( 2 * 24 * 24 );
		let translateY = 0;//Math.sin( ( 45 + rotate ) * 2 * Math.PI / 360 ) * Math.sqrt( 2 * 24 * 24 );
		directionCSS = '-ms-transform: translate(' + translateX + 'px,' + translateY + 'px) rotate(' + rotate + 'deg); -webkit-transform: translate(' + translateX + 'px,' + translateY + 'px) rotate(' + rotate + 'deg); transform: translate(' + translateX + 'px,' + translateY + 'px) rotate(' + rotate + 'deg); ';
	}
	if ( map.getZoom() < 17)
	{
		ref = "";
	}
	let Icon = L.divIcon({
		className: iconClass,
		html: '<div style="background-image: url(\'./img/' + symbolURL + colourURL + '.svg\');background-repeat: no-repeat;' + directionCSS + '"> </div><span class="' + refClass + '">' + ref + '</span>',
		iconSize: [iconSize, iconSize],
		iconAnchor:   [iconOffset, iconOffset],
		popupAnchor:  [0, -5]
	});
	return Icon;
}

/**
 * Rectangle-based data loading for high zoom levels
 */
function loadDataRectangles(lat1, lon1, lat2, lon2) {
	// Convert coordinates to bounds object
	const mapBounds = {
		north: lat1,
		south: lat2, 
		east: lon2,
		west: lon1
	};
	
	// Get rectangles in current view
	const rectanglesInView = getRectanglesInView({
		getNorth: () => mapBounds.north,
		getSouth: () => mapBounds.south,
		getEast: () => mapBounds.east,
		getWest: () => mapBounds.west
	});
	
	console.log(`Found ${rectanglesInView.length} rectangles in view for high zoom data`);
	
	// Find rectangles that need loading
	const rectanglesToLoad = rectanglesInView.filter(rectId => {
		if (isRectangleLoaded(rectId)) {
			return false; // Already loaded
		}
		if (isRectangleLoading(rectId)) {
			return false; // Currently loading
		}
		return shouldRetryRectangle(rectId); // Should retry failed rectangles
	});
	
	console.log(`Need to load ${rectanglesToLoad.length} rectangles for high zoom data`);
	
	if (rectanglesToLoad.length === 0) {
		// All data already loaded or loading, merge existing data
		mergeAndRenderRectangleData(rectanglesInView, false);
		return;
	}
	
	// Load each rectangle individually
	rectanglesToLoad.forEach(rectId => {
		loadSingleRectangleData(rectId, false);
	});
	
	// Always merge and render available data
	mergeAndRenderRectangleData(rectanglesInView, false);
}

/**
 * Rectangle-based data loading for low zoom levels  
 */
function loadDataLowZoomRectangles(lat1, lon1, lat2, lon2) {
	// Convert coordinates to bounds object
	const mapBounds = {
		north: lat1,
		south: lat2,
		east: lon2,
		west: lon1
	};
	
	// Get rectangles in current view
	const rectanglesInView = getRectanglesInView({
		getNorth: () => mapBounds.north,
		getSouth: () => mapBounds.south,
		getEast: () => mapBounds.east,
		getWest: () => mapBounds.west
	});
	
	console.log(`Found ${rectanglesInView.length} rectangles in view for low zoom data`);
	
	// Find rectangles that need loading
	const rectanglesToLoad = rectanglesInView.filter(rectId => {
		if (isRectangleLoaded(rectId + '_lowzoom')) {
			return false; // Already loaded (use separate ID for low zoom)
		}
		if (isRectangleLoading(rectId + '_lowzoom')) {
			return false; // Currently loading
		}
		return shouldRetryRectangle(rectId + '_lowzoom'); // Should retry failed rectangles
	});
	
	console.log(`Need to load ${rectanglesToLoad.length} rectangles for low zoom data`);
	
	if (rectanglesToLoad.length === 0) {
		// All data already loaded or loading, merge existing data
		mergeAndRenderRectangleData(rectanglesInView.map(id => id + '_lowzoom'), true);
		return;
	}
	
	// Load each rectangle individually
	rectanglesToLoad.forEach(rectId => {
		loadSingleRectangleData(rectId + '_lowzoom', true);
	});
	
	// Always merge and render available data
	mergeAndRenderRectangleData(rectanglesInView.map(id => id + '_lowzoom'), true);
}

/**
 * Load data for a single rectangle with fallback endpoint support
 */
function loadSingleRectangleData(rectangleId, isLowZoom = false, endpointIndex = 0) {
	// Extract base rectangle ID (remove _lowzoom suffix if present)
	const baseRectId = rectangleId.replace('_lowzoom', '');
	const bounds = getRectangleBounds(baseRectId);
	
	markRectangleLoading(rectangleId);
	
	$( "#loading_text" ).text("")
	$( "#loading" ).attr("class", "");
	$( "#loading_icon" ).attr("class", "loading_spinner")
	$( "#loading_cont" ).fadeIn(100)
	loadingcounter++;
	
	let XMLRequestText;
	let RequestURL;
	
	if (isLowZoom) {
		// Low zoom query - just street lamps and light sources
		XMLRequestText = `[bbox:${bounds.south},${bounds.west},${bounds.north},${bounds.east}];` +
			'( node["highway"="street_lamp"]; node["light_source"];); out skel;'
	} else {
		// High zoom query - full detailed query
		XMLRequestText = `[bbox:${bounds.south},${bounds.west},${bounds.north},${bounds.east}];` +
			'( node["highway"="street_lamp"]; node["light_source"]; node["tower:type"="lighting"]; node["aeroway"="navigationaid"];'
		
		if (map.hasLayer(BenchesLayer)) {
			XMLRequestText += 'node["amenity"="bench"];'
		}
		
		const today = new Date();
		if (today.getMonth() == 11) { // show christmas trees only in December
			XMLRequestText += 'node["xmas:feature"="tree"];'
		}
		
		if (map.hasLayer(LitStreetsLayer) || map.hasLayer(UnLitStreetsLayer)) {
			XMLRequestText += '(way["highway"][!area]["lit"]; >;); ' +
				'(way["highway"][area]["lit"]; >;); ';
		}
		XMLRequestText += '); out qt; '
	}
	
	//URL Codieren
	XMLRequestText = encodeURIComponent(XMLRequestText);
	
	if (location.protocol == 'https:') {
		RequestProtocol = "https://";
	} else {
		RequestProtocol = "http://";
	}
	
	// Use current endpoint from the list
	const currentEndpoint = OVERPASS_ENDPOINTS[endpointIndex % OVERPASS_ENDPOINTS.length];
	RequestURL = RequestProtocol + currentEndpoint + "?data=" + XMLRequestText;
	
	console.log(`Loading rectangle ${rectangleId} with bounds:`, bounds);
	console.log(`Using endpoint: ${currentEndpoint} (attempt ${endpointIndex + 1})`);
	
	//AJAX REQUEST
	$.ajax({
		url: RequestURL,
		type: 'GET',
		crossDomain: true,
		success: function(data) {
			console.log(`Successfully loaded rectangle ${rectangleId} from ${currentEndpoint}`);
			
			if (loadingcounter==1) {
				$( "#loading_text" ).html("")
				$( "#loading" ).attr("class", "success");
				$( "#loading_icon" ).attr("class", "loading_success")
			}
			loadingcounter--;
			
			// Store the data in rectangle cache
			markRectangleLoaded(rectangleId, data);
			
			// Re-render the current view with updated data
			const currentBounds = map.getBounds();
			const currentRectangles = getRectanglesInView(currentBounds);
			if (isLowZoom) {
				mergeAndRenderRectangleData(currentRectangles.map(id => id + '_lowzoom'), true);
			} else {
				mergeAndRenderRectangleData(currentRectangles, false);
			}
		},
		error: function(jqXHR, textStatus, errorThrown){
			console.log(`Failed to load rectangle ${rectangleId} from ${currentEndpoint}:`, textStatus, jqXHR.status);
			
			loadingcounter--;
			
			// Check if we should try another endpoint
			const nextEndpointIndex = endpointIndex + 1;
			const isLastEndpoint = nextEndpointIndex >= OVERPASS_ENDPOINTS.length;
			const isTooManyRequests = jqXHR.status === 429;
			const isServerError = jqXHR.status >= 500;
			
			// Retry with next endpoint if we have more endpoints and certain error conditions
			if (!isLastEndpoint && (isTooManyRequests || isServerError || textStatus === "timeout")) {
				console.log(`Retrying rectangle ${rectangleId} with next endpoint...`);
				// Remove from loading state temporarily to allow retry
				loadingRectangles.delete(rectangleId);
				updateLoadingOverlays();
				
				// Retry with next endpoint after a short delay
				setTimeout(() => {
					loadSingleRectangleData(rectangleId, isLowZoom, nextEndpointIndex);
				}, 1000);
				return;
			}
			
			// All endpoints failed or non-retryable error
			markRectangleFailed(rectangleId);
			
			let textStatus_value;
			if( i18next.isInitialized) {
				if (textStatus == "timeout" || textStatus == "error" || textStatus == "abort" || textStatus == "parseerror") {
					textStatus_value = i18next.t("ajaxerror_" + textStatus);
				} else {
					textStatus_value = i18next.t("ajaxerror_unknown");
				}
			} else { // fallback in case i18next is not initalized yet.
				if (isTooManyRequests) {
					textStatus_value = "Too Many Requests - Try again later";
				} else {
					textStatus_value = "Error while loading data";
				}
			}
			
			$( "#loading" ).attr("class", "error");
			$( "#loading_icon" ).attr("class", "loading_error")
			$( "#loading_text" ).html("&nbsp;" + textStatus_value)
		},
		timeout: 10000 // timeout after 10s
	});
}

/**
 * Merge data from multiple rectangles and render it
 */
function mergeAndRenderRectangleData(rectangleIds, isLowZoom = false) {
	const dataArrays = getRectangleData(rectangleIds);
	
	if (dataArrays.length === 0) {
		console.log(`No data available for ${rectangleIds.length} rectangles`);
		return;
	}
	
	console.log(`Merging data from ${dataArrays.length} loaded rectangles out of ${rectangleIds.length} total`);
	
	if (isLowZoom) {
		// For low zoom, we need to merge all data into a single dataset
		// and pass it to the low zoom parser
		const mergedData = mergeXMLData(dataArrays);
		parseOSMlowZoom(mergedData);
	} else {
		// For high zoom, we need to merge all data into a single dataset
		// and pass it to the regular parser
		const mergedData = mergeXMLData(dataArrays);
		parseOSM(mergedData);
	}
}

/**
 * Merge multiple XML datasets into a single XML document
 */
function mergeXMLData(dataArrays) {
	if (dataArrays.length === 0) {
		return null;
	}
	
	if (dataArrays.length === 1) {
		return dataArrays[0];
	}
	
	// Create a new XML document with osm root
	const xmlDoc = document.implementation.createDocument(null, "osm", null);
	const osmRoot = xmlDoc.documentElement;
	osmRoot.setAttribute("version", "0.6");
	osmRoot.setAttribute("generator", "Rectangle Manager");
	
	const addedElements = new Set(); // Track added elements to avoid duplicates
	
	// Merge all data
	dataArrays.forEach((data, index) => {
		if (!data) return;
		
		// Parse the XML data if it's a string
		let doc = data;
		if (typeof data === 'string') {
			const parser = new DOMParser();
			doc = parser.parseFromString(data, 'text/xml');
		}
		
		// Add all nodes and ways from this dataset
		const elements = doc.querySelectorAll('node, way');
		elements.forEach(element => {
			const id = element.getAttribute('id');
			const elementKey = element.tagName + '_' + id;
			
			// Only add if we haven't seen this element before
			if (!addedElements.has(elementKey)) {
				const clonedElement = xmlDoc.importNode(element, true);
				osmRoot.appendChild(clonedElement);
				addedElements.add(elementKey);
			}
		});
	});
	
	console.log(`Merged ${addedElements.size} unique elements from ${dataArrays.length} rectangles`);
	return xmlDoc;
}
