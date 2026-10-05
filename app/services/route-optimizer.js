import Service, { inject as service } from '@ember/service';

import { configuredCoordinate, correctStreetName } from '../utils/address-lookup-config';

const GOOGLE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const GOOGLE_MAPS_API_KEY = 'AIzaSyAQnddZ7O-hoZay6MKFu57o66N_2C0L76E';

const PHONES_API_URL = 'https://route-flow-details-api.netlify.app/api/contacts';
//'https://script.google.com/macros/s/AKfycbyOY9LggM1CLWXtG-VfSP1XZdCZTw8GavQgQTuAq0GNPvq9crHxAYdg8jxWs-J3-SFp/exec';

const MAX_ADDRESSES = 26;
const MAX_POINTS_PER_MAPS_URL = 9;
const MAX_APPLE_STOPS_PER_URL = 14;
const OUTLIER_MIN_NEAREST_KM = 5;
const OUTLIER_MULTIPLIER = 4;
const EARTH_RADIUS_KM = 6371.0088;

export class RouteOptimizerError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'RouteOptimizerError';
        this.details = details;
    }
}

/**
 * Ember service that geocodes Polonne addresses through Visicom and sends one
 * optimized route request directly from the browser to Google Routes API.
 *
 * Register as app/services/route-optimizer.js, inject with:
 *   @service('route-optimizer') routeOptimizer;
 */
export default class RouteOptimizerService extends Service {
    @service('visicom-geocoder') visicomGeocoder;
    @service('current-location') currentLocation;
    @service('address-phones') addressPhones;
    @service('app-settings') appSettings;

    googleMapsApiKey = GOOGLE_MAPS_API_KEY;
    addressRepairer = null;
    phoneApiUrl = PHONES_API_URL;

    /**
     * Call once from an initializer, route, controller, or component.
     * addressRepairer is optional and may return up to three corrected strings.
     */
    configure({ googleMapsApiKey, visicomApiKey, addressRepairer = null, phoneApiUrl = PHONES_API_URL } = {}) {
        this.googleMapsApiKey = googleMapsApiKey ?? this.googleMapsApiKey;
        if (visicomApiKey) this.visicomGeocoder.configure({ apiKey: visicomApiKey });
        this.phoneApiUrl = phoneApiUrl ?? this.phoneApiUrl;
        if (phoneApiUrl) this.addressPhones.configure({ apiUrl: phoneApiUrl });
        this.addressRepairer = addressRepairer;
        return this;
    }

