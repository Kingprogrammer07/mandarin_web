export interface UserLocation {
  latitude: number;
  longitude: number;
}

function requestTelegramLocation(): Promise<UserLocation | null> {
  const locationManager = window.Telegram?.WebApp?.LocationManager;

  if (!locationManager) {
    return Promise.resolve(null);
  }

  const getLocation = () =>
    new Promise<UserLocation | null>((resolve) => {
      locationManager.getLocation((locationData) => {
        if (!locationData) {
          resolve(null);
          return;
        }

        resolve({
          latitude: locationData.latitude,
          longitude: locationData.longitude,
        });
      });
    });

  if (locationManager.isInited) {
    return getLocation();
  }

  return new Promise<UserLocation | null>((resolve) => {
    locationManager.init(() => {
      void getLocation().then(resolve);
    });
  });
}

function requestBrowserLocation(options: PositionOptions): Promise<UserLocation> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      reject,
      options
    );
  });
}

function watchBrowserLocation(options: PositionOptions): Promise<UserLocation> {
  return new Promise((resolve, reject) => {
    let watchId: number | null = null;
    const timeoutId = window.setTimeout(() => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      reject(new Error('Location watch timed out'));
    }, 15000);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        window.clearTimeout(timeoutId);
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
        }
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        window.clearTimeout(timeoutId);
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
        }
        reject(error);
      },
      options
    );
  });
}

/**
 * Request user location with a fallback chain:
 * 1. Telegram LocationManager (if inside Telegram WebApp)
 * 2. Browser geolocation (high accuracy)
 * 3. Browser geolocation (low accuracy, cached)
 * 4. Browser geolocation watch (last resort)
 *
 * Returns `null` if all attempts fail.
 */
export async function requestUserLocation(): Promise<UserLocation | null> {
  const telegramLocation = await requestTelegramLocation().catch(() => null);

  if (telegramLocation) {
    return telegramLocation;
  }

  if (!navigator.geolocation) {
    return null;
  }

  const browserLocationAttempts: PositionOptions[] = [
    { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
    { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 12000 },
  ];

  for (const options of browserLocationAttempts) {
    try {
      return await requestBrowserLocation(options);
    } catch {
      // Android WebView can fail the first location attempt immediately after permission is granted.
    }
  }

  try {
    return await watchBrowserLocation({
      enableHighAccuracy: false,
      maximumAge: 10 * 60 * 1000,
      timeout: 15000,
    });
  } catch {
    return null;
  }
}
