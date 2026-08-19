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
    }>;
  }>;
  status: string;
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
