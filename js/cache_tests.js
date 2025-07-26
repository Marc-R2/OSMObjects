/**
 * Test file for Cache Manager functionality
 * Run these tests to verify the caching system works correctly
 */

/**
 * Test suite for cache manager
 */
function runCacheManagerTests() {
    console.log("Starting Cache Manager Tests...");
    
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
    
    // Clear cache before testing
    if (window.CacheManager) {
        window.CacheManager.clearCache();
    }
    
    // Test 1: Cache Manager availability
    {
        assert(typeof window.CacheManager === 'object', "Cache Manager is available globally");
        assert(typeof window.CacheManager.getCachedData === 'function', "getCachedData function exists");
        assert(typeof window.CacheManager.setCachedData === 'function', "setCachedData function exists");
        assert(typeof window.CacheManager.isCached === 'function', "isCached function exists");
        assert(typeof window.CacheManager.getCacheStats === 'function', "getCacheStats function exists");
        assert(typeof window.CacheManager.clearCache === 'function', "clearCache function exists");
    }
    
    // Test 2: Basic cache operations
    {
        const testRectId = "rect_52.5000_13.4000";
        const testData = {
            test: "data",
            nodes: [
                { id: 1, lat: 52.5, lon: 13.4, tags: { highway: "street_lamp" } },
                { id: 2, lat: 52.501, lon: 13.401, tags: { highway: "street_lamp" } }
            ]
        };
        
        // Initially should not be cached
        assert(!window.CacheManager.isCached(testRectId), "Rectangle not cached initially");
        assert(window.CacheManager.getCachedData(testRectId) === null, "getCachedData returns null for non-cached data");
        
        // Store data in cache
        const cacheSuccess = window.CacheManager.setCachedData(testRectId, testData, false);
        assert(cacheSuccess, "Data stored successfully in cache");
        
        // Should now be cached
        assert(window.CacheManager.isCached(testRectId), "Rectangle is cached after storing");
        
        // Retrieve cached data
        const cachedData = window.CacheManager.getCachedData(testRectId);
        assert(cachedData !== null, "getCachedData returns non-null for cached data");
        assert(cachedData.test === "data", "Cached data content is correct");
        assert(cachedData.nodes.length === 2, "Cached data structure is preserved");
    }
    
    // Test 3: Low zoom cache separation
    {
        const testRectId = "rect_52.5100_13.4100";
        const highZoomData = { type: "high_zoom", nodes: [1, 2, 3] };
        const lowZoomData = { type: "low_zoom", nodes: [1] };
        
        // Store different data for high and low zoom
        window.CacheManager.setCachedData(testRectId, highZoomData, false);
        window.CacheManager.setCachedData(testRectId, lowZoomData, true);
        
        // Verify they are stored separately
        const highZoomCached = window.CacheManager.getCachedData(testRectId, false);
        const lowZoomCached = window.CacheManager.getCachedData(testRectId, true);
        
        assert(highZoomCached.type === "high_zoom", "High zoom data cached correctly");
        assert(lowZoomCached.type === "low_zoom", "Low zoom data cached correctly");
        assert(highZoomCached.nodes.length === 3, "High zoom data has correct content");
        assert(lowZoomCached.nodes.length === 1, "Low zoom data has correct content");
    }
    
    // Test 4: Cache statistics
    {
        const stats = window.CacheManager.getCacheStats();
        
        assert(typeof stats === 'object', "Cache stats returns object");
        assert(typeof stats.entries === 'number', "Stats include entry count");
        assert(typeof stats.totalSize === 'number', "Stats include total size");
        assert(typeof stats.totalSizeKB === 'number', "Stats include size in KB");
        assert(stats.entries >= 2, "Stats show correct number of entries (at least 2 from previous tests)");
        assert(stats.totalSize > 0, "Stats show non-zero total size");
        assert(stats.ttlHours === 24, "Stats show correct TTL hours");
    }
    
    // Test 5: Cache key generation and collision avoidance
    {
        const rectId1 = "rect_52.5000_13.4000";
        const rectId2 = "rect_52.5000_13.4001";
        const data1 = { id: 1 };
        const data2 = { id: 2 };
        
        window.CacheManager.setCachedData(rectId1, data1, false);
        window.CacheManager.setCachedData(rectId2, data2, false);
        
        const cached1 = window.CacheManager.getCachedData(rectId1);
        const cached2 = window.CacheManager.getCachedData(rectId2);
        
        assert(cached1.id === 1, "First rectangle data correct");
        assert(cached2.id === 2, "Second rectangle data correct");
        assert(cached1.id !== cached2.id, "Different rectangles have different cached data");
    }
    
    // Test 6: Large data caching
    {
        const largeData = {
            nodes: [],
            ways: []
        };
        
        // Generate large dataset
        for (let i = 0; i < 100; i++) {
            largeData.nodes.push({
                id: i,
                lat: 52.5 + (i * 0.001),
                lon: 13.4 + (i * 0.001),
                tags: { highway: "street_lamp", ref: `lamp_${i}` }
            });
        }
        
        for (let i = 0; i < 50; i++) {
            largeData.ways.push({
                id: 1000 + i,
                nodes: [i, i + 1, i + 2],
                tags: { highway: "residential", lit: "yes" }
            });
        }
        
        const largeRectId = "rect_52.5200_13.4200";
        const success = window.CacheManager.setCachedData(largeRectId, largeData, false);
        
        assert(success, "Large data cached successfully");
        
        const retrievedLargeData = window.CacheManager.getCachedData(largeRectId);
        assert(retrievedLargeData !== null, "Large data retrieved successfully");
        assert(retrievedLargeData.nodes.length === 100, "Large data nodes preserved");
        assert(retrievedLargeData.ways.length === 50, "Large data ways preserved");
    }
    
    // Test 7: Cache clearing
    {
        const beforeClearStats = window.CacheManager.getCacheStats();
        assert(beforeClearStats.entries > 0, "Cache has entries before clearing");
        
        const clearedCount = window.CacheManager.clearCache();
        assert(clearedCount > 0, "clearCache returns number of cleared entries");
        
        const afterClearStats = window.CacheManager.getCacheStats();
        assert(afterClearStats.entries === 0, "Cache is empty after clearing");
        
        // Verify specific entries are gone
        assert(!window.CacheManager.isCached("rect_52.5000_13.4000"), "Specific entry cleared");
        assert(window.CacheManager.getCachedData("rect_52.5200_13.4200") === null, "Large data entry cleared");
    }
    
    console.log(`\nCache Manager Test Results: ${passed} passed, ${failed} failed`);
    return failed === 0;
}

