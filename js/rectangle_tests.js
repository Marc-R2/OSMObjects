/**
 * Test file for Rectangle Manager functionality
 * Run these tests to verify the rectangle grid system works correctly
 */

/**
 * Test suite for rectangle manager
 */
function runRectangleManagerTests() {
    console.log("Starting Rectangle Manager Tests...");
    
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
    
    // Test 1: Rectangle ID generation
    {
        const id1 = getRectangleId(52.5, 13.4);
        const id2 = getRectangleId(52.5001, 13.4001); // Should round to same rectangle
        const id3 = getRectangleId(52.51, 13.41); // Should be different rectangle
        
        assert(id1 === "rect_52.5000_13.4000", "Rectangle ID generation for exact coordinates");
        assert(id1 === id2, "Rectangle ID consistency for nearby coordinates");
        assert(id1 !== id3, "Rectangle ID differentiation for distant coordinates");
    }
    
    // Test 2: Rectangle bounds calculation
    {
        const bounds = getRectangleBounds("rect_52.5000_13.4000");
        assert(bounds.south === 52.5, "Rectangle south bound correct");
        assert(bounds.north === 52.51, "Rectangle north bound correct");
        assert(bounds.west === 13.4, "Rectangle west bound correct");
        assert(bounds.east === 13.41, "Rectangle east bound correct");
    }
    
    // Test 3: Area division into rectangles
    {
        const testBounds = {
            north: 52.52,
            south: 52.48,
            east: 13.42,
            west: 13.38
        };
        
        const rectangles = divideAreaIntoRectangles(testBounds);
        assert(rectangles.length > 0, "Area division generates rectangles");
        assert(rectangles.includes("rect_52.4800_13.3800"), "Area division includes expected rectangle");
        assert(rectangles.includes("rect_52.5100_13.4100"), "Area division includes corner rectangle");
    }
    
    // Test 4: Rectangle loading state management
    {
        clearRectangleCache();
        const testId = "rect_52.5000_13.4000";
        
        assert(!isRectangleLoaded(testId), "Rectangle not loaded initially");
        assert(!isRectangleLoading(testId), "Rectangle not loading initially");
        assert(shouldRetryRectangle(testId), "Rectangle should be retried initially");
        
        markRectangleLoading(testId);
        assert(isRectangleLoading(testId), "Rectangle marked as loading");
        assert(!isRectangleLoaded(testId), "Rectangle not loaded while loading");
        
        markRectangleLoaded(testId, { test: "data" });
        assert(!isRectangleLoading(testId), "Rectangle not loading after loaded");
        assert(isRectangleLoaded(testId), "Rectangle marked as loaded");
        
        const data = getRectangleData([testId]);
        assert(data.length === 1, "Rectangle data retrieval works");
        assert(data[0].test === "data", "Rectangle data content correct");
    }
    
    // Test 5: Rectangle failure handling
    {
        clearRectangleCache();
        const testId = "rect_52.5000_13.4000";
        
        assert(shouldRetryRectangle(testId), "Rectangle should be retried initially (first time)");
        markRectangleFailed(testId);
        assert(shouldRetryRectangle(testId), "Rectangle should be retried after first failure (time check needed)");
        
        // Simulate multiple failures
        for (let i = 0; i < 4; i++) {
            markRectangleFailed(testId);
        }
        assert(!shouldRetryRectangle(testId), "Rectangle should not be retried after max failures");
    }
    
    // Test 6: Cache statistics
    {
        clearRectangleCache();
        markRectangleLoading("rect_52.0000_13.0000");
        markRectangleLoaded("rect_52.0100_13.0100", {});
        markRectangleFailed("rect_52.0200_13.0200");
        
        const stats = getRectangleCacheStats();
        assert(stats.loading === 1, "Cache stats show correct loading count");
        assert(stats.loaded === 1, "Cache stats show correct loaded count");
        assert(stats.failed === 1, "Cache stats show correct failed count");
    }
    
    console.log(`\nTest Results: ${passed} passed, ${failed} failed`);
    return failed === 0;
}

/**
 * Test the rectangle system with a realistic map scenario
 */
function testRectangleSystemWithMap() {
    console.log("\nTesting Rectangle System with Map Scenario...");
    
    // Simulate a map view of Berlin city center
    const berlinBounds = {
        north: 52.525,
        south: 52.515,
        east: 13.405,
        west: 13.395
    };
    
    const rectangles = divideAreaIntoRectangles(berlinBounds);
    console.log(`Generated ${rectangles.length} rectangles for Berlin city center`);
    console.log("Rectangle IDs:", rectangles);
    
    // Test loading simulation
    console.log("\nSimulating data loading...");
    for (const rectId of rectangles) {
        markRectangleLoading(rectId);
        console.log(`Loading rectangle: ${rectId}`);
        
        // Simulate successful loading for most rectangles
        if (Math.random() > 0.2) {
            markRectangleLoaded(rectId, { 
                rectangleId: rectId, 
                nodeCount: Math.floor(Math.random() * 100),
                timestamp: Date.now()
            });
            console.log(`✓ Loaded rectangle: ${rectId}`);
        } else {
            markRectangleFailed(rectId);
            console.log(`✗ Failed rectangle: ${rectId}`);
        }
    }
    
    const stats = getRectangleCacheStats();
    console.log("\nFinal cache statistics:", stats);
    
    // Test data retrieval
    const loadedData = getRectangleData(rectangles);
    console.log(`Retrieved data from ${loadedData.length} rectangles`);
    
    return true;
}

// Make test functions available globally for manual testing
window.runRectangleManagerTests = runRectangleManagerTests;
window.testRectangleSystemWithMap = testRectangleSystemWithMap;