/**
 * Performance testing and monitoring utilities
 */

// Performance measurement class
class PerformanceMonitor {
    constructor() {
        this.marks = new Map();
        this.measures = new Map();
        this.enabled = true;
    }

    mark(name) {
        if (!this.enabled) return;
        performance.mark(name);
        this.marks.set(name, performance.now());
    }

    measure(name, startMark, endMark) {
        if (!this.enabled) return;
        
        try {
            performance.measure(name, startMark, endMark);
            const measure = performance.getEntriesByName(name, 'measure')[0];
            this.measures.set(name, measure.duration);
            return measure.duration;
        } catch (e) {
            console.warn('Performance measure failed:', e);
            return null;
        }
    }

    getResults() {
        return {
            marks: Object.fromEntries(this.marks),
            measures: Object.fromEntries(this.measures),
            navigation: this.getNavigationTiming(),
            resources: this.getResourceTiming()
        };
    }

    getNavigationTiming() {
        const nav = performance.getEntriesByType('navigation')[0];
        if (!nav) return null;

        return {
            domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
            loadComplete: nav.loadEventEnd - nav.loadEventStart,
            totalLoadTime: nav.loadEventEnd - nav.fetchStart,
            domInteractive: nav.domInteractive - nav.fetchStart,
            firstPaint: this.getFirstPaint()
        };
    }

    getFirstPaint() {
        const paintEntries = performance.getEntriesByType('paint');
        const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
        return firstPaint ? firstPaint.startTime : null;
    }

    getResourceTiming() {
        const resources = performance.getEntriesByType('resource');
        return {
            totalResources: resources.length,
            totalSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
            slowestResources: resources
                .sort((a, b) => b.duration - a.duration)
                .slice(0, 5)
                .map(r => ({
                    name: r.name.split('/').pop(),
                    duration: r.duration,
                    size: r.transferSize
                }))
        };
    }

    logResults() {
        console.group('Performance Results');
        console.table(this.getResults());
        console.groupEnd();
    }
}

// Map performance monitoring
class MapPerformanceMonitor {
    constructor(map) {
        this.map = map;
        this.monitor = new PerformanceMonitor();
        this.setupMapEvents();
    }

    setupMapEvents() {
        this.monitor.mark('map-init-start');
        
        this.map.on('load', () => {
            this.monitor.mark('map-init-end');
            this.monitor.measure('map-initialization', 'map-init-start', 'map-init-end');
        });

        this.map.on('movestart', () => {
            this.monitor.mark('map-move-start');
        });

        this.map.on('moveend', () => {
            this.monitor.mark('map-move-end');
            this.monitor.measure('map-movement', 'map-move-start', 'map-move-end');
        });

        this.map.on('zoomstart', () => {
            this.monitor.mark('map-zoom-start');
        });

        this.map.on('zoomend', () => {
            this.monitor.mark('map-zoom-end');
            this.monitor.measure('map-zoom', 'map-zoom-start', 'map-zoom-end');
        });
    }

    measureDataLoad(callback) {
        this.monitor.mark('data-load-start');
        const originalCallback = callback;
        
        return (...args) => {
            this.monitor.mark('data-load-end');
            this.monitor.measure('data-loading', 'data-load-start', 'data-load-end');
            return originalCallback.apply(this, args);
        };
    }

    getMapPerformance() {
        return {
            mapMetrics: this.monitor.getResults(),
            layerCount: this.map.eachLayer ? this.getLayerCount() : 0,
            currentZoom: this.map.getZoom(),
            viewportSize: this.getViewportSize()
        };
    }

    getLayerCount() {
        let count = 0;
        this.map.eachLayer(() => count++);
        return count;
    }

    getViewportSize() {
        return {
            width: window.innerWidth,
            height: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio || 1
        };
    }
}

// Performance testing utilities
const PerformanceTests = {
    // Test script loading performance
    testScriptLoading() {
        const scripts = document.querySelectorAll('script[src]');
        const results = [];
        
        scripts.forEach(script => {
            const src = script.src;
            const resources = performance.getEntriesByName(src);
            if (resources.length > 0) {
                const resource = resources[0];
                results.push({
                    src: src.split('/').pop(),
                    duration: resource.duration,
                    size: resource.transferSize,
                    async: script.async,
                    defer: script.defer
                });
            }
        });

        return results.sort((a, b) => b.duration - a.duration);
    },

    // Test DOM performance
    testDOMPerformance() {
        const start = performance.now();
        const elements = document.querySelectorAll('*');
        const end = performance.now();

        return {
            elementCount: elements.length,
            queryTime: end - start,
            domSize: document.documentElement.outerHTML.length
        };
    },

    // Test memory usage (approximate)
    testMemoryUsage() {
        if (performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return { message: 'Memory API not available' };
    },

    // Run all performance tests
    runAllTests() {
        const results = {
            timestamp: new Date().toISOString(),
            navigation: new PerformanceMonitor().getNavigationTiming(),
            scripts: this.testScriptLoading(),
            dom: this.testDOMPerformance(),
            memory: this.testMemoryUsage(),
            userAgent: navigator.userAgent,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio || 1
            }
        };

        console.group('🚀 Performance Test Results');
        console.table(results.navigation);
        console.table(results.scripts);
        console.table(results.dom);
        console.table(results.memory);
        console.groupEnd();

        return results;
    }
};

// Global performance monitor instance
window.globalPerformanceMonitor = new PerformanceMonitor();
window.PerformanceTests = PerformanceTests;

// Auto-run basic performance tests on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => PerformanceTests.runAllTests(), 1000);
    });
} else {
    setTimeout(() => PerformanceTests.runAllTests(), 1000);
}