import { get, set, del, clear, keys } from 'idb-keyval';
import { EquipmentRecord } from '../types';

const STORAGE_KEY = 'equipment_records_v2';

export const storage = {
  async saveRecords(records: EquipmentRecord[]): Promise<void> {
    await set(STORAGE_KEY, records);
  },

  async loadRecords(): Promise<EquipmentRecord[]> {
    const records = await get<EquipmentRecord[]>(STORAGE_KEY);
    return records || [];
  },

  async clearAll(): Promise<void> {
    await clear();
  },

  // Migration from localStorage
  async migrateFromLocalStorage(): Promise<EquipmentRecord[] | null> {
    const oldData = localStorage.getItem('equipment_records');
    if (oldData) {
      try {
        const records = JSON.parse(oldData);
        await this.saveRecords(records);
        localStorage.removeItem('equipment_records');
        return records;
      } catch (e) {
        console.error('Migration failed', e);
        return null;
      }
    }
    return null;
  }
};