    /**
     * @param {object} options
     * @param {string[]|string} options.addresses Array or newline-separated text.
     * @param {[number, number]|string} [options.origin] [lat, lng] or "lat,lng".
     * @param {string} [options.googleMapsApiKey] Overrides configured key.
     * @param {string} [options.visicomApiKey] Key for /feature by Visicom link.
     * @param {object} [options.resolutions] Choices indexed by input row.
     * @param {Array} [options.resolvedPoints] Points from prior missing-address result.
     * @param {Object<string, string>|Map<string, string>} [options.corrections]
     * @param {Function} [options.addressRepairer] Async candidate provider.
     */
    async buildRoute({
        addresses,
        origin,
        googleMapsApiKey = this.googleMapsApiKey,
        visicomApiKey = this.visicomApiKey,
        phoneApiUrl = this.phoneApiUrl,
        corrections = {},
        addressRepairer = this.addressRepairer,
        resolutions = {},
        resolvedPoints = [],
    }) {
        visicomApiKey = this.appSettings.visicomApiKey || visicomApiKey;
        const originalAddresses = normalizeAddresses(addresses);
        const entries = originalAddresses.flatMap((originalAddress, index) => {
            const choice = resolutions[index];
            if (choice?.type === 'remove') return [];
            const address = choice?.type === 'rename' ? String(choice.address ?? '').trim() : originalAddress;
            return [
                {
                    index,
                    address,
                    queryAddress: correctStreetName(
                        choice?.type === 'rename' ? address : getCorrection(corrections, address) ?? address
                    ),
                    linkUrl: choice?.type === 'link' ? choice.url : null,
                },
            ];
        });
        if (entries.some((entry) => !entry.address)) {
            throw new RouteOptimizerError('Введіть нову назву для кожної зміненої вулиці.');
        }
        if (!entries.length) {
            throw new RouteOptimizerError('Додайте хоча б одну адресу до маршруту.');
        }

        const knownPoints = new Map(resolvedPoints.map(({ index, point }) => [index, point]));
        const pointsByIndex = new Map();
        const unprocessed = entries.filter((entry) => {
            const coordinate = configuredCoordinate(entry.address) ?? configuredCoordinate(entry.queryAddress);
            if (coordinate) {
                pointsByIndex.set(entry.index, {
                    index: entry.index,
                    address: entry.address,
                    queryAddress: entry.queryAddress,
                    coordinate,
                    vizcomId: null,
                    coordinateSource: 'config',
                });
                return false;
            }
            const point = knownPoints.get(entry.index);
            if (
                point &&
                point.address === entry.address &&
                point.queryAddress === entry.queryAddress &&
                (point.sourceLink ?? null) === (entry.linkUrl ?? null) &&
                isCoordinate(point.coordinate)
            ) {
                pointsByIndex.set(entry.index, point);
                return false;
            }
            return true;
        });
        const toGeocode = unprocessed.filter((entry) => !entry.linkUrl);
        const geocoded = toGeocode.length ? await this.#geocodeEntries(toGeocode) : { points: [], missingEntries: [] };
        for (const point of geocoded.points) pointsByIndex.set(point.index, point);
        let missingEntries = [...geocoded.missingEntries];
        for (const entry of unprocessed.filter((item) => item.linkUrl)) {
            try {
                pointsByIndex.set(entry.index, await this.#pointFromLink(entry, visicomApiKey));
            } catch (error) {
                missingEntries.push({ ...entry, reason: error.message });
            }
        }

        let points = entries.flatMap((entry) =>
            pointsByIndex.has(entry.index) ? [pointsByIndex.get(entry.index)] : []
        );
        let outliers = findOutliers(points);
        const appliedCorrections = entries
            .filter((entry) => entry.address !== entry.queryAddress)
            .map(({ address, queryAddress }) => ({ address, queryAddress }));

        if ((missingEntries.length > 0 || outliers.length > 0) && addressRepairer) {
            const repaired = await this.#repairSuspects({
                entries,
                points,
                missingEntries,
                outliers,
                addressRepairer,
                visicomApiKey,
            });

            if (repaired.length > 0) {
                for (const correction of repaired) {
                    const existing = appliedCorrections.find((item) => item.address === correction.address);
                    if (existing) existing.queryAddress = correction.queryAddress;
                    else appliedCorrections.push(correction);
                }
                const repairedEntries = entries.filter((entry) => repaired.some((item) => item.index === entry.index));
                const refreshed = await this.#geocodeEntries(repairedEntries);
                for (const point of refreshed.points) pointsByIndex.set(point.index, point);
                missingEntries = missingEntries.filter((entry) => !repaired.some((item) => item.index === entry.index));
                missingEntries.push(...refreshed.missingEntries);
                points = entries.flatMap((entry) =>
                    pointsByIndex.has(entry.index) ? [pointsByIndex.get(entry.index)] : []
                );
                outliers = findOutliers(points);
            }
        }

        if (missingEntries.length > 0) {
            throw new RouteOptimizerError(
                'Не вдалося знайти координати для деяких адрес. Оберіть дію для кожної з них.',
                {
                    missingEntries: missingEntries.map(({ index, address, reason }) => ({
                        index,
                        address,
                        reason: reason ?? null,
                    })),
                    resolvedPoints: [...pointsByIndex.entries()].map(([index, point]) => ({ index, point })),
                }
            );
        }

        if (outliers.length > 0) {
            throw new RouteOptimizerError('Знайдено адреси з підозріло віддаленими координатами.', {
                outlierAddresses: outliers,
            });
        }

        let phoneLookupWarning = null;
        const isLoadAdditional = this.appSettings.spreadsheetId && this.appSettings.loadAdditionalInfo;
        if (isLoadAdditional && (phoneApiUrl?.trim() || this.addressPhones.hasApiUrl)) {
            try {
                const phoneResults = await this.addressPhones.lookup(
                    points.map((point) => point.address),
                    { apiUrl: phoneApiUrl || undefined, spreadsheetId: this.appSettings.spreadsheetId }
                );
                points = attachPhones(points, phoneResults);
            } catch (error) {
                phoneLookupWarning = error?.message ?? 'Не вдалося отримати телефони за адресами.';
                points = attachPhones(points, []);
            }
        } else {
            points = attachPhones(points, []);
        }

        const originPoint = hasOrigin(origin) ? parseOrigin(origin) : await this.currentLocation.getOrigin({ points });

        if (!googleMapsApiKey?.trim()) {
            throw new RouteOptimizerError('Не налаштовано GOOGLE_MAPS_API_KEY.');
        }

