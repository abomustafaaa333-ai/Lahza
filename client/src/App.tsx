import { Toaster } from "@/components/ui/sonner";
import { AppUpdateNotice } from "@/components/AppUpdateNotice";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { lazy, Suspense, useEffect, useRef } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { clearAuthRuntimeLock, lockAuthRuntime } from "./lib/authRuntime";

const isStaticDemo = import.meta.env.VITE_LAHZA_STATIC_DEMO === "true";
const Admin = lazy(() => import("@/pages/Admin"));
const DemoAdmin = lazy(() => import("@/pages/DemoAdmin"));
const DownloadApp = lazy(() => import("@/pages/DownloadApp"));
const PartnerPortal = lazy(() => import("@/pages/PartnerPortal"));

function Router() {
  const AdminPage = isStaticDemo ? DemoAdmin : Admin;
  return <Suspense fallback={<main className="customer-auth-loading" dir="rtl"><img src="/assets/lahza-logo.svg" alt="لحظة" /><span>جارٍ فتح الصفحة...</span></main>}><Switch><Route path="/" component={Home} /><Route path="/download" component={DownloadApp} /><Route path="/partner/store" component={PartnerPortal} /><Route path="/partner" component={PartnerPortal} /><Route path="/admin" component={AdminPage} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch></Suspense>;
}

export default function App() {
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    if (isStaticDemo) return;

    const recordBackgroundTime = () => {
      backgroundedAt.current = Date.now();
    };
    const restartPublicApp = () => {
      const wasBackgroundedFor = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
      backgroundedAt.current = null;
      if (document.visibilityState !== "visible" || wasBackgroundedFor < 30_000) return;
      clearAuthRuntimeLock();
      lockAuthRuntime();
      window.location.replace("/");
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") recordBackgroundTime();
      else restartPublicApp();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", recordBackgroundTime);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", recordBackgroundTime);
    };
  }, []);

  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider>{!isStaticDemo ? <AppUpdateNotice /> : null}<Toaster richColors position="top-right" offset="5rem" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
