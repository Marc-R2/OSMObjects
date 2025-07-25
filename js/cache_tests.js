/**
 * Test file for localStorage caching functionality
 * Run these tests to verify the persistent caching system works correctly
 */

/**
 * Test suite for localStorage caching
 */
function runLocalStorageCacheTests() {
    console.log("Starting localStorage Cache Tests...");
    
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
    
    // Clear cache before tests
    clearLocalStorageCache();
    
    // Test 1: Save and load data
    {
        const testRectId = "rect_52.5000_13.4000";
        const testData = {
            elements: [
                { type: "node", id: 1, lat: 52.5001, lon: 13.4001, tags: { highway: "street_lamp" } }
            ]
        };
        
        saveToLocalStorageCache(testRectId, testData);
        const loadedData = loadFromLocalStorageCache(testRectId);
        
        assert(loadedData !== null, "Data successfully saved and loaded from localStorage");
        assert(JSON.stringify(loadedData) === JSON.stringify(testData), "Loaded data matches saved data");
        assert(isInLocalStorageCache(testRectId), "Rectangle correctly identified as cached");
    }
    
    // Test 2: Cache expiry
    {
        const testRectId = "rect_52.5100_13.4100";
        const testData = { elements: [] };
        
        // Manually create an expired cache entry
        const expiredEntry = {
            rectangleId: testRectId,
            data: testData,
            timestamp: Date.now() - CACHE_CONFIG.CACHE_EXPIRY_MS - 1000, // Expired
            size: 100
        };
        
        const key = CACHE_CONFIG.CACHE_KEY_PREFIX + testRectId;
        localStorage.setItem(key, JSON.stringify(expiredEntry));
        
        const loadedData = loadFromLocalStorageCache(testRectId);
        assert(loadedData === null, "Expired cache entry correctly removed");
        assert(!isInLocalStorageCache(testRectId), "Expired rectangle not identified as cached");
    }
    
    // Test 3: Cache statistics
    {
        const stats = getLocalStorageCacheStats();
        assert(typeof stats.count === 'number', "Cache stats include count");
        assert(typeof stats.sizeMB === 'string', "Cache stats include size in MB");
        assert(typeof stats.sizeBytes === 'number', "Cache stats include size in bytes");
        assert(stats.maxSizeMB === CACHE_CONFIG.MAX_CACHE_SIZE_MB, "Cache stats show correct max size");
    }
    
    // Test 4: Cache size calculation
    {
        const smallData = { elements: [] };
        const largeData = { elements: new Array(1000).fill({ type: "node", id: 1, lat: 52.5, lon: 13.4 }) };
        
        const smallSize = calculateDataSize(smallData);
        const largeSize = calculateDataSize(largeData);
        
        assert(largeSize > smallSize, "Larger data has larger calculated size");
        assert(smallSize > 0, "Small data has positive size");
    }
    
    // Test 5: Integration with rectangle loading
    {
        const testRectId = "rect_52.5200_13.4200";
        const testData = {
            elements: [
                { type: "node", id: 2, lat: 52.5201, lon: 13.4201, tags: { amenity: "bench" } }
            ]
        };
        
        // Save directly to localStorage
        saveToLocalStorageCache(testRectId, testData);
        
        // Test that isRectangleLoaded now finds it
        const isLoaded = isRectangleLoaded(testRectId);
        assert(isLoaded, "Rectangle correctly identified as loaded from localStorage");
        
        // Test that it's now in memory cache too
        const memoryData = loadedRectangles.get(testRectId);
        assert(memoryData !== undefined, "Rectangle data loaded into memory cache");
        assert(memoryData.status === 'loaded', "Rectangle status set to loaded");
    }
    
    // Test 6: Cache metadata management
    {
        const metadata = getCacheMetadata();
        assert(typeof metadata.entries === 'object', "Cache metadata has entries object");
        assert(typeof metadata.totalSize === 'number', "Cache metadata has total size");
        assert(typeof metadata.created === 'number', "Cache metadata has creation timestamp");
    }
    
    // Test 7: Clear all caches
    {
        clearRectangleCache(); // Should clear both memory and localStorage
        const stats = getLocalStorageCacheStats();
        assert(stats.count === 0, "All localStorage cache entries cleared");
        assert(loadedRectangles.size === 0, "All memory cache entries cleared");
    }
    
    console.log(`\nLocalStorage Cache Tests completed: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
        console.log("🎉 All localStorage cache tests passed!");
    } else {
        console.warn(`⚠️ ${failed} localStorage cache tests failed`);
    }
    
    return { passed, failed };
}

/**
 * Performance test for cache operations
 */
function runCachePerformanceTests() {
    console.log("Starting Cache Performance Tests...");
    
    const testData = {
        elements: new Array(100).fill(null).map((_, i) => ({
            type: "node",
            id: i,
            lat: 52.5 + (i * 0.001),
            lon: 13.4 + (i * 0.001),
            tags: { highway: "street_lamp", ref: `lamp_${i}` }
        }))
    };
    
    // Test save performance
    const saveStart = performance.now();
    for (let i = 0; i < 10; i++) {
        saveToLocalStorageCache(`rect_52.${5000 + i}_13.4000`, testData);
    }
    const saveTime = performance.now() - saveStart;
    
    // Test load performance
    const loadStart = performance.now();
    for (let i = 0; i < 10; i++) {
        loadFromLocalStorageCache(`rect_52.${5000 + i}_13.4000`);
    }
    const loadTime = performance.now() - loadStart;
    
    console.log(`Cache Performance Results:`);
    console.log(`- Save 10 rectangles: ${saveTime.toFixed(2)}ms (${(saveTime/10).toFixed(2)}ms per rectangle)`);
    console.log(`- Load 10 rectangles: ${loadTime.toFixed(2)}ms (${(loadTime/10).toFixed(2)}ms per rectangle)`);
    
    // Cleanup
    clearLocalStorageCache();
    
    return { saveTime, loadTime };
}

/**
 * Test cache size management
 */
function testCacheSizeManagement() {
    console.log("Testing Cache Size Management...");
    
    clearLocalStorageCache();
    
    // Create large test data
    const largeData = {
        elements: new Array(1000).fill(null).map((_, i) => ({
            type: "node",
            id: i,
            lat: 52.5 + (i * 0.0001),
            lon: 13.4 + (i * 0.0001),
            tags: { 
                highway: "street_lamp", 
                ref: `lamp_${i}`,
                description: `This is a very long description for lamp ${i} to increase data size for cache management testing purposes. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`
            }
        }))
    };
    
    // Fill cache with multiple large entries
    const numEntries = 20;
    for (let i = 0; i < numEntries; i++) {
        saveToLocalStorageCache(`rect_52.${5000 + i}_13.4000`, largeData);
    }
    
    const stats = getLocalStorageCacheStats();
    console.log(`Created ${numEntries} cache entries, total size: ${stats.sizeMB}MB`);
    
    // Force cache size management
    manageCacheSize();
    
    const statsAfter = getLocalStorageCacheStats();
    console.log(`After cache management: ${statsAfter.count} entries, ${statsAfter.sizeMB}MB`);
    
    clearLocalStorageCache();
    
    return { beforeCount: stats.count, afterCount: statsAfter.count };
}

/**
 * Run all cache tests
 */
function runAllCacheTests() {
    console.log("=== Running All Cache Tests ===\n");
    
    const basicTests = runLocalStorageCacheTests();
    console.log("");
    
    const perfTests = runCachePerformanceTests();
    console.log("");
    
    const sizeTests = testCacheSizeManagement();
    console.log("");
    
    console.log("=== All Cache Tests Complete ===");
    console.log(`Basic tests: ${basicTests.passed} passed, ${basicTests.failed} failed`);
    console.log(`Performance: Save ${perfTests.saveTime.toFixed(2)}ms, Load ${perfTests.loadTime.toFixed(2)}ms`);
    console.log(`Size management: ${sizeTests.beforeCount} -> ${sizeTests.afterCount} entries`);
    
    return {
        basic: basicTests,
        performance: perfTests,
        sizeManagement: sizeTests
    };
}