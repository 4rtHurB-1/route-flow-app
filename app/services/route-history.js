import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';

export const ROUTE_HISTORY_STORAGE_KEY = 'street-geo-app.route-history.v1';
export const MAX_ROUTE_HISTORY_ITEMS = 10;

export default class RouteHistoryService extends Service {
  @tracked routes = [];

  constructor() {
    super(...arguments);
    this.routes = this.readRoutes();
  }

  get storage() {
    return typeof window === 'undefined' ? null : window.localStorage;
  }

  readRoutes() {
    try {
      const stored = JSON.parse(this.storage?.getItem(ROUTE_HISTORY_STORAGE_KEY));
      return Array.isArray(stored) ? keepRoutes(stored) : [];
    } catch {
      return [];
    }
  }

  saveRoute({ addresses, route }) {
    const inputAddresses = String(addresses ?? '')
      .split(/\r?\n/u)
      .map((address) => address.trim())
      .filter(Boolean);
    const optimizedAddresses = (route?.orderedStops ?? [])
      .filter((stop) => stop.address !== 'Поточне місцеположення')
      .map((stop) => stop.address);
    const titleAddresses =
      optimizedAddresses.length > 0 ? optimizedAddresses : inputAddresses;
    const id =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const record = {
      id,
      createdAt: new Date().toISOString(),
      title: titleAddresses.slice(0, 4).join(', '),
      inputAddresses,
      route,
      bookmarked: false,
      name: null,
    };

    this.persist(keepRoutes([record, ...this.routes]));

    return record;
  }

  bookmarkRoute(id, name) {
    const trimmedName = String(name ?? '').trim();
    if (!trimmedName) throw new Error('Введіть назву маршруту.');
    const record = this.routes.find((item) => item.id === id);
    if (!record) throw new Error('Маршрут більше не доступний в історії.');
    this.persist(this.routes.map((item) =>
      item.id === id ? { ...item, bookmarked: true, name: trimmedName } : item,
    ));
  }

  deleteRoute(id) {
    this.persist(this.routes.filter((item) => item.id !== id));
  }

  persist(routes) {
    try {
      if (!this.storage) throw new Error('localStorage недоступний.');
      this.storage.setItem(ROUTE_HISTORY_STORAGE_KEY, JSON.stringify(routes));
      this.routes = routes;
    } catch {
      throw new Error('Не вдалося зберегти історію маршрутів у цьому браузері.');
    }
  }
}

function keepRoutes(routes) {
  let recentCount = 0;
  return routes.filter((item) => {
    if (item.bookmarked === true) return true;
    recentCount += 1;
    return recentCount <= MAX_ROUTE_HISTORY_ITEMS;
  });
}
