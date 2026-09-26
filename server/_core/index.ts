import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { autoCompleteDueOrders, removeDemoStores, ensureLahzaRuntimeSchema, handleWahaWebhook } from "../lahza";
import { startDailyReadinessReminders } from "../daily-readiness-reminders";
import { ensureScheduledPushSchema, runScheduledPushNotifications } from "../notificationDelivery";
import { ensureDatabaseCompatibility, migrateDatabase } from "../db";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/health", (_req, res) => res.status(200).json({ ok: true, service: "lahza" }));
  app.post("/api/waha/webhook", (req, res) => {
    void handleWahaWebhook(req.body).catch(error => console.warn("Unable to process WAHA webhook", error));
    res.status(202).json({ accepted: true });
  });
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

  if (process.env.NODE_ENV === "development") await setupVite(app, server);
  else serveStatic(app);

  const port = Number(process.env.PORT ?? 24669);
  await migrateDatabase();
  await ensureLahzaRuntimeSchema();
  await ensureScheduledPushSchema();
  console.log("[Database] Ensured scheduled phone notification schema");
  await ensureDatabaseCompatibility();
  server.listen(port, () => console.log(`Lahza server listening on port ${port}`));

  void removeDemoStores().catch(error => console.warn("Unable to remove legacy demo stores", error));
  startDailyReadinessReminders();
  const runScheduledPush = () => void runScheduledPushNotifications().catch(error => console.warn("Unable to deliver scheduled phone notifications", error));
  runScheduledPush();
  setInterval(runScheduledPush, 30_000);
  const runOrderCompletion = () => void autoCompleteDueOrders().catch(error => console.warn("Unable to auto-complete due orders", error));
  runOrderCompletion();
  setInterval(runOrderCompletion, 60_000);
}

startServer().catch(error => {
  console.error("Unable to start Lahza server", error);
  process.exitCode = 1;
});
