import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { CITY_KEYS, DEFAULT_CITY, type CityKey } from "../../shared/cities";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  city: CityKey;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  const requestedCity = opts.req.headers["x-lahza-city"];
  const city = typeof requestedCity === "string" && (CITY_KEYS as readonly string[]).includes(requestedCity) ? requestedCity as CityKey : DEFAULT_CITY;
  return { req: opts.req, res: opts.res, user: null, city };
}