/**
 * Test TTL (Time To Live) functionality
 * Note: This test modifies internal cache timestamps for testing
 */
function testCacheTTL() {
    console.log("\nTesting Cache TTL Functionality...");
    
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
    
    // Clear cache first
    window.CacheManager.clearCache();
    
    // Test 1: Fresh cache entry
    {
        const testRectId = "rect_52.5000_13.4000";
        const testData = { fresh: true };
        
        window.CacheManager.setCachedData(testRectId, testData);
        
        assert(window.CacheManager.isCached(testRectId), "Fresh cache entry is available");
        
        const cachedData = window.CacheManager.getCachedData(testRectId);
        assert(cachedData.fresh === true, "Fresh cache data is correct");
    }
    
    // Test 2: Simulate expired cache entry
    // Note: This is a simplified test - in a real scenario, we'd wait 24 hours or modify system time
    {
        const expiredRectId = "rect_52.5100_13.4100";
        const expiredData = { expired: true };
        
        // Store data normally first
        window.CacheManager.setCachedData(expiredRectId, expiredData);
        assert(window.CacheManager.isCached(expiredRectId), "Data cached before expiration simulation");
        
        // Manually manipulate localStorage to simulate expired entry
        if (typeof localStorage !== 'undefined') {
            const cacheKey = `osm_cache_v1.0_${expiredRectId}`;
            const currentEntry = localStorage.getItem(cacheKey);
            if (currentEntry) {
                try {
                    const parsed = JSON.parse(currentEntry);
                    // Set timestamp to 25 hours ago (beyond 24h TTL)
                    parsed.timestamp = Date.now() - (25 * 60 * 60 * 1000);
                    localStorage.setItem(cacheKey, JSON.stringify(parsed));
                    
                    // Now check if it's treated as expired
                    assert(!window.CacheManager.isCached(expiredRectId), "Expired cache entry is not available");
                    assert(window.CacheManager.getCachedData(expiredRectId) === null, "Expired cache returns null");
                } catch (e) {
                    console.warn("Could not simulate expired cache entry:", e);
                }
            }
        }
    }
    
    // Test 3: Cache cleanup of old entries
    {
        // Create several cache entries with different ages
        const testData = { cleanup: true };
        
        for (let i = 0; i < 5; i++) {
            const rectId = `rect_52.52${i}0_13.42${i}0`;
            window.CacheManager.setCachedData(rectId, testData);
        }
        
        const beforeCleanup = window.CacheManager.getCacheStats();
        assert(beforeCleanup.entries >= 5, "Multiple entries created for cleanup test");
        
        // Simulate some old entries by manipulating timestamps
        if (typeof localStorage !== 'undefined') {
            const cacheKey = `osm_cache_v1.0_rect_52.5200_13.4200`;
            const entry = localStorage.getItem(cacheKey);
            if (entry) {
                try {
                    const parsed = JSON.parse(entry);
                    parsed.timestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
                    localStorage.setItem(cacheKey, JSON.stringify(parsed));
                } catch (e) {
                    console.warn("Could not manipulate cache timestamp:", e);
                }
            }
        }
        
        const cleanedCount = window.CacheManager.cleanOldCacheEntries(10);
        assert(cleanedCount >= 0, "Cache cleanup runs without error");
        
        const afterCleanup = window.CacheManager.getCacheStats();
        assert(afterCleanup.oldEntries === 0, "No old entries remain after cleanup");
    }
    
    console.log(`\nCache TTL Test Results: ${passed} passed, ${failed} failed`);
    return failed === 0;
}

