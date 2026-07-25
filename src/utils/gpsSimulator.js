/**
 * GPS Simulator for Running Demo & Testing
 * Generates realistic running GPS paths around parks & cities.
 */

// Taipei Daan Park Loop center around 25.030, 121.535
const DAAN_PARK_NODES = [
  { lat: 25.0335, lng: 121.5328 }, // NW corner (Xinyi & Jianguo)
  { lat: 25.0338, lng: 121.5385 }, // NE corner (Xinyi & Xinsheng)
  { lat: 25.0268, lng: 121.5388 }, // SE corner (Heping & Xinsheng)
  { lat: 25.0265, lng: 121.5330 }, // SW corner (Heping & Jianguo)
  { lat: 25.0335, lng: 121.5328 }  // Back to Start
];

const RIVERSIDE_PARK_NODES = [
  { lat: 25.0782, lng: 121.5451 },
  { lat: 25.0795, lng: 121.5520 },
  { lat: 25.0810, lng: 121.5600 },
  { lat: 25.0785, lng: 121.5650 },
  { lat: 25.0750, lng: 121.5580 },
  { lat: 25.0740, lng: 121.5480 },
  { lat: 25.0782, lng: 121.5451 }
];

export const PRESET_ROUTES = [
  { id: 'daan', name: '大安森林公園環狀路線 (2.5 km)', nodes: DAAN_PARK_NODES },
  { id: 'riverside', name: '美堤河濱景觀跑道 (5.0 km)', nodes: RIVERSIDE_PARK_NODES }
];

export class GPSSimulator {
  constructor(routeId = 'daan') {
    this.route = PRESET_ROUTES.find(r => r.id === routeId) || PRESET_ROUTES[0];
    this.nodes = this.route.nodes;
    this.currentNodeIndex = 0;
    this.progress = 0; // 0 to 1 between nodes
    this.speedKmh = 10.2; // Default runner speed ~10.2 km/h
  }

  // Generate next coordinate based on delta time in seconds
  nextPoint(deltaTimeSeconds = 1) {
    if (this.currentNodeIndex >= this.nodes.length - 1) {
      this.currentNodeIndex = 0; // Loop back
      this.progress = 0;
    }

    const startNode = this.nodes[this.currentNodeIndex];
    const endNode = this.nodes[this.currentNodeIndex + 1];

    // Distance per second in meters
    const metersPerSec = (this.speedKmh * 1000) / 3600;
    // Add minor speed fluctuation (±5%)
    const currentSpeedMps = metersPerSec * (0.95 + Math.random() * 0.1);

    // Approximate distance between node segment (in lat/lng degree approximation)
    const dLat = endNode.lat - startNode.lat;
    const dLng = endNode.lng - startNode.lng;
    const segmentDistMeters = Math.sqrt(dLat * dLat + dLng * dLng) * 111000;

    const deltaProgress = (currentSpeedMps * deltaTimeSeconds) / Math.max(segmentDistMeters, 1);
    this.progress += deltaProgress;

    if (this.progress >= 1) {
      this.currentNodeIndex++;
      this.progress = 0;
      return { lat: endNode.lat, lng: endNode.lng, speedKmh: this.speedKmh };
    }

    // Interpolate with slight GPS jitter (+-0.00002 deg)
    const jitterLat = (Math.random() - 0.5) * 0.00001;
    const jitterLng = (Math.random() - 0.5) * 0.00001;

    const lat = startNode.lat + dLat * this.progress + jitterLat;
    const lng = startNode.lng + dLng * this.progress + jitterLng;

    return { lat, lng, speedKmh: this.speedKmh * (0.96 + Math.random() * 0.08) };
  }
}
