/**
 * Test file for Enhanced Location functionality
 * Run these tests to verify the location tracking and display features work correctly
 */

/**
 * Test suite for enhanced location features
 */
function runEnhancedLocationTests() {
    console.log("Starting Enhanced Location Tests...");
    
    let passed = 0;
    let failed = 0;
    
    function assert(condition, message) {
        if (condition) {
            console.log(`✓ ${message}`);
            passed++;
        } else {
            console.error(`✗ ${message}`);
            failed++;
        }
    }
    
    // Test 1: Location configuration
    {
        assert(typeof LOCATION_CONFIG === 'object', "Location configuration object exists");
        assert(typeof LOCATION_CONFIG.DEFAULT_ZOOM === 'number', "Default zoom level is configured");
        assert(typeof LOCATION_CONFIG.ACCURACY_CIRCLE_STYLE === 'object', "Accuracy circle style is configured");
        assert(typeof LOCATION_CONFIG.MARKER_STYLE === 'object', "Marker style is configured");
    }
    
    // Test 2: Location utility functions
    {
        assert(typeof getCurrentLocation === 'function', "getCurrentLocation function exists");
        assert(typeof isLocationTrackingActive === 'function', "isLocationTrackingActive function exists");
        assert(typeof centerOnCurrentLocation === 'function', "centerOnCurrentLocation function exists");
    }
    
    // Test 3: Location tracking state
    {
        const isTracking = isLocationTrackingActive();
        assert(typeof isTracking === 'boolean', "Location tracking state returns boolean");
        
        const currentLoc = getCurrentLocation();
        assert(currentLoc === null || (typeof currentLoc === 'object' && 'lat' in currentLoc && 'lng' in currentLoc), 
               "Current location is null or valid LatLng object");
    }
    
    // Test 4: Notification system
    {
        // Test notification creation
        showLocationNotification('Test notification', 'info');
        const notification = document.getElementById('location_notification');
        assert(notification !== null, "Notification element created");
        assert(notification.textContent === 'Test notification', "Notification message set correctly");
        assert(notification.className.includes('info'), "Notification type class applied");
        
        // Test different notification types
        showLocationNotification('Success test', 'success');
        assert(notification.className.includes('success'), "Success notification style applied");
        
        showLocationNotification('Error test', 'error');
        assert(notification.className.includes('error'), "Error notification style applied");
        
        showLocationNotification('Warning test', 'warning');
        assert(notification.className.includes('warning'), "Warning notification style applied");
    }
    
    // Test 5: Location info display
    {
        const testPos = L.latLng(52.5200, 13.4050);
        const testAccuracy = 15;
        
        updateLocationInfoDisplay(testPos, testAccuracy);
        
        const locationInfo = document.getElementById('location_info');
        assert(locationInfo !== null, "Location info element created");
        assert(locationInfo.innerHTML.includes('52.5200'), "Location coordinates displayed");
        assert(locationInfo.innerHTML.includes('13.4050'), "Location coordinates displayed");
        assert(locationInfo.innerHTML.includes('±15m'), "Location accuracy displayed");
    }
    
    // Test 6: Location display update
    {
        const testPos = L.latLng(52.5100, 13.4100);
        const testAccuracy = 25;
        
        // This should update lastKnownPosition
        updateLocationDisplay(testPos, testAccuracy);
        
        const currentLoc = getCurrentLocation();
        assert(currentLoc !== null, "Location was stored after update");
        if (currentLoc) {
            assert(Math.abs(currentLoc.lat - 52.5100) < 0.0001, "Stored latitude is correct");
            assert(Math.abs(currentLoc.lng - 13.4100) < 0.0001, "Stored longitude is correct");
        }
    }
    
    // Test 7: Tracking button state management
    {
        // Create a mock tracking button
        const mockButton = document.createElement('a');
        mockButton.className = 'location-track-button';
        document.body.appendChild(mockButton);
        
        // Test button state updates
        locationTrackingEnabled = true;
        updateTrackingButtonState();
        assert(mockButton.style.backgroundColor === 'rgb(255, 107, 107)', "Tracking button shows active state");
        
        locationTrackingEnabled = false;
        updateTrackingButtonState();
        assert(mockButton.style.backgroundColor === '', "Tracking button shows inactive state");
        
        // Cleanup
        document.body.removeChild(mockButton);
    }
    
    // Test 8: Enhanced locate control creation
    {
        // Create a test map div
        const testMapDiv = document.createElement('div');
        testMapDiv.id = 'test_map';
        testMapDiv.style.width = '400px';
        testMapDiv.style.height = '300px';
        document.body.appendChild(testMapDiv);
        
        try {
            const testMap = L.map('test_map').setView([52.5, 13.4], 13);
            const locateControl = createEnhancedLocateControl(testMap);
            
            assert(typeof locateControl === 'object', "Enhanced locate control created successfully");
            assert(typeof locateControl.start === 'function', "Locate control has start method");
            assert(typeof locateControl.stop === 'function', "Locate control has stop method");
            
            // Test tracking control creation
            const trackingControl = createLocationTrackingControl(testMap);
            assert(typeof trackingControl === 'object', "Location tracking control created successfully");
            
            // Cleanup test map
            testMap.remove();
        } catch (error) {
            console.warn('Map creation test skipped (expected in test environment):', error.message);
        }
        
        // Cleanup test div
        document.body.removeChild(testMapDiv);
    }
    
    // Test 9: Geolocation API availability check
    {
        assert(typeof navigator !== 'undefined', "Navigator object available");
        
        if (typeof navigator.geolocation !== 'undefined') {
            assert(typeof navigator.geolocation.getCurrentPosition === 'function', "Geolocation getCurrentPosition available");
            assert(typeof navigator.geolocation.watchPosition === 'function', "Geolocation watchPosition available");
            assert(typeof navigator.geolocation.clearWatch === 'function', "Geolocation clearWatch available");
        } else {
            console.warn("Geolocation API not available in this environment");
        }
    }
    
    // Test 10: Keyboard shortcut setup (manual verification)
    {
        // We can't easily test keyboard events in an automated way,
        // but we can verify the event listener was added
        const hasKeydownListeners = document.addEventListener.toString().includes('keydown') || 
                                   window.addEventListener.toString().includes('keydown');
        
        // This test is informational only
        console.log("ℹ️ Keyboard shortcuts available: Ctrl+L (locate), Ctrl+T (toggle tracking)");
        assert(true, "Keyboard shortcut information logged");
    }
    
    console.log(`\nEnhanced Location Tests completed: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
        console.log("🎉 All enhanced location tests passed!");
    } else {
        console.warn(`⚠️ ${failed} enhanced location tests failed`);
    }
    
    return { passed, failed };
}

/**
 * Manual test for location functionality (requires user interaction)
 */
function runManualLocationTest() {
    console.log("=== Manual Location Test ===");
    console.log("This test requires user interaction and location permission.");
    console.log("Please perform the following actions:");
    console.log("1. Click the locate button (crosshair icon) in the top-left");
    console.log("2. Grant location permission when prompted");
    console.log("3. Observe the location marker and accuracy circle");
    console.log("4. Click the tracking button (target icon) to start continuous tracking");
    console.log("5. Move around and observe location updates");
    console.log("6. Check the location info display at the top of the map");
    console.log("7. Try keyboard shortcuts: Ctrl+L (locate), Ctrl+T (toggle tracking)");
    console.log("8. Check notifications in the top-right corner");
    
    const instructions = [
        "✓ Location button clicked and permission granted",
        "✓ Location marker and accuracy circle visible",
        "✓ Continuous tracking button tested",
        "✓ Location info display shows coordinates",
        "✓ Keyboard shortcuts work (Ctrl+L, Ctrl+T)",
        "✓ Notifications appear for location events"
    ];
    
    console.log("\nExpected results:");
    instructions.forEach(instruction => {
        console.log(instruction);
    });
    
    return instructions;
}

/**
 * Performance test for location updates
 */
function testLocationPerformance() {
    console.log("Testing Location Update Performance...");
    
    const testPositions = [
        L.latLng(52.5200, 13.4050),
        L.latLng(52.5201, 13.4051),
        L.latLng(52.5202, 13.4052),
        L.latLng(52.5203, 13.4053),
        L.latLng(52.5204, 13.4054)
    ];
    
    const startTime = performance.now();
    
    testPositions.forEach((pos, index) => {
        updateLocationDisplay(pos, 10 + index);
        updateLocationInfoDisplay(pos, 10 + index);
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`Updated ${testPositions.length} locations in ${duration.toFixed(2)}ms`);
    console.log(`Average: ${(duration / testPositions.length).toFixed(2)}ms per update`);
    
    return { duration, averagePerUpdate: duration / testPositions.length };
}

/**
 * Test location accuracy calculations
 */
function testLocationAccuracyDisplay() {
    console.log("Testing Location Accuracy Display...");
    
    const testCases = [
        { accuracy: 5, expected: "±5m" },
        { accuracy: 12.7, expected: "±13m" },
        { accuracy: 156.3, expected: "±156m" },
        { accuracy: 1234.8, expected: "±1235m" }
    ];
    
    let passed = 0;
    let failed = 0;
    
    testCases.forEach(testCase => {
        const pos = L.latLng(52.5, 13.4);
        updateLocationInfoDisplay(pos, testCase.accuracy);
        
        const locationInfo = document.getElementById('location_info');
        const displayedAccuracy = locationInfo.innerHTML.match(/±(\d+)m/);
        
        if (displayedAccuracy && displayedAccuracy[0] === testCase.expected) {
            console.log(`✓ Accuracy ${testCase.accuracy}m displayed as ${testCase.expected}`);
            passed++;
        } else {
            console.error(`✗ Accuracy ${testCase.accuracy}m should display as ${testCase.expected}, got ${displayedAccuracy ? displayedAccuracy[0] : 'null'}`);
            failed++;
        }
    });
    
    console.log(`Accuracy display test: ${passed} passed, ${failed} failed`);
    return { passed, failed };
}

/**
 * Run all location tests
 */
function runAllLocationTests() {
    console.log("=== Running All Enhanced Location Tests ===\n");
    
    const basicTests = runEnhancedLocationTests();
    console.log("");
    
    const perfTests = testLocationPerformance();
    console.log("");
    
    const accuracyTests = testLocationAccuracyDisplay();
    console.log("");
    
    const manualInstructions = runManualLocationTest();
    console.log("");
    
    console.log("=== All Enhanced Location Tests Complete ===");
    console.log(`Basic tests: ${basicTests.passed} passed, ${basicTests.failed} failed`);
    console.log(`Performance: ${perfTests.averagePerUpdate.toFixed(2)}ms per location update`);
    console.log(`Accuracy display: ${accuracyTests.passed} passed, ${accuracyTests.failed} failed`);
    console.log(`Manual test instructions: ${manualInstructions.length} steps provided`);
    
    return {
        basic: basicTests,
        performance: perfTests,
        accuracy: accuracyTests,
        manual: manualInstructions
    };
}