        const destinationIndex = chooseDestinationIndex(originPoint, points);
        const optimized = await this.#optimizeForDestination({
            origin: originPoint,
            stops: points,
            destinationIndex,
            apiKey: googleMapsApiKey.trim(),
        });
        const routeParts = splitRouteParts(optimized.points);

        return {
            inputAddresses: entries.map((entry) => entry.address),
            orderedStops: optimized.points,
            distanceMeters: optimized.distanceMeters,
            duration: optimized.duration,
            durationSeconds: parseDurationSeconds(optimized.duration),
            routeParts,
            googleMapsUrls: routeParts.map((part) => part.googleMapsUrl),
            appleMapsUrls: routeParts.map((part) => part.appleMapsUrl),
            appliedCorrections,
            phoneLookupWarning,
        };
    }

    async #geocodeEntries(entries, apiKey) {
        const items = await this.visicomGeocoder.search(
            entries.map((entry) => entry.queryAddress),
            { apiKey }
        );
        const byAddress = new Map();

        for (const item of items) {
            if (item && typeof item === 'object' && typeof item.address === 'string') {
                byAddress.set(item.address.trim(), item);
            }
        }

        const points = [];
        const missingEntries = [];
        for (const entry of entries) {
            const match = byAddress.get(entry.queryAddress);
            if (!isCoordinate(match?.coordinate)) {
                missingEntries.push({ ...entry, reason: match?.error ?? null });
            } else {
                points.push({
                    index: entry.index,
                    address: entry.address,
                    queryAddress: entry.queryAddress,
                    coordinate: match.coordinate,
                    vizcomId: match.vizcomId ?? null,
                });
            }
        }
        return { points, missingEntries };
    }

    async #pointFromLink(entry, apiKey) {
        const vizcomId = parseVisicomId(entry.linkUrl);
        let info;
        try {
            info = await this.visicomGeocoder.getFeatureById(vizcomId, { apiKey });
        } catch (error) {
            throw new RouteOptimizerError(error?.message ?? 'Не вдалося отримати точку за посиланням Visicom.');
        }
        return {
            index: entry.index,
            address: entry.address,
            queryAddress: entry.queryAddress,
            coordinate: info.coordinate,
            vizcomId,
            sourceLink: entry.linkUrl,
        };
    }

    async #repairSuspects({ entries, points, missingEntries, outliers, addressRepairer }) {
        if (typeof addressRepairer !== 'function') return [];

        const outlierAddresses = new Set(outliers.map((point) => point.address));
        const suspects = entries.filter(
            (entry) => !entry.linkUrl && (missingEntries.includes(entry) || outlierAddresses.has(entry.address))
        );
        const repaired = [];

        for (const entry of suspects) {
            const reason = missingEntries.includes(entry) ? 'missing' : 'outlier';
            const candidates = await addressRepairer({
                address: entry.address,
                queryAddress: entry.queryAddress,
                reason,
                points,
            });
            const uniqueCandidates = [...new Set(candidates ?? [])]
                .map((candidate) => String(candidate).trim())
                .filter((candidate) => candidate && candidate !== entry.queryAddress)
                .slice(0, 3);

            for (const candidate of uniqueCandidates) {
                const testEntry = { address: entry.address, queryAddress: candidate };
                const testResult = await this.#geocodeEntries([testEntry]);
                const candidatePoint = testResult.points[0];
                if (!candidatePoint) continue;

                const peers = points.filter((point) => point.address !== entry.address);
                if (!pointFitsCluster(candidatePoint, peers)) continue;

                entry.queryAddress = candidate;
                repaired.push({ index: entry.index, address: entry.address, queryAddress: candidate });
                break;
            }
        }

        return repaired;
    }

    async #optimizeForDestination({ origin, stops, destinationIndex, apiKey }) {
        const destination = stops[destinationIndex];
        const intermediates = stops.filter((_, index) => index !== destinationIndex);
        const shouldOptimize = intermediates.length > 1;
        const payload = await fetchJson(
            GOOGLE_ROUTES_URL,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask':
                        'routes.optimizedIntermediateWaypointIndex,' + 'routes.distanceMeters,routes.duration',
                },
                body: JSON.stringify({
                    origin: googleWaypoint(origin),
                    destination: googleWaypoint(destination),
                    intermediates: intermediates.map(googleWaypoint),
                    travelMode: 'DRIVE',
                    routingPreference: 'TRAFFIC_AWARE',
                    optimizeWaypointOrder: true,
                    languageCode: 'uk',
                    regionCode: 'ua',
                    units: 'METRIC',
                }),
            },
            'Google Routes API'
        );

        const route = payload?.routes?.[0];
        if (!route) {
            throw new RouteOptimizerError(`Google Routes API не повернув маршрут: ${JSON.stringify(payload)}`);
        }

        const order = shouldOptimize
            ? route.optimizedIntermediateWaypointIndex ?? []
            : intermediates.map((_, index) => index);
        const expectedOrder = intermediates.map((_, index) => index);
        const sortedOrder = Array.isArray(order) ? [...order].sort((a, b) => a - b) : [];
        console.log(JSON.stringify(sortedOrder), JSON.stringify(expectedOrder));
        if (JSON.stringify(sortedOrder) !== JSON.stringify(expectedOrder)) {
            throw new RouteOptimizerError(`Google Routes API повернув некоректний порядок: ${JSON.stringify(order)}`);
        }

        return {
            points: [origin, ...order.map((index) => intermediates[index]), destination],
            distanceMeters: route.distanceMeters,
            duration: route.duration,
        };
    }
}

