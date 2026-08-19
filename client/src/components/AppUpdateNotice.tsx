import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type UpdatePayload = {
  versionCode: number;
  versionName: string;
  downloadUrl: string;
  message?: string;
};

export function shouldOfferUpdate(installedVersionCode: number, payload: UpdatePayload | null) {
  let downloadUrl: URL | null = null;
  try {
    downloadUrl = payload ? new URL(payload.downloadUrl, "https://lahza.local") : null;
  } catch {
    downloadUrl = null;
  }
  return Boolean(
    payload &&
    Number.isFinite(installedVersionCode) &&
    installedVersionCode > 0 &&
    Number(payload.versionCode) > installedVersionCode &&
    downloadUrl?.protocol === "https:",
  );
}

declare global {
  interface Window {
    LahzaApp?: {
      getVersionCode?: () => number | string;
      openExternal?: (url: string) => void;
    };
  }
}

export function AppUpdateNotice() {
  const [update, setUpdate] = useState<UpdatePayload | null>(null);

  useEffect(() => {
    const nativeVersion = Number(window.LahzaApp?.getVersionCode?.());
    if (!Number.isFinite(nativeVersion) || nativeVersion <= 0) return;

    let active = true;
    fetch("/app-update.json", { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then((payload: UpdatePayload | null) => {
        if (!active || !payload) return;
        if (shouldOfferUpdate(nativeVersion, payload)) setUpdate(payload);
      })
      .catch(() => undefined);

    return () => { active = false; };
  }, []);

  const openDownload = () => {
    if (!update) return;
    const downloadUrl = new URL(update.downloadUrl, window.location.origin).toString();
    if (window.LahzaApp?.openExternal) window.LahzaApp.openExternal(downloadUrl);
    else window.location.assign(downloadUrl);
  };

  return (
    <Dialog open={Boolean(update)} onOpenChange={open => !open && setUpdate(null)}>
      <DialogContent dir="rtl" className="w-[calc(100%-2rem)] max-w-sm rounded-3xl border-0 bg-white p-6 shadow-2xl">
        <DialogHeader>
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600"><RefreshCw className="h-6 w-6" /></div>
          <DialogTitle className="pt-3 text-center text-xl">يتوفر تحديث جديد</DialogTitle>
          <DialogDescription className="text-center leading-6">{update?.message ?? "يتوفر إصدار أحدث من تطبيق لحظة."}</DialogDescription>
        </DialogHeader>
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-center text-xs text-slate-500">الإصدار الجديد: {update?.versionName}</div>
        <div className="mt-4 grid gap-2">
          <Button onClick={openDownload} className="rounded-xl bg-red-600 py-6 text-white hover:bg-red-700"><Download className="h-4 w-4" /> تحميل التحديث</Button>
          <Button variant="ghost" onClick={() => setUpdate(null)} className="rounded-xl text-slate-500">لاحقاً</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
