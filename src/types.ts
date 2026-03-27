export interface EquipmentRecord {
  id: string;
  imageUrl: string;
  code: string;
  type: 'CTO' | 'MUFA' | 'RESERVA';
  coordinates: string;
  timestamp: string;
  power: string;
  extractedAt: string;
}

export interface ExtractionResult {
  code: string;
  type: 'CTO' | 'MUFA' | 'RESERVA';
  coordinates: string;
  timestamp: string;
  power: string;
}
