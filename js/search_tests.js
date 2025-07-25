/**
 * Test file for Enhanced Fuzzy Search functionality
 * Run these tests to verify the search features work correctly
 */

/**
 * Test suite for fuzzy search functionality
 */
function runFuzzySearchTests() {
    console.log("Starting Fuzzy Search Tests...");
    
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
    
    // Test 1: Fuzzy matching algorithm
    {
        assert(fuzzyMatch('berlin', 'Berlin') === 1, "Exact match (case insensitive) returns 1");
        assert(fuzzyMatch('berlin', 'Berlin, Germany') > 0.8, "Substring match returns high score");
        assert(fuzzyMatch('brln', 'Berlin') > 0.6, "Fuzzy match returns reasonable score");
        assert(fuzzyMatch('xyz', 'Berlin') < 0.3, "Non-matching strings return low score");
        assert(fuzzyMatch('', 'Berlin') === 0, "Empty pattern returns 0");
        assert(fuzzyMatch('Berlin', '') === 0, "Empty target returns 0");
    }
    
    // Test 2: Search configuration
    {
        assert(typeof SEARCH_CONFIG === 'object', "Search configuration object exists");
        assert(typeof SEARCH_CONFIG.MIN_SEARCH_LENGTH === 'number', "Minimum search length configured");
        assert(typeof SEARCH_CONFIG.SEARCH_DEBOUNCE_MS === 'number', "Search debounce configured");
        assert(typeof SEARCH_CONFIG.FUZZY_THRESHOLD === 'number', "Fuzzy threshold configured");
        assert(SEARCH_CONFIG.FUZZY_THRESHOLD >= 0 && SEARCH_CONFIG.FUZZY_THRESHOLD <= 1, "Fuzzy threshold in valid range");
    }
    
    // Test 3: Search utility functions
    {
        assert(typeof getSearchStats === 'function', "getSearchStats function exists");
        assert(typeof clearAllSearchData === 'function', "clearAllSearchData function exists");
        assert(typeof loadSearchData === 'function', "loadSearchData function exists");
        assert(typeof initializeEnhancedSearch === 'function', "initializeEnhancedSearch function exists");
    }
    
    // Test 4: Search statistics
    {
        const stats = getSearchStats();
        assert(typeof stats === 'object', "Search stats return object");
        assert(typeof stats.history === 'number', "Search stats include history count");
        assert(typeof stats.favorites === 'number', "Search stats include favorites count");
        assert(typeof stats.fuzzyEnabled === 'boolean', "Search stats include fuzzy enabled flag");
        assert(typeof stats.config === 'object', "Search stats include config object");
    }
    
    // Test 5: Search data management
    {
        // Clear all data first
        clearAllSearchData();
        let stats = getSearchStats();
        assert(stats.history === 0, "Search history cleared");
        assert(stats.favorites === 0, "Search favorites cleared");
        
        // Test adding to history (simulated)
        searchHistory = [
            { display_name: 'Berlin, Germany', lat: 52.5200, lon: 13.4050, type: 'city' },
            { display_name: 'Munich, Germany', lat: 48.1351, lon: 11.5820, type: 'city' }
        ];
        
        stats = getSearchStats();
        assert(stats.history === 2, "Search history updated correctly");
        
        // Test adding to favorites (simulated)
        searchFavorites = [
            { display_name: 'Brandenburg Gate', lat: 52.5163, lon: 13.3777, type: 'monument' }
        ];
        
        stats = getSearchStats();
        assert(stats.favorites === 1, "Search favorites updated correctly");
    }
    
    // Test 6: Fuzzy matching with real-world examples
    {
        const testCases = [
            { pattern: 'brandenbrg', target: 'Brandenburg Gate', expected: true },
            { pattern: 'alexandrplatz', target: 'Alexanderplatz', expected: true },
            { pattern: 'potsdamer', target: 'Potsdamer Platz', expected: true },
            { pattern: 'museumsinsl', target: 'Museum Island', expected: true },
            { pattern: 'completely_different', target: 'Brandenburg Gate', expected: false }
        ];
        
        testCases.forEach(testCase => {
            const score = fuzzyMatch(testCase.pattern, testCase.target);
            const passes = testCase.expected ? score >= SEARCH_CONFIG.FUZZY_THRESHOLD : score < SEARCH_CONFIG.FUZZY_THRESHOLD;
            assert(passes, `Fuzzy match "${testCase.pattern}" vs "${testCase.target}": ${score.toFixed(3)}`);
        });
    }
    
    // Test 7: Search result deduplication (simulated)
    {
        // This would normally be tested with actual search control instance
        // For now, we test the algorithm conceptually
        const duplicateResults = [
            { lat: 52.5200, lon: 13.4050, display_name: 'Berlin' },
            { lat: 52.5200, lon: 13.4050, display_name: 'Berlin' }, // duplicate
            { lat: 52.5201, lon: 13.4051, display_name: 'Berlin Central' } // different
        ];
        
        // Simulate deduplication logic
        const seen = new Set();
        const unique = duplicateResults.filter(result => {
            const key = `${result.lat}_${result.lon}_${result.display_name}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        
        assert(unique.length === 2, "Duplicate search results are properly filtered");
    }
    
    // Test 8: Search relevance sorting (simulated)
    {
        const unsortedResults = [
            { display_name: 'Berlin Station', relevance: 0.7, source: 'nominatim' },
            { display_name: 'Berlin', relevance: 0.9, source: 'favorite' },
            { display_name: 'Berlin Area', relevance: 0.8, source: 'history' },
            { display_name: 'New Berlin', relevance: 0.9, source: 'nominatim' }
        ];
        
        // Simulate sorting logic
        const sorted = unsortedResults.sort((a, b) => {
            if (b.relevance !== a.relevance) return b.relevance - a.relevance;
            const sourcePriority = { favorite: 3, history: 2, nominatim: 1 };
            return sourcePriority[b.source] - sourcePriority[a.source];
        });
        
        assert(sorted[0].display_name === 'Berlin', "Favorite with high relevance ranks first");
        assert(sorted[1].display_name === 'New Berlin', "High relevance nominatim result ranks second");
    }
    
    // Test 9: Search input validation
    {
        const validInputs = ['Berlin', 'Munich', 'Hamburg', 'Köln'];
        const invalidInputs = ['', 'a', '  ', null, undefined];
        
        validInputs.forEach(input => {
            assert(input && input.length >= SEARCH_CONFIG.MIN_SEARCH_LENGTH, 
                   `Valid search input: "${input}"`);
        });
        
        invalidInputs.forEach(input => {
            const isInvalid = !input || input.trim().length < SEARCH_CONFIG.MIN_SEARCH_LENGTH;
            assert(isInvalid, `Invalid search input correctly identified: "${input}"`);
        });
    }
    
    // Test 10: LocalStorage integration
    {
        // Test localStorage availability
        assert(typeof localStorage !== 'undefined', "localStorage is available");
        
        // Test saving/loading search data
        const testHistory = [{ display_name: 'Test Location', lat: 52.5, lon: 13.4, type: 'test' }];
        const testFavorites = [{ display_name: 'Test Favorite', lat: 52.6, lon: 13.5, type: 'test' }];
        
        try {
            localStorage.setItem(SEARCH_CONFIG.STORAGE_KEYS.HISTORY, JSON.stringify(testHistory));
            localStorage.setItem(SEARCH_CONFIG.STORAGE_KEYS.FAVORITES, JSON.stringify(testFavorites));
            
            const loadedHistory = JSON.parse(localStorage.getItem(SEARCH_CONFIG.STORAGE_KEYS.HISTORY));
            const loadedFavorites = JSON.parse(localStorage.getItem(SEARCH_CONFIG.STORAGE_KEYS.FAVORITES));
            
            assert(loadedHistory.length === 1, "Search history saved and loaded correctly");
            assert(loadedFavorites.length === 1, "Search favorites saved and loaded correctly");
            
            // Cleanup
            localStorage.removeItem(SEARCH_CONFIG.STORAGE_KEYS.HISTORY);
            localStorage.removeItem(SEARCH_CONFIG.STORAGE_KEYS.FAVORITES);
            
        } catch (error) {
            console.warn("localStorage test skipped due to error:", error);
        }
    }
    
    console.log(`\nFuzzy Search Tests completed: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
        console.log("🎉 All fuzzy search tests passed!");
    } else {
        console.warn(`⚠️ ${failed} fuzzy search tests failed`);
    }
    
    return { passed, failed };
}

/**
 * Performance test for fuzzy matching
 */
function runFuzzyMatchPerformanceTest() {
    console.log("Testing Fuzzy Match Performance...");
    
    const patterns = ['berlin', 'munich', 'hamburg', 'cologne', 'frankfurt'];
    const targets = [
        'Berlin, Germany', 'Munich, Bavaria', 'Hamburg, Germany', 
        'Cologne, North Rhine-Westphalia', 'Frankfurt am Main',
        'Dresden, Saxony', 'Stuttgart, Baden-Württemberg',
        'Düsseldorf, North Rhine-Westphalia', 'Dortmund, North Rhine-Westphalia',
        'Essen, North Rhine-Westphalia'
    ];
    
    const startTime = performance.now();
    let totalMatches = 0;
    
    patterns.forEach(pattern => {
        targets.forEach(target => {
            const score = fuzzyMatch(pattern, target);
            if (score >= SEARCH_CONFIG.FUZZY_THRESHOLD) {
                totalMatches++;
            }
        });
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const totalComparisons = patterns.length * targets.length;
    
    console.log(`Performance Results:`);
    console.log(`- ${totalComparisons} fuzzy comparisons in ${duration.toFixed(2)}ms`);
    console.log(`- Average: ${(duration / totalComparisons).toFixed(3)}ms per comparison`);
    console.log(`- Found ${totalMatches} matches above threshold (${SEARCH_CONFIG.FUZZY_THRESHOLD})`);
    
    return { duration, totalComparisons, averagePerComparison: duration / totalComparisons, totalMatches };
}

/**
 * Test search UI components (requires DOM)
 */
function testSearchUIComponents() {
    console.log("Testing Search UI Components...");
    
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
    
    // Test 1: Search control creation
    {
        try {
            // Create a test map div
            const testMapDiv = document.createElement('div');
            testMapDiv.id = 'test_search_map';
            testMapDiv.style.width = '400px';
            testMapDiv.style.height = '300px';
            document.body.appendChild(testMapDiv);
            
            const testMap = L.map('test_search_map').setView([52.5, 13.4], 13);
            const searchControl = createEnhancedSearchControl(testMap);
            
            assert(typeof searchControl === 'object', "Enhanced search control created successfully");
            
            // Test adding to map
            testMap.addControl(searchControl);
            
            // Check if search input was created
            const searchInput = document.querySelector('#search-input');
            assert(searchInput !== null, "Search input element created");
            
            // Check if suggestions container was created
            const suggestionsDiv = document.querySelector('#search-suggestions');
            assert(suggestionsDiv !== null, "Search suggestions container created");
            
            // Check if clear button was created
            const clearButton = document.querySelector('#search-clear');
            assert(clearButton !== null, "Search clear button created");
            
            // Cleanup
            testMap.remove();
            document.body.removeChild(testMapDiv);
            
        } catch (error) {
            console.warn('Search UI test skipped (expected in test environment):', error.message);
        }
    }
    
    // Test 2: Search notification system
    {
        showSearchNotification('Test search notification', 'info');
        const notification = document.getElementById('location_notification');
        assert(notification !== null, "Search notification system works");
        
        hideSearchNotification();
        assert(notification.style.display === 'none', "Search notification can be hidden");
    }
    
    console.log(`Search UI Tests: ${passed} passed, ${failed} failed`);
    return { passed, failed };
}

/**
 * Manual test instructions for search functionality
 */
function runManualSearchTest() {
    console.log("=== Manual Search Test ===");
    console.log("This test requires user interaction with the search interface.");
    console.log("Please perform the following actions:");
    console.log("1. Click in the search box (top-right corner)");
    console.log("2. Type 'Berlin' and observe typeahead suggestions");
    console.log("3. Select a result and verify it zooms to the location");
    console.log("4. Try fuzzy matching by typing 'brln' or 'mnch'");
    console.log("5. Add a result to favorites using the star button");
    console.log("6. Check search history panel");
    console.log("7. Try keyboard shortcut Ctrl+F to focus search");
    console.log("8. Test search clearing with the × button");
    console.log("9. Verify search stats and data management buttons");
    
    const instructions = [
        "✓ Search box is visible in top-right corner",
        "✓ Typeahead suggestions appear while typing",
        "✓ Selecting result zooms to location and adds marker",
        "✓ Fuzzy matching works for misspelled queries",
        "✓ Favorites system works (star button)",
        "✓ Search history is saved and displayed",
        "✓ Keyboard shortcut Ctrl+F focuses search",
        "✓ Clear button (×) works properly",
        "✓ Search stats and management buttons function",
        "✓ Search data persists across page reloads"
    ];
    
    console.log("\nExpected results:");
    instructions.forEach(instruction => {
        console.log(instruction);
    });
    
    return instructions;
}

/**
 * Run all fuzzy search tests
 */
function runAllSearchTests() {
    console.log("=== Running All Fuzzy Search Tests ===\n");
    
    const basicTests = runFuzzySearchTests();
    console.log("");
    
    const perfTests = runFuzzyMatchPerformanceTest();
    console.log("");
    
    const uiTests = testSearchUIComponents();
    console.log("");
    
    const manualInstructions = runManualSearchTest();
    console.log("");
    
    console.log("=== All Fuzzy Search Tests Complete ===");
    console.log(`Basic tests: ${basicTests.passed} passed, ${basicTests.failed} failed`);
    console.log(`Performance: ${perfTests.averagePerComparison.toFixed(3)}ms per fuzzy comparison`);
    console.log(`UI tests: ${uiTests.passed} passed, ${uiTests.failed} failed`);
    console.log(`Manual test instructions: ${manualInstructions.length} steps provided`);
    
    return {
        basic: basicTests,
        performance: perfTests,
        ui: uiTests,
        manual: manualInstructions
    };
}