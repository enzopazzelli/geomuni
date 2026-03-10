'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const CENTER = [-28.4606, -62.8347];

export default function ReporteMapPicker({ onSelect, selected }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markerRef    = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });

    mapRef.current = L.map(containerRef.current).setView(CENTER, 14);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap / CARTO',
      maxZoom: 20,
    }).addTo(mapRef.current);

    mapRef.current.on('click', (e) => {
      const { lat, lng } = e.latlng;
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
      onSelect(lat, lng);
    });

    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  // Actualizamos el marcador si la ubicación viene de geolocalización
  useEffect(() => {
    if (!mapRef.current || !selected) return;
    if (markerRef.current) markerRef.current.remove();
    markerRef.current = L.marker([selected.lat, selected.lng]).addTo(mapRef.current);
    mapRef.current.setView([selected.lat, selected.lng], 17);
  }, [selected?.lat, selected?.lng]);

  return <div ref={containerRef} style={{ height: '300px', width: '100%', borderRadius: '16px', overflow: 'hidden', zIndex: 0 }} />;
}
