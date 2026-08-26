import { Toaster } from "@/components/ui/sonner";
import { AppUpdateNotice } from "@/components/AppUpdateNotice";
import { TooltipProvider } from "@/components/ui/tooltip";
import Admin from "@/pages/Admin";
import DemoAdmin from "@/pages/DemoAdmin";
import DownloadApp from "@/pages/DownloadApp";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import PartnerPortal from "@/pages/PartnerPortal";
import { Route, Switch } from "wouter";
import { useEffect, useRef } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { clearAuthRuntimeLock, lockAuthRuntime } from "./lib/authRuntime";

const isStaticDemo = import.meta.env.VITE_LAHZA_STATIC_DEMO === "true";

function Router() {
  const AdminPage = isStaticDemo ? DemoAdmin : Admin;
  return <Switch><Route path="/" component={Home} /><Route path="/download" component={DownloadApp} /><Route path="/partner/store" component={PartnerPortal} /><Route path="/partner" component={PartnerPortal} /><Route path="/admin" component={AdminPage} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
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

  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider>{!isStaticDemo ? <AppUpdateNotice /> : null}<Toaster richColors position="top-center" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
