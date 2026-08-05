import React, { useEffect, useRef, useState } from 'react';
import { Sun, Moon, Globe } from 'lucide-react';
import { getHaversineDistance } from '../utils/metrics';

const MAP_TILE_STYLES = {
  voyager: {
    name: '清晰街景',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 19
  },
  osm: {
    name: '標準 OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    maxZoom: 19
  },
  dark: {
    name: '夜間暗黑',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 19
  }
};

export function MapViewComponent({ pathPoints = [], isTracking = false }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const polylineRef = useRef(null);
  const runnerMarkerRef = useRef(null);
  const startMarkerRef = useRef(null);
  const kmMarkersRef = useRef([]);

  // Map theme style state (Default to Standard OpenStreetMap for high contrast)
  const [mapStyleKey, setMapStyleKey] = useState('osm');

  const clearKmMarkers = () => {
    if (mapInstanceRef.current && kmMarkersRef.current.length > 0) {
      kmMarkersRef.current.forEach(m => {
        try {
          mapInstanceRef.current.removeLayer(m);
        } catch (e) {}
      });
      kmMarkersRef.current = [];
    }
  };

  // Initialize Map
  useEffect(() => {
    if (typeof window === 'undefined' || !window.L || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = pathPoints.length > 0 ? pathPoints[0].lat : 25.0335;
      const initialLng = pathPoints.length > 0 ? pathPoints[0].lng : 121.5328;

      const map = window.L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false
      });

      const activeStyle = MAP_TILE_STYLES[mapStyleKey];
      tileLayerRef.current = window.L.tileLayer(activeStyle.url, {
        maxZoom: activeStyle.maxZoom,
        subdomains: activeStyle.subdomains
      }).addTo(map);

      mapInstanceRef.current = map;

      // High contrast polyline: Vibrant Blue / Cyan with dark outline
      polylineRef.current = window.L.polyline([], {
        color: '#0066FF',
        weight: 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
    }

    return () => {
      clearKmMarkers();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Handle Tile Layer Switch
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const activeStyle = MAP_TILE_STYLES[mapStyleKey];

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    tileLayerRef.current = window.L.tileLayer(activeStyle.url, {
      maxZoom: activeStyle.maxZoom,
      subdomains: activeStyle.subdomains
    }).addTo(mapInstanceRef.current);

    // Adjust polyline color depending on theme for best visibility
    if (polylineRef.current) {
      polylineRef.current.setStyle({
        color: mapStyleKey === 'dark' ? '#00E5FF' : '#0052FF',
        weight: 6
      });
    }
  }, [mapStyleKey]);

  // Update Polyline & Markers when pathPoints change
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;

    const map = mapInstanceRef.current;
    const latLngs = pathPoints.map(p => [p.lat, p.lng]);

    if (polylineRef.current) {
      polylineRef.current.setLatLngs(latLngs);
    }

    // Clear and redraw kilometer milestone markers
    clearKmMarkers();

    if (pathPoints.length > 0) {
      const currentPoint = pathPoints[pathPoints.length - 1];
      const startPoint = pathPoints[0];

      // Start Marker
      if (!startMarkerRef.current) {
        const startIcon = window.L.divIcon({
          className: 'custom-start-marker',
          html: `<div style="background:#00C853; color:#FFF; font-weight:800; font-size:11px; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #FFF; box-shadow:0 2px 8px rgba(0,0,0,0.4);">S</div>`
        });
        startMarkerRef.current = window.L.marker([startPoint.lat, startPoint.lng], { icon: startIcon }).addTo(map);
      }

      // Calculate and draw kilometer markers (1k, 2k, 3k, etc.)
      let runningKm = 0;
      let nextKmTarget = 1;
      for (let i = 1; i < pathPoints.length; i++) {
        const p1 = pathPoints[i - 1];
        const p2 = pathPoints[i];
        if (p1 && p2 && typeof p1.lat === 'number' && typeof p2.lat === 'number') {
          const segDist = getHaversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
          runningKm += segDist;
          while (runningKm >= nextKmTarget) {
            const kmNum = nextKmTarget;
            const kmIcon = window.L.divIcon({
              className: 'custom-km-marker',
              html: `<div style="
                background: linear-gradient(135deg, #00E676, #00B0FF);
                color: #0A0E17;
                font-weight: 900;
                font-size: 11px;
                width: 22px;
                height: 22px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px solid #FFFFFF;
                box-shadow: 0 3px 10px rgba(0,0,0,0.6);
                font-family: inherit;
              ">${kmNum}</div>`,
              iconSize: [22, 22],
              iconAnchor: [11, 11]
            });

            const marker = window.L.marker([p2.lat, p2.lng], { icon: kmIcon })
              .bindTooltip(`第 ${kmNum} 公里播報點`, { permanent: false, direction: 'top', offset: [0, -10] })
              .addTo(map);

            kmMarkersRef.current.push(marker);
            nextKmTarget += 1;
          }
        }
      }

      // Runner Pulse Marker
      const runnerIcon = window.L.divIcon({
        className: 'custom-runner-icon',
        html: `<div class="runner-marker"></div>`
      });

      if (!runnerMarkerRef.current) {
        runnerMarkerRef.current = window.L.marker([currentPoint.lat, currentPoint.lng], { icon: runnerIcon }).addTo(map);
      } else {
        runnerMarkerRef.current.setLatLng([currentPoint.lat, currentPoint.lng]);
      }

      // Pan map smoothly to follow runner
      if (isTracking) {
        map.panTo([currentPoint.lat, currentPoint.lng], { animate: true, duration: 0.5 });
      } else if (pathPoints.length > 1) {
        map.fitBounds(polylineRef.current.getBounds(), { padding: [30, 30] });
      }
    }
  }, [pathPoints, isTracking]);

  const mapStyleOptions = [
    { key: 'osm', name: '標準', icon: Globe },
    { key: 'dark', name: '暗黑', icon: Moon },
    { key: 'voyager', name: '亮彩', icon: Sun }
  ];

  const currentOption = mapStyleOptions.find(o => o.key === mapStyleKey) || mapStyleOptions[0];
  const IconComponent = currentOption.icon;

  const handleCycleMapStyle = () => {
    const currentIndex = mapStyleOptions.findIndex(o => o.key === mapStyleKey);
    const nextIndex = (currentIndex + 1) % mapStyleOptions.length;
    setMapStyleKey(mapStyleOptions[nextIndex].key);
  };

  return (
    <div className="map-frame" style={{ position: 'relative' }}>
      {/* Map DOM Container */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

      {/* Compact Single Map Theme Cycle Button */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 1000
      }}>
        <button
          onClick={handleCycleMapStyle}
          title="點擊切換地圖風格 (清晰 → 標準 → 暗黑)"
          style={{
            background: 'rgba(10, 14, 23, 0.85)',
            backdropFilter: 'blur(12px)',
            color: '#00E676',
            border: '1px solid rgba(0, 230, 118, 0.4)',
            borderRadius: '20px',
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            transition: 'all 0.2s ease'
          }}
        >
          <IconComponent size={14} color="#00E676" />
          <span>{currentOption.name}模式</span>
        </button>
      </div>
    </div>
  );
}
