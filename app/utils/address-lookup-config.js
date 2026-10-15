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
    'Новополонська 174': 'Замкова 42',
    'Перемоги 51': 'Лесі Українки 177',
    'Романа 53а': 'Романа 47'
};

/**
 * Exact address -> [latitude, longitude]. Add only verified coordinates.
 * Example: 'Староміська 113': [YOUR_LATITUDE, YOUR_LONGITUDE],
 */
export const ADDRESS_COORDINATES = {
    'Староміська 113': [50.1147, 27.48649],
    'Староміська 9': [50.108879834327645, 27.496188381506407],
    'Староміська 23': [50.10852838767722, 27.4942199526854],
    'Староміська 34': [50.107849484191746, 27.492022128744786],
    'Староміська 59': [50.11021798393978, 27.48789289990912],
    'Староміська 75': [50.11154934990494, 27.488166485242147],
    'Староміська 98': [50.11321652087451, 27.487855664326943],
    'Староміська 108': [50.114076526777716, 27.486954442132323],
    'Староміська 118': [50.11569375859649, 27.48768002874477],
    'Староміська 125а': [50.11655715982179, 27.487422536689166],
    'Гонти 13': [50.10475606574656, 27.50101361384287],
    'Гонти 26б': [50.10757300576834, 27.49411125758043],
    'Гонти 3': [50.10377567581014, 27.499232557580438],
    '1 Гонти 7': [50.10390642347423, 27.498792675318775],
    '2 Гонти 1': [50.105484347291124, 27.50016236125568],
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
