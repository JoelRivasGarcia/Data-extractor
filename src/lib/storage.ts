import { get, set, del, clear, keys } from 'idb-keyval';
import { EquipmentRecord } from '../types';

const STORAGE_KEY_PREFIX = 'records_cache_';
const LAST_SYNC_PREFIX = 'last_sync_';
const PENDING_KEY = 'pending_uploads_v2';
const CONTRACTORS_KEY = 'local_contractors';
const TECHNICIANS_KEY = 'local_technicians_';
const PROJECTS_KEY = 'local_projects_';
const REPORTS_KEY = 'local_reports_';

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

  async saveBlob(id: string, blob: Blob): Promise<void> {
    await set(`blob_${id}`, blob);
  },

  async getBlob(id: string): Promise<Blob | null> {
    return await get<Blob>(`blob_${id}`) || null;
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

  // Offline / Dev Mode Storage
  async saveLocalContractors(contractors: any[]): Promise<void> {
    await set(CONTRACTORS_KEY, contractors);
  },

  async getLocalContractors(): Promise<any[]> {
    return await get(CONTRACTORS_KEY) || [];
  },

  async saveLocalTechnicians(contractorId: string, technicians: any[]): Promise<void> {
    await set(`${TECHNICIANS_KEY}${contractorId}`, technicians);
  },

  async getLocalTechnicians(contractorId: string): Promise<any[]> {
    return await get(`${TECHNICIANS_KEY}${contractorId}`) || [];
  },

  async saveLocalProjects(contractorId: string, projects: any[]): Promise<void> {
    await set(`${PROJECTS_KEY}${contractorId}`, projects);
  },

  async getLocalProjects(contractorId: string): Promise<any[]> {
    return await get(`${PROJECTS_KEY}${contractorId}`) || [];
  },

  async saveLocalReports(projectId: string, reports: any[]): Promise<void> {
    await set(`${REPORTS_KEY}${projectId}`, reports);
  },

  async getLocalReports(projectId: string): Promise<any[]> {
    return await get(`${REPORTS_KEY}${projectId}`) || [];
  },

  async deleteLocalReports(projectId: string): Promise<void> {
    await del(`${REPORTS_KEY}${projectId}`);
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
