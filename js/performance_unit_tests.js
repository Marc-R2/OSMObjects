/**
 * Unit tests for performance optimizations
 */

// Test suite for performance optimizations
class PerformanceTestSuite {
    constructor() {
        this.tests = [];
        this.results = [];
    }

    addTest(name, testFunction) {
        this.tests.push({ name, testFunction });
    }

    async runAllTests() {
        console.group('🧪 Performance Optimization Tests');
        
        for (const test of this.tests) {
            try {
                const startTime = performance.now();
                const result = await test.testFunction();
                const duration = performance.now() - startTime;
                
                this.results.push({
                    name: test.name,
                    passed: result.passed,
                    message: result.message,
                    duration: duration,
                    details: result.details
                });
                
                console.log(`${result.passed ? '✅' : '❌'} ${test.name}: ${result.message} (${duration.toFixed(2)}ms)`);
                if (result.details) {
                    console.log('  Details:', result.details);
                }
            } catch (error) {
                this.results.push({
                    name: test.name,
                    passed: false,
                    message: `Test failed: ${error.message}`,
                    duration: 0
                });
                console.log(`❌ ${test.name}: Test failed - ${error.message}`);
            }
        }
        
        console.groupEnd();
        return this.results;
    }

    getReport() {
        const passed = this.results.filter(r => r.passed).length;
        const total = this.results.length;
        
        return {
            summary: `${passed}/${total} tests passed`,
            passed,
            total,
            results: this.results
        };
    }
}

// Initialize test suite
const perfTestSuite = new PerformanceTestSuite();

// Test 1: Script loading optimization
perfTestSuite.addTest('Script Loading Order', () => {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const deferredScripts = scripts.filter(s => s.defer);
    const nonDeferredScripts = scripts.filter(s => !s.defer && !s.async);
    
    // Critical scripts should load first without defer
    const criticalScripts = ['settings.js', 'jquery-1.12.4.min.js', 'leaflet.js'];
    const criticalLoaded = criticalScripts.every(name => 
        nonDeferredScripts.some(s => s.src.includes(name))
    );
    
    return {
        passed: criticalLoaded && deferredScripts.length > 0,
        message: criticalLoaded ? 'Critical scripts load first, non-critical deferred' : 'Script loading order needs optimization',
        details: {
            totalScripts: scripts.length,
            deferredScripts: deferredScripts.length,
            criticalLoaded
        }
    };
});

// Test 2: CSS preloading
perfTestSuite.addTest('CSS Preloading', () => {
    // Check for links that have as="style" attribute (indicating they were preloaded)
    const preloadedCSS = Array.from(document.querySelectorAll('link[rel="stylesheet"][as="style"]'));
    const totalCSS = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    
    return {
        passed: preloadedCSS.length > 0,
        message: preloadedCSS.length > 0 ? 'CSS preloading implemented and working' : 'No CSS preloading found',
        details: {
            preloadedCSS: preloadedCSS.length,
            totalCSS: totalCSS.length,
            preloadedFiles: preloadedCSS.map(l => l.href.split('/').pop())
        }
    };
});

// Test 3: Map performance options
perfTestSuite.addTest('Map Performance Configuration', () => {
    if (!window.map) {
        return {
            passed: false,
            message: 'Map not initialized'
        };
    }
    
    const hasCanvas = map.options.preferCanvas;
    const updateIdle = map.options.updateWhenIdle;
    const hasKeepBuffer = map.eachLayer ? (() => {
        let hasBuffer = false;
        map.eachLayer(layer => {
            if (layer.options && layer.options.keepBuffer) {
                hasBuffer = true;
            }
        });
        return hasBuffer;
    })() : false;
    
    return {
        passed: hasCanvas && updateIdle,
        message: 'Map performance options configured',
        details: {
            preferCanvas: hasCanvas,
            updateWhenIdle: updateIdle,
            hasKeepBuffer
        }
    };
});

