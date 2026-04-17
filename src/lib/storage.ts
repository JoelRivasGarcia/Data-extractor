import { get, set, del, clear, keys } from 'idb-keyval';
import { EquipmentRecord } from '../types';

const STORAGE_KEY_PREFIX = 'records_cache_';
const LAST_SYNC_PREFIX = 'last_sync_';
const PENDING_KEY = 'pending_uploads_v2';

export interface PendingUpload {
  id: string;
  blob: Blob;
  name: string;
  timestamp: number;
}

export const storage = {
  async saveRecords(projectId: string, records: EquipmentRecord[]): Promise<void> {
    await set(`${STORAGE_KEY_PREFIX}${projectId}`, records);
  },

  async loadRecords(projectId: string): Promise<EquipmentRecord[]> {
    const records = await get<EquipmentRecord[]>(`${STORAGE_KEY_PREFIX}${projectId}`);
    return records || [];
  },

  async setLastSync(projectId: string, timestamp: string): Promise<void> {
    await set(`${LAST_SYNC_PREFIX}${projectId}`, timestamp);
  },

  async getLastSync(projectId: string): Promise<string | null> {
    return await get<string>(`${LAST_SYNC_PREFIX}${projectId}`) || null;
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

  async saveGeminiCache(hash: string, result: any): Promise<void> {
    await set(`gemini_cache_${hash}`, { result, timestamp: Date.now() });
  },

  async getGeminiCache(hash: string): Promise<any | null> {
    const cached = await get<{result: any, timestamp: number}>(`gemini_cache_${hash}`);
    if (cached && Date.now() - cached.timestamp < 1000 * 60 * 60 * 24 * 7) { // 7 días
      return cached.result;
    }
    return null;
  },

  // Migration from localStorage
  async migrateFromLocalStorage(): Promise<void> {
    const oldData = localStorage.getItem('equipment_records');
    if (oldData) {
      try {
        const records: EquipmentRecord[] = JSON.parse(oldData);
        // Identify projects and group them
        const projectGroups: Record<string, EquipmentRecord[]> = {};
        records.forEach(r => {
          const pid = r.projectId || 'legacy';
          if (!projectGroups[pid]) projectGroups[pid] = [];
          projectGroups[pid].push(r);
        });
        
        for (const [pid, group] of Object.entries(projectGroups)) {
          await this.saveRecords(pid, group);
        }
        
        localStorage.removeItem('equipment_records');
      } catch (e) {
        console.error('Migration failed', e);
      }
    }
  }
};
