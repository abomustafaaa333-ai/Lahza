import { cleanExpiredOffers } from "./expiredOffers";

async function run() {
  const result = await cleanExpiredOffers();
  console.log(`[Offers] Expiry cleanup complete: ${result.expired} expired, ${result.imagesDeleted} images deleted.`);
}

run().then(
  () => process.exit(0),
  error => {
    console.error("[Offers] Expiry cleanup failed", error);
    process.exit(1);
  },
);
