/**
 * Replace the street part of an address, keeping its house number unchanged.
 * Matching ignores letter case and repeated spaces; the rest of the input is
 * passed through to Visicom after the replacement.
 */
export const STREET_NAME_CORRECTIONS = {
  '2 Гонти': 'пров. Гонти',
  'Гонти': 'вул. Гонти',
  Дикабристів: 'Гаївська',
};

/**
 * Exact address -> [latitude, longitude]. Add only verified coordinates.
 * Example: 'Староміська 113': [YOUR_LATITUDE, YOUR_LONGITUDE],
 */
export const ADDRESS_COORDINATES = {
  'Староміська 113': [50.1147, 27.48649],
};

export function normalizeAddressKey(address) {
  return String(address ?? '').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('uk-UA');
}

export function correctStreetName(address) {
  const trimmed = String(address ?? '').trim().replace(/\s+/gu, ' ');
  const normalized = normalizeAddressKey(trimmed);
  const rules = Object.entries(STREET_NAME_CORRECTIONS)
    .sort(([first], [second]) => second.length - first.length);

  for (const [street, replacement] of rules) {
    const key = normalizeAddressKey(street);
    if (!normalized.startsWith(`${key} `)) continue;
    const house = trimmed.slice(key.length).trim();
    if (/^\d/u.test(house)) return `${replacement.trim()} ${house}`;
  }
  return trimmed;
}

export function configuredCoordinate(address) {
  const key = normalizeAddressKey(address);
  const match = Object.entries(ADDRESS_COORDINATES).find(
    ([candidate]) => normalizeAddressKey(candidate) === key,
  );
  if (!match) return null;

  const coordinate = match[1];
  if (!Array.isArray(coordinate) || coordinate.length !== 2 ||
    !coordinate.every((value) => typeof value === 'number' && Number.isFinite(value)) ||
    coordinate[0] < -90 || coordinate[0] > 90 ||
    coordinate[1] < -180 || coordinate[1] > 180) {
    throw new Error(`Некоректні координати в конфігурації для адреси «${match[0]}».`);
  }
  return [...coordinate];
}
