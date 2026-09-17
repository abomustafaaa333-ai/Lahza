import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { autoCompleteDueOrders, ensureDemoStoresSeed, handleWahaWebhook } from "../lahza";
import { startDailyReadinessReminders } from "../daily-readiness-reminders";
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

  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => console.log(`Lahza server listening on port ${port}`));

  void ensureDemoStoresSeed().catch(error => console.warn("Unable to seed demo stores", error));
  startDailyReadinessReminders();
  const runOrderCompletion = () => void autoCompleteDueOrders().catch(error => console.warn("Unable to auto-complete due orders", error));
  runOrderCompletion();
  setInterval(runOrderCompletion, 60_000);
}

startServer().catch(error => {
  console.error("Unable to start Lahza server", error);
  process.exitCode = 1;
});
