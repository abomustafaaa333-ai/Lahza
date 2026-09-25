import { describe, expect, it } from "vitest";
import { sendPushNotification } from "./pushNotifications";

describe("Firebase push delivery", () => {
  it("reports no registered devices when the recipient list is empty", async () => {
    await expect(sendPushNotification([], { title: "Offer", body: "Test" })).resolves.toEqual({
      sent: 0,
      failed: 0,
      failedTokens: [],
      reason: "no_registered_devices",
    });
  });
});
