/**
 * Replace the street part of an address, keeping its house number unchanged.
 * Matching ignores letter case and repeated spaces; the rest of the input is
 * passed through to Visicom after the replacement.
 */
export const STREET_NAME_CORRECTIONS = {
    '2 Гонти': 'пров. Гонти',
    Гонти: 'вул. Гонти',
    Дикабристів: 'Гаївська',
};

const ADDRESS_CORRECTIONS = {
    'Зарічний 5': 'Скорика 12',
    'Скорика 3': 'Гоголя 50',
    'Новополонська 130': 'Новополонська 127',
    'Новополонська 182': 'Карповщинська 92',
    'Староміська 54': 'Новополонська 15',
    'Гонти 22': 'Новополонський 21',
    'Гонти 32': '1 Гонти 7',
    'Зарічна 58': 'Новополонська 119',
    'Зарічна 108': 'Новополонська 36',
    'Зарічна 102': 'Замкова 48',
    'Перемоги 51': 'Лесі Українки 177',
};

/**
 * Exact address -> [latitude, longitude]. Add only verified coordinates.
 * Example: 'Староміська 113': [YOUR_LATITUDE, YOUR_LONGITUDE],
 */
export const ADDRESS_COORDINATES = {
    'Староміська 113': [50.1147, 27.48649],
    // 'Зарічна 108': [50.107081512346944, 27.504813049788293],
    // 'Зарічна 102': [50.112774797792774, 27.50144810777972],
    // 'Перемоги 51': [50.12111346667361, 27.489626896808417],
};

export function normalizeAddressKey(address) {
    return String(address ?? '')
        .trim()
        .replace(/\s+/gu, ' ')
        .toLocaleLowerCase('uk-UA');
}

export function correctStreetName(address) {
    const trimmed = String(address ?? '')
        .trim()
        .replace(/\s+/gu, ' ');

    const normalized = normalizeAddressKey(trimmed);

    // Заміна повної адреси, включно з номером будинку.
    const addressMatch = Object.entries(ADDRESS_CORRECTIONS).find(
        ([candidate]) => normalizeAddressKey(candidate) === normalized
    );

    if (addressMatch) {
        return String(addressMatch[1]).trim().replace(/\s+/gu, ' ');
    }

    // Заміна лише назви вулиці зі збереженням номера будинку.
    const rules = Object.entries(STREET_NAME_CORRECTIONS).sort(([first], [second]) => second.length - first.length);

    for (const [street, replacement] of rules) {
        const key = normalizeAddressKey(street);

        if (!normalized.startsWith(`${key} `)) continue;

        const house = trimmed.slice(key.length).trim();

        if (/^\d/u.test(house)) {
            return `${replacement.trim()} ${house}`;
        }
    }

    return trimmed;
}

export function configuredCoordinate(address) {
    const key = normalizeAddressKey(address);
    const match = Object.entries(ADDRESS_COORDINATES).find(([candidate]) => normalizeAddressKey(candidate) === key);
    if (!match) return null;

    const coordinate = match[1];
    if (
        !Array.isArray(coordinate) ||
        coordinate.length !== 2 ||
        !coordinate.every((value) => typeof value === 'number' && Number.isFinite(value)) ||
        coordinate[0] < -90 ||
        coordinate[0] > 90 ||
        coordinate[1] < -180 ||
        coordinate[1] > 180
    ) {
        throw new Error(`Некоректні координати в конфігурації для адреси «${match[0]}».`);
    }
    return [...coordinate];
}