async function fetchJson(url, options, service) {
    let response;
    try {
        response = await fetch(url, options);
    } catch (error) {
        throw new RouteOptimizerError(`Не вдалося виконати браузерний запит до ${service}. Перевірте CORS і мережу.`, {
            cause: error.message,
        });
    }

    const responseText = await response.text();
    if (!response.ok) {
        throw new RouteOptimizerError(`${service} повернув HTTP ${response.status}: ${responseText}`, {
            status: response.status,
        });
    }
    try {
        return JSON.parse(responseText);
    } catch (error) {
        throw new RouteOptimizerError(`${service} повернув некоректний JSON.`, { cause: error.message, responseText });
    }
}

function normalizeAddresses(value) {
    const addresses = (Array.isArray(value) ? value : String(value ?? '').split(/\r?\n/u))
        .map((address) => String(address).trim())
        .filter(Boolean);
    if (addresses.length === 0) {
        throw new RouteOptimizerError('Для маршруту потрібно щонайменше одну адресу.');
    }
    if (addresses.length > MAX_ADDRESSES) {
        throw new RouteOptimizerError(`Дозволено не більше ${MAX_ADDRESSES} адрес в одному маршруті.`);
    }
    return addresses;
}

function getCorrection(corrections, address) {
    return corrections instanceof Map ? corrections.get(address) : corrections?.[address];
}

export function parseVisicomId(value) {
    let url;
    try {
        url = new URL(String(value ?? '').trim());
    } catch {
        throw new RouteOptimizerError('Введіть посилання на точку Visicom.');
    }
    const match = /^\/i\/([A-Za-z0-9_-]+)\/?$/u.exec(url.pathname);
    if (
        url.protocol !== 'https:' ||
        url.hostname !== 'maps.visicom.ua' ||
        url.port ||
        url.username ||
        url.password ||
        !match
    ) {
        throw new RouteOptimizerError('Формат посилання: https://maps.visicom.ua/i/ID?lang=uk');
    }
    return match[1];
}

function hasOrigin(value) {
    return value !== undefined && value !== null && value !== '';
}

function parseOrigin(value) {
    const coordinate = Array.isArray(value)
        ? value.map(Number)
        : String(value)
              .split(',')
              .map((part) => Number(part.trim()));
    if (!isCoordinate(coordinate)) {
        throw new RouteOptimizerError(
            'Поточне місцеположення має бути у форматі [latitude, longitude] або "latitude,longitude".'
        );
    }
    const [latitude, longitude] = coordinate;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new RouteOptimizerError('Координати поточного місцеположення виходять за допустимі межі.');
    }
    return { address: 'Поточне місцеположення', coordinate };
}

function isCoordinate(value) {
    return (
        Array.isArray(value) &&
        value.length === 2 &&
        value.every((item) => typeof item === 'number' && Number.isFinite(item))
    );
}

function googleWaypoint(point) {
    const [latitude, longitude] = point.coordinate;
    return { location: { latLng: { latitude, longitude } } };
}

function straightLineDistance(first, second) {
    const [firstLatitude, firstLongitude] = first.coordinate;
    const [secondLatitude, secondLongitude] = second.coordinate;
    const latitudeDelta = degreesToRadians(secondLatitude - firstLatitude);
    const longitudeDelta = degreesToRadians(secondLongitude - firstLongitude);
    const firstLatitudeRadians = degreesToRadians(firstLatitude);
    const secondLatitudeRadians = degreesToRadians(secondLatitude);
    const haversine =
        Math.sin(latitudeDelta / 2) ** 2 +
        Math.cos(firstLatitudeRadians) * Math.cos(secondLatitudeRadians) * Math.sin(longitudeDelta / 2) ** 2;
    return 2 * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function degreesToRadians(value) {
    return (value * Math.PI) / 180;
}

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function nearestDistanceKm(point, peers) {
    return Math.min(...peers.map((peer) => straightLineDistance(point, peer) * EARTH_RADIUS_KM));
}

function findOutliers(stops) {
    if (stops.length < 3) return [];
    const nearestDistances = stops.map((point, index) =>
        nearestDistanceKm(
            point,
            stops.filter((_, otherIndex) => otherIndex !== index)
        )
    );
    const thresholdKm = Math.max(OUTLIER_MIN_NEAREST_KM, median(nearestDistances) * OUTLIER_MULTIPLIER);
    return stops.flatMap((stop, index) =>
        stop.coordinateSource !== 'config' && nearestDistances[index] > thresholdKm
            ? [
                  {
                      address: stop.address,
                      queryAddress: stop.queryAddress,
                      coordinate: stop.coordinate,
                      nearestDistanceKm: Number(nearestDistances[index].toFixed(2)),
                  },
              ]
            : []
    );
}

function pointFitsCluster(point, peers) {
    if (peers.length < 2) return true;
    const peerNearestDistances = peers.map((peer, index) =>
        nearestDistanceKm(
            peer,
            peers.filter((_, otherIndex) => otherIndex !== index)
        )
    );
    const thresholdKm = Math.max(OUTLIER_MIN_NEAREST_KM, median(peerNearestDistances) * OUTLIER_MULTIPLIER);
    return nearestDistanceKm(point, peers) <= thresholdKm;
}

function chooseDestinationIndex(origin, stops) {
    let destinationIndex = 0;
    for (let index = 1; index < stops.length; index += 1) {
        if (straightLineDistance(origin, stops[index]) > straightLineDistance(origin, stops[destinationIndex])) {
            destinationIndex = index;
        }
    }
    return destinationIndex;
}

function coordinateText(point) {
    return point.coordinate.join(',');
}

function mapsUrl(points) {
    const params = new URLSearchParams({
        api: '1',
        origin: coordinateText(points[0]),
        destination: coordinateText(points.at(-1)),
        travelmode: 'driving',
    });
    if (points.length > 2) {
        params.set('waypoints', points.slice(1, -1).map(coordinateText).join('|'));
    }
    return `https://www.google.com/maps/dir/?${params}`;
}

function splitRouteParts(points) {
    const parts = [];
    let start = 0;
    while (start < points.length - 1) {
        const end = Math.min(start + MAX_POINTS_PER_MAPS_URL, points.length);
        const chunk = points.slice(start, end);
        parts.push({
            stops: chunk.slice(1),
            googleMapsUrl: mapsUrl(chunk),
            appleMapsUrl: appleMapsUrl(chunk),
        });
        start = end - 1;
    }
    return parts;
}

function splitAppleRouteParts(points) {
    const parts = [];
    let start = 0;
    while (start < points.length - 1) {
        const end = Math.min(start + MAX_APPLE_STOPS_PER_URL + 1, points.length);
        const chunk = points.slice(start, end);
        parts.push({ stops: chunk.slice(1), appleMapsUrl: appleMapsUrl(chunk) });
        start = end - 1;
    }
    return parts;
}

function parseDurationSeconds(duration) {
    const match = /^(\d+(?:\.\d+)?)s$/u.exec(duration ?? '');
    return match ? Number(match[1]) : null;
}

function normalizePhoneAddress(value) {
    return String(value ?? '')
        .trim()
        .toLocaleLowerCase('uk-UA')
        .replace(/\s+/gu, ' ');
}

function attachPhones(points, results) {
    const infoByAddress = new Map((results ?? []).map((item) => [normalizePhoneAddress(item?.address), item]));

    return points.map((point) => {
        const info = infoByAddress.get(normalizePhoneAddress(point.address));

        return {
            ...point,
            phones: Array.isArray(info?.phones) ? info.phones : [],
            blacklisted: info?.blacklisted === true,
            blacklistReason:
                typeof info?.blacklistReason === 'string' && info.blacklistReason.trim()
                    ? info.blacklistReason.trim()
                    : null,
            blacklistMatches: Array.isArray(info?.blacklistMatches) ? info.blacklistMatches : [],
        };
    });
}

function appleMapsUrl(points) {
    const url = new URL('https://maps.apple.com/directions');
    //url.searchParams.set('source', coordinateText(points[0]));
    url.searchParams.set('destination', coordinateText(points.at(-1)));
    for (const waypoint of points.slice(1, -1)) {
        url.searchParams.append('waypoint', coordinateText(waypoint));
    }
    url.searchParams.set('mode', 'driving');
    return url.toString();
}

export { appleMapsUrl, findOutliers, normalizeAddresses, parseOrigin, splitRouteParts, splitAppleRouteParts };
