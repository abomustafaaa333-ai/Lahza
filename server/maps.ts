type DirectionsQuery = {
  origin: string;
  destination: string;
  mode?: string;
  language?: string;
  region?: string;
};

export type DirectionsResult = {
  routes: Array<{
    legs: Array<{
      distance: { text: string; value: number };
      duration?: { text: string; value: number };
    }>;
  }>;
  status: string;
};

export type RoadRoute = {
  distanceMeters: number;
  durationSeconds: number;
};

export function createGoogleDirectionsUrl(params: DirectionsQuery, apiKey: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("key", apiKey);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url;
}

export async function getDirections(params: DirectionsQuery): Promise<DirectionsResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY is required to calculate the road distance");
  const response = await fetch(createGoogleDirectionsUrl(params, apiKey));
  if (!response.ok) throw new Error(`Google Maps request failed (${response.status})`);
  return (await response.json()) as DirectionsResult;
}

function estimateRoute(origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }): RoadRoute {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const lat1 = toRadians(origin.latitude);
  const lat2 = toRadians(destination.latitude);
  const deltaLat = toRadians(destination.latitude - origin.latitude);
  const deltaLng = toRadians(destination.longitude - origin.longitude);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  const straightLineMeters = earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  // A road is normally longer than a straight line. Keep this as a conservative
  // fallback only when both external routing providers are unavailable.
  const distanceMeters = Math.max(500, Math.round(straightLineMeters * 1.35));
  return { distanceMeters, durationSeconds: Math.max(180, Math.ceil(distanceMeters / 1000) * 180) };
}

export async function getRoadRoute(origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }): Promise<RoadRoute> {
  if (![origin.latitude, origin.longitude, destination.latitude, destination.longitude].every(Number.isFinite)) {
    throw new Error("إحداثيات الموقع غير صالحة");
  }

  const orsKey = process.env.OPENROUTESERVICE_API_KEY?.trim();
  if (orsKey) {
    try {
      const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car/geojson", {
        method: "POST",
        headers: { Authorization: orsKey, "Content-Type": "application/json" },
        body: JSON.stringify({ coordinates: [[origin.longitude, origin.latitude], [destination.longitude, destination.latitude]] }),
      });
      if (response.ok) {
        const data = await response.json() as { features?: Array<{ properties?: { segments?: Array<{ distance?: number; duration?: number }> } }> };
        const segment = data.features?.[0]?.properties?.segments?.[0];
        if (segment?.distance && segment.duration) return { distanceMeters: segment.distance, durationSeconds: segment.duration };
        console.warn("OpenRouteService returned no usable route; trying fallback provider");
      } else {
        console.warn(`OpenRouteService request failed (${response.status}); trying fallback provider`);
      }
    } catch (error) {
      console.warn("OpenRouteService is unavailable; trying fallback provider", error);
    }
  }

  const googleKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (googleKey) {
    try {
      const response = await getDirections({ origin: `${origin.latitude},${origin.longitude}`, destination: `${destination.latitude},${destination.longitude}`, mode: "driving", language: "ar", region: "sy" });
      const leg = response.routes?.[0]?.legs?.[0];
      if (response.status === "OK" && leg?.distance?.value) {
        return { distanceMeters: leg.distance.value, durationSeconds: leg.duration?.value ?? Math.ceil(leg.distance.value / 1000) * 180 };
      }
      console.warn("Google Maps returned no usable route; using local estimate");
    } catch (error) {
      console.warn("Google Maps is unavailable; using local estimate", error);
    }
  }

  return estimateRoute(origin, destination);
}

export async function getDirectionsRoute(params: DirectionsQuery): Promise<RoadRoute> {
  const [originLat, originLng] = params.origin.split(",").map(Number);
  const [destinationLat, destinationLng] = params.destination.split(",").map(Number);
  return getRoadRoute({ latitude: originLat, longitude: originLng }, { latitude: destinationLat, longitude: destinationLng });
}
