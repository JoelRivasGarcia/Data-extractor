import JSZip from 'jszip';
import { InventoryItem, TendidoItem } from '../types';

export async function parseKmz(file: File): Promise<{ name: string; items: InventoryItem[]; tendidos: TendidoItem[] }> {
  const zip = new JSZip();
  const contents = await zip.loadAsync(file);
  
  const kmlFile = Object.keys(contents.files).find(name => name.endsWith('.kml'));
  if (!kmlFile) throw new Error("No se encontró un archivo KML dentro del KMZ");
  
  const kmlText = await contents.files[kmlFile].async('string');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
  
  const items: InventoryItem[] = [];
  const tendidos: TendidoItem[] = [];
  const projectName = xmlDoc.querySelector('Document > name')?.textContent || file.name.replace('.kmz', '');

  const getCoords = (placemark: Element) => {
    const coordText = placemark.querySelector('Point > coordinates')?.textContent;
    if (!coordText) return null;
    const [lng, lat] = coordText.trim().split(',').map(Number);
    return { lat, lng };
  };

  const getLinePoints = (placemark: Element) => {
    const coordText = placemark.querySelector('LineString > coordinates')?.textContent;
    if (!coordText) return [];
    return coordText.trim().split(/\s+/).map(coord => {
      const [lng, lat] = coord.split(',').map(Number);
      return { lat, lng };
    });
  };

  const placemarks = Array.from(xmlDoc.querySelectorAll('Placemark'));
  
  placemarks.forEach(pm => {
    const name = pm.querySelector('name')?.textContent || 'S/N';
    const fullPath = getFolderPath(pm);
    const fullPathUpper = fullPath.toUpperCase();
    
    // Skip if not in a relevant folder (optional, but helps if KMZ has unrelated data)
    // For now we assume everything in the KMZ might be relevant if it matches our criteria
    
    const pointCoords = getCoords(pm);
    const linePoints = getLinePoints(pm);
    
    if (pointCoords) {
      let type: 'CTO' | 'MUFA' | 'RESERVA' | null = null;
      const nameUpper = name.toUpperCase();
      
      if (fullPathUpper.includes('MUFA') || nameUpper.includes('MUFA')) type = 'MUFA';
      else if (fullPathUpper.includes('RESERVA') || nameUpper.includes('RESERVA')) type = 'RESERVA';
      else if (fullPathUpper.includes('CTO') || nameUpper.includes('CTO')) type = 'CTO';
      
      if (type) {
        let itemCelda = '';
        if (fullPathUpper.includes('CELDAS')) {
          const parts = fullPath.split(' > ');
          const partsUpper = fullPathUpper.split(' > ');
          const celdasIndex = partsUpper.findIndex(p => p.includes('CELDAS'));
          if (celdasIndex !== -1 && parts[celdasIndex + 1]) {
            itemCelda = parts[celdasIndex + 1];
          }
        }

        items.push({
          id: name || `item-${crypto.randomUUID()}`,
          name,
          type,
          coordinates: pointCoords,
          celda: itemCelda,
          status: 'PENDING'
        });
      }
    } else if (linePoints.length > 1) {
      let linearDist = 0;
      for (let i = 0; i < linePoints.length - 1; i++) {
        linearDist += calculateDistance(linePoints[i].lat, linePoints[i].lng, linePoints[i + 1].lat, linePoints[i + 1].lng);
      }

      let tendidoType: '96H' | '48H' | '24H' | 'OTRO' = 'OTRO';
      if (fullPathUpper.includes('96H')) tendidoType = '96H';
      else if (fullPathUpper.includes('48H')) tendidoType = '48H';
      else if (fullPathUpper.includes('24H')) tendidoType = '24H';
      else if (name.toUpperCase().includes('96H')) tendidoType = '96H';
      else if (name.toUpperCase().includes('48H')) tendidoType = '48H';
      else if (name.toUpperCase().includes('24H')) tendidoType = '24H';

      let tendidoCelda = '';
      if (fullPathUpper.includes('CELDAS')) {
        const parts = fullPath.split(' > ');
        const partsUpper = fullPathUpper.split(' > ');
        const celdasIndex = partsUpper.findIndex(p => p.includes('CELDAS'));
        if (celdasIndex !== -1 && parts[celdasIndex + 1]) {
          tendidoCelda = parts[celdasIndex + 1];
        }
      }

      tendidos.push({
        id: name || `tendido-${crypto.randomUUID()}`,
        name: name || 'Tendido S/N',
        type: tendidoType,
        linearDistance: linearDist,
        totalDistance: linearDist,
        points: linePoints,
        celda: tendidoCelda,
        equipmentCount: { ctoMufa: 0, reserva50: 0, reserva60: 0, pasantes: 0 },
        extrasDetails: []
      });
    }
  });

  // Helper to get full folder path for a placemark
  function getFolderPath(el: Element): string {
    let path = '';
    let parent = el.parentElement;
    while (parent && parent.tagName === 'Folder') {
      const folderName = parent.querySelector('name')?.textContent || '';
      path = folderName + ' > ' + path;
      parent = parent.parentElement;
    }
    return path;
  }

  // Calculate extra distances for tendidos
  tendidos.forEach(tendido => {
    const startPoint = tendido.points[0];
    const endPoint = tendido.points[tendido.points.length - 1];
    
    tendido.extrasDetails = [];
    tendido.totalDistance = tendido.linearDistance; // Reset to linear before adding extras
    
    // 1. Extremos: 15m cada uno (Total +30m)
    tendido.totalDistance += 30;
    tendido.extrasDetails.push("+30m (Extremos)");

    items.forEach(item => {
      const distToStart = calculateDistance(item.coordinates.lat, item.coordinates.lng, startPoint.lat, startPoint.lng);
      const distToEnd = calculateDistance(item.coordinates.lat, item.coordinates.lng, endPoint.lat, endPoint.lng);
      
      // Threshold of 10 meters to match the detection radius and avoid double counting at ends
      const isAtEnd = distToStart < 10 || distToEnd < 10;

      if (isPointNearLine(item.coordinates, tendido.points, 10)) { // 10m threshold
        if (item.type === 'RESERVA') {
          // Extract meters from name (e.g., "Reserva 10m" -> 10)
          const meters = parseInt(item.name.replace(/[^0-9]/g, '')) || 50;
          tendido.totalDistance += meters;
          tendido.extrasDetails.push(`+${meters}m (${item.name})`);
          
          if (meters === 60) tendido.equipmentCount.reserva60++;
          else tendido.equipmentCount.reserva50++;
        } else if (!isAtEnd) {
          // Pasante logic refined by cable type
          let shouldAddExtra = false;
          let label = "";

          if (item.type === 'MUFA') {
            // 96H and 48H consider MUFAs, 24H does NOT (only CTOs)
            if (tendido.type === '96H' || tendido.type === '48H' || tendido.type === 'OTRO') {
              shouldAddExtra = true;
              label = "+20m (MUFA pasante)";
            }
          } else if (item.type === 'CTO') {
            // 24H considers CTOs, 96H and 48H do NOT
            if (tendido.type === '24H' || tendido.type === 'OTRO') {
              shouldAddExtra = true;
              label = "+20m (CTO pasante)";
            }
          }

          if (shouldAddExtra) {
            tendido.totalDistance += 20;
            tendido.equipmentCount.pasantes++;
            tendido.extrasDetails.push(label);
          }
        }
      }
    });
  });

  return { name: projectName, items, tendidos };
}

