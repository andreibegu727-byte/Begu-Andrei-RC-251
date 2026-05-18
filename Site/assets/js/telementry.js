/**
 * UI Telemetry Engine & Performance Monitor
 * Autor: Nume Prenume | Expert RC 251
 * Data: 15.05.2026 | No-Dependency GDPR Beacon
 */

(function() {
    'use strict';

    // Inițializarea obiectului de telemetrie
    const telemetryData = {
        appId: typeof __app_id !== 'undefined' ? __app_id : 'RC251-UTM-PORTFOLIO',
        timestamp: new Date().toISOString(),
        environment: {
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            viewportSize: `${window.innerWidth}x${window.innerHeight}`,
            devicePixelRatio: window.devicePixelRatio,
            hardwareConcurrency: navigator.hardwareConcurrency || 'N/A', // Cores CPU
            deviceMemory: navigator.deviceMemory || 'N/A', // Memorie RAM în GB
            networkType: navigator.connection ? navigator.connection.effectiveType : 'unknown'
        },
        performanceMetrics: {}
    };

    // Funcția de colectare a metricilor din API-ul Performance al browserului
    function collectPerformanceMetrics() {
        if (!window.performance || !window.performance.getEntriesByType) return;

        // Metricile de Navigație (Timp de încărcare DOM, TTFB etc.)
        const navEntries = window.performance.getEntriesByType('navigation');
        if (navEntries.length > 0) {
            const timing = navEntries[0];
            telemetryData.performanceMetrics.dnsTime = timing.domainLookupEnd - timing.domainLookupStart;
            telemetryData.performanceMetrics.tcpHandshake = timing.connectEnd - timing.connectStart;
            telemetryData.performanceMetrics.ttfb = timing.responseStart - timing.requestStart; // Time to First Byte
            telemetryData.performanceMetrics.domInteractive = timing.domInteractive;
            telemetryData.performanceMetrics.loadEvent = timing.loadEventEnd - timing.loadEventStart;
        }

        // Metricile de Randare (First Paint, First Contentful Paint)
        const paintEntries = window.performance.getEntriesByType('paint');
        paintEntries.forEach((entry) => {
            if (entry.name === 'first-paint') {
                telemetryData.performanceMetrics.firstPaint = entry.startTime;
            } else if (entry.name === 'first-contentful-paint') {
                telemetryData.performanceMetrics.firstContentfulPaint = entry.startTime;
            }
        });

        dispatchTelemetry();
    }

    // Trimiterea datelor folosind navigator.sendBeacon
    function dispatchTelemetry() {
        const payload = JSON.stringify(telemetryData);
        const endpoint = "[https://analytics.rc251.utm.md/api/telemetry](https://analytics.rc251.utm.md/api/telemetry)"; // URL-ul simulat al serverului UTM

        console.log("%c[TELEMETRIE ACTIVE] Structură JSON trimisă:", "color: #00f2ff; font-weight: bold;", telemetryData);

        // Verificăm suportul pentru sendBeacon în browser
        if (navigator.sendBeacon) {
            navigator.sendBeacon(endpoint, payload);
        } else {
            // Fallback în cazul în care sendBeacon nu este suportat (browsere legacy)
            const xhr = new XMLHttpRequest();
            xhr.open("POST", endpoint, true);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.send(payload);
        }
    }

    // Rulăm colectarea metricilor după terminarea completă a evenimentului de încărcare (Load)
    window.addEventListener('load', function() {
        // Un mic delay pentru a permite finalizarea calculelor de sistem
        setTimeout(collectPerformanceMetrics, 500);
    });

})();

