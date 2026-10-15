import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MediaPlace } from '../utils/shaheenMedia';

interface Props {
  places: MediaPlace[];
  selected: number;
  onSelect: (index: number) => void;
  label: string;
}

// Numbered pins (numbers only in HTML; names go in as text nodes). Names overlap when the map is
// zoomed out on a phone, so they show on hover / tap / selection instead of permanently.
const pin = (n: number, active: boolean) => L.divIcon({
  className: '',
  html: `<span class="flex items-center justify-center rounded-full border-2 font-bold text-white shadow-md ${active ? 'h-8 w-8 border-amber-950 bg-amber-800 text-sm' : 'h-6 w-6 border-white bg-amber-600 text-[11px]'}">${n}</span>`,
  iconSize: active ? [32, 32] : [24, 24],
  iconAnchor: active ? [16, 16] : [12, 12],
});

/**
 * Interactive OpenStreetMap map for the places Shaheen mentioned (loaded on demand: Leaflet is only
 * downloaded when an answer has places). Numbered markers match the list under the map.
 */
export default function ShaheenMap({ places, selected, onSelect, label }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.Marker[]>([]);
  const select = useRef(onSelect);
  select.current = onSelect;
  const key = places.map((p) => `${p.lat},${p.lon}`).join('|');

  useEffect(() => {
    if (!host.current || !places.length) return;
    const m = L.map(host.current, { scrollWheelZoom: false, worldCopyJump: true, zoomControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    }).addTo(m);
    markers.current = places.map((p, i) => {
      // Text nodes only: place names come from the model and must never become HTML.
      const tip = document.createElement('span');
      tip.textContent = `${i + 1}. ${p.name}`;
      return L.marker([p.lat, p.lon], { icon: pin(i + 1, false), title: p.name, keyboard: true }).addTo(m)
        .bindTooltip(tip, { direction: 'top', offset: [0, -14] })
        .on('click', () => select.current(i));
    });
    if (places.length === 1) m.setView([places[0].lat, places[0].lon], 7);
    else m.fitBounds(L.latLngBounds(places.map((p) => [p.lat, p.lon] as [number, number])), { padding: [32, 32], maxZoom: 7 });
    map.current = m;
    // The chat panel can resize (open/close, rotate): keep the tiles aligned.
    const observer = new ResizeObserver(() => m.invalidateSize());
    observer.observe(host.current);
    return () => { observer.disconnect(); m.remove(); map.current = null; markers.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const m = map.current;
    const target = places[selected];
    if (!m || !target) return;
    markers.current.forEach((marker, i) => { marker.setIcon(pin(i + 1, i === selected)); marker.setZIndexOffset(i === selected ? 1000 : 0); if (i !== selected) marker.closeTooltip(); });
    markers.current[selected]?.openTooltip();
    if (places.length > 1) m.flyTo([target.lat, target.lon], Math.max(m.getZoom(), 6), { duration: 0.8 });
  }, [selected, key, places]);

  return <div ref={host} dir="ltr" role="region" aria-label={label} className="isolate z-0 h-56 w-full overflow-hidden rounded-lg border border-stone-200 bg-stone-100 sm:h-64" data-testid="shaheen-map" />;
}
