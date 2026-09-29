import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';

export const APP_SETTINGS_STORAGE_KEY = 'street-geo-app.settings.v1';

export function spreadsheetIdFromUrl(value) {
    const text = String(value ?? '').trim();
    if (!text) return null;

    let url;
    try {
        url = new URL(text);
    } catch {
        throw new Error('Вставте повне посилання на Google Таблицю.');
    }

    const match = /^\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/|$)/u.exec(url.pathname);
    if (
        url.protocol !== 'https:' ||
        url.hostname !== 'docs.google.com' ||
        url.port ||
        url.username ||
        url.password ||
        !match
    ) {
        throw new Error('Посилання має вигляд https://docs.google.com/spreadsheets/d/ID/edit');
    }
    return match[1];
}

export default class AppSettingsService extends Service {
    @tracked spreadsheetUrl = '';
    @tracked visicomApiKey = '';
    @tracked loadAdditionalInfo;

    constructor() {
        super(...arguments);
        try {
            const saved = JSON.parse(globalThis.localStorage?.getItem(APP_SETTINGS_STORAGE_KEY));
            if (typeof saved?.spreadsheetUrl === 'string') {
                spreadsheetIdFromUrl(saved.spreadsheetUrl);
                this.spreadsheetUrl = saved.spreadsheetUrl.trim();
            }
            if (typeof saved?.visicomApiKey === 'string') {
                this.visicomApiKey = saved.visicomApiKey.trim();
            }

            if (this.spreadsheetUrl && typeof saved?.loadAdditionalInfo === 'string') {
                this.loadAdditionalInfo = saved.loadAdditionalInfo === 'true';
            }
        } catch {
            // Invalid or unavailable storage leaves settings empty.
        }
    }

    get spreadsheetId() {
        return spreadsheetIdFromUrl(this.spreadsheetUrl);
    }

    saveLoadAdditionalInfo(value) {
        try {
            const saved = JSON.parse(globalThis.localStorage?.getItem(APP_SETTINGS_STORAGE_KEY));
            console.log(saved, value);
            globalThis.localStorage.setItem(
                APP_SETTINGS_STORAGE_KEY,
                JSON.stringify({ ...saved, loadAdditionalInfo: value ? 'true' : 'false' })
            );
            this.loadAdditionalInfo = value;
        } catch (e) {
            throw new Error('Не вдалося зберегти налаштування в цьому браузері.');
        }
    }

    save({ spreadsheetUrl, visicomApiKey, loadAdditionalInfo }) {
        const next = {
            spreadsheetUrl: String(spreadsheetUrl ?? '').trim(),
            visicomApiKey: String(visicomApiKey ?? '').trim(),
            loadAdditionalInfo: loadAdditionalInfo ? 'true' : 'false',
        };
        spreadsheetIdFromUrl(next.spreadsheetUrl);

        try {
            globalThis.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(next));
        } catch {
            throw new Error('Не вдалося зберегти налаштування в цьому браузері.');
        }

        this.spreadsheetUrl = next.spreadsheetUrl;
        this.visicomApiKey = next.visicomApiKey;
        this.loadAdditionalInfo = loadAdditionalInfo;
    }
}
