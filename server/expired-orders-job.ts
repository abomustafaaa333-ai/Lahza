import { cleanExpiredOrders } from "./orderLifecycle";

async function run() {
  const result = await cleanExpiredOrders();
  console.log(`[Orders] Cleanup complete before ${result.cutoff.toISOString()}: ${result.deliveryDeleted} orders and ${result.legacyIntercityDeleted} legacy intercity orders deleted.`);
}

run().then(
  () => process.exit(0),
  error => {
    console.error("[Orders] Scheduled cleanup failed", error);
    process.exit(1);
  },
);
