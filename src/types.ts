export interface Contractor {
  id: string;
  name: string;
  createdAt: string;
}

export interface Technician {
  id: string; // Matches UID (anonymous or custom)
  contractorId: string;
  name: string;
  pin: string;
  role: 'TECH';
  createdAt: string;
  lastLogin?: string;
}

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
  contractorId: string; // For isolation
  linkedItemId?: string; // ID from the inventory/KMZ
  notes?: string; 
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
  contractorId: string; // For isolation
  members: string[]; // UID list for read optimization
  createdAt: string;
  createdBy: string;
  status: 'active' | 'archived';
  telegramChatId?: string;
  // Optimización de lecturas
  lastRecordsUpdate?: string;
  lastKmzUpdate?: string;
  lastReportsUpdate?: string;
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
  assignedTo?: string; // Technician ID
  assignedAt?: string;
  manualStatus?: 'PENDING' | 'INSTALLED';
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
  assignedTo?: string; // Technician ID
  assignedAt?: string;
  manualStatus?: 'PENDING' | 'COMPLETED';
}

export interface TendidoReport {
  id: string;
  projectId: string;
  contractorId: string; // For isolation
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
  technicianId?: string; // Reference to Technician entity
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
