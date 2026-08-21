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
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

const isStaticDemo = import.meta.env.VITE_LAHZA_STATIC_DEMO === "true";

function Router() {
  const AdminPage = isStaticDemo ? DemoAdmin : Admin;
  return <Switch><Route path="/" component={Home} /><Route path="/download" component={DownloadApp} /><Route path="/partner/store" component={PartnerPortal} /><Route path="/partner" component={PartnerPortal} /><Route path="/admin" component={AdminPage} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider>{!isStaticDemo ? <AppUpdateNotice /> : null}<Toaster richColors position="top-center" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
