export interface EquipmentRecord {
  id: string;
  imageUrl: string;
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
