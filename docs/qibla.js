'use strict';

// =================================================================
// Qibla: retning til Kaabaen ud fra GPS-placering og telefonens kompas.
// På Android leverer appen (Java) placering og kompasretning (sand nord).
// =================================================================

const KAABA = { lat: 21.422487, lon: 39.826206 };
const qibla = {
    loc: store.get('qiblaLoc', null), // {lat, lon, acc, time}
    bearing: null,
    heading: null,
    dialAngle: 0,                     // akkumuleret vinkel for blød rotation
    active: false
};

const toRad = d => d * Math.PI / 180;
const toDeg = r => r * 180 / Math.PI;

function qiblaBearing(lat, lon) {
    const φ1 = toRad(lat), φ2 = toRad(KAABA.lat), Δλ = toRad(KAABA.lon - lon);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function distanceKm(lat, lon) {
    const R = 6371;
    const dφ = toRad(KAABA.lat - lat), dλ = toRad(KAABA.lon - lon);
    const a = Math.sin(dφ / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(KAABA.lat)) * Math.sin(dλ / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

function compassName(deg) {
    const names = ['N', 'NNØ', 'NØ', 'ØNØ', 'Ø', 'ØSØ', 'SØ', 'SSØ', 'S', 'SSV', 'SV', 'VSV', 'V', 'VNV', 'NV', 'NNV'];
    return names[Math.round(deg / 22.5) % 16];
}

function applyLocation(loc) {
    qibla.loc = loc;
    qibla.bearing = qiblaBearing(loc.lat, loc.lon);
    $('qiblaBearing').textContent = `${Math.round(qibla.bearing)}° ${compassName(qibla.bearing)}`;
    $('qiblaDistance').textContent = `${Math.round(distanceKm(loc.lat, loc.lon)).toLocaleString('da-DK')} km`;
    $('qiblaLocation').textContent = `Placering: ${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`
        + (loc.acc ? ` (±${Math.round(loc.acc)} m)` : '')
        + (loc.time ? ` · ${new Date(loc.time).toLocaleString('da-DK', { dateStyle: 'short', timeStyle: 'short' })}` : '');
    $('qiblaMarker').style.transform = `rotate(${qibla.bearing}deg)`;
    updateQiblaUi();
}

function updateQiblaUi() {
    const status = $('qiblaStatus');
    const compass = $('compass');
    if (qibla.bearing === null) return;
    if (qibla.heading === null) {
        status.textContent = `Qibla ligger ${Math.round(qibla.bearing)}° fra nord (${compassName(qibla.bearing)})`;
        compass.classList.remove('aligned');
        return;
    }
    let diff = ((qibla.bearing - qibla.heading + 540) % 360) - 180; // -180..180
    const aligned = Math.abs(diff) <= 4;
    compass.classList.toggle('aligned', aligned);
    status.textContent = aligned
        ? '✓ Du vender mod Kaabaen'
        : `Drej ${Math.abs(Math.round(diff))}° til ${diff > 0 ? 'højre ↻' : 'venstre ↺'}`;
}

// Kaldes fra Android med kompasretning i grader (sand nord) og nøjagtighed 0-3
window.__compass = function (heading, accuracy) {
    if (!qibla.active) return;
    qibla.heading = heading;
    // Drej skiven blødt (undgå hop ved 359° → 0°)
    const target = -heading;
    let delta = ((target - qibla.dialAngle + 540) % 360) - 180;
    qibla.dialAngle += delta;
    $('compassDial').style.transform = `rotate(${qibla.dialAngle}deg)`;
    $('qiblaHeading').textContent = `${Math.round(heading)}° ${compassName(heading)}`;
    $('compass').classList.toggle('uncalibrated', accuracy !== undefined && accuracy < 2);
    updateQiblaUi();
};

window.__location = function (ok, lat, lon, acc, message, code) {
    const banner = $('qiblaLocBanner');
    if (ok) {
        banner.hidden = true;
        const loc = { lat, lon, acc, time: Date.now() };
        store.set('qiblaLoc', loc);
        applyLocation(loc);
        return;
    }
    // Placering slået fra eller ingen tilladelse: vis besked med knap
    if (code === 'disabled' || code === 'permission') {
        $('qiblaLocMsg').textContent = message + (qibla.loc ? ' Indtil da bruges din sidst kendte placering.' : '');
        $('qiblaEnableBtn').textContent = code === 'disabled' ? '📍 Slå placering til' : '📍 Giv adgang til placering';
        $('qiblaEnableBtn').dataset.code = code;
        banner.hidden = false;
    }
    if (qibla.loc) {
        applyLocation(qibla.loc);
    } else {
        $('qiblaStatus').textContent = code === 'disabled' ? 'Placering er slået fra' : (message || 'Kunne ikke finde din placering');
    }
    // Spørg én gang pr. besøg på siden, om placering skal slås til
    if (code === 'disabled' && !qibla.askedEnable && currentPage === 'qibla') {
        qibla.askedEnable = true;
        askConfirm('Slå placering til?',
            'Placering (GPS) er slået fra på telefonen. Appen skal bruge din placering for at finde qibla-retningen. Tryk "Slå til" for at åbne indstillingen – appen fortsætter automatisk, når du kommer tilbage.',
            'Slå til').then(yes => { if (yes) enableLocation(); });
    }
};

function enableLocation() {
    if (window.AndroidBridge && AndroidBridge.enableLocation) AndroidBridge.enableLocation();
    else requestQiblaLocation();
}

$('qiblaEnableBtn').addEventListener('click', () => {
    if ($('qiblaEnableBtn').dataset.code === 'disabled') enableLocation();
    else requestQiblaLocation();
});

function requestQiblaLocation() {
    $('qiblaStatus').textContent = 'Finder din placering…';
    if (window.AndroidBridge && AndroidBridge.requestLocation) {
        AndroidBridge.requestLocation();
    } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            p => window.__location(true, p.coords.latitude, p.coords.longitude, p.coords.accuracy),
            e => window.__location(false, 0, 0, 0, 'Placering ikke tilgængelig: ' + e.message),
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
    } else {
        window.__location(false, 0, 0, 0, 'Placering understøttes ikke');
    }
}

function browserOrientation(e) {
    let heading = null;
    if (typeof e.webkitCompassHeading === 'number') heading = e.webkitCompassHeading;
    else if (e.absolute && typeof e.alpha === 'number') heading = (360 - e.alpha) % 360;
    if (heading !== null) window.__compass(heading, 3);
}

function startQibla(fromBackground) {
    qibla.active = true;
    if (!fromBackground) qibla.askedEnable = false;
    if (qibla.loc) applyLocation(qibla.loc);
    requestQiblaLocation();
    if (window.AndroidBridge && AndroidBridge.startCompass) {
        if (!AndroidBridge.startCompass()) {
            $('qiblaHeading').textContent = 'Intet kompas';
            toast('Telefonen har ikke et kompas – brug gradtallet');
        }
    } else if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iPhone: kompasset kræver tilladelse, og spørgsmålet skal udløses af et tryk
        const ask = () => DeviceOrientationEvent.requestPermission().then(state => {
            if (state === 'granted') {
                $('compass').removeEventListener('click', ask);
                window.addEventListener('deviceorientation', browserOrientation);
            } else {
                $('qiblaHeading').textContent = 'Ingen adgang til kompas';
            }
        }).catch(() => { $('qiblaHeading').textContent = 'Tryk på kompasset for at slå det til'; });
        $('compass').addEventListener('click', ask);
        ask();
    } else {
        window.addEventListener('deviceorientationabsolute', browserOrientation);
        window.addEventListener('deviceorientation', browserOrientation);
    }
}

function stopQibla() {
    qibla.active = false;
    if (window.AndroidBridge && AndroidBridge.stopCompass) AndroidBridge.stopCompass();
    window.removeEventListener('deviceorientationabsolute', browserOrientation);
    window.removeEventListener('deviceorientation', browserOrientation);
}

$('qiblaRetryBtn').addEventListener('click', requestQiblaLocation);
