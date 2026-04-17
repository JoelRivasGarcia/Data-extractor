export interface EquipmentRecord {
  id: string;
  imageUrl?: string; // Optional now, as it might be loaded lazily
  code: string;
  type: 'CTO' | 'MUFA' | 'RESERVA';
  coordinates: string;
  timestamp: string;
  power: string;
  extractedAt: string;
  method?: 'LOCAL' | 'GEMINI' | 'HYBRID';
  aiModel?: string;
  isNew?: boolean;
  userId?: string;
  projectId: string;
}

export interface ProjectIndex {
  projectId: string;
  lastUpdated: string;
  items: EquipmentRecordSummary[];
}

export interface EquipmentRecordSummary {
  id: string;
  code: string;
  type: 'CTO' | 'MUFA' | 'RESERVA';
  coordinates: string;
  power: string;
  extractedAt: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  status: 'active' | 'archived';
}

export interface ExtractionResult {
  code: string;
  type: 'CTO' | 'MUFA' | 'RESERVA';
  coordinates: string;
  timestamp: string;
  power: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: 'CTO' | 'MUFA' | 'RESERVA';
  coordinates: {
    lat: number;
    lng: number;
  };
  celda?: string;
  status: 'PENDING' | 'INSTALLED';
  recordId?: string; // Reference to the record that matched this item
}

export interface TendidoItem {
  id: string;
  name: string;
  type: '96H' | '48H' | '24H' | 'OTRO';
  linearDistance: number; // in meters
  totalDistance: number; // linear + extras
  points: { lat: number; lng: number }[];
  celda?: string;
  equipmentCount: {
    ctoMufa: number;
    reserva50: number;
    reserva60: number;
    pasantes: number;
  };
  extrasDetails?: string[];
}

export interface TendidoReport {
  id: string;
  projectId: string;
  tendidoId: string;
  startMeter: number;
  endMeter: number;
  hardware: {
    cintaBandi: number;
    hevillas: number;
    etiquetas: number;
    alambre: number;
    mensajero: number;
    cruceta: number;
    brazoCruceta: number;
    grillete: number;
    chapas: number;
    clevi: number;
    preformado: number;
    brazo060: number;
    brazo1m: number;
    otros: string;
  };
  timestamp: string;
  technician: string;
  notes?: string;
}

export interface KmzProject {
  id: string;
  name: string;
  items: InventoryItem[];
  tendidos: TendidoItem[];
  uploadedAt: string;
  reports?: TendidoReport[];
}