function isPointNearLine(point: { lat: number; lng: number }, line: { lat: number; lng: number }[], threshold: number): boolean {
  // 1. Fast Bounding Box Check: If the point is far from the entire line's BB, skip expensive math
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of line) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  
  // Convert threshold (meters) to approximate degrees (rough estimation is enough for BB)
  const thresholdDeg = threshold / 111320; 
  if (point.lat < minLat - thresholdDeg || point.lat > maxLat + thresholdDeg ||
      point.lng < minLng - thresholdDeg || point.lng > maxLng + thresholdDeg) {
    return false;
  }

  // 2. Precise Segment Check
  for (let i = 0; i < line.length - 1; i++) {
    const dist = distToSegment(point, line[i], line[i + 1]);
    if (dist <= threshold) return true;
  }
  return false;
}

function distToSegment(p: { lat: number; lng: number }, v: { lat: number; lng: number }, w: { lat: number; lng: number }): number {
  // Use squared coordinate distance for the ratio 't' to avoid mixing units
  const l2 = Math.pow(w.lat - v.lat, 2) + Math.pow(w.lng - v.lng, 2);
  if (l2 === 0) return calculateDistance(p.lat, p.lng, v.lat, v.lng);
  
  // Calculate projection ratio t
  let t = ((p.lat - v.lat) * (w.lat - v.lat) + (p.lng - v.lng) * (w.lng - v.lng)) / l2;
  t = Math.max(0, Math.min(1, t));
  
  const projection = {
    lat: v.lat + t * (w.lat - v.lat),
    lng: v.lng + t * (w.lng - v.lng)
  };
  
  // Final distance in meters using Haversine
  return calculateDistance(p.lat, p.lng, projection.lat, projection.lng);
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
}