// Test 4: Performance monitoring availability
perfTestSuite.addTest('Performance Monitoring', () => {
    const hasGlobalMonitor = typeof window.globalPerformanceMonitor !== 'undefined';
    const hasPerformanceTests = typeof window.PerformanceTests !== 'undefined';
    const hasMapMonitor = typeof window.MapPerformanceMonitor !== 'undefined';
    
    return {
        passed: hasGlobalMonitor && hasPerformanceTests,
        message: 'Performance monitoring tools available',
        details: {
            hasGlobalMonitor,
            hasPerformanceTests,
            hasMapMonitor
        }
    };
});

// Test 5: Mobile optimizations
perfTestSuite.addTest('Mobile Viewport Configuration', () => {
    const viewport = document.querySelector('meta[name="viewport"]');
    const content = viewport ? viewport.getAttribute('content') : '';
    
    const hasDeviceWidth = content.includes('width=device-width');
    const hasInitialScale = content.includes('initial-scale=1.0');
    const hasMaxScale = content.includes('maximum-scale=');
    const hasUserScalable = content.includes('user-scalable=no');
    
    return {
        passed: hasDeviceWidth && hasInitialScale,
        message: 'Mobile viewport configured',
        details: {
            hasDeviceWidth,
            hasInitialScale,
            hasMaxScale,
            hasUserScalable,
            content
        }
    };
});

// Test 6: Event throttling
perfTestSuite.addTest('Event Throttling', () => {
    // Check if throttled functions exist
    const hasThrottle = typeof window.throttle !== 'undefined' || 
                       document.body.innerHTML.includes('throttle');
    
    return {
        passed: hasThrottle,
        message: hasThrottle ? 'Event throttling implemented' : 'No event throttling found',
        details: {
            hasThrottleFunction: typeof window.throttle !== 'undefined'
        }
    };
});

// Test 7: Memory usage check
perfTestSuite.addTest('Memory Usage', () => {
    if (!performance.memory) {
        return {
            passed: true,
            message: 'Memory API not available (normal on some browsers)'
        };
    }
    
    const usedMB = performance.memory.usedJSHeapSize / (1024 * 1024);
    const limitMB = performance.memory.jsHeapSizeLimit / (1024 * 1024);
    const usage = (usedMB / limitMB) * 100;
    
    return {
        passed: usage < 50, // Less than 50% memory usage is good
        message: `Memory usage: ${usedMB.toFixed(1)}MB (${usage.toFixed(1)}%)`,
        details: {
            usedMB: usedMB.toFixed(1),
            limitMB: limitMB.toFixed(1),
            usagePercent: usage.toFixed(1)
        }
    };
});

// Test 8: Load time performance
perfTestSuite.addTest('Load Time Performance', () => {
    const navigation = performance.getEntriesByType('navigation')[0];
    if (!navigation) {
        return {
            passed: false,
            message: 'Navigation timing not available'
        };
    }
    
    const loadTime = navigation.loadEventEnd - navigation.fetchStart;
    const domReady = navigation.domContentLoadedEventEnd - navigation.fetchStart;
    
    return {
        passed: loadTime < 300, // Less than 300ms is excellent
        message: `Total load time: ${loadTime.toFixed(0)}ms, DOM ready: ${domReady.toFixed(0)}ms`,
        details: {
            loadTime: loadTime.toFixed(0),
            domReady: domReady.toFixed(0),
            rating: loadTime < 200 ? 'Excellent' : loadTime < 500 ? 'Good' : 'Needs improvement'
        }
    };
});

// Export for global access
window.PerformanceTestSuite = PerformanceTestSuite;
window.perfTestSuite = perfTestSuite;

// Auto-run tests when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            perfTestSuite.runAllTests().then(results => {
                console.log('📊 Performance Test Report:', perfTestSuite.getReport());
            });
        }, 2000); // Wait for app initialization
    });
} else {
    setTimeout(() => {
        perfTestSuite.runAllTests().then(results => {
            console.log('📊 Performance Test Report:', perfTestSuite.getReport());
        });
    }, 2000);
}