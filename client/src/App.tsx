import { Toaster } from "@/components/ui/sonner";
import { AppUpdateNotice } from "@/components/AppUpdateNotice";
import { TooltipProvider } from "@/components/ui/tooltip";
import Admin from "@/pages/Admin";
import DownloadApp from "@/pages/DownloadApp";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/download" component={DownloadApp} /><Route path="/admin" component={Admin} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><AppUpdateNotice /><Toaster richColors position="top-center" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
