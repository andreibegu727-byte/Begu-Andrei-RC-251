/**
 * UI Telemetry & State Persistence Engine
 * Autor: Begu Andrei | Expert RC-251
 * Data: 19.05.2026 | Web Storage Integration (GDPR Compliant)
 * Proiect: Tradiții Moldovenești — begu-andrei.netlify.app
 *
 * State Preservation Engineering: Web Storage Persistence validated by: Begu Andrei | 19.05.2026
 *
 * ARHITECTURA:
 *  - localStorage  -> vizite istorice (persistenta fara termen)
 *  - sessionStorage -> ora start sesiune + durata curenta (volatile per tab)
 *  - navigator.sendBeacon -> trimite payload GDPR-safe la inchiderea paginii
 *  - try/catch -> protectie anti-coruptie manuala a storage-ului
 *  - GDPR Opt-Out -> checkbox in footer sterge tot si opreste beacon-ul
 */

(function () {
  'use strict';

  /* =========================================================
     GDPR OPT-OUT CHECK — verificam inainte de orice altceva
  ========================================================= */
  const optOutEl = document.getElementById('telemetry-optout');
  const isOptedOut = localStorage.getItem('utm_gdpr_optout') === 'true';

  if (optOutEl) {
    optOutEl.checked = isOptedOut;
    optOutEl.addEventListener('change', function () {
      if (this.checked) {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('utm_gdpr_optout', 'true');
        console.log('%c[GDPR] Opt-out activat. Toate datele de telemetrie sterse.', 'color:#ef4444;font-weight:bold');
        return;
      } else {
        localStorage.removeItem('utm_gdpr_optout');
        console.log('%c[GDPR] Consimtamant acordat. Telemetria reactivata.', 'color:#4ade80;font-weight:bold');
      }
    });
  }

  // Daca utilizatorul a refuzat, oprim executia complet
  if (isOptedOut) {
    console.log('%c[TELEMETRIE] Dezactivata prin GDPR Opt-Out.', 'color:#64748b');
    return;
  }

  /* =========================================================
     1. GESTIUNEA VIZITELOR (localStorage) — cu protectie anti-coruptie
  ========================================================= */
  let visitCount;
  try {
    const raw = localStorage.getItem('utm_telemetry_visits');
    if (raw === null) {
      visitCount = 1;
    } else {
      visitCount = parseInt(raw, 10) + 1;
      // Protectie: daca parsarea esueaza (ex: utilizatorul a scris text), resetam
      if (isNaN(visitCount) || visitCount < 1) {
        throw new Error('Valoare utm_telemetry_visits invalida: ' + raw);
      }
    }
    localStorage.setItem('utm_telemetry_visits', String(visitCount));
  } catch (e) {
    console.warn('[TELEMETRIE] Storage corupt, reset la starea initiala:', e.message);
    visitCount = 1;
    try {
      localStorage.clear();
      localStorage.setItem('utm_telemetry_visits', '1');
    } catch (resetErr) {
      console.error('[TELEMETRIE] Imposibil de resetat storage-ul:', resetErr);
    }
  }

  /* =========================================================
     2. GESTIUNEA SESIUNII (sessionStorage) — ora startului
  ========================================================= */
  let sessionStartTime;
  try {
    sessionStartTime = sessionStorage.getItem('utm_session_start_time');
    if (sessionStartTime === null) {
      const now = new Date();
      // Format HH:MM:SS
      sessionStartTime = now.toTimeString().split(' ')[0];
      sessionStorage.setItem('utm_session_start_time', sessionStartTime);
    }
  } catch (e) {
    sessionStartTime = new Date().toTimeString().split(' ')[0];
    console.warn('[TELEMETRIE] sessionStorage indisponibil:', e.message);
  }

  /* =========================================================
     3. SESSION DURATION ESTIMATOR
     La descarcarea paginii calculeaza durata in secunde,
     salveaza in array istorice si afiseaza media.
     Formula: Durata(s) = OraInchiderii - OraStartSesiunii(sessionStorage)
  ========================================================= */
  window.addEventListener('beforeunload', function () {
    try {
      const startStr = sessionStorage.getItem('utm_session_start_time');
      if (!startStr) return;

      // Convertim HH:MM:SS la milisecunde de la miezul noptii
      const parts = startStr.split(':').map(Number);
      const startMs = (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
      const nowMs = new Date().getHours() * 3600000
                  + new Date().getMinutes() * 60000
                  + new Date().getSeconds() * 1000;
      const durationSec = Math.max(0, Math.round((nowMs - startMs) / 1000));

      // Salvam in array de istorice
      let durations = [];
      try {
        durations = JSON.parse(localStorage.getItem('utm_session_durations') || '[]');
        if (!Array.isArray(durations)) durations = [];
      } catch (_) { durations = []; }

      durations.push(durationSec);
      // Pastram ultimele 50 de sesiuni pentru a nu umple storage-ul
      if (durations.length > 50) durations = durations.slice(-50);

      localStorage.setItem('utm_session_durations', JSON.stringify(durations));

      const avg = (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1);
      console.log(
        '%c[TELEMETRIE] Sesiune inchisa | Durata: %c' + durationSec + 's' +
        '%c | Media istorica: %c' + avg + 's',
        'color:#94a3b8', 'color:#38bdf8;font-weight:bold',
        'color:#94a3b8', 'color:#4ade80;font-weight:bold'
      );
    } catch (e) {
      console.warn('[TELEMETRIE] Eroare calcul durata sesiune:', e.message);
    }
  });

  /* =========================================================
     4. PAYLOAD COMPLET DE TELEMETRIE
  ========================================================= */
  const telemetryPayload = {
    appId: typeof __app_id !== 'undefined' ? __app_id : 'RC251-UTM-TRADITII-MOLDOVENESTI',
    timestamp: new Date().toISOString(),
    userProfile: {
      historicalVisits: visitCount,
      sessionStartedAt: sessionStartTime,
      isNewUser: visitCount === 1,
    },
    environment: {
      screenResolution: window.screen.width + 'x' + window.screen.height,
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform || 'unknown',
    },
    performance: (function () {
      try {
        const nav = performance.getEntriesByType('navigation')[0];
        if (!nav) return null;
        return {
          // Durata totala de incarcare
          loadTime: Math.round(nav.loadEventEnd - nav.startTime),
          // Time to First Byte
          ttfb: Math.round(nav.responseStart - nav.requestStart),
          // DOM Content Loaded
          dcl: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
        };
      } catch (_) { return null; }
    })(),
  };

  /* =========================================================
     5. LOG FORMATAT IN CONSOLA (dovada de functionare pentru SS30)
  ========================================================= */
  console.group('%c[TELEMETRIE PERSISTENTA ACTIVE]', 'color:#00f2ff;font-weight:bold;font-size:11px;');
  console.log(
    '%cUtilizatorul se afla la vizita: %c' + visitCount,
    'color:#ffffff;', 'color:#00ff66;font-weight:bold;font-size:13px;'
  );
  console.log(
    '%cSesiunea curenta a inceput la ora: %c' + sessionStartTime,
    'color:#ffffff;', 'color:#ffcc00;font-weight:bold;'
  );
  console.log(
    '%cUtilizator nou: %c' + (visitCount === 1 ? 'DA' : 'NU'),
    'color:#ffffff;', 'color:#a78bfa;font-weight:bold;'
  );
  console.log('Payload complet trimis la Beacon:', telemetryPayload);
  console.groupEnd();

  /* =========================================================
     6. EXPEDIERE SECURE BEACON (non-blocking, la inchidere)
  ========================================================= */
  if (navigator.sendBeacon) {
    try {
      navigator.sendBeacon(
        'https://analytics.rc251.utm.md/api/telemetry',
        JSON.stringify(telemetryPayload)
      );
    } catch (e) {
      console.warn('[TELEMETRIE] sendBeacon esuat:', e.message);
    }
  } else {
    // Fallback pentru browsere fara sendBeacon (< 2015)
    console.warn('[TELEMETRIE] sendBeacon indisponibil. Payload logat local.');
  }

})();
