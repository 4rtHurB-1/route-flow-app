import Service from '@ember/service';

export const DEFAULT_ORIGIN = Object.freeze([50.12103, 27.5029]);
export const DEFAULT_MAX_DISTANCE_KM = 50;

const EARTH_RADIUS_KM = 6371.0088;

export default class CurrentLocationService extends Service {
  maxDistanceKm = DEFAULT_MAX_DISTANCE_KM;
  positionOptions = {
    enableHighAccuracy: true,
    timeout: 10_000,
    maximumAge: 60_000,
  };

  configure({ maxDistanceKm, positionOptions } = {}) {
    if (Number.isFinite(maxDistanceKm) && maxDistanceKm > 0) {
      this.maxDistanceKm = maxDistanceKm;
    }
    if (positionOptions) {
      this.positionOptions = {
        ...this.positionOptions,
        ...positionOptions,
      };
    }
    return this;
  }

  getCurrentPosition(options = this.positionOptions) {
    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        reject(new Error('Геолокація не підтримується цим браузером.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coordinate = [
            position?.coords?.latitude,
            position?.coords?.longitude,
          ];
          if (!isCoordinate(coordinate)) {
            reject(new Error('Браузер повернув некоректну геопозицію.'));
            return;
          }
          resolve(coordinate);
        },
        (error) => reject(new Error(geolocationErrorMessage(error))),
        options,
      );
    });
  }

  /**
   * Returns a route-origin point. Permission errors, unavailable geolocation,
   * invalid coordinates, and a position farther than maxDistanceKm from every
   * route stop all resolve to DEFAULT_ORIGIN.
   */
  async getOrigin({
    points = [],
    maxDistanceKm = this.maxDistanceKm,
  } = {}) {
    try {
      const coordinate = await this.getCurrentPosition();
      const routePoints = points.filter((point) =>
        isCoordinate(point?.coordinate),
      );

      if (
        routePoints.length > 0 &&
        Number.isFinite(maxDistanceKm) &&
        nearestDistanceKm(coordinate, routePoints) > maxDistanceKm
      ) {
        return fallbackOrigin('too-far');
      }

      return {
        address: 'Поточне місцеположення',
        coordinate,
        source: 'geolocation',
        usedFallback: false,
      };
    } catch (error) {
      return fallbackOrigin('unavailable', error?.message);
    }
  }
}

function fallbackOrigin(reason, error = null) {
  return {
    address: 'Поточне місцеположення',
    coordinate: [...DEFAULT_ORIGIN],
    source: 'default',
    usedFallback: true,
    fallbackReason: reason,
    geolocationError: error,
  };
}

function geolocationErrorMessage(error) {
  switch (error?.code) {
    case 1:
      return 'Користувач не дозволив доступ до геопозиції.';
    case 2:
      return 'Поточну геопозицію неможливо визначити.';
    case 3:
      return 'Час очікування геопозиції минув.';
    default:
      return error?.message || 'Не вдалося визначити поточну геопозицію.';
  }
}

function nearestDistanceKm(coordinate, points) {
  return Math.min(
    ...points.map((point) => distanceKm(coordinate, point.coordinate)),
  );
}

function distanceKm(first, second) {
  const latitudeDelta = degreesToRadians(second[0] - first[0]);
  const longitudeDelta = degreesToRadians(second[1] - first[1]);
  const firstLatitude = degreesToRadians(first[0]);
  const secondLatitude = degreesToRadians(second[0]);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

function isCoordinate(value) {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every(Number.isFinite) &&
    value[0] >= -90 &&
    value[0] <= 90 &&
    value[1] >= -180 &&
    value[1] <= 180
  );
}
