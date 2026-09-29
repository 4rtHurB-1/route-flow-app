import Service from '@ember/service';

export class AddressPhonesError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'AddressPhonesError';
    this.details = details;
  }
}

/**
 * Looks up phone numbers for several addresses in one browser request.
 *
 * The endpoint must accept a comma-separated `address` query parameter and
 * return address phones and optional blacklist data for every result.
 */
export default class AddressPhonesService extends Service {
  apiUrl = null;

  configure({ apiUrl } = {}) {
    this.apiUrl = apiUrl ?? this.apiUrl;
    return this;
  }

  get hasApiUrl() {
    return Boolean(this.apiUrl?.trim());
  }

  async lookup(addresses, { apiUrl = this.apiUrl, spreadsheetId } = {}) {
    const requestedAddresses = normalizeAddresses(addresses);
    if (requestedAddresses.length === 0) return [];
    if (!spreadsheetId || !/^[A-Za-z0-9_-]+$/u.test(spreadsheetId)) {
      throw new AddressPhonesError('Не вказано ID Google Таблиці.');
    }

    const endpoint = parseApiUrl(apiUrl);
    endpoint.searchParams.set('address', requestedAddresses.join(','));
    endpoint.searchParams.set('spreadsheetId', spreadsheetId);

    let response;
    try {
      response = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
    } catch (error) {
      throw new AddressPhonesError(
        'Не вдалося виконати запит до API телефонів. Перевірте CORS і мережу.',
        { cause: error.message },
      );
    }

    const responseText = await response.text();
    if (!response.ok) {
      throw new AddressPhonesError(
        `API телефонів повернув HTTP ${response.status}: ${responseText}`,
        { status: response.status },
      );
    }

    let payload;
    try {
      payload = JSON.parse(responseText);
    } catch (error) {
      throw new AddressPhonesError('API телефонів повернув некоректний JSON.', {
        cause: error.message,
      });
    }

    if (payload?.success !== true || !Array.isArray(payload.results)) {
      throw new AddressPhonesError(
        payload?.error ?? 'API телефонів повернув дані невідомого формату.',
      );
    }

    const resultsByAddress = new Map(
      payload.results.map((item) => [normalizeAddressKey(item?.address), item]),
    );

    return requestedAddresses.map((address, index) => {
      const item =
        resultsByAddress.get(normalizeAddressKey(address)) ??
        payload.results[index] ??
        {};
      const phones = uniquePhones(item.phones);

      return {
        address,
        found: item.found === true || phones.length > 0,
        phones,
        matches: Array.isArray(item.matches) ? item.matches : [],
        blacklisted: item.blacklisted === true,
        blacklistReason: normalizeOptionalText(item.blacklistReason),
      };
    });
  }
}

function normalizeAddresses(value) {
  return (Array.isArray(value) ? value : String(value ?? '').split(/\r?\n/u))
    .map((address) => String(address).trim())
    .filter(Boolean);
}

function normalizeAddressKey(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('uk-UA')
    .replace(/\s+/gu, ' ');
}

function normalizePhone(value) {
  const phone = String(value ?? '').trim();
  if (!phone) return null;

  const compact = phone.replace(/[\s().-]/gu, '');
  return /^\+?\d{5,15}$/u.test(compact) ? compact : null;
}

function uniquePhones(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(normalizePhone).filter(Boolean))];
}

function normalizeOptionalText(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

function parseApiUrl(value) {
  if (!String(value ?? '').trim()) {
    throw new AddressPhonesError('Не налаштовано URL API телефонів.');
  }

  let url;
  try {
    url = new URL(String(value).trim());
  } catch {
    throw new AddressPhonesError('URL API телефонів має некоректний формат.');
  }

  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new AddressPhonesError('URL API телефонів має використовувати HTTP або HTTPS.');
  }
  return url;
}

export { normalizeAddressKey, normalizePhone, uniquePhones };
