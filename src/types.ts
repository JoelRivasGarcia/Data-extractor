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
}

export interface ExtractionResult {
  code: string;
  type: 'CTO' | 'MUFA' | 'RESERVA';
  coordinates: string;
  timestamp: string;
  power: string;
}