/**
 * Test cache integration with rectangle system
 */
function testCacheIntegration() {
    console.log("\nTesting Cache Integration with Rectangle System...");
    
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
    
    // Clear both caches
    window.CacheManager.clearCache();
    if (typeof clearRectangleCache === 'function') {
        clearRectangleCache();
    }
    
    // Test 1: Rectangle cache and persistent cache interaction
    {
        const testRectId = "rect_52.5000_13.4000";
        const testData = {
            osm: {
                version: "0.6",
                nodes: [
                    { id: 1, lat: 52.5, lon: 13.4, tags: { highway: "street_lamp" } }
                ]
            }
        };
        
        // Simulate caching API response
        window.CacheManager.setCachedData(testRectId.replace('rect_', ''), testData, false);
        
        assert(window.CacheManager.isCached(testRectId.replace('rect_', '')), "Data cached in persistent cache");
        
        // Verify cache can be retrieved
        const cachedData = window.CacheManager.getCachedData(testRectId.replace('rect_', ''));
        assert(cachedData !== null, "Cached data can be retrieved");
        assert(cachedData.osm.nodes.length === 1, "Cached OSM data structure preserved");
    }
    
    // Test 2: Cache key format consistency
    {
        const rectangleId = "rect_52.5100_13.4100";
        const lowZoomId = rectangleId + "_lowzoom";
        
        // Test that cache keys work with both formats
        const testData1 = { type: "high" };
        const testData2 = { type: "low" };
        
        // Store using base ID (without rect_ prefix)
        const baseId = rectangleId.replace('rect_', '');
        window.CacheManager.setCachedData(baseId, testData1, false);
        window.CacheManager.setCachedData(baseId, testData2, true);
        
        // Verify both can be retrieved
        const highZoomData = window.CacheManager.getCachedData(baseId, false);
        const lowZoomData = window.CacheManager.getCachedData(baseId, true);
        
        assert(highZoomData.type === "high", "High zoom data cached with base ID");
        assert(lowZoomData.type === "low", "Low zoom data cached with base ID");
    }
    
    // Test 3: Cache statistics reflect integration
    {
        const stats = window.CacheManager.getCacheStats();
        assert(stats.entries >= 3, "Cache stats show integrated entries");
        
        const cachedIds = window.CacheManager.getCachedRectangleIds();
        assert(Array.isArray(cachedIds), "getCachedRectangleIds returns array");
        assert(cachedIds.length >= 2, "Multiple rectangle IDs cached");
        
        // Check format of returned IDs
        const hasLowZoom = cachedIds.some(id => id.includes('_lowzoom'));
        const hasHighZoom = cachedIds.some(id => !id.includes('_lowzoom'));
        
        assert(hasLowZoom, "Low zoom rectangle IDs included");
        assert(hasHighZoom, "High zoom rectangle IDs included");
    }
    
    console.log(`\nCache Integration Test Results: ${passed} passed, ${failed} failed`);
    return failed === 0;
}

