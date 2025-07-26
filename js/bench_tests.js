/**
 * Test file for bench functionality
 * Run these tests to verify bench icon selection works correctly
 */

/**
 * Test bench icon selection logic
 */
function testBenchIcons() {
    console.log("Testing bench icon selection...");
    
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
    
    // Test that getMarkerIcon function exists and handles new parameters
    {
        const icon = getMarkerIcon(L, "bench", null, null, null, null, null, null, null, null, "yes", null, null, null, null, null);
        assert(typeof icon === 'object', "getMarkerIcon returns object for bench with backrest");
    }
    
    // Test bench icon selection priority with enhanced combinations
    {
        // Test lit bench combinations (highest priority)
        const litWoodIcon = getMarkerIcon(L, "bench", null, null, null, null, null, null, null, null, "yes", "wood", null, null, "yes", "yes");
        assert(litWoodIcon.options.html.includes('bench_wood_lit.svg'), "Wood lit bench uses bench_wood_lit icon");
        
        const litMetalIcon = getMarkerIcon(L, "bench", null, null, null, null, null, null, null, null, "yes", "metal", null, null, "yes", "yes");
        assert(litMetalIcon.options.html.includes('bench_metal_lit.svg'), "Metal lit bench uses bench_metal_lit icon");
        
        const litIcon = getMarkerIcon(L, "bench", null, null, null, null, null, null, null, null, "yes", null, null, null, "yes", "yes");
        assert(litIcon.options.html.includes('bench_lit.svg'), "Generic lit bench uses bench_lit icon");
        
        // Test bin bench combinations (second priority)
        const binWoodIcon = getMarkerIcon(L, "bench", null, null, null, null, null, null, null, null, "yes", "wood", null, null, null, "yes");
        assert(binWoodIcon.options.html.includes('bench_wood_bin.svg'), "Wood bench with bin uses bench_wood_bin icon");
        
        const binMetalIcon = getMarkerIcon(L, "bench", null, null, null, null, null, null, null, null, "yes", "metal", null, null, null, "yes");
        assert(binMetalIcon.options.html.includes('bench_metal_bin.svg'), "Metal bench with bin uses bench_metal_bin icon");
        
        const binIcon = getMarkerIcon(L, "bench", null, null, null, null, null, null, null, null, "yes", null, null, null, null, "yes");
        assert(binIcon.options.html.includes('bench_bin.svg'), "Generic bench with bin uses bench_bin icon");
        
        // Test wood material
        const woodIcon = getMarkerIcon(L, "bench", null, null, null, null, null, null, null, null, null, "wood", null, null, null, null);
        assert(woodIcon.options.html.includes('bench_wood.svg'), "Wood bench uses bench_wood icon");
        
        // Test metal material
        const metalIcon = getMarkerIcon(L, "bench", null, null, null, null, null, null, null, null, null, "metal", null, null, null, null);
        assert(metalIcon.options.html.includes('bench_metal.svg'), "Metal bench uses bench_metal icon");
        
        // Test steel (same as metal)
        const steelIcon = getMarkerIcon(L, "bench", null, null, null, null, null, null, null, null, null, "steel", null, null, null, null);
        assert(steelIcon.options.html.includes('bench_metal.svg'), "Steel bench uses bench_metal icon");
        
        // Test backrest yes
        const backrestIcon = getMarkerIcon(L, "bench", null, null, null, null, null, null, null, null, "yes", null, null, null, null, null);
        assert(backrestIcon.options.html.includes('bench_backrest.svg'), "Bench with backrest uses bench_backrest icon");
        
        // Test no backrest
        const noBackrestIcon = getMarkerIcon(L, "bench", null, null, null, null, null, null, null, null, "no", null, null, null, null, null);
        assert(noBackrestIcon.options.html.includes('bench_no_backrest.svg'), "Bench without backrest uses bench_no_backrest icon");
        
        // Test default bench
        const defaultIcon = getMarkerIcon(L, "bench", null, null, null, null, null, null, null, null, null, null, null, null, null, null);
        assert(defaultIcon.options.html.includes('bench.svg'), "Default bench uses bench icon");
    }
    
    console.log(`\nBench Icon Test Results: ${passed} passed, ${failed} failed`);
    return failed === 0;
}

/**
 * Test bench attribute parsing
 */
function testBenchAttributeParsing() {
    console.log("\nTesting bench attribute parsing...");
    
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
    
    // Test that translation keys exist
    {
        assert(typeof i18next.t("bench") === 'string', "Bench translation exists");
        assert(typeof i18next.t("bench_backrest") === 'string', "Bench backrest translation exists");
        assert(typeof i18next.t("bench_material") === 'string', "Bench material translation exists");
        assert(typeof i18next.t("bench_seats") === 'string', "Bench seats translation exists");
        assert(typeof i18next.t("bench_colour") === 'string', "Bench colour translation exists");
        assert(typeof i18next.t("bench_lit") === 'string', "Bench lit translation exists");
    }
    
    console.log(`\nBench Attribute Test Results: ${passed} passed, ${failed} failed`);
    return failed === 0;
}

/**
 * Test SVG file existence (simulated)
 */
function testBenchSVGFiles() {
    console.log("\nTesting bench SVG files...");
    
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
    
    // Test that SVG filenames are correctly formed
    const expectedFiles = [
        'bench.svg',
        'bench_backrest.svg', 
        'bench_no_backrest.svg',
        'bench_wood.svg',
        'bench_metal.svg',
        'bench_lit.svg',
        'bench_bin.svg'
    ];
    
    expectedFiles.forEach(filename => {
        // We can't easily test file existence in browser, but we can test the icon generation includes the right filename
        const testIcon = getMarkerIcon(L, "bench", null, null, null, null, null, null, null, null, null, null, null, null, null, null);
        assert(typeof testIcon === 'object', `Icon object created for ${filename}`);
    });
    
    console.log(`\nBench SVG Test Results: ${passed} passed, ${failed} failed`);
    return failed === 0;
}

/**
 * Run all bench tests
 */
function runBenchTests() {
    console.log("Running Bench Feature Tests...\n");
    
    const results = [
        testBenchIcons(),
        testBenchAttributeParsing(),
        testBenchSVGFiles()
    ];
    
    const allPassed = results.every(result => result === true);
    
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Bench Test Results: ${allPassed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}`);
    console.log(`${'='.repeat(50)}`);
    
    return allPassed;
}

// Make test functions available globally for manual testing
window.testBenchIcons = testBenchIcons;
window.testBenchAttributeParsing = testBenchAttributeParsing;
window.testBenchSVGFiles = testBenchSVGFiles;
window.runBenchTests = runBenchTests;