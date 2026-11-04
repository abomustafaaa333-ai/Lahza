import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { serverOrigin } from "@/lib/serverOrigin";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type MapPoint = { lat: number; lng: number };

/**
 * A full map with a pin fixed at its centre: the customer moves the map under the pin and confirms.
 * Moving the map is easier than dragging a marker on a phone.
 */
export function TaxiMapPicker({ open, onOpenChange, title, start, myLocation, locating, onLocate, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  start: MapPoint;
  myLocation: MapPoint | null;
  locating: boolean;
  onLocate: () => void;
  onConfirm: (point: MapPoint) => void;
}) {
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!open) return;
    // The dialog mounts its content after opening; wait a frame so the map measures a sized box.
    const frame = window.requestAnimationFrame(() => {
      if (!holder.current || map.current) return;
      map.current = L.map(holder.current, { center: [start.lat, start.lng], zoom: 15, zoomControl: false, attributionControl: true });
      // Tiles come through the Lahza server, which identifies the app to OpenStreetMap and caches them.
      L.tileLayer(`${serverOrigin()}/api/map-tiles/{z}/{x}/{y}.png`, {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map.current);
      L.control.zoom({ position: "bottomleft" }).addTo(map.current);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      map.current?.remove();
      map.current = null;
    };
    // The start point only matters when the map opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Follow "my location" only when it changes while the map is open, so reopening keeps the saved point.
  const seenLocation = useRef<string | null>(null);
  useEffect(() => { if (open) seenLocation.current = myLocation ? `${myLocation.lat},${myLocation.lng}` : null; }, [open]);
  useEffect(() => {
    const key = myLocation ? `${myLocation.lat},${myLocation.lng}` : null;
    if (!open || !myLocation || key === seenLocation.current) return;
    seenLocation.current = key;
    map.current?.flyTo([myLocation.lat, myLocation.lng], 17, { duration: 0.6 });
  }, [open, myLocation?.lat, myLocation?.lng]);

  const confirm = () => {
    const center = map.current?.getCenter();
    if (!center) return;
    onConfirm({ lat: center.lat, lng: center.lng });
    onOpenChange(false);
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent dir="rtl" className="taxi-map-dialog w-[calc(100%-1rem)] max-w-lg overflow-hidden rounded-3xl border-0 bg-white p-0 shadow-2xl">
      <DialogHeader className="px-5 pt-5"><DialogTitle className="text-right text-lg font-black text-[#4a2618]">{title}</DialogTitle><DialogDescription className="text-right">حرّك الخريطة حتى يقف الدبوس على المكان، ثم اضغط تأكيد.</DialogDescription></DialogHeader>
      <div className="taxi-map-frame">
        <div ref={holder} className="taxi-map" />
        <span className="taxi-map-pin" aria-hidden="true"><MapPin className="h-10 w-10" /></span>
        <button type="button" className="taxi-map-locate" onClick={onLocate} disabled={locating}><LocateFixed className="h-4 w-4" />{locating ? "جارٍ التحديد..." : "موقعي"}</button>
      </div>
      <div className="p-4"><Button type="button" onClick={confirm} className="h-12 w-full rounded-2xl bg-[#ff6b2b] text-base font-black text-white hover:bg-[#e85a1c]">تأكيد هذا المكان</Button></div>
    </DialogContent>
  </Dialog>;
}