/**
 * Test cache performance and limitations
 */
function testCachePerformance() {
    console.log("\nTesting Cache Performance and Limitations...");
    
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
    
    // Clear cache first
    window.CacheManager.clearCache();
    
    // Test 1: Multiple rapid cache operations
    {
        const startTime = performance.now();
        
        for (let i = 0; i < 50; i++) {
            const rectId = `52.5${i.toString().padStart(3, '0')}_13.4${i.toString().padStart(3, '0')}`;
            const data = { 
                id: i, 
                timestamp: Date.now(),
                nodes: Array.from({length: 10}, (_, j) => ({id: i * 10 + j, lat: 52.5 + j * 0.001, lon: 13.4 + j * 0.001}))
            };
            
            window.CacheManager.setCachedData(rectId, data);
        }
        
        const cacheTime = performance.now() - startTime;
        console.log(`Cached 50 entries in ${cacheTime.toFixed(2)}ms`);
        
        const stats = window.CacheManager.getCacheStats();
        assert(stats.entries === 50, "All 50 entries cached successfully");
        assert(cacheTime < 1000, "Caching completed in reasonable time (< 1 second)");
    }
    
    // Test 2: Rapid cache retrieval
    {
        const startTime = performance.now();
        let retrievedCount = 0;
        
        for (let i = 0; i < 50; i++) {
            const rectId = `52.5${i.toString().padStart(3, '0')}_13.4${i.toString().padStart(3, '0')}`;
            const data = window.CacheManager.getCachedData(rectId);
            if (data && data.id === i) {
                retrievedCount++;
            }
        }
        
        const retrievalTime = performance.now() - startTime;
        console.log(`Retrieved 50 entries in ${retrievalTime.toFixed(2)}ms`);
        
        assert(retrievedCount === 50, "All 50 entries retrieved successfully");
        assert(retrievalTime < 500, "Retrieval completed in reasonable time (< 0.5 seconds)");
    }
    
    // Test 3: Cache size monitoring
    {
        const stats = window.CacheManager.getCacheStats();
        console.log(`Current cache: ${stats.entries} entries, ${stats.totalSizeKB}KB`);
        
        assert(stats.totalSizeKB > 0, "Cache size calculation working");
        assert(stats.totalSizeKB < 10000, "Cache size is reasonable (< 10MB)");
        
        const maxEntries = 1000; // From CACHE_CONFIG.MAX_ENTRIES
        assert(stats.maxEntries === maxEntries, "Max entries setting reported correctly");
    }
    
    console.log(`\nCache Performance Test Results: ${passed} passed, ${failed} failed`);
    return failed === 0;
}

/**
 * Run all cache tests
 */
function runAllCacheTests() {
    console.log("Running All Cache Manager Tests...\n");
    
    const results = [
        runCacheManagerTests(),
        testCacheTTL(),
        testCacheIntegration(),
        testCachePerformance()
    ];
    
    const allPassed = results.every(result => result === true);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Overall Cache Test Results: ${allPassed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}`);
    console.log(`${'='.repeat(60)}`);
    
    // Show final cache stats
    if (window.CacheManager) {
        const finalStats = window.CacheManager.getCacheStats();
        console.log('Final Cache Statistics:', finalStats);
    }
    
    return allPassed;
}

// Make test functions available globally
window.runCacheManagerTests = runCacheManagerTests;
window.testCacheTTL = testCacheTTL;
window.testCacheIntegration = testCacheIntegration;
window.testCachePerformance = testCachePerformance;
window.runAllCacheTests = runAllCacheTests;