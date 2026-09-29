import Service from '@ember/service';

export const DEFAULT_VISICOM_API_KEY = 'ed30e7dd088c1979245f0d8a40e44706';
export const VISICOM_GEOCODE_URL =
  'https://api.visicom.ua/data-api/5.0/uk/geocode.json';
export const VISICOM_FEATURE_URL =
  'https://api.visicom.ua/data-api/5.0/uk/feature/';

export class VisicomGeocoderError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'VisicomGeocoderError';
    this.details = details;
  }
}

export default class VisicomGeocoderService extends Service {
  apiKey = DEFAULT_VISICOM_API_KEY;
  settlement = 'Полонне';

  configure({ apiKey, settlement } = {}) {
    this.apiKey = apiKey?.trim() || this.apiKey;
    this.settlement = settlement?.trim() || this.settlement;
    return this;
  }

  /**
   * Searches every address independently. A failed address does not prevent
   * successful results for the other addresses.
   */
  async search(addresses, { apiKey = this.apiKey } = {}) {
    const effectiveApiKey = apiKey?.trim() || this.apiKey;
    const normalized = (Array.isArray(addresses) ? addresses : [addresses])
      .map((address) => String(address ?? '').trim())
      .filter(Boolean);

    return Promise.all(
      normalized.map(async (address) => {
        try {
          const info = await this.getVisicomInfo(address, {
            apiKey: effectiveApiKey,
          });
          return {
            address,
            vizcomId: info.id,
            coordinate: info.coordinate,
          };
        } catch (error) {
          return {
            address,
            coordinate: null,
            error: error?.message ?? 'Не вдалося знайти адресу.',
          };
        }
      }),
    );
  }

  async getVisicomInfo(address, { apiKey = this.apiKey } = {}) {
    const normalizedAddress = String(address ?? '').trim();
    if (!normalizedAddress) {
      throw new VisicomGeocoderError('Не вказано адресу.');
    }

    const url = new URL(VISICOM_GEOCODE_URL);
    url.searchParams.set('categories', 'adr_address');
    url.searchParams.set('text', `${this.settlement}, ${normalizedAddress}`);
    url.searchParams.set('limit', '10');
    url.searchParams.set('key', requireApiKey(apiKey?.trim() || this.apiKey));

    const data = await fetchJson(url, 'Visicom Geocode API');
    const feature = firstFeature(data);
    return pointFromFeature(feature);
  }

  async getFeatureById(vizcomId, { apiKey = this.apiKey } = {}) {
    const id = String(vizcomId ?? '').trim();
    if (!id) throw new VisicomGeocoderError('Не вказано ID точки Visicom.');

    const url = new URL(
      `${VISICOM_FEATURE_URL}${encodeURIComponent(id)}.json`,
    );
    url.searchParams.set('key', requireApiKey(apiKey?.trim() || this.apiKey));
    const feature = await fetchJson(url, 'Visicom Feature API');
    return pointFromFeature(feature);
  }
}

function requireApiKey(value) {
  const apiKey = String(value ?? '').trim();
  if (!apiKey) throw new VisicomGeocoderError('Не налаштовано VISICOM_API_KEY.');
  return apiKey;
}

async function fetchJson(url, serviceName) {
  let response;
  try {
    response = await fetch(url, { method: 'GET' });
  } catch (error) {
    throw new VisicomGeocoderError(
      `Не вдалося виконати браузерний запит до ${serviceName}. Перевірте CORS і мережу.`,
      { cause: error?.message },
    );
  }

  const responseText = await response.text();
  if (!response.ok) {
    throw new VisicomGeocoderError(
      `${serviceName} повернув HTTP ${response.status}: ${responseText}`,
      { status: response.status },
    );
  }

  try {
    return JSON.parse(responseText);
  } catch (error) {
    throw new VisicomGeocoderError(
      `${serviceName} повернув некоректний JSON.`,
      { cause: error?.message },
    );
  }
}

function firstFeature(data) {
  if (data?.type === 'FeatureCollection') {
    const feature = data.features?.[0];
    if (!feature) throw new VisicomGeocoderError('Адресу не знайдено.');
    return feature;
  }
  if (data?.type === 'Feature') return data;
  throw new VisicomGeocoderError('Невідомий формат відповіді Visicom.');
}

function pointFromFeature(feature) {
  const longitudeLatitude = feature?.geo_centroid?.coordinates ??
    (feature?.geometry?.type === 'Point'
      ? feature.geometry.coordinates
      : null);

  if (!isLongitudeLatitude(longitudeLatitude)) {
    throw new VisicomGeocoderError('Visicom не повернув коректний geo_centroid.');
  }

  return {
    id: feature.id,
    coordinate: [longitudeLatitude[1], longitudeLatitude[0]],
  };
}

function isLongitudeLatitude(value) {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.slice(0, 2).every(Number.isFinite) &&
    value[0] >= -180 &&
    value[0] <= 180 &&
    value[1] >= -90 &&
    value[1] <= 90
  );
}
