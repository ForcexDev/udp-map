import L from 'leaflet';

export const createMarkerIcon = (color: string, svgPath: string, opacity: number = 1, isPinned: boolean = false) => {
  const pinBadge = isPinned ? `
    <div style="position:absolute;top:-6px;right:-6px;background:linear-gradient(135deg,#FFD700,#FFA500);border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 8px rgba(255,165,0,0.4);z-index:5;">
      <svg viewBox="0 0 24 24" width="10" height="10" fill="#fff"><path d="M16 9V4l1 0c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1l1 0v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/></svg>
    </div>
  ` : '';

  // --- CONFIGURACIÓN DE TAMAÑO ---
  // Para hacer los iconos más pequeños, ajusta estas variables:
  const iconW = 40;  // Ancho del cuadro blanco
  const iconH = 40;  // Alto del cuadro blanco
  const containerH = 50; // Alto total (cuadro + flecha)

  return L.divIcon({
    html: `
      <div class="udp-marker marker-shadow" style="width:${iconW}px;height:${containerH}px;position:relative;opacity:${opacity};">
        ${pinBadge}
        <div style="
          width:${iconW}px;height:${iconH}px;
          border-radius:16px;
          background:white;
          border:2.5px solid ${color};
          display:flex;align-items:center;justify-content:center;
          position:relative;z-index:2;
          box-shadow:0 4px 16px rgba(0,0,0,0.15), 0 0 0 3px ${color}15;
        ">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="${color}"><path d="${svgPath}"/></svg>
        </div>
        <div style="
          position:absolute;bottom:2px;left:50%;transform:translateX(-50%);
          width:0;height:0;
          border-left:8px solid transparent;
          border-right:8px solid transparent;
          border-top:10px solid ${color};
          z-index:1;
          filter:drop-shadow(0 2px 4px rgba(0,0,0,0.15));
        "></div>
      </div>
    `,
    className: '',
    iconSize: [iconW, containerH],
    iconAnchor: [iconW / 2, containerH],
    popupAnchor: [0, -containerH]
  });
};

export const createFacultyIcon = (name: string, image?: string) => {
  // --- CONFIGURACIÓN DE TAMAÑO FACULTADES ---
  const avatarSize = 40; // Tamaño del avatar circular
  const iconW = 140;     // Ancho del contenedor invisible para centrar
  const iconH = 64;      // Alto del contenedor

  const avatarHtml = image
    ? `<img src="${image}" style="width:${avatarSize}px;height:${avatarSize}px;border-radius:12px;object-fit:cover;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.15);" loading="lazy" alt="${name}" />`
    : `<div style="width:${avatarSize}px;height:${avatarSize}px;border-radius:12px;background:#D41F2D;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
        <svg viewBox="0 0 24 24" width="${avatarSize * 0.45}" height="${avatarSize * 0.45}" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
      </div>`;

  return L.divIcon({
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;gap:4px;width:${iconW}px;">
        ${avatarHtml}
        <div style="
          background:rgba(255,255,255,0.95);
          padding:3px 10px;
          border-radius:10px;
          border:1.5px solid rgba(212,31,45,0.2);
          box-shadow:0 4px 12px rgba(0,0,0,0.1);
        ">
          <span style="font-size:9px;font-weight:800;color:#D41F2D;text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;">${name}</span>
        </div>
      </div>
    `,
    className: '',
    iconSize: [iconW, iconH],
    iconAnchor: [iconW / 2, iconH / 2]
  });
};

export const createUserLocationIcon = () => {
  const dotSize = 18;
  const pulseExtra = 10; // extra radius for pulse ring
  const totalSize = dotSize + pulseExtra * 2;
  return L.divIcon({
    html: `
      <div class="user-location-dot" style="width:${totalSize}px;height:${totalSize}px;display:flex;align-items:center;justify-content:center;">
        <div style="width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:#D41F2D;border:3px solid white;box-shadow:0 2px 8px rgba(212,31,45,0.4);position:relative;z-index:2;"></div>
      </div>
    `,
    className: '',
    iconSize: [totalSize, totalSize],
    iconAnchor: [totalSize / 2, totalSize / 2]
  });
};

export const timeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'ahora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days}d`;
  return new Date(timestamp).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
};

export const isPointInPolygon = (point: { lat: number, lng: number }, polygon: [number, number][]): boolean => {
  const x = point.lat, y = point.lng;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};
