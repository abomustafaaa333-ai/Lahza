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

export async function getRoadRoute(origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }): Promise<RoadRoute> {
  const orsKey = process.env.OPENROUTESERVICE_API_KEY?.trim();
  if (orsKey) {
    const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car/geojson", {
      method: "POST",
      headers: { Authorization: orsKey, "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: [[origin.longitude, origin.latitude], [destination.longitude, destination.latitude]] }),
    });
    if (!response.ok) throw new Error(`OpenRouteService request failed (${response.status})`);
    const data = await response.json() as { features?: Array<{ properties?: { segments?: Array<{ distance?: number; duration?: number }> } }> };
    const segment = data.features?.[0]?.properties?.segments?.[0];
    if (!segment?.distance || !segment.duration) throw new Error("OpenRouteService returned no route");
    return { distanceMeters: segment.distance, durationSeconds: segment.duration };
  }
  const response = await getDirections({ origin: `${origin.latitude},${origin.longitude}`, destination: `${destination.latitude},${destination.longitude}`, mode: "driving", language: "ar", region: "sy" });
  const leg = response.routes?.[0]?.legs?.[0];
  if (response.status !== "OK" || !leg?.distance?.value) throw new Error("تعذر حساب مسافة الطريق حالياً. أضف مفتاح OpenRouteService أو Google Maps إلى Railway.");
  return { distanceMeters: leg.distance.value, durationSeconds: leg.duration?.value ?? Math.ceil(leg.distance.value / 1000) * 180 };
}

export async function getDirectionsRoute(params: DirectionsQuery): Promise<RoadRoute> {
  const [originLat, originLng] = params.origin.split(",").map(Number);
  const [destinationLat, destinationLng] = params.destination.split(",").map(Number);
  return getRoadRoute({ latitude: originLat, longitude: originLng }, { latitude: destinationLat, longitude: destinationLng });
}
