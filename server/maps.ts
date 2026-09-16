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
  if (![origin.latitude, origin.longitude, destination.latitude, destination.longitude].every(Number.isFinite)) {
    throw new Error("إحداثيات الموقع غير صالحة");
  }

  const orsKey = process.env.OPENROUTESERVICE_API_KEY?.trim();
  if (!orsKey) {
    throw new Error("خدمة حساب المسافة غير مهيأة: أضف OPENROUTESERVICE_API_KEY إلى Railway");
  }

  try {
    const response = await fetch("https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson", {
      method: "POST",
      headers: { Authorization: orsKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        coordinates: [[origin.longitude, origin.latitude], [destination.longitude, destination.latitude]],
        // Delivery pins can be inside buildings or off-road. Snap each point
        // to the nearest routable road within 5 km while keeping real routing.
        radiuses: [5000, 5000],
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.error(`OpenRouteService request failed (${response.status})`, details.slice(0, 500));
      let providerMessage = "";
      try {
        const parsed = JSON.parse(details) as { error?: { message?: string }; message?: string };
        providerMessage = parsed.error?.message ?? parsed.message ?? "";
      } catch {
        providerMessage = details.replace(/\s+/g, " ").trim().slice(0, 180);
      }
      throw new Error(`تعذر حساب مسافة الطريق الحقيقية عبر OpenRouteService (HTTP ${response.status})${providerMessage ? `: ${providerMessage}` : ". تحقق من المفتاح والإحداثيات وإعدادات Railway"}`);
    }

    const data = await response.json() as { features?: Array<{ properties?: { segments?: Array<{ distance?: number; duration?: number }> } }> };
    const segments = data.features?.[0]?.properties?.segments ?? [];
    const validSegments = segments.filter((segment): segment is { distance: number; duration: number } => Number.isFinite(segment.distance) && Number.isFinite(segment.duration));
    if (!validSegments.length) {
      throw new Error("لم تُرجع OpenRouteService مساراً صالحاً بين الموقعين");
    }

    return {
      distanceMeters: validSegments.reduce((total, segment) => total + segment.distance, 0),
      durationSeconds: validSegments.reduce((total, segment) => total + segment.duration, 0),
    };
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith("تعذر حساب") || error.message.startsWith("لم تُرجع"))) {
      throw error;
    }
    console.error("OpenRouteService is unavailable", error);
    throw new Error("تعذر الاتصال بخدمة حساب المسافة الحقيقية عبر OpenRouteService");
  }
}

export async function getDirectionsRoute(params: DirectionsQuery): Promise<RoadRoute> {
  const [originLat, originLng] = params.origin.split(",").map(Number);
  const [destinationLat, destinationLng] = params.destination.split(",").map(Number);
  return getRoadRoute({ latitude: originLat, longitude: originLng }, { latitude: destinationLat, longitude: destinationLng });
}
