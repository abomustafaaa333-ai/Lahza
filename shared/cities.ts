export const CITY_KEYS = ["manbij", "jarabulus"] as const;
export type CityKey = (typeof CITY_KEYS)[number];

export const CITY_LABELS: Record<CityKey, string> = {
  manbij: "منبج",
  jarabulus: "جرابلس",
};

export const DEFAULT_CITY: CityKey = "manbij";
