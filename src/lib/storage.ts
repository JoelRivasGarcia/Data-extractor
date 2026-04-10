import { get, set, del, clear, keys } from 'idb-keyval';
import { EquipmentRecord } from '../types';

const STORAGE_KEY = 'equipment_records_v2';
const PENDING_KEY = 'pending_uploads_v2';

export interface PendingUpload {
  id: string;
  blob: Blob;
  name: string;
  timestamp: number;
}

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

  // Pending Uploads Management
  async savePendingUploads(uploads: PendingUpload[]): Promise<void> {
    await set(PENDING_KEY, uploads);
  },

  async getPendingUploads(): Promise<PendingUpload[]> {
    const uploads = await get<PendingUpload[]>(PENDING_KEY);
    return uploads || [];
  },

  async addPendingUpload(upload: PendingUpload): Promise<void> {
    const uploads = await this.getPendingUploads();
    await set(PENDING_KEY, [...uploads, upload]);
  },

  async removePendingUpload(id: string): Promise<void> {
    const uploads = await this.getPendingUploads();
    const updated = uploads.filter(u => u.id !== id);
    if (updated.length === 0) {
      await del(PENDING_KEY);
    } else {
      await set(PENDING_KEY, updated);
    }
  },

  async clearPendingUploads(): Promise<void> {
    await del(PENDING_KEY);
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
