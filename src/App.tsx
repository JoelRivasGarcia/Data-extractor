import * as React from 'react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Upload, 
  Table, 
  Trash2, 
  Download, 
  Image as ImageIcon, 
  MapPin, 
  Calendar, 
  Hash,
  Search,
  Filter,
  Loader2,
  X,
  Plus,
  Box,
  Layers,
  RotateCcw,
  Zap,
  Map,
  ArrowUpDown,
  Wifi,
  WifiOff,
  Database,
  Edit3,
  CloudUpload,
  CheckCircle,
  AlertCircle,
  LogIn,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  FileSpreadsheet,
  Settings,
  Eye,
  EyeOff,
  ExternalLink,
  Info,
  Bell,
  BellRing,
  FileText,
  Activity,
  AlertTriangle,
  Copy,
  ChevronDown,
  Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import EXIF from 'exif-js';
import Tesseract from 'tesseract.js';
import { EquipmentRecord, Project, InventoryItem, KmzProject, TendidoItem, TendidoReport } from './types';
import { parseKmz, calculateDistance } from './services/kmzService';
import { extractEquipmentData } from './services/geminiService';
import { extractWithOpenRouter, fetchOpenRouterModels } from './services/openRouterService';
import { storage, PendingUpload } from './lib/storage';
import { auth, googleProvider, signInWithPopup, signOut, db, collection, query, where, onSnapshot, doc, setDoc, limit, getDocs } from './firebase';
import { useAuth, handleFirestoreError, OperationType } from './FirebaseProvider';
import { deleteDoc } from 'firebase/firestore';

export default function App() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [records, setRecords] = useState<EquipmentRecord[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CTO' | 'MUFA' | 'RESERVA'>('ALL');
  const [uploadType, setUploadType] = useState<'CTO' | 'MUFA' | 'RESERVA'>('CTO');
  const [sortOrder, setSortOrder] = useState<'NEWEST' | 'OLDEST' | 'SERIAL_ASC' | 'SERIAL_DESC' | 'POWER_ASC' | 'POWER_DESC'>('NEWEST');
  const [selectedModel, setSelectedModel] = useState<string>("gemini-flash-latest");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showDeleteKmzConfirm, setShowDeleteKmzConfirm] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadSummary, setUploadSummary] = useState<{
    total: number;
    success: number;
    failed: { name: string; error: string }[];
  } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(localStorage.getItem('currentProjectId'));
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [openRouterKey, setOpenRouterKey] = useState<string>(localStorage.getItem('openRouterKey') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'EXTRACTION' | 'INVENTORY' | 'REPORTS'>('EXTRACTION');
  const [inventorySubTab, setInventorySubTab] = useState<'EQUIPOS' | 'TENDIDOS'>('EQUIPOS');
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState<'ALL' | 'CTO' | 'MUFA' | 'RESERVA'>('ALL');
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<'ALL' | 'PENDING' | 'INSTALLED'>('ALL');
  const [inventoryCeldaFilter, setInventoryCeldaFilter] = useState('ALL');
  const [tendidoTypeFilter, setTendidoTypeFilter] = useState<'ALL' | '96H' | '48H' | '24H' | 'OTRO'>('ALL');
  const [tendidoStatusFilter, setTendidoStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  const [tendidoCeldaFilter, setTendidoCeldaFilter] = useState('ALL');
  const [kmzProject, setKmzProject] = useState<KmzProject | null>(null);
  const [tendidoReports, setTendidoReports] = useState<TendidoReport[]>([]);
  const [editingTendidoId, setEditingTendidoId] = useState<string | null>(null);
  const [editTendidoName, setEditTendidoName] = useState('');
  const [isParsingKmz, setIsParsingKmz] = useState(false);
  const [newReport, setNewReport] = useState<Partial<TendidoReport>>({
    hardware: { 
      cintaBandi: 0, hevillas: 0, etiquetas: 0, alambre: 0, mensajero: 0, 
      cruceta: 0, brazoCruceta: 0, grillete: 0, chapas: 0, clevi: 0, 
      preformado: 0, brazo060: 0, brazo1m: 0, otros: '' 
    }
  });
  const [showReportSummary, setShowReportSummary] = useState<TendidoReport | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const kmzFileInputRef = useRef<HTMLInputElement>(null);
  const isKmzInitialLoad = useRef(true);
  const lastProjectId = useRef<string | null>(null);

  useEffect(() => {
    if (currentProjectId) {
      // If project changed, reset load flag and filters
      if (lastProjectId.current !== currentProjectId) {
        isKmzInitialLoad.current = true;
        lastProjectId.current = currentProjectId;
        
        // Reset filters to avoid "leaking" data from previous project
        setInventoryCeldaFilter('ALL');
        setInventoryTypeFilter('ALL');
        setInventoryStatusFilter('ALL');
        setTendidoCeldaFilter('ALL');
        setTendidoTypeFilter('ALL');
        setTendidoStatusFilter('ALL');
        setInventorySearchQuery('');
      }

      if (isKmzInitialLoad.current) {
        // Cleanup old global keys from previous versions
        localStorage.removeItem('kmzProject');
        localStorage.removeItem('tendidoReports');
        
        const savedKmz = localStorage.getItem(`kmzProject_${currentProjectId}`);
        const savedReports = localStorage.getItem(`tendidoReports_${currentProjectId}`);
        
        setKmzProject(savedKmz ? JSON.parse(savedKmz) : null);
        setTendidoReports(savedReports ? JSON.parse(savedReports) : []);
        isKmzInitialLoad.current = false;
      } else {
        // Save only after initial load
        if (kmzProject) {
          localStorage.setItem(`kmzProject_${currentProjectId}`, JSON.stringify(kmzProject));
        } else {
          localStorage.removeItem(`kmzProject_${currentProjectId}`);
        }
        localStorage.setItem(`tendidoReports_${currentProjectId}`, JSON.stringify(tendidoReports));
      }
    } else {
      setKmzProject(null);
      setTendidoReports([]);
      isKmzInitialLoad.current = true;
      lastProjectId.current = null;
    }
  }, [kmzProject, tendidoReports, currentProjectId]);

  useEffect(() => {
    if (authLoading || !user || !isAdmin) return;

    const syncLocalProjects = async () => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('kmzProject_')) {
          const projectId = key.replace('kmzProject_', '');
          
          // Check if this project exists in the cloud list
          if (!projects.find(p => p.id === projectId)) {
            try {
              const localData = JSON.parse(localStorage.getItem(key) || '{}');
              if (localData.name) {
                console.log("Syncing local project to cloud:", localData.name);
                const newProject: Project = {
                  id: projectId,
                  name: localData.name,
                  createdAt: new Date().toISOString(),
                  createdBy: user.uid,
                  status: 'active'
                };
                await setDoc(doc(db, 'projects', projectId), newProject);
                // Auto-select if none selected
                if (!currentProjectId) {
                  setCurrentProjectId(projectId);
                  localStorage.setItem('currentProjectId', projectId);
                }
                // The onSnapshot will pick it up and add it to the list
              }
            } catch (e) {
              console.error("Error syncing local project:", e);
            }
          }
        }
      }
    };

    syncLocalProjects();
  }, [user, isAdmin, projects, authLoading]);

  useEffect(() => {
    if (authLoading || !user || !currentProjectId) return;

    const syncLocalRecords = async () => {
      try {
        // 1. Try to migrate from old localStorage key first
        const migratedRecords = await storage.migrateFromLocalStorage();
        if (migratedRecords && migratedRecords.length > 0) {
          console.log(`Migrated ${migratedRecords.length} records from localStorage to IndexedDB.`);
        }

        // 2. Load all local records from IndexedDB
        const localRecords = await storage.loadRecords();
        if (localRecords.length > 0) {
          console.log(`Found ${localRecords.length} local records. Syncing to cloud...`);
          for (const record of localRecords) {
            const updatedRecord = {
              ...record,
              projectId: record.projectId || currentProjectId,
              userId: record.userId || user.uid
            };
            
            try {
              await setDoc(doc(db, 'records', updatedRecord.id), updatedRecord, { merge: true });
            } catch (e) {
              console.error("Error syncing local record:", e);
            }
          }
          // Clear local storage after successful sync attempt
          await storage.saveRecords([]); 
        }
      } catch (e) {
        console.error("Error in syncLocalRecords:", e);
      }
    };

    syncLocalRecords();
  }, [user, authLoading, currentProjectId]);

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  };

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5);

      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.error("Error playing sound:", e);
    }
  };

  const showDesktopNotification = (success: number, total: number) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification("Proceso Finalizado", {
        body: `Se procesaron ${success} de ${total} fotos correctamente.`,
      });
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.code === 'auth/popup-blocked') {
        setError("El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para este sitio.");
      } else if (err.code === 'auth/unauthorized-domain') {
        setError("Dominio no autorizado. Debes añadir la URL de Netlify en la Consola de Firebase > Authentication > Settings > Authorized domains.");
      } else if (err.code === 'auth/cancelled-popup-request') {
        // User closed the popup, no need to show error
      } else {
        setError("Error al iniciar sesión: " + (err.message || "Error desconocido"));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ code: string; coordinates: string }>({ code: '', coordinates: '' });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const checkPending = async () => {
      const pending = await storage.getPendingUploads();
      setPendingCount(pending.length);
    };
    checkPending();
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setProjects([]);
      setCurrentProjectId(null);
      return;
    }

    const q = query(collection(db, 'projects'), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      setProjects(projectsData);
      
      // If current project is not in the list anymore, don't delete it immediately
      // It might be a local project that needs to be synced to the cloud
      if (currentProjectId && !projectsData.find(p => p.id === currentProjectId)) {
        console.log("Project not found in cloud, might be local:", currentProjectId);
      }
      
      // Auto-select first project if none selected and we don't have a local one
      if (!currentProjectId && projectsData.length > 0) {
        setCurrentProjectId(projectsData[0].id);
        localStorage.setItem('currentProjectId', projectsData[0].id);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });

    return () => unsubscribe();
  }, [user, authLoading]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setRecords([]);
      setIsInitialLoad(false);
      return;
    }

    if (!currentProjectId) {
      setRecords([]);
      setIsInitialLoad(false);
      return;
    }

    // Fetch records for the current project
    const q = query(
      collection(db, 'records'), 
      where('projectId', '==', currentProjectId)
    );
    
    // Deep recovery: Fetch recent records for this user to find orphans or mislinked photos
    const recoveryQ = query(
      collection(db, 'records'),
      where('userId', '==', user.uid),
      limit(1000) // Check last 1000 photos for recovery
    );

    const syncRecords = (snapshot: any) => {
      const recordsToUpdate: { ref: any, data: any }[] = [];
      
      setRecords(prev => {
        const newRecords = [...prev];
        snapshot.forEach((doc: any) => {
          const data = doc.data() as EquipmentRecord;
          const index = newRecords.findIndex(r => r.id === data.id);
          
          // Recovery logic: If record has no project OR project doesn't exist in cloud
          // ONLY run this if projects have been loaded to avoid false positives
          const projectExists = projects.some(p => p.id === data.projectId);
          if (projects.length > 0 && currentProjectId && (!data.projectId || !projectExists)) {
            console.log("Found record to recover:", data.id);
            recordsToUpdate.push({ ref: doc.ref, data: { ...data, projectId: currentProjectId } });
            data.projectId = currentProjectId;
          }

          if (index >= 0) {
            newRecords[index] = data;
          } else {
            newRecords.push(data);
          }
        });
        // Only show records for the current project in the UI
        return newRecords.filter(r => r.projectId === currentProjectId);
      });

      // Perform updates outside of state setter
      recordsToUpdate.forEach(({ ref, data }) => {
        setDoc(ref, data, { merge: true }).catch(err => console.error("Error recovering record:", err));
      });

      setIsInitialLoad(false);
    };

    const unsubscribe = onSnapshot(q, (snapshot) => syncRecords(snapshot), (error) => {
      handleFirestoreError(error, OperationType.LIST, 'records');
    });

    const unsubscribeRecovery = onSnapshot(recoveryQ, (snapshot) => syncRecords(snapshot), (error) => {
      console.warn("Recovery fetch error:", error);
    });

    return () => {
      unsubscribe();
      unsubscribeRecovery();
    };
  }, [user, authLoading, currentProjectId, projects]);

  useEffect(() => {
    const initPending = async () => {
      // Check for pending uploads to resume (only if online and logged in)
      if (user && isOnline) {
        const pending = await storage.getPendingUploads();
        if (pending.length > 0) {
          console.log(`Resuming ${pending.length} pending uploads...`);
          processFiles(pending, true);
        }
      }
    };
    initPending();
  }, [user, isOnline]);

  useEffect(() => {
    if (isInitialLoad) return;
    
    const saveToStorage = async () => {
      try {
        await storage.saveRecords(records);
      } catch (err) {
        console.error('Error saving to IndexedDB:', err);
        setError('Error al guardar los datos. Es posible que el almacenamiento del navegador esté lleno.');
      }
    };
    saveToStorage();
  }, [records, isInitialLoad]);

  useEffect(() => {
    if (kmzProject && records.length > 0) {
      const updatedItems = kmzProject.items.map(item => {
        // If already installed, keep it
        if (item.status === 'INSTALLED') return item;

        // Try to find a match in records
        const match = records.find(record => {
          if (record.type !== item.type) return false;

          if (item.type === 'CTO') {
            // Match by serial code (exact or contains)
            return record.code.toUpperCase().includes(item.name.toUpperCase()) || 
                   item.name.toUpperCase().includes(record.code.toUpperCase());
          }

          if (item.type === 'MUFA') {
            // Match by numeric digits
            const recordDigits = record.code.replace(/\D/g, '');
            const itemDigits = item.name.replace(/\D/g, '');
            return recordDigits.length > 4 && itemDigits.includes(recordDigits);
          }

          if (item.type === 'RESERVA') {
            // Match by GPS proximity (30m)
            const [recLat, recLon] = record.coordinates.split(',').map(c => parseFloat(c.trim()));
            if (isNaN(recLat) || isNaN(recLon)) return false;
            const dist = calculateDistance(recLat, recLon, item.coordinates.lat, item.coordinates.lng);
            return dist <= 30;
          }

          return false;
        });

        if (match) {
          return { ...item, status: 'INSTALLED', recordId: match.id };
        }
        return item;
      });

      // Only update if something changed to avoid infinite loops
      const hasChanges = updatedItems.some((item, idx) => item.status !== kmzProject.items[idx].status);
      if (hasChanges) {
        setKmzProject({
          ...kmzProject,
          items: updatedItems
        });
      }
    }
  }, [records, kmzProject?.items]);

  const handleKmzUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingKmz(true);
    try {
      const { name, items, tendidos } = await parseKmz(file);
      setKmzProject({
        id: crypto.randomUUID(),
        name,
        items,
        tendidos,
        uploadedAt: new Date().toISOString()
      });
      setActiveTab('INVENTORY');
    } catch (err) {
      console.error("Error parsing KMZ:", err);
      setError("No se pudo procesar el archivo KMZ. Asegúrate de que sea un archivo válido de Google Earth.");
    } finally {
      setIsParsingKmz(false);
      if (e.target) e.target.value = '';
    }
  };

  const clearNewHighlights = () => {
    setNewlyAddedIds(new Set());
  };

  const deleteTendido = (id: string) => {
    if (!kmzProject) return;
    setKmzProject({
      ...kmzProject,
      tendidos: kmzProject.tendidos.filter(t => t.id !== id)
    });
  };

  const copyReportToClipboard = (report: TendidoReport) => {
    const tendido = kmzProject?.tendidos.find(t => t.id === report.tendidoId);
    const date = new Date(report.timestamp);
    
    let text = `FECHA: ${date.toLocaleDateString()}\n`;
    text += `HORA: ${date.toLocaleTimeString()}\n`;
    text += `PROYECTO: ${kmzProject?.name || 'N/A'}\n\n`;
    text += `TECNICO: ${report.technician}\n\n`;
    text += `TRAMO: ${tendido?.name || 'N/A'}\n\n`;
    text += `Punta Inicial: ${report.startMeter}m\n`;
    text += `Punta Final: ${report.endMeter}m\n`;
    text += `Tendido: ${Math.abs(report.endMeter - report.startMeter)}m\n`;
    
    const hardwareLabels: Record<string, string> = {
      preformado: 'PREFORMADO',
      clevi: 'CLEVIS',
      brazo060: 'BRAZO 60',
      cintaBandi: 'CINTA BANDI',
      hevillas: 'HEBILLA',
      etiquetas: 'ETIQETAS',
      cruceta: 'CRUZETA',
      alambre: 'ALAMBRE',
      brazoCruceta: 'BRAZO CRUZETA',
      mensajero: 'MENSAJERO',
      chapas: 'CHAPA',
      grillete: 'GRILLETE',
      brazo1m: 'BRAZO DE 1MT'
    };

    Object.entries(hardwareLabels).forEach(([key, label]) => {
      const val = report.hardware[key as keyof typeof report.hardware];
      if (typeof val === 'number' && val > 0) {
        text += `${label}: ${val}\n`;
      }
    });

    if (report.hardware.otros) {
      text += `OTROS: ${report.hardware.otros}\n`;
    }

    if (report.notes) {
      text += `\nOBSERVACIONES: ${report.notes}\n`;
    }

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const startEditingReport = (report: TendidoReport) => {
    setEditingReportId(report.id);
    setNewReport({
      tendidoId: report.tendidoId,
      startMeter: report.startMeter,
      endMeter: report.endMeter,
      hardware: { ...report.hardware },
      notes: report.notes || '',
      technician: report.technician || ''
    });
    setActiveTab('REPORTS');
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteReport = (id: string) => {
    setTendidoReports(prev => prev.filter(r => r.id !== id));
  };

  const startEditingTendido = (tendido: TendidoItem) => {
    setEditingTendidoId(tendido.id);
    setEditTendidoName(tendido.name);
  };

  const saveTendidoEdit = () => {
    if (!kmzProject || !editingTendidoId) return;
    setKmzProject({
      ...kmzProject,
      tendidos: kmzProject.tendidos.map(t => 
        t.id === editingTendidoId ? { ...t, name: editTendidoName } : t
      )
    });
    setEditingTendidoId(null);
  };

  const saveReport = () => {
    if (!newReport.tendidoId || newReport.startMeter === undefined || newReport.endMeter === undefined) return;
    
    if (editingReportId) {
      setTendidoReports(prev => prev.map(r => 
        r.id === editingReportId ? {
          ...r,
          tendidoId: newReport.tendidoId!,
          startMeter: newReport.startMeter!,
          endMeter: newReport.endMeter!,
          hardware: newReport.hardware as any,
          notes: newReport.notes,
          technician: newReport.technician || r.technician
        } : r
      ));
      setEditingReportId(null);
    } else {
      const report: TendidoReport = {
        id: crypto.randomUUID(),
        tendidoId: newReport.tendidoId,
        startMeter: newReport.startMeter,
        endMeter: newReport.endMeter,
        hardware: newReport.hardware as any,
        notes: newReport.notes,
        timestamp: new Date().toISOString(),
        technician: user?.displayName || user?.email || 'Técnico'
      };

      setTendidoReports(prev => [...prev, report]);
      setShowReportSummary(report);
    }

    setNewReport({
      hardware: { 
        cintaBandi: 0, hevillas: 0, etiquetas: 0, alambre: 0, mensajero: 0, 
        cruceta: 0, brazoCruceta: 0, grillete: 0, chapas: 0, clevi: 0, 
        preformado: 0, brazo060: 0, brazo1m: 0, otros: '' 
      },
      notes: '',
      technician: user?.displayName || user?.email || ''
    });
  };

  const uniqueCeldas = useMemo(() => {
    if (!kmzProject) return [];
    return Array.from(new Set(kmzProject.items.map(item => (item.celda || '').trim()).filter(Boolean))) as string[];
  }, [kmzProject?.items]);

  const uniqueTendidoCeldas = useMemo(() => {
    if (!kmzProject) return [];
    return Array.from(new Set(kmzProject.tendidos.map(t => (t.celda || '').trim()).filter(Boolean))) as string[];
  }, [kmzProject?.tendidos]);

  const cellStats = useMemo(() => {
    const stats: Record<string, { total: number; installed: number }> = {};
    if (!kmzProject) return stats;
    kmzProject.items.forEach(item => {
      const celda = (item.celda || '').trim();
      if (celda) {
        if (!stats[celda]) stats[celda] = { total: 0, installed: 0 };
        stats[celda].total++;
        if (item.status === 'INSTALLED') stats[celda].installed++;
      }
    });
    return stats;
  }, [kmzProject?.items]);

  const tendidoCellStats = useMemo(() => {
    const stats: Record<string, { total: number; completed: number }> = {};
    if (!kmzProject) return stats;
    kmzProject.tendidos.forEach(t => {
      const celda = (t.celda || '').trim();
      if (celda) {
        if (!stats[celda]) stats[celda] = { total: 0, completed: 0 };
        stats[celda].total++;
        const hasReports = tendidoReports.some(r => r.tendidoId === t.id);
        if (hasReports) stats[celda].completed++;
      }
    });
    return stats;
  }, [kmzProject?.tendidos, tendidoReports]);

  const handleTendidoKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveTendidoEdit();
    if (e.key === 'Escape') setEditingTendidoId(null);
  };

  const startEditing = (record: EquipmentRecord) => {
    setEditingId(record.id);
    setEditValues({ code: record.code, coordinates: record.coordinates });
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string) => {
    const record = records.find(r => r.id === id);
    if (record) {
      const updatedRecord = { ...record, code: editValues.code, coordinates: editValues.coordinates };
      if (user) {
        try {
          await setDoc(doc(db, 'records', id), updatedRecord);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `records/${id}`);
        }
      } else {
        setRecords(prev => prev.map(r => r.id === id ? updatedRecord : r));
      }
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      saveEdit(id);
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  const extractPowerValue = (powerStr: string) => {
    const match = powerStr.match(/(-?\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : -Infinity;
  };

  const filteredRecords = records
    .filter(record => {
      const matchesSearch = (record.code || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'ALL' || record.type === typeFilter;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      if (sortOrder === 'SERIAL_ASC') return (a.code || '').localeCompare(b.code || '');
      if (sortOrder === 'SERIAL_DESC') return (b.code || '').localeCompare(a.code || '');
      if (sortOrder === 'POWER_ASC') return extractPowerValue(a.power || '') - extractPowerValue(b.power || '');
      if (sortOrder === 'POWER_DESC') return extractPowerValue(b.power || '') - extractPowerValue(a.power || '');
      return 0;
    });

  // Handle NEWEST/OLDEST by reversing if needed (since state is prepended)
  const sortedRecords = sortOrder === 'OLDEST' ? [...filteredRecords].reverse() : filteredRecords;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const fileList = Array.from(files) as File[];
    // Save to pending queue before starting
    const pending: PendingUpload[] = fileList.map(file => ({
      id: Math.random().toString(36).substring(2, 15),
      blob: file as Blob,
      name: file.name,
      timestamp: Date.now()
    }));
    
    await storage.savePendingUploads(pending);
    await processFiles(pending);
  };

  const getExifData = (file: File): Promise<{ coordinates: string | null; timestamp: string | null }> => {
    return new Promise((resolve) => {
      EXIF.getData(file as any, function(this: any) {
        const lat = EXIF.getTag(this, "GPSLatitude");
        const latRef = EXIF.getTag(this, "GPSLatitudeRef");
        const lon = EXIF.getTag(this, "GPSLongitude");
        const lonRef = EXIF.getTag(this, "GPSLongitudeRef");
        const date = EXIF.getTag(this, "DateTimeOriginal") || EXIF.getTag(this, "DateTime");

        let coords = null;
        if (lat && lon) {
          const latDec = (lat[0] + lat[1] / 60 + lat[2] / 3600) * (latRef === "S" ? -1 : 1);
          const lonDec = (lon[0] + lon[1] / 60 + lon[2] / 3600) * (lonRef === "W" ? -1 : 1);
          coords = `${latDec.toFixed(6)}, ${lonDec.toFixed(6)}`;
        }

        let timestamp = null;
        if (date) {
          // EXIF date format is YYYY:MM:DD HH:MM:SS
          const parts = date.split(' ');
          if (parts.length === 2) {
            timestamp = `${parts[0].replace(/:/g, '/')} ${parts[1]}`;
          }
        }

        resolve({ coordinates: coords, timestamp });
      });
    });
  };

  const runLocalOCR = async (file: File): Promise<string> => {
    try {
      const result = await Tesseract.recognize(file, 'eng', {
        logger: m => console.log(m)
      });
      return result.data.text;
    } catch (err) {
      console.error("OCR Error:", err);
      return "";
    }
  };

  const validateData = (data: { code?: string; coordinates?: string; timestamp?: string; type?: string }) => {
    const coordRegex = /^-?\d{1,2}\.\d+,\s*-?\d{1,3}\.\d+$/;
    // Stricter serial code pattern: must have at least one number and be alphanumeric
    const codeRegex = /^(?=.*[0-9])[A-Z0-9-]{6,20}$/i;
    
    // Blacklist of words that are definitely not serial numbers (districts, common labels)
    const blacklist = ['SURQUILLO', 'MIRAFLORES', 'LIMA', 'PERU', 'CTO', 'MUFA', 'RESERVA', 'TELEFONICA', 'CLARO', 'ENTEL'];
    const isBlacklisted = data.code ? blacklist.includes(data.code.toUpperCase()) : false;
    
    const isCoordsValid = data.coordinates ? coordRegex.test(data.coordinates) : false;
    
    // CTO specific validation: MUST start with WN-
    let isCodeValid = data.code ? (codeRegex.test(data.code) && !isBlacklisted) : false;
    if (data.type === 'CTO' && data.code && !data.code.toUpperCase().startsWith('WN-')) {
      isCodeValid = false;
    }

    const isTimestampValid = !!data.timestamp;

    return {
      isCoordsValid,
      isCodeValid,
      isTimestampValid,
      isValid: isCoordsValid && isCodeValid && isTimestampValid
    };
  };

  const extractSerialFromText = (text: string): string | null => {
    // Clean text: remove spaces that might break the WN- prefix
    const cleanText = text.replace(/\s+/g, '');
    
    const patterns = [
      /(WN-[A-Z0-9-]{6,15})/i, // Specific CTO pattern
      /(?:SN|S\/N|COD|CODE|SERIAL|ID)[:\s]*([A-Z0-9-]{6,15})/i,
      /\b(WN[0-9]{4,12})\b/i, // Handle cases where the dash is missing
      /\b([A-Z0-9]{2,4}[0-9]{4,10})\b/i
    ];

    for (const pattern of patterns) {
      const match = cleanText.match(pattern) || text.match(pattern);
      if (match) return match[1] || match[0];
    }
    return null;
  };

  const extractCoordsFromText = (text: string): string | null => {
    // Handle formats like: 12.117775S 77.015488W or -12.117775, -77.015488
    // Pattern 1: Decimal with S/W suffixes (Common in field cameras)
    const swPattern = /(-?\d+\.\d+)\s*[Ss]\s*(-?\d+\.\d+)\s*[Ww]/;
    // Pattern 2: Standard lat, lon
    const stdPattern = /(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/;

    const swMatch = text.match(swPattern);
    if (swMatch) {
      // If it has S/W, we ensure they are negative for Peru
      const lat = -Math.abs(parseFloat(swMatch[1]));
      const lon = -Math.abs(parseFloat(swMatch[2]));
      return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    }

    const stdMatch = text.match(stdPattern);
    if (stdMatch) {
      return `${parseFloat(stdMatch[1]).toFixed(6)}, ${parseFloat(stdMatch[2]).toFixed(6)}`;
    }

    return null;
  };

  const extractPowerFromText = (text: string): string | null => {
    // Look for patterns like -18.50 dBm or -20.1
    const pattern = /(-?\d{1,2}\.\d{1,2})\s*(?:dBm|uW)?/i;
    const match = text.match(pattern);
    if (match) {
      return `${match[1]} dBm`;
    }
    return null;
  };

  const testOpenRouterKey = async () => {
    if (!openRouterKey) return;
    setIsTestingKey(true);
    setKeyStatus('idle');
    try {
      const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
        headers: {
          "Authorization": `Bearer ${openRouterKey}`
        }
      });
      if (response.ok) {
        setKeyStatus('valid');
        // Fetch models immediately after validation
        setIsFetchingModels(true);
        const models = await fetchOpenRouterModels(openRouterKey);
        setAvailableModels(models);
        setIsFetchingModels(false);
      } else {
        setKeyStatus('invalid');
      }
    } catch (err) {
      setKeyStatus('invalid');
    } finally {
      setIsTestingKey(false);
    }
  };

  useEffect(() => {
    if (showSettings && openRouterKey && availableModels.length === 0) {
      const loadModels = async () => {
        setIsFetchingModels(true);
        const models = await fetchOpenRouterModels(openRouterKey);
        setAvailableModels(models);
        setIsFetchingModels(false);
      };
      loadModels();
    }
  }, [showSettings, openRouterKey]);

  const createProject = async () => {
    if (!newProjectName.trim() || !user) return;
    
    const projectId = crypto.randomUUID();
    const newProject: Project = {
      id: projectId,
      name: newProjectName.trim(),
      createdAt: new Date().toISOString(),
      createdBy: user.uid,
      status: 'active'
    };

    try {
      await setDoc(doc(db, 'projects', projectId), newProject);
      setNewProjectName('');
      setIsCreatingProject(false);
      setCurrentProjectId(projectId);
      localStorage.setItem('currentProjectId', projectId);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `projects/${projectId}`);
    }
  };

  const processFiles = async (items: (File | PendingUpload)[], isResumingBatch = false) => {
    if (!currentProjectId) {
      setError("Por favor, selecciona o crea un proyecto antes de subir fotos.");
      return;
    }
    setIsUploading(true);
    setIsResuming(isResumingBatch);
    setError(null);
    if (!isResumingBatch) {
      setUploadSummary(null);
      setNewlyAddedIds(new Set());
    }
    setUploadProgress({ current: 0, total: items.length });

    const failed: { name: string; error: string }[] = [];
    let successCount = 0;
    
    // Process in small batches
    const batchSize = 2;
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (item) => {
        const file = 'blob' in item ? new File([item.blob], item.name, { type: item.blob.type }) : item;
        const itemId = 'id' in item ? item.id : null;

        try {
          // 1. Try Local Extraction (EXIF + OCR)
          const exif = await getExifData(file);
          const ocrText = await runLocalOCR(file);
          
          let localData = {
            code: extractSerialFromText(ocrText) || '',
            coordinates: exif.coordinates || extractCoordsFromText(ocrText) || '',
            timestamp: exif.timestamp || '',
            power: extractPowerFromText(ocrText) || '',
            type: uploadType,
            method: 'LOCAL' as const
          };

          const validation = validateData({ ...localData, type: uploadType });
          let finalData: { code: string; coordinates: string; timestamp: string; power: string; type: 'CTO' | 'MUFA' | 'RESERVA'; method: 'LOCAL' | 'GEMINI' | 'HYBRID' } = { ...localData, power: localData.power || 'N/A' };
          let extractionMethod: 'LOCAL' | 'GEMINI' | 'HYBRID' = 'LOCAL';

          // 2. Fallback to Gemini if local is incomplete or invalid
          if (!validation.isValid) {
            // Check if offline - if so, save to pending and skip Gemini
            if (!isOnline) {
              if (!itemId) {
                await storage.addPendingUpload({
                  id: crypto.randomUUID(),
                  name: file.name,
                  blob: file,
                  timestamp: Date.now()
                });
              }
              throw new Error("Offline: Foto guardada en cola para procesar con IA cuando haya internet.");
            }

            // Wait for rate limiter (max 1 request every 8 seconds to stay under 7-8 RPM free tier)
            const now = Date.now();
            const timeSinceLastCall = now - (window as any).lastGeminiCall || 0;
            const minDelay = 8000; 
            if (timeSinceLastCall < minDelay) {
              await new Promise(resolve => setTimeout(resolve, minDelay - timeSinceLastCall));
            }
            (window as any).lastGeminiCall = Date.now();

            const resizedBase64 = await resizeImage(file);
            
            let geminiResult = null;
            let usedModel = selectedModel;

            const tryModel = async (model: string, label: string) => {
              try {
                if (model.startsWith('openrouter/')) {
                  if (!openRouterKey) {
                    throw new Error("API Key de OpenRouter no configurada en Ajustes.");
                  }
                  const { result } = await extractWithOpenRouter(resizedBase64, 'image/jpeg', model.replace('openrouter/', ''), openRouterKey);
                  return { result, label };
                } else {
                  const { result } = await extractEquipmentData(resizedBase64, 'image/jpeg', model);
                  return { result, label };
                }
              } catch (err: any) {
                const msg = err.message?.toLowerCase() || "";
                const isRetryable = msg.includes('429') || msg.includes('quota') || msg.includes('503') || msg.includes('limit') || msg.includes('overloaded') || msg.includes('not found');
                return { error: err, retryable: isRetryable };
              }
            };

            const models = [
              { id: "gemini-flash-latest", label: "Gemini Flash (Estable)" },
              { id: "gemini-3.1-flash-lite-preview", label: "Gemini Lite" },
              { id: "openrouter/qwen/qwen-2.5-72b-instruct", label: "Qwen 2.5 72B" }
            ];

            // If we have an OpenRouter key, we can fallback to OpenRouter models too
            const otherModels = models.filter(m => m.id !== selectedModel);
            
            let extraction = await tryModel(selectedModel, models.find(m => m.id === selectedModel)?.label || selectedModel);
            
            // Fallback logic: if the primary model fails, try the others
            if (extraction.error && extraction.retryable) {
              for (const model of otherModels) {
                // If it's an OpenRouter model, we need the key
                if (model.id.startsWith('openrouter/') && !openRouterKey) continue;
                
                console.warn(`${usedModel} falló. Probando respaldo: ${model.label}...`);
                extraction = await tryModel(model.id, model.label);
                if (extraction.result) {
                  usedModel = extraction.label || model.label;
                  break;
                }
              }
            }

            if (extraction.result) {
              geminiResult = extraction.result;
              usedModel = extraction.label || "Gemini";
            } else {
              throw extraction.error || new Error("No se pudo procesar con ninguna versión de IA");
            }

            if (geminiResult) {
              // Merge results: prefer local if valid, otherwise use Gemini
              finalData = {
                code: validation.isCodeValid ? localData.code : (geminiResult.code || 'S/N'),
                coordinates: validation.isCoordsValid ? localData.coordinates : (geminiResult.coordinates || '0,0'),
                timestamp: validation.isTimestampValid ? localData.timestamp : (geminiResult.timestamp || new Date().toLocaleString()),
                power: geminiResult.power || localData.power || 'N/A',
                type: uploadType, // User selected type takes precedence
                method: validation.isValid ? 'LOCAL' : (Object.values(validation).some(v => v) ? 'HYBRID' : 'GEMINI')
              };
              extractionMethod = finalData.method;
              (finalData as any).aiModel = usedModel;
            }
          }

          const resizedBase64 = await resizeImage(file);
          
          const newRecord: EquipmentRecord = {
            id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
            imageUrl: resizedBase64,
            code: finalData.code || 'S/N',
            type: uploadType,
            coordinates: finalData.coordinates || '0,0',
            timestamp: finalData.timestamp || new Date().toLocaleString(),
            power: finalData.power || 'N/A',
            extractedAt: new Date().toLocaleString(),
            method: extractionMethod,
            aiModel: (finalData as any).aiModel || (extractionMethod === 'LOCAL' ? 'N/A' : 'Gemini 3'),
            projectId: currentProjectId,
            userId: user?.uid
          };

          if (user) {
            try {
              // We don't save isNew to Firestore, it's a local UI state
              await setDoc(doc(db, 'records', newRecord.id), newRecord);
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, `records/${newRecord.id}`);
            }
          }
          
          setNewlyAddedIds(prev => new Set(prev).add(newRecord.id));
          successCount++;
          // Remove from pending queue after success
          if (itemId) {
            await storage.removePendingUpload(itemId);
          }
          return newRecord;
        } catch (err) {
          console.error(`Error processing ${file.name}:`, err);
          failed.push({ 
            name: file.name, 
            error: err instanceof Error ? err.message : 'Error desconocido' 
          });
          return null;
        } finally {
          setUploadProgress(prev => ({ ...prev, current: Math.min(prev.current + 1, items.length) }));
        }
      });

      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter((r): r is EquipmentRecord => r !== null);
      
      if (validResults.length > 0 && !user) {
        setRecords(prev => [...validResults, ...prev]);
      }

      // Add a small delay between batches to stay under the 10 RPM limit (Free Tier)
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    if (isResuming) {
      // If we were resuming and finished, clear any leftovers just in case
      if (failed.length === 0) {
        await storage.clearPendingUploads();
      }
    }

    setUploadSummary({
      total: items.length,
      success: successCount,
      failed: failed
    });
    
    // Notify user
    playNotificationSound();
    showDesktopNotification(successCount, items.length);
    
    setIsUploading(false);
    setIsResuming(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          // Optimized for Free Tier: 800px is enough for OCR and saves 70% space vs 1200px
          const MAX_WIDTH = 800; 
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Quality 0.5 is the sweet spot for legibility vs file size
          resolve(canvas.toDataURL('image/jpeg', 0.5));
        };
        img.onerror = () => reject(new Error("Error al cargar la imagen"));
      };
      reader.onerror = () => reject(new Error("Error al leer el archivo"));
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const deleteRecord = async (id: string) => {
    if (user) {
      try {
        await deleteDoc(doc(db, 'records', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `records/${id}`);
      }
    } else {
      setRecords(prev => prev.filter(r => r.id !== id));
    }
  };

  const deleteFilteredRecords = async () => {
    const filteredIds = filteredRecords.map(r => r.id);
    
    if (user) {
      try {
        await Promise.all(filteredIds.map(id => deleteDoc(doc(db, 'records', id))));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'multiple records');
      }
    } else {
      setRecords(prev => prev.filter(r => !filteredIds.includes(r.id)));
    }
    
    // If not filtered, we are deleting everything, so clear pending too
    if (!isFiltered) {
      await storage.clearPendingUploads();
    }
    
    setShowDeleteAllConfirm(false);
  };

  const isFiltered = searchQuery !== '' || typeFilter !== 'ALL';

  const exportToCSV = () => {
    if (!kmzProject) return;
    
    const headers = [
      'TIPO', 'NOMBRE/CÓDIGO', 'ESTADO', 'CELDA', 'COORDENADAS / DISTANCIA', 'FECHA CARGA'
    ];

    const rows: string[][] = [];

    // 1. Add Inventory Items (EQUIPOS)
    kmzProject.items.forEach(item => {
      rows.push([
        item.type,
        item.name,
        item.status === 'INSTALLED' ? 'COMPLETO' : 'INCOMPLETO',
        item.celda || 'N/A',
        `${item.coordinates.lat}, ${item.coordinates.lng}`,
        kmzProject.uploadedAt
      ]);
    });

    // 2. Add Tendidos
    kmzProject.tendidos.forEach(t => {
      const hasReports = tendidoReports.some(r => r.tendidoId === t.id);
      rows.push([
        t.type,
        t.name,
        hasReports ? 'COMPLETO' : 'INCOMPLETO',
        t.celda || 'N/A',
        `${Math.round(t.totalDistance)}m`,
        kmzProject.uploadedAt
      ]);
    });
    
    // Properly escape and quote CSV fields using semicolon (;) for Excel in Spanish locales
    const formatCSVRow = (row: string[]) => {
      return row.map(field => {
        const stringField = String(field || '').replace(/"/g, '""');
        return `"${stringField}"`;
      }).join(";");
    };

    // Add BOM and "sep=;" for maximum Excel compatibility
    const csvContent = "\uFEFF" + "sep=;\n" + [headers, ...rows].map(formatCSVRow).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `inventario_${kmzProject.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCoordinates = (coordStr: string) => {
    if (!coordStr) return null;

    // Handles various formats:
    // "12.11894S 77.02391W"
    // "-12.11894, -77.02391"
    // "12,11894S, 77,02391W"
    
    // 1. Clean the string but keep signs, dots, commas, and direction letters
    const clean = coordStr.replace(/[^\d.,\sNSEW+-]/gi, ' ');
    
    // 2. Find all potential numeric parts with their optional direction
    // This regex looks for a number (with . or ,) followed by an optional N,S,E,W
    const partRegex = /([+-]?\d+(?:[.,]\d+)?)\s*([NSEW])?/gi;
    const matches = Array.from(clean.matchAll(partRegex));

    if (matches.length < 2) return null;

    const processMatch = (match: RegExpMatchArray) => {
      let numStr = match[1].replace(',', '.');
      let val = parseFloat(numStr);
      const dir = match[2]?.toUpperCase();

      if (dir) {
        if (dir === 'S' || dir === 'W') val = -Math.abs(val);
        if (dir === 'N' || dir === 'E') val = Math.abs(val);
      }
      return val;
    };

    let lat = processMatch(matches[0]);
    let lon = processMatch(matches[1]);

    // Heuristics for Peru (User context: All images are from Peru)
    // Peru Latitude: ~0 to -18 (South)
    // Peru Longitude: ~-68 to -82 (West)
    
    // If no direction suffix was provided and values are positive, 
    // but they fall within the expected absolute range for Peru, 
    // we assume they should be negative.
    if (!matches[0][2] && lat > 0 && lat < 25) {
      lat = -lat;
    }
    if (!matches[1][2] && lon > 0 && lon > 60 && lon < 95) {
      lon = -lon;
    }

    if (isNaN(lat) || isNaN(lon)) return null;

    return { lat, lon };
  };

  const exportToKML = () => {
    const dataToExport = filteredRecords;
    if (dataToExport.length === 0) return;

    // Group records by type
    const groupedRecords = dataToExport.reduce((acc, record) => {
      if (!acc[record.type]) {
        acc[record.type] = [];
      }
      acc[record.type].push(record);
      return acc;
    }, {} as Record<string, EquipmentRecord[]>);

    let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Optical Equipment Records - ${new Date().toLocaleDateString()}</name>
    <description>Extracted data from optical equipment photos grouped by type</description>
    
    <Style id="style-CTO">
      <IconStyle>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/blu-blank.png</href>
        </Icon>
        <scale>1.1</scale>
      </IconStyle>
    </Style>
    
    <Style id="style-MUFA">
      <IconStyle>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/purple-blank.png</href>
        </Icon>
        <scale>1.1</scale>
      </IconStyle>
    </Style>
    
    <Style id="style-RESERVA">
      <IconStyle>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/orange-blank.png</href>
        </Icon>
        <scale>1.1</scale>
      </IconStyle>
    </Style>
`;

    // Iterate through each type group
    (Object.entries(groupedRecords) as [string, EquipmentRecord[]][]).forEach(([type, records]) => {
      kmlContent += `
    <Folder>
      <name>${type}</name>
      <description>Records for equipment type: ${type}</description>`;

      records.forEach(record => {
        const coords = parseCoordinates(record.coordinates);
        if (coords) {
          kmlContent += `
      <Placemark>
        <name>${record.code}</name>
        <styleUrl>#style-${record.type}</styleUrl>
        <description><![CDATA[
          <p><b>Type:</b> ${record.type}</p>
          <p><b>Power:</b> ${record.power}</p>
          <p><b>Timestamp:</b> ${record.timestamp}</p>
          <p><b>Coordinates:</b> ${record.coordinates}</p>
          <p><b>Extracted At:</b> ${record.extractedAt}</p>
        ]]></description>
        <Point>
          <coordinates>${coords.lon},${coords.lat},0</coordinates>
        </Point>
      </Placemark>`;
        }
      });

      kmlContent += `
    </Folder>`;
    });

    kmlContent += `
  </Document>
</kml>`;

    const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `equipment_data_${new Date().toISOString().split('T')[0]}.kml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = (Array.from(e.dataTransfer.files) as File[]).filter(f => f.type.startsWith('image/'));
      if (files.length > 0) {
        await processFiles(files);
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-[#141414]" size={48} />
          <p className="font-serif italic text-xl">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-12 rounded-lg border-2 border-[#141414] shadow-[12px_12px_0px_0px_rgba(20,20,20,1)]">
          <div className="flex flex-col items-center text-center space-y-8">
            <div className="bg-[#141414] p-4 rounded-full">
              <Table className="text-[#E4E3E0]" size={48} />
            </div>
            <div>
              <h1 className="text-3xl font-heading italic">Optical Data Extractor</h1>
              <p className="text-xs uppercase tracking-[0.3em] opacity-50 mt-2">Acceso Profesional</p>
            </div>
            <p className="text-sm opacity-70 leading-relaxed">
              Inicia sesión para acceder a tus registros, sincronizar datos en la nube y colaborar con tu equipo.
            </p>

            {error && (
              <div className="w-full p-3 bg-red-50 border border-red-200 rounded text-red-600 text-xs flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            <button 
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 bg-[#141414] text-[#E4E3E0] py-4 px-6 font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <LogIn size={20} />
              )}
              {isLoggingIn ? 'Iniciando...' : 'Ingresar con Google'}
            </button>
            <div className="pt-4 border-t border-[#141414]/10 w-full">
              <p className="text-[10px] uppercase tracking-widest opacity-30">
                Sistema de Inventario v1.0 • Joel Rivas
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] bg-[#E4E3E0] sticky top-0 z-40 relative">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 w-full lg:w-auto">
            <div className="flex items-center gap-4 w-full sm:w-auto justify-start">
              <div className="bg-[#141414] p-2">
                <Table className="text-[#E4E3E0]" size={24} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-heading italic leading-none">Optical Data Extractor V2</h1>
                <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.3em] opacity-50 mt-1">Professional Field Tool</p>
              </div>
            </div>

            {/* Project Selector */}
            <div className="flex items-center gap-3 bg-white/50 px-4 py-2 rounded border border-[#141414]/10 w-full sm:w-auto">
              <div className="flex flex-col flex-1 sm:flex-none">
                <span className="text-[9px] uppercase tracking-widest opacity-40 font-bold">Proyecto</span>
                <select 
                  value={currentProjectId || ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    setCurrentProjectId(id);
                    localStorage.setItem('currentProjectId', id);
                  }}
                  className="bg-transparent border-none text-xs font-bold outline-none cursor-pointer p-0 appearance-none min-w-[120px]"
                >
                  {projects.length === 0 && <option value="">Sin Proyectos</option>}
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => {
                      const currentProject = projects.find(p => p.id === currentProjectId);
                      if (currentProject) {
                        const newName = prompt("Nuevo nombre del proyecto:", currentProject.name);
                        if (newName && newName.trim()) {
                          setDoc(doc(db, 'projects', currentProject.id), { ...currentProject, name: newName.trim() }, { merge: true });
                        }
                      } else if (kmzProject && kmzProject.id === currentProjectId) {
                        const newName = prompt("Nuevo nombre del proyecto KMZ:", kmzProject.name);
                        if (newName && newName.trim()) {
                          setKmzProject({ ...kmzProject, name: newName.trim() });
                        }
                      } else if (kmzProject) {
                        // If we have a KMZ project but no firestore project selected, maybe they want to rename the KMZ
                        const newName = prompt("Nuevo nombre del proyecto KMZ:", kmzProject.name);
                        if (newName && newName.trim()) {
                          setKmzProject({ ...kmzProject, name: newName.trim() });
                        }
                      }
                    }}
                    className="p-1.5 hover:bg-[#141414] hover:text-[#E4E3E0] rounded transition-all"
                    title="Renombrar Proyecto"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button 
                    onClick={() => setIsCreatingProject(true)}
                    className="p-1.5 hover:bg-[#141414] hover:text-[#E4E3E0] rounded transition-all"
                    title="Nuevo Proyecto"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-center lg:justify-end gap-4 sm:gap-6 w-full lg:w-auto">
            {/* Status Indicators */}
            <div className="flex items-center gap-4 border-x border-[#141414]/10 px-4 sm:px-6">
              <div className="flex flex-col items-end">
                <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                  {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                  {isOnline ? 'Online' : 'Offline'}
                </div>
                <div className="text-[9px] opacity-40 uppercase tracking-tighter">Estado de Red</div>
              </div>

              {pendingCount > 0 && (
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                    <CloudUpload size={12} className="animate-bounce" />
                    {pendingCount} Pendientes
                  </div>
                  <div className="text-[9px] opacity-40 uppercase tracking-tighter">Cola de Sincro</div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {pendingCount > 0 && isOnline && (
                <button 
                  onClick={async () => {
                    const pending = await storage.getPendingUploads();
                    processFiles(pending, true);
                  }}
                  className="bg-blue-600 text-white px-3 sm:px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2"
                >
                  <RotateCcw size={12} />
                  <span className="hidden sm:inline">Sincronizar Ahora</span>
                  <span className="sm:hidden">Sincro</span>
                </button>
              )}
              <button 
                onClick={exportToCSV}
                className="bg-green-600 text-white px-3 sm:px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-green-700 transition-all flex items-center gap-2"
              >
                <Download size={14} />
                CSV
              </button>
              <button 
                onClick={exportToKML}
                className="border border-[#141414] px-3 sm:px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-all flex items-center gap-2"
              >
                <Download size={14} />
                KML
              </button>

              <div className="hidden sm:block h-8 w-px bg-[#141414]/10 mx-1" />

              <div className="flex items-center gap-3 sm:gap-4">
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                    {isAdmin && <ShieldCheck size={12} className="text-blue-600" />}
                    <span className="max-w-[80px] sm:max-w-none truncate">{user?.displayName || user?.email || 'Usuario'}</span>
                  </div>
                  <div className="text-[9px] opacity-40 uppercase tracking-tighter">{isAdmin ? 'Admin' : 'Técnico'}</div>
                </div>
                <button 
                  onClick={() => signOut(auth)}
                  className="p-2 hover:bg-red-50 text-red-600 rounded-full transition-colors"
                  title="Cerrar Sesión"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Absolute Settings Button for consistent top-right placement */}
        <button 
          onClick={() => setShowSettings(true)}
          className={`absolute top-4 right-4 sm:right-6 p-2 rounded-full transition-all hover:bg-[#141414]/5 ${
            openRouterKey ? 'text-[#141414]/60' : 'text-[#141414]/30'
          }`}
          title="Configuración de IA"
        >
          <Settings size={18} />
        </button>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-8">
        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-[#F8F9FA] p-1 rounded-xl border border-[#141414]/5 w-fit">
          <button 
            onClick={() => setActiveTab('EXTRACTION')}
            className={`px-6 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
              activeTab === 'EXTRACTION' 
                ? 'bg-white text-blue-600 shadow-sm border border-[#141414]/5' 
                : 'text-[#141414]/40 hover:text-[#141414]/60'
            }`}
          >
            <ImageIcon size={14} />
            Extracción
          </button>
          <button 
            onClick={() => setActiveTab('INVENTORY')}
            className={`px-6 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
              activeTab === 'INVENTORY' 
                ? 'bg-white text-blue-600 shadow-sm border border-[#141414]/5' 
                : 'text-[#141414]/40 hover:text-[#141414]/60'
            }`}
          >
            <Map size={14} />
            Inventario KMZ
            {kmzProject && kmzProject.items.length > 0 && (
              <span className="bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded-full ml-1">
                {Math.round((kmzProject.items.filter(i => i.status === 'INSTALLED').length / kmzProject.items.length) * 100)}%
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('REPORTS')}
            className={`px-6 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
              activeTab === 'REPORTS' 
                ? 'bg-white text-blue-600 shadow-sm border border-[#141414]/5' 
                : 'text-[#141414]/40 hover:text-[#141414]/60'
            }`}
          >
            <Activity size={14} />
            Reportes Técnicos
          </button>
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative flex flex-col md:flex-row justify-between items-center gap-4"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{error}</span>
              </div>
              <div className="flex items-center gap-3">
                {error.includes('cuota') && (
                  <button 
                    onClick={async () => {
                      setError(null);
                      const pending = await storage.getPendingUploads();
                      if (pending.length > 0) {
                        processFiles(pending, true);
                      }
                    }}
                    className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-wider hover:bg-red-700 transition-colors"
                  >
                    Reintentar ahora
                  </button>
                )}
                <button onClick={() => setError(null)} className="p-1 hover:bg-red-200 rounded transition-colors">
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Views */}
        {activeTab === 'EXTRACTION' && (
          <div className="space-y-8">
            {/* Upload Area */}
            <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-4 rounded-lg border border-[#141414] border-opacity-10 shadow-sm gap-4">
            <div className="flex items-center gap-3">
              <Layers size={18} className="opacity-50" />
              <span className="text-xs uppercase tracking-widest font-bold">Tipo:</span>
              <div className="flex gap-2">
                {(['CTO', 'MUFA', 'RESERVA'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setUploadType(type)}
                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest border transition-all ${
                      uploadType === type 
                        ? 'bg-[#141414] text-[#E4E3E0] border-[#141414]' 
                        : 'border-[#141414] border-opacity-20 opacity-50 hover:opacity-100'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div 
            onDragOver={onDragOver}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed border-[#141414] border-opacity-20 rounded-lg p-12
              flex flex-col items-center justify-center cursor-pointer
              hover:border-opacity-100 hover:bg-[#141414] hover:bg-opacity-5 transition-all
              ${isUploading ? 'pointer-events-none opacity-50' : ''}
            `}
          >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            accept="image/*"
            multiple
          />
          {isUploading ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="animate-spin" size={48} />
              <p className="font-serif italic">
                {isResuming ? 'Reanudando carga pendiente' : 'Analizando datos del equipo'} ({uploadProgress.current} de {uploadProgress.total})...
              </p>
            </div>
          ) : (
            <>
              <Upload size={48} className="mb-4 opacity-20" />
              <p className="font-serif italic text-xl mb-2">Suelta las fotos aquí</p>
              <p className="text-[11px] uppercase tracking-widest opacity-50">o haz clic para buscar archivos</p>
            </>
          )}
        </div>
      </div>

      {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-lg border border-[#141414] border-opacity-10 shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={16} />
            <input 
              type="text"
              placeholder="Buscar por código serial..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-transparent border-b border-[#141414] border-opacity-10 focus:border-opacity-100 outline-none text-sm transition-all"
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Filter className="opacity-30" size={16} />
            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="bg-transparent border-b border-[#141414] border-opacity-10 focus:border-opacity-100 outline-none text-sm py-2 px-2 cursor-pointer transition-all"
            >
              <option value="ALL">Todos los Equipos</option>
              <option value="CTO">Solo CTO</option>
              <option value="MUFA">Solo MUFA</option>
              <option value="RESERVA">Solo RESERVA</option>
            </select>
          </div>
        </div>

        {/* Data Grid */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#141414] pb-2 gap-4">
            <h2 className="font-serif italic text-lg">Registros Extraídos</h2>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              {newlyAddedIds.size > 0 && (
                <button 
                  onClick={clearNewHighlights}
                  className="text-[10px] uppercase tracking-widest text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded border border-blue-200"
                >
                  Revisados
                </button>
              )}
              { (searchQuery || typeFilter !== 'ALL') && (
                <button 
                  onClick={() => { setSearchQuery(''); setTypeFilter('ALL'); setSortOrder('NEWEST'); }}
                  className="text-[10px] uppercase tracking-widest text-red-500 hover:underline"
                >
                  Limpiar
                </button>
              )}
              <span className="text-[11px] uppercase tracking-widest opacity-50">
                {sortedRecords.length}/{records.length}
              </span>
              {records.length > 0 && (
                <button 
                  onClick={() => setShowDeleteAllConfirm(true)}
                  className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors ml-auto"
                >
                  <Trash2 size={10} />
                  <span className="hidden sm:inline">{isFiltered ? 'Eliminar Filtrados' : 'Eliminar Todo'}</span>
                  <span className="sm:hidden">Borrar</span>
                </button>
              )}
            </div>
          </div>

          {sortedRecords.length === 0 ? (
            <div className="py-20 text-center opacity-30 bg-white rounded-lg border border-dashed border-[#141414] border-opacity-10">
              <p className="font-serif italic">
                {records.length === 0 
                  ? "No se encontraron registros. Sube una foto para comenzar." 
                  : "No hay coincidencias para los filtros actuales."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-white rounded-lg border border-[#141414] border-opacity-10">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left border-b border-[#141414] border-opacity-10">
                    <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Vista Previa</th>
                    <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Tipo</th>
                    <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">
                      <button 
                        onClick={() => setSortOrder(sortOrder === 'SERIAL_ASC' ? 'SERIAL_DESC' : 'SERIAL_ASC')}
                        className="flex items-center gap-1 hover:text-[#141414] transition-colors"
                      >
                        Código Serial
                        <ArrowUpDown size={14} strokeWidth={3} className={sortOrder === 'SERIAL_ASC' || sortOrder === 'SERIAL_DESC' ? 'opacity-100 text-blue-600' : 'opacity-30'} />
                      </button>
                    </th>
                    <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">
                      <button 
                        onClick={() => setSortOrder(sortOrder === 'POWER_ASC' ? 'POWER_DESC' : 'POWER_ASC')}
                        className="flex items-center gap-1 hover:text-[#141414] transition-colors"
                      >
                        Potencia
                        <ArrowUpDown size={14} strokeWidth={3} className={sortOrder === 'POWER_ASC' || sortOrder === 'POWER_DESC' ? 'opacity-100 text-blue-600' : 'opacity-30'} />
                      </button>
                    </th>
                    <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Coordenadas</th>
                    <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Fecha Foto</th>
                    <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Método</th>
                    <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRecords.map((record) => (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={record.id}
                      className={`group border-b border-[#141414] border-opacity-5 transition-all cursor-default ${
                        newlyAddedIds.has(record.id) 
                          ? 'bg-amber-50 hover:bg-[#141414] hover:text-[#E4E3E0]' 
                          : 'hover:bg-[#141414] hover:text-[#E4E3E0]'
                      }`}
                    >
                      <td className="p-4">
                        <div 
                          className="w-12 h-12 bg-gray-200 rounded overflow-hidden cursor-pointer"
                          onClick={() => setSelectedImage(record.imageUrl)}
                        >
                          <img 
                            src={record.imageUrl} 
                            alt="Equipment" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {record.type === 'CTO' ? (
                            <Box size={14} className="opacity-50" />
                          ) : record.type === 'MUFA' ? (
                            <Layers size={14} className="opacity-50" />
                          ) : (
                            <RotateCcw size={14} className="opacity-50" />
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            record.type === 'CTO' 
                              ? 'border-blue-500 text-blue-500 bg-blue-50' 
                              : record.type === 'MUFA'
                              ? 'border-purple-500 text-purple-500 bg-purple-50'
                              : 'border-orange-500 text-orange-500 bg-orange-50'
                          }`}>
                            {record.type}
                          </span>
                        </div>
                      </td>
                      <td 
                        className="p-4 font-mono text-sm tracking-tight cursor-text"
                        onDoubleClick={() => startEditing(record)}
                        title="Doble clic para editar"
                      >
                        <div className="flex items-center gap-2">
                          <Hash size={12} className="opacity-30 group-hover:opacity-100" />
                          {editingId === record.id ? (
                            <input 
                              type="text"
                              value={editValues.code}
                              onChange={(e) => setEditValues(prev => ({ ...prev, code: e.target.value }))}
                              onKeyDown={(e) => handleKeyDown(e, record.id)}
                              onBlur={() => saveEdit(record.id)}
                              className="bg-white border border-[#141414] px-2 py-1 text-xs outline-none w-full text-[#141414]"
                              autoFocus
                            />
                          ) : (
                            record.code
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-mono text-sm tracking-tight">
                        <div className="flex items-center gap-2">
                          <Zap size={12} className="opacity-30 group-hover:opacity-100" />
                          {record.power}
                        </div>
                      </td>
                      <td 
                        className="p-4 font-mono text-sm tracking-tight cursor-text"
                        onDoubleClick={() => startEditing(record)}
                        title="Doble clic para editar"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin size={12} className="opacity-30 group-hover:opacity-100" />
                          {editingId === record.id ? (
                            <input 
                              type="text"
                              value={editValues.coordinates}
                              onChange={(e) => setEditValues(prev => ({ ...prev, coordinates: e.target.value }))}
                              onKeyDown={(e) => handleKeyDown(e, record.id)}
                              onBlur={() => saveEdit(record.id)}
                              className="bg-white border border-[#141414] px-2 py-1 text-xs outline-none w-full text-[#141414]"
                            />
                          ) : (
                            record.coordinates
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-mono text-sm tracking-tight">
                        <div className="flex items-center gap-2">
                          <Calendar size={12} className="opacity-30 group-hover:opacity-100" />
                          {record.timestamp}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border w-fit ${
                            record.method === 'LOCAL' 
                              ? 'border-green-500 text-green-500 bg-green-50' 
                              : record.method === 'HYBRID'
                              ? 'border-blue-500 text-blue-500 bg-blue-50'
                              : 'border-purple-500 text-purple-500 bg-purple-50'
                          }`}>
                            {record.method || 'GEMINI'}
                          </span>
                          {record.method !== 'LOCAL' && record.aiModel && (
                            <span className="text-[8px] uppercase tracking-tighter opacity-40">
                              {record.aiModel}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => deleteRecord(record.id)}
                            className="p-2 hover:bg-red-500 hover:text-white rounded transition-colors text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )}

    {activeTab === 'INVENTORY' && (
      <div className="space-y-8">
          {/* Inventory Dashboard */}
          {!kmzProject ? (
            <div className="py-20 text-center bg-white rounded-xl border-2 border-dashed border-[#141414]/10">
              <div className="max-w-md mx-auto space-y-6">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-600">
                  <Map size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Cargar Inventario KMZ</h3>
                  <p className="text-sm opacity-50 mt-2">Sube el archivo de Google Earth para controlar el avance del proyecto (CTOs, MUFAs y Reservas).</p>
                </div>
                <label className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-blue-700 transition-all cursor-pointer shadow-lg shadow-blue-600/20">
                  <CloudUpload size={16} />
                  {isParsingKmz ? 'Procesando...' : 'Seleccionar KMZ'}
                  <input 
                    type="file" 
                    accept=".kmz,.kml" 
                    className="hidden" 
                    onChange={handleKmzUpload}
                    disabled={isParsingKmz}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl border border-[#141414]/5 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-1">Proyecto KMZ Activo</div>
                    <div className="text-lg font-bold truncate">{kmzProject.name}</div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button 
                      onClick={() => kmzFileInputRef.current?.click()}
                      className="flex-1 bg-blue-50 text-blue-600 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={12} /> Cambiar
                    </button>
                    <input 
                      type="file" 
                      ref={kmzFileInputRef}
                      accept=".kmz,.kml" 
                      className="hidden" 
                      onChange={handleKmzUpload}
                    />
                    <button 
                      onClick={() => setShowDeleteKmzConfirm(true)}
                      className="flex-1 bg-red-50 text-red-600 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                    >
                      <Trash2 size={12} /> Borrar
                    </button>
                  </div>
                </div>
                
                {['CTO', 'MUFA', 'RESERVA'].map(type => {
                  const items = (kmzProject?.items || []).filter(i => i.type === type);
                  const installed = items.filter(i => i.status === 'INSTALLED').length;
                  const percent = items.length > 0 ? Math.round((installed / items.length) * 100) : 0;
                  
                  return (
                    <div key={type} className="bg-white p-6 rounded-xl border border-[#141414]/5 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div className="text-[10px] uppercase tracking-widest font-bold opacity-40">{type}s</div>
                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          percent === 100 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {percent}%
                        </div>
                      </div>
                      <div className="text-2xl font-bold">{installed} <span className="text-sm opacity-30">/ {items.length}</span></div>
                      <div className="w-full h-1.5 bg-[#F8F9FA] rounded-full mt-4 overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          className={`h-full rounded-full ${
                            percent === 100 ? 'bg-green-500' : 'bg-blue-600'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Inventory Table */}
              <div className="bg-white rounded-xl border border-[#141414]/5 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-[#141414]/5 flex flex-col md:flex-row justify-between items-start md:items-center bg-[#F8F9FA] gap-4">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setInventorySubTab('EQUIPOS')}
                      className={`text-sm font-bold uppercase tracking-widest pb-1 border-b-2 transition-all ${
                        inventorySubTab === 'EQUIPOS' ? 'border-blue-600 text-blue-600' : 'border-transparent opacity-40'
                      }`}
                    >
                      Equipos
                    </button>
                    <button 
                      onClick={() => setInventorySubTab('TENDIDOS')}
                      className={`text-sm font-bold uppercase tracking-widest pb-1 border-b-2 transition-all ${
                        inventorySubTab === 'TENDIDOS' ? 'border-blue-600 text-blue-600' : 'border-transparent opacity-40'
                      }`}
                    >
                      Tendidos
                    </button>
                  </div>

                  {inventorySubTab === 'EQUIPOS' && (
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                      <div className="relative flex-1 md:w-48">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 opacity-30" size={14} />
                        <input 
                          type="text"
                          placeholder="Filtrar por nombre..."
                          value={inventorySearchQuery}
                          onChange={(e) => setInventorySearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#141414]/10 rounded-lg text-xs outline-none focus:border-blue-600 transition-all"
                        />
                      </div>
                      <select 
                        value={inventoryTypeFilter}
                        onChange={(e) => setInventoryTypeFilter(e.target.value as any)}
                        className="bg-white border border-[#141414]/10 rounded-lg text-xs py-1.5 px-3 outline-none focus:border-blue-600 transition-all cursor-pointer"
                      >
                        <option value="ALL">Todos Tipos</option>
                        <option value="CTO">CTO</option>
                        <option value="MUFA">MUFA</option>
                        <option value="RESERVA">RESERVA</option>
                      </select>
                      <select 
                        value={inventoryStatusFilter}
                        onChange={(e) => setInventoryStatusFilter(e.target.value as any)}
                        className="bg-white border border-[#141414]/10 rounded-lg text-xs py-1.5 px-3 outline-none focus:border-blue-600 transition-all cursor-pointer"
                      >
                        <option value="ALL">Todos Estados</option>
                        <option value="PENDING">Pendiente</option>
                        <option value="INSTALLED">Instalado</option>
                      </select>
                      <select 
                        value={inventoryCeldaFilter}
                        onChange={(e) => setInventoryCeldaFilter(e.target.value)}
                        className="bg-white border border-[#141414]/10 rounded-lg text-xs py-1.5 px-3 outline-none focus:border-blue-600 transition-all cursor-pointer"
                      >
                        <option value="ALL">Todas Celdas</option>
                        <option value="NONE">Sin Celda</option>
                        {uniqueCeldas.map(celda => {
                          const stats = cellStats[celda];
                          const isComplete = stats && stats.installed === stats.total;
                          return (
                            <option key={celda} value={celda}>
                              {isComplete ? '🟢' : '⚪'} {celda} ({stats?.installed || 0}/{stats?.total || 0})
                            </option>
                          );
                        })}
                      </select>
                      {(inventorySearchQuery || inventoryTypeFilter !== 'ALL' || inventoryStatusFilter !== 'ALL' || inventoryCeldaFilter !== 'ALL') && (
                        <button 
                          onClick={() => {
                            setInventorySearchQuery('');
                            setInventoryTypeFilter('ALL');
                            setInventoryStatusFilter('ALL');
                            setInventoryCeldaFilter('ALL');
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest"
                        >
                          <RotateCcw size={12} /> Limpiar
                        </button>
                      )}
                    </div>
                  )}

                  {inventorySubTab === 'TENDIDOS' && (
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                      <div className="relative flex-1 md:w-48">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 opacity-30" size={14} />
                        <input 
                          type="text"
                          placeholder="Filtrar tendido..."
                          value={inventorySearchQuery}
                          onChange={(e) => setInventorySearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#141414]/10 rounded-lg text-xs outline-none focus:border-blue-600 transition-all"
                        />
                      </div>
                      <select 
                        value={tendidoTypeFilter}
                        onChange={(e) => setTendidoTypeFilter(e.target.value as any)}
                        className="bg-white border border-[#141414]/10 rounded-lg text-xs py-1.5 px-3 outline-none focus:border-blue-600 transition-all cursor-pointer"
                      >
                        <option value="ALL">Todos Tipos</option>
                        <option value="96H">96H</option>
                        <option value="48H">48H</option>
                        <option value="24H">24H</option>
                        <option value="OTRO">Otros</option>
                      </select>
                      <select 
                        value={tendidoStatusFilter}
                        onChange={(e) => setTendidoStatusFilter(e.target.value as any)}
                        className="bg-white border border-[#141414]/10 rounded-lg text-xs py-1.5 px-3 outline-none focus:border-blue-600 transition-all cursor-pointer"
                      >
                        <option value="ALL">Todos Estados</option>
                        <option value="PENDING">Incompletos</option>
                        <option value="COMPLETED">Completos</option>
                      </select>
                      <select 
                        value={tendidoCeldaFilter}
                        onChange={(e) => setTendidoCeldaFilter(e.target.value)}
                        className="bg-white border border-[#141414]/10 rounded-lg text-xs py-1.5 px-3 outline-none focus:border-blue-600 transition-all cursor-pointer"
                      >
                        <option value="ALL">Todas Celdas</option>
                        <option value="NONE">Sin Celda</option>
                        {uniqueTendidoCeldas.map(celda => {
                          const stats = tendidoCellStats[celda];
                          const isComplete = stats && stats.completed === stats.total;
                          return (
                            <option key={celda} value={celda}>
                              {isComplete ? '🟢' : '⚪'} {celda} ({stats?.completed || 0}/{stats?.total || 0})
                            </option>
                          );
                        })}
                      </select>
                      {(inventorySearchQuery || tendidoTypeFilter !== 'ALL' || tendidoStatusFilter !== 'ALL' || tendidoCeldaFilter !== 'ALL') && (
                        <button 
                          onClick={() => {
                            setInventorySearchQuery('');
                            setTendidoTypeFilter('ALL');
                            setTendidoStatusFilter('ALL');
                            setTendidoCeldaFilter('ALL');
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest"
                        >
                          <RotateCcw size={12} /> Limpiar
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {inventorySubTab === 'EQUIPOS' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-[#F8F9FA] text-left">
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Estado</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Nombre / Serial</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Tipo</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Celda</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Coordenadas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(kmzProject?.items || [])
                          .filter(item => {
                            const searchLower = inventorySearchQuery.toLowerCase().trim();
                            const matchesSearch = !searchLower || 
                              item.name.toLowerCase().includes(searchLower) ||
                              (item.celda && item.celda.toLowerCase().includes(searchLower));
                            
                            const matchesType = inventoryTypeFilter === 'ALL' || item.type === inventoryTypeFilter;
                            const matchesStatus = inventoryStatusFilter === 'ALL' || item.status === inventoryStatusFilter;
                            
                            // Strict Celda filtering: trim and handle empty strings
                            const itemCelda = (item.celda || '').trim();
                            const filterCelda = (inventoryCeldaFilter || 'ALL').trim();
                            
                            let matchesCelda = false;
                            if (filterCelda === 'ALL') {
                              matchesCelda = true;
                            } else if (filterCelda === 'NONE') {
                              matchesCelda = itemCelda === '';
                            } else {
                              matchesCelda = itemCelda !== '' && itemCelda === filterCelda;
                            }
                            
                            return matchesSearch && matchesType && matchesStatus && matchesCelda;
                          })
                          .map((item) => (
                            <tr key={item.id} className="border-b border-[#141414]/5 hover:bg-[#F8F9FA] transition-colors">
                              <td className="p-4">
                                {item.status === 'INSTALLED' ? (
                                  <div className="flex items-center gap-2 text-green-600">
                                    <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                                      <CheckCircle size={12} className="text-white" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Completo</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-gray-400">
                                    <div className="w-4 h-4 rounded-full bg-gray-300" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Incompleto</span>
                                  </div>
                                )}
                              </td>
                              <td className="p-4 font-mono text-sm font-bold">{item.name}</td>
                              <td className="p-4">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                                  item.type === 'CTO' ? 'border-blue-500 text-blue-500 bg-blue-50' :
                                  item.type === 'MUFA' ? 'border-purple-500 text-purple-500 bg-purple-50' :
                                  'border-orange-500 text-orange-500 bg-orange-50'
                                }`}>
                                  {item.type}
                                </span>
                              </td>
                              <td className="p-4 text-xs">
                                {item.celda ? (
                                  <span className="bg-gray-100 px-2 py-1 rounded border border-gray-200 font-bold text-gray-700">
                                    {item.celda}
                                  </span>
                                ) : (
                                  <span className="opacity-30">N/A</span>
                                )}
                              </td>
                              <td className="p-4 font-mono text-[10px] opacity-40">
                                {item.coordinates.lat.toFixed(6)}, {item.coordinates.lng.toFixed(6)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-[#F8F9FA] text-left">
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Estado</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Nombre del Tendido</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Tipo</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Celda</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Dist. Lineal</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Extras</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Total Proyectado</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Longitud Real</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kmzProject.tendidos
                          .filter(t => {
                            const searchLower = inventorySearchQuery.toLowerCase().trim();
                            const matchesSearch = !searchLower || 
                              t.name.toLowerCase().includes(searchLower) ||
                              (t.celda && t.celda.toLowerCase().includes(searchLower));

                            const matchesType = tendidoTypeFilter === 'ALL' || t.type === tendidoTypeFilter;
                            
                            const tCelda = (t.celda || '').trim();
                            const fCelda = (tendidoCeldaFilter || 'ALL').trim();
                            
                            let matchesCelda = false;
                            if (fCelda === 'ALL') {
                              matchesCelda = true;
                            } else if (fCelda === 'NONE') {
                              matchesCelda = tCelda === '';
                            } else {
                              matchesCelda = tCelda !== '' && tCelda === fCelda;
                            }
                            
                            const hasReports = tendidoReports.some(r => r.tendidoId === t.id);
                            const matchesStatus = tendidoStatusFilter === 'ALL' || 
                              (tendidoStatusFilter === 'COMPLETED' && hasReports) ||
                              (tendidoStatusFilter === 'PENDING' && !hasReports);
                              
                            return matchesSearch && matchesType && matchesCelda && matchesStatus;
                          })
                          .map((tendido) => (
                          <tr key={tendido.id} className="border-b border-[#141414]/5 hover:bg-[#F8F9FA] transition-colors">
                            <td className="p-4">
                              {(() => {
                                const hasReports = tendidoReports.some(r => r.tendidoId === tendido.id);
                                return hasReports ? (
                                  <div className="flex items-center gap-2 text-green-600">
                                    <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                                      <CheckCircle size={12} className="text-white" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Completo</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-gray-400">
                                    <div className="w-4 h-4 rounded-full bg-gray-300" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Incompleto</span>
                                  </div>
                                );
                              })()}
                            </td>
                            <td 
                              className="p-4 font-mono text-sm font-bold cursor-text"
                              onDoubleClick={() => startEditingTendido(tendido)}
                            >
                              {editingTendidoId === tendido.id ? (
                                <input 
                                  type="text"
                                  value={editTendidoName}
                                  onChange={(e) => setEditTendidoName(e.target.value)}
                                  onKeyDown={handleTendidoKeyDown}
                                  onBlur={saveTendidoEdit}
                                  className="bg-white border border-blue-600 px-2 py-1 text-xs outline-none w-full"
                                  autoFocus
                                />
                              ) : (
                                tendido.name
                              )}
                            </td>
                            <td className="p-4">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                                tendido.type === '96H' ? 'border-red-500 text-red-500 bg-red-50' :
                                tendido.type === '48H' ? 'border-orange-500 text-orange-500 bg-orange-50' :
                                tendido.type === '24H' ? 'border-yellow-500 text-yellow-500 bg-yellow-50' :
                                'border-gray-500 text-gray-500 bg-gray-50'
                              }`}>
                                {tendido.type}
                              </span>
                            </td>
                            <td className="p-4 text-xs">
                              {tendido.celda ? (
                                <span className="bg-gray-100 px-2 py-1 rounded border border-gray-200 font-bold text-gray-700">
                                  {tendido.celda}
                                </span>
                              ) : (
                                <span className="opacity-30">N/A</span>
                              )}
                            </td>
                            <td className="p-4 font-mono text-sm">{Math.round(tendido.linearDistance)}m</td>
                            <td className="p-4">
                              <div className="flex flex-col gap-1">
                                {(tendido.type === '96H' || tendido.type === '48H') && (
                                  <span className="text-[9px] font-bold text-blue-600">+40m (Extremos)</span>
                                )}
                                {tendido.equipmentCount.ctoMufa > 0 && (tendido.type !== '96H' && tendido.type !== '48H') && (
                                  <span className="text-[9px] opacity-60">+{tendido.equipmentCount.ctoMufa * 20}m ({tendido.equipmentCount.ctoMufa} CTO/MUFA)</span>
                                )}
                                {tendido.equipmentCount.reserva50 > 0 && (
                                  <span className="text-[9px] opacity-60">+{tendido.equipmentCount.reserva50 * 50}m ({tendido.equipmentCount.reserva50} Res. 50m)</span>
                                )}
                                {tendido.equipmentCount.reserva60 > 0 && (
                                  <span className="text-[9px] opacity-60">+{tendido.equipmentCount.reserva60 * 60}m ({tendido.equipmentCount.reserva60} Res. 60m)</span>
                                )}
                              </div>
                            </td>
                            <td className="p-4 font-mono text-sm font-bold text-blue-600">
                              {Math.round(tendido.totalDistance)}m
                            </td>
                            <td className="p-4">
                              {(() => {
                                const reports = tendidoReports.filter(r => r.tendidoId === tendido.id);
                                if (reports.length === 0) return <span className="text-[10px] opacity-30">Sin reportes</span>;
                                
                                const totalReal = reports.reduce((acc, r) => acc + Math.abs(r.endMeter - r.startMeter), 0);
                                const diff = Math.abs(totalReal - tendido.totalDistance);
                                const isWithinLimit = diff <= 50;
                                
                                return (
                                  <div className="flex items-center gap-2">
                                    <span className={`font-mono text-sm font-bold ${isWithinLimit ? 'text-green-600' : 'text-red-600'}`}>
                                      {Math.round(totalReal)}m
                                    </span>
                                    <div className={`w-2 h-2 rounded-full ${isWithinLimit ? 'bg-green-500' : 'bg-red-500'}`} />
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => deleteTendido(tendido.id)}
                                  className="p-2 hover:bg-red-500 hover:text-white rounded transition-colors text-red-600"
                                  title="Eliminar tendido"
                                >
                                  <Trash2 size={14} />
                                </button>
                                {(() => {
                                  const report = tendidoReports.find(r => r.tendidoId === tendido.id);
                                  if (report) {
                                    return (
                                      <button 
                                        onClick={() => setShowReportSummary(report)}
                                        className="p-2 hover:bg-blue-500 hover:text-white rounded transition-colors text-blue-600"
                                        title="Ver reporte de materiales"
                                      >
                                        <Eye size={14} />
                                      </button>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'REPORTS' && (
        <div className="space-y-8">
          {!kmzProject ? (
            <div className="py-20 text-center bg-white rounded-xl border-2 border-dashed border-[#141414]/10">
              <div className="max-w-md mx-auto space-y-6">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-600">
                  <Activity size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Cargar Inventario KMZ Primero</h3>
                  <p className="text-sm opacity-50 mt-2">Debes cargar un archivo KMZ en la pestaña de Inventario para poder generar reportes técnicos.</p>
                </div>
                <button 
                  onClick={() => setActiveTab('INVENTORY')}
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                >
                  Ir a Inventario
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-8 bg-white rounded-xl border border-[#141414]/5 shadow-sm">
              {/* New Report Form */}
              <div className="bg-[#F8F9FA] p-6 rounded-xl border border-[#141414]/5">
                <h3 className="text-sm font-bold uppercase tracking-widest mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-blue-600" />
                    Nuevo Reporte de Tendido
                  </div>
                  {editingReportId && (
                    <button 
                      onClick={() => {
                        setEditingReportId(null);
                        setNewReport({
                          hardware: { 
                            cintaBandi: 0, hevillas: 0, etiquetas: 0, alambre: 0, mensajero: 0, 
                            cruceta: 0, brazoCruceta: 0, grillete: 0, chapas: 0, clevi: 0, 
                            preformado: 0, brazo060: 0, brazo1m: 0, otros: '' 
                          }
                        });
                      }}
                      className="text-[10px] text-red-500 hover:underline"
                    >
                      Cancelar Edición
                    </button>
                  )}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-50">Seleccionar Tendido</label>
                    <select 
                      value={newReport.tendidoId || ''}
                      onChange={(e) => setNewReport({ ...newReport, tendidoId: e.target.value })}
                      className="w-full bg-white border border-[#141414]/10 rounded-lg p-3 text-xs outline-none focus:border-blue-600"
                    >
                      <option value="">Seleccione un tramo...</option>
                      {kmzProject.tendidos.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-50">Abscisa Inicio (m)</label>
                    <input 
                      type="number"
                      value={newReport.startMeter || ''}
                      onChange={(e) => setNewReport({ ...newReport, startMeter: parseFloat(e.target.value) })}
                      placeholder="0"
                      className="w-full bg-white border border-[#141414]/10 rounded-lg p-3 text-xs outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-50">Abscisa Fin (m)</label>
                    <input 
                      type="number"
                      value={newReport.endMeter || ''}
                      onChange={(e) => setNewReport({ ...newReport, endMeter: parseFloat(e.target.value) })}
                      placeholder="100"
                      className="w-full bg-white border border-[#141414]/10 rounded-lg p-3 text-xs outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="space-y-2 flex flex-col justify-end">
                    <button 
                      onClick={saveReport}
                      disabled={!newReport.tendidoId || newReport.startMeter === undefined || newReport.endMeter === undefined}
                      className="w-full bg-blue-600 text-white p-3 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
                    >
                      {editingReportId ? 'Actualizar' : 'Guardar'}
                    </button>
                  </div>
                </div>

                {/* Hardware Section */}
                <div className="mt-8">
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-50 mb-4 block">Ferretería Utilizada</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {[
                      { key: 'cintaBandi', label: 'Cinta Bandi' },
                      { key: 'hevillas', label: 'Hevillas' },
                      { key: 'etiquetas', label: 'Etiquetas' },
                      { key: 'alambre', label: 'Alambre' },
                      { key: 'mensajero', label: 'Mensajero' },
                      { key: 'cruceta', label: 'Cruceta' },
                      { key: 'brazoCruceta', label: 'Brazo Cruceta' },
                      { key: 'grillete', label: 'Grillete' },
                      { key: 'chapas', label: 'Chapas' },
                      { key: 'clevi', label: 'Clevi' },
                      { key: 'preformado', label: 'Preformado' },
                      { key: 'brazo060', label: 'Brazo 0.60m' },
                      { key: 'brazo1m', label: 'Brazo 1m' }
                    ].map(item => (
                      <div key={item.key} className="space-y-1">
                        <label className="text-[9px] uppercase tracking-tight opacity-40">{item.label}</label>
                        <input 
                          type="number"
                          value={newReport.hardware?.[item.key as keyof typeof newReport.hardware] || 0}
                          onChange={(e) => setNewReport({
                            ...newReport,
                            hardware: { ...newReport.hardware!, [item.key]: parseInt(e.target.value) || 0 }
                          })}
                          className="w-full bg-white border border-[#141414]/10 rounded-lg p-2 text-xs outline-none focus:border-blue-600"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Observations Section */}
                <div className="mt-8 space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-50">Observaciones</label>
                  <textarea 
                    value={newReport.notes || ''}
                    onChange={(e) => setNewReport({ ...newReport, notes: e.target.value })}
                    placeholder="Escribe aquí cualquier observación relevante sobre el tramo o discrepancias en la distancia..."
                    className="w-full bg-white border border-[#141414]/10 rounded-lg p-3 text-xs outline-none focus:border-blue-600 min-h-[80px] resize-none"
                  />
                </div>
              </div>

              {/* Reports List */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest opacity-50">Historial de Reportes</h3>
                <div className="grid grid-cols-1 gap-4">
                  {tendidoReports.length === 0 ? (
                    <div className="py-12 text-center bg-[#F8F9FA] rounded-xl border border-dashed border-[#141414]/10">
                      <p className="text-sm opacity-40 italic">No hay reportes técnicos generados para este proyecto.</p>
                    </div>
                  ) : (
                    tendidoReports.map(report => {
                      const tendido = kmzProject?.tendidos.find(t => t.id === report.tendidoId);
                      const isOrphan = !tendido;
                      const realDist = Math.abs(report.endMeter - report.startMeter);
                      const projDist = tendido ? tendido.totalDistance : 0;
                      const diff = Math.abs(realDist - projDist);
                      const isWithinLimit = diff <= 50;

                      return (
                        <div 
                          key={report.id} 
                          className={`border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
                            isOrphan ? 'bg-orange-50/50 border-orange-200' : 'bg-white border-[#141414]/5'
                          }`}
                        >
                          <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                              <div className={`${isOrphan ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-600'} p-2 rounded-lg`}>
                                {isOrphan ? <AlertTriangle size={18} /> : <Activity size={18} />}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
                                <div className="col-span-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-sm italic">{tendido?.name || report.tendidoId || 'Diseño Anterior'}</h4>
                                    {isOrphan && (
                                      <span className="text-[8px] bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded font-bold uppercase">Huérfano</span>
                                    )}
                                  </div>
                                  <p className="text-[9px] opacity-40 uppercase tracking-widest truncate">
                                    {report.technician} • {new Date(report.timestamp).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="flex flex-col justify-center">
                                  <p className="text-[8px] uppercase tracking-widest opacity-40 mb-0.5">Proyectado</p>
                                  <p className="text-xs font-mono">{tendido ? `${Math.round(projDist)}m` : 'N/A'}</p>
                                </div>
                                <div className="flex flex-col justify-center">
                                  <p className="text-[8px] uppercase tracking-widest opacity-40 mb-0.5">Real</p>
                                  <div className="flex items-center gap-1">
                                    <p className={`text-xs font-bold ${isWithinLimit || isOrphan ? 'text-green-600' : 'text-red-600'}`}>{Math.round(realDist)}m</p>
                                    {!isOrphan && <div className={`w-1.5 h-1.5 rounded-full ${isWithinLimit ? 'bg-green-500' : 'bg-red-500'}`} />}
                                  </div>
                                </div>
                                <div className="flex flex-col justify-center">
                                  <p className="text-[8px] uppercase tracking-widest opacity-40 mb-0.5">Observaciones</p>
                                  <p className="text-[10px] italic truncate max-w-[150px]">{report.notes || '-'}</p>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <button 
                                onClick={() => setShowReportSummary(report)}
                                className="p-2 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"
                                title="Ver detalle"
                              >
                                <Eye size={18} />
                              </button>
                              <button 
                                onClick={() => deleteReport(report.id)}
                                className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                                title="Eliminar reporte"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#141414]/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setShowSettings(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-[#141414]/10 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-[#141414]/5 flex justify-between items-center bg-[#F8F9FA]">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 p-2 rounded-lg text-white">
                    <Settings size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">Configuración de IA</h2>
                    <a 
                      href="https://openrouter.ai/keys" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 mt-0.5"
                    >
                      Obtener clave en OpenRouter.ai <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-[#141414]/5 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Environment Warning */}
                {!window.location.hostname.includes('run.app') && !window.location.hostname.includes('localhost') && (
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3">
                    <AlertCircle className="text-amber-600 shrink-0" size={20} />
                    <div className="text-xs text-amber-800 space-y-1">
                      <p className="font-bold uppercase tracking-tight">Entorno Externo Detectado</p>
                      <p className="opacity-80">
                        Estás fuera de AI Studio. Los modelos de Google (Gemini) fallarán con error 403. 
                        <strong> Debes usar OpenRouter</strong> para extraer datos en Netlify.
                      </p>
                    </div>
                  </div>
                )}

                {/* Storage Info Section */}
                <div className="space-y-4 pt-4 border-t border-[#141414]/5">
                  <div className="flex items-center gap-2">
                    <Database size={16} className="text-blue-600" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">Almacenamiento de Datos</h3>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl space-y-3">
                    <p className="text-[11px] text-gray-600 leading-relaxed">
                      Las fotos y registros se guardan de forma segura en la nube (Google Firestore). 
                      Si subes fotos sin conexión, se guardan temporalmente en tu navegador (IndexedDB) 
                      y se sincronizan automáticamente cuando recuperas la conexión.
                    </p>
                    <div className="flex items-center gap-2 text-[10px] font-mono bg-white p-2 rounded border border-gray-200">
                      <span className="opacity-40">Colección:</span>
                      <span className="text-blue-600 font-bold">records</span>
                    </div>
                  </div>
                </div>

                {/* Data Recovery Section */}
                <div className="space-y-4 pt-4 border-t border-[#141414]/5">
                  <div className="flex items-center gap-2">
                    <RotateCcw size={16} className="text-blue-600" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">Recuperación de Datos</h3>
                  </div>
                  <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl space-y-3">
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      Si no ves tus fotos, esta función buscará registros "huérfanos" o asociados a otros proyectos 
                      y los vinculará al proyecto actual: <strong>{projects.find(p => p.id === currentProjectId)?.name || 'Sin Proyecto'}</strong>.
                    </p>
                    <button 
                      onClick={async () => {
                        const btn = document.getElementById('recovery-btn');
                        if (btn) btn.innerText = 'Buscando en la nube...';
                        
                        try {
                          // 1. Migrate from old localStorage
                          await storage.migrateFromLocalStorage();
                          // 2. Sync local records to cloud
                          const localRecords = await storage.loadRecords();
                          if (localRecords.length > 0 && currentProjectId && user) {
                            for (const record of localRecords) {
                              await setDoc(doc(db, 'records', record.id), {
                                ...record,
                                projectId: record.projectId || currentProjectId,
                                userId: record.userId || user.uid
                              }, { merge: true });
                            }
                            await storage.saveRecords([]);
                          }
                          
                          // 3. Cloud Recovery: Find records for this user that might be in other projects
                          if (currentProjectId && user) {
                            const q = query(collection(db, 'records'), where('userId', '==', user.uid), limit(500));
                            const snapshot = await getDocs(q);
                            let recoveredCount = 0;
                            
                            for (const docSnap of snapshot.docs) {
                              const data = docSnap.data();
                              const projectExists = projects.some(p => p.id === data.projectId);
                              
                              // If project doesn't exist OR user explicitly wants to pull everything here
                              if (!data.projectId || !projectExists) {
                                await setDoc(docSnap.ref, { ...data, projectId: currentProjectId }, { merge: true });
                                recoveredCount++;
                              }
                            }
                            alert(`Búsqueda completada. Se recuperaron ${recoveredCount} registros huérfanos.`);
                          } else {
                            alert("Búsqueda completada. Si había datos locales, se han sincronizado.");
                          }
                        } catch (e) {
                          console.error(e);
                          alert("Error durante la recuperación.");
                        } finally {
                          if (btn) btn.innerText = 'Iniciar Recuperación Profunda';
                        }
                      }}
                      id="recovery-btn"
                      className="w-full py-2.5 bg-white border border-blue-200 text-blue-600 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                    >
                      Iniciar Recuperación Profunda
                    </button>
                  </div>
                </div>

                {/* API Key Section */}
                <div className="space-y-3">
                  <label className="block text-[11px] uppercase tracking-widest font-bold opacity-50">
                    API Key de OpenRouter
                  </label>
                  <div className="relative">
                    <input 
                      type={showKey ? "text" : "password"}
                      value={openRouterKey}
                      onChange={(e) => {
                        setOpenRouterKey(e.target.value);
                        localStorage.setItem('openRouterKey', e.target.value);
                        setKeyStatus('idle');
                      }}
                      placeholder="sk-or-v1-..."
                      className={`w-full bg-[#F8F9FA] border p-4 rounded-xl text-sm outline-none transition-all font-mono pr-24 ${
                        keyStatus === 'valid' ? 'border-green-500 ring-4 ring-green-500/10' : 
                        keyStatus === 'invalid' ? 'border-red-500 ring-4 ring-red-500/10' : 
                        'border-[#141414]/10 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                      }`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <button 
                        onClick={() => setShowKey(!showKey)}
                        className="p-2 hover:bg-[#141414]/5 rounded-lg transition-colors text-[#141414]/40"
                      >
                        {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                      <div className="w-px h-4 bg-[#141414]/10" />
                      {isTestingKey ? (
                        <Loader2 size={18} className="animate-spin text-blue-600" />
                      ) : keyStatus === 'valid' ? (
                        <CheckCircle size={18} className="text-green-500" />
                      ) : keyStatus === 'invalid' ? (
                        <AlertCircle size={18} className="text-red-500" />
                      ) : (
                        <button 
                          onClick={testOpenRouterKey}
                          className="text-[10px] font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded"
                        >
                          Validar
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notifications Section */}
                <div className="space-y-4 pt-4 border-t border-[#141414]/5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <label className="block text-[11px] uppercase tracking-widest font-bold opacity-50">
                        Notificaciones de Proceso
                      </label>
                      <p className="text-[10px] opacity-40">Recibe una alerta sonora y visual al terminar la extracción.</p>
                    </div>
                    {notificationPermission === 'granted' ? (
                      <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                        <Bell size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Activadas</span>
                      </div>
                    ) : (
                      <button 
                        onClick={requestNotificationPermission}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-opacity-90 transition-all"
                      >
                        <BellRing size={14} />
                        Permitir
                      </button>
                    )}
                  </div>
                </div>

                {/* Model Browser Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Box size={16} className="text-blue-600" />
                      <h3 className="text-sm font-bold">Seleccionar Modelo</h3>
                    </div>
                    <span className="text-[10px] opacity-40 uppercase tracking-widest font-bold">
                      {availableModels.length > 0 ? `${availableModels.length} disponibles` : 'Modelos de Google'}
                    </span>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={16} />
                    <input 
                      type="text"
                      placeholder="Buscar modelos (ej: free, qwen, llama)..."
                      value={modelSearchQuery}
                      onChange={(e) => setModelSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-[#F8F9FA] border border-[#141414]/10 rounded-xl text-sm focus:border-blue-500 outline-none transition-all"
                    />
                  </div>

                  {/* Model List */}
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {/* Google Models (Always visible) */}
                    <div className="pb-2">
                      <p className="text-[9px] uppercase tracking-[0.2em] font-bold opacity-30 mb-3 ml-1">Google (Nativo)</p>
                      {[
                        { id: 'gemini-flash-latest', name: 'Gemini Flash', desc: 'Rápido y eficiente (Recomendado)', free: true },
                        { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Lite', desc: 'Versión ligera para tareas simples', free: true }
                      ].filter(m => m.name.toLowerCase().includes(modelSearchQuery.toLowerCase())).map(m => (
                        <button
                          key={m.id}
                          onClick={() => setSelectedModel(m.id)}
                          className={`w-full text-left p-4 rounded-xl border transition-all mb-2 flex items-center justify-between group ${
                            selectedModel === m.id 
                              ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/10' 
                              : 'border-[#141414]/5 hover:border-blue-600/30 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${selectedModel === m.id ? 'bg-blue-600 text-white' : 'bg-[#F8F9FA] text-[#141414]/40 group-hover:text-blue-600'}`}>
                              <Zap size={16} />
                            </div>
                            <div>
                              <div className="text-sm font-bold flex items-center gap-2">
                                {m.name}
                                {m.free && <span className="text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold uppercase">Gratis</span>}
                              </div>
                              <div className="text-[10px] opacity-40 mt-0.5">{m.desc}</div>
                            </div>
                          </div>
                          {selectedModel === m.id && <CheckCircle size={18} className="text-blue-600" />}
                        </button>
                      ))}
                    </div>

                    {/* OpenRouter Models */}
                    {openRouterKey && (
                      <div className="pt-2 border-t border-[#141414]/5 mt-4">
                        <p className="text-[9px] uppercase tracking-[0.2em] font-bold opacity-30 mb-3 ml-1">OpenRouter (BYOK)</p>
                        {isFetchingModels ? (
                          <div className="py-8 flex flex-col items-center gap-3 opacity-40">
                            <Loader2 size={24} className="animate-spin" />
                            <p className="text-[10px] uppercase tracking-widest">Cargando modelos...</p>
                          </div>
                        ) : availableModels.length === 0 ? (
                          <div className="py-8 text-center border border-dashed border-[#141414]/10 rounded-xl">
                            <p className="text-[10px] opacity-40 italic">Valida tu llave para ver los modelos de OpenRouter</p>
                          </div>
                        ) : (
                          availableModels
                            .filter(m => m.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) || m.id.toLowerCase().includes(modelSearchQuery.toLowerCase()))
                            .slice(0, 50) // Limit to top 50 for performance
                            .map(m => {
                              const fullId = `openrouter/${m.id}`;
                              const isFree = m.pricing?.prompt === "0" && m.pricing?.completion === "0";
                              return (
                                <button
                                  key={m.id}
                                  onClick={() => setSelectedModel(fullId)}
                                  className={`w-full text-left p-4 rounded-xl border transition-all mb-2 flex items-center justify-between group ${
                                    selectedModel === fullId 
                                      ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/10' 
                                      : 'border-[#141414]/5 hover:border-blue-600/30 bg-white'
                                  }`}
                                >
                                  <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg ${selectedModel === fullId ? 'bg-blue-600 text-white' : 'bg-[#F8F9FA] text-[#141414]/40 group-hover:text-blue-600'}`}>
                                      <MapPin size={16} />
                                    </div>
                                    <div>
                                      <div className="text-sm font-bold flex items-center gap-2">
                                        {m.name}
                                        <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase">Vision</span>
                                        {isFree && <span className="text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold uppercase">Gratis</span>}
                                      </div>
                                      <div className="text-[9px] opacity-40 font-mono mt-0.5">{m.id}</div>
                                      <div className="flex items-center gap-3 mt-1.5">
                                        <div className="text-[8px] bg-[#141414]/5 px-1.5 py-0.5 rounded flex items-center gap-1">
                                          <Hash size={8} /> {Math.round(m.context_length / 1024)}k Contexto
                                        </div>
                                        {!isFree && (
                                          <div className="text-[8px] text-blue-600 font-bold">
                                            ${(parseFloat(m.pricing?.prompt) * 1000000).toFixed(2)} / 1M tokens
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {selectedModel === fullId && <CheckCircle size={18} className="text-blue-600" />}
                                </button>
                              );
                            })
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-[#141414]/5 bg-[#F8F9FA] flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] opacity-40">
                  <Info size={12} />
                  <span>Selecciona un modelo para aplicarlo inmediatamente.</span>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="bg-[#141414] text-white px-8 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-lg shadow-[#141414]/20"
                >
                  Listo
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Project Modal */}
      <AnimatePresence>
        {isCreatingProject && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-[#141414] bg-opacity-90 flex items-center justify-center p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#E4E3E0] p-8 max-w-md w-full rounded-lg border border-[#141414] shadow-2xl"
            >
              <h2 className="font-serif italic text-2xl mb-4">Nuevo Proyecto</h2>
              <p className="text-sm mb-6 opacity-70">Define un nombre para el nuevo frente de trabajo (ej. SURCO 12).</p>
              
              <div className="space-y-4 mb-8">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-50">Nombre del Proyecto</label>
                  <input 
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Ej. SURCO 12, Lima 13..."
                    className="w-full bg-white border border-[#141414] px-4 py-3 outline-none focus:ring-2 ring-[#141414]/10 transition-all"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && createProject()}
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setIsCreatingProject(false)}
                  className="flex-1 border border-[#141414] py-3 text-xs uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={createProject}
                  disabled={!newProjectName.trim()}
                  className="flex-1 bg-[#141414] text-[#E4E3E0] py-3 text-xs uppercase tracking-widest hover:bg-opacity-90 transition-colors disabled:opacity-50"
                >
                  Crear Proyecto
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#141414] bg-opacity-90 flex items-center justify-center p-8"
            onClick={() => setSelectedImage(null)}
          >
            <button 
              className="absolute top-8 right-8 text-[#E4E3E0] hover:scale-110 transition-transform"
              onClick={() => setSelectedImage(null)}
            >
              <X size={32} />
            </button>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              src={selectedImage} 
              alt="Full view" 
              className="max-w-full max-h-full object-contain shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete All Confirmation Modal */}
      <AnimatePresence>
        {showDeleteKmzConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-8 max-w-sm w-full rounded-2xl shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={32} />
              </div>
              <h2 className="text-xl font-bold mb-2">¿Eliminar Proyecto KMZ?</h2>
              <p className="text-sm opacity-60 mb-8">
                Esta acción eliminará el inventario actual y todos los reportes técnicos asociados. No se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDeleteKmzConfirm(false)}
                  className="flex-1 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest border border-[#141414]/10 hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    setKmzProject(null);
                    setShowDeleteKmzConfirm(false);
                  }}
                  className="flex-1 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showDeleteAllConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-[#141414] bg-opacity-90 flex items-center justify-center p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#E4E3E0] p-8 max-w-md w-full rounded-lg border border-[#141414] shadow-2xl"
            >
              <h2 className="font-serif italic text-2xl mb-4 text-red-600">
                Confirmar Eliminación {isFiltered ? 'Filtrada' : 'Total'}
              </h2>
              <p className="text-sm mb-8 opacity-70 leading-relaxed">
                ¿Estás seguro de que quieres eliminar <strong>{isFiltered ? `los ${filteredRecords.length} registros filtrados` : `todos los ${records.length} registros`}</strong>? 
                {isFiltered ? ' Los demás registros se mantendrán.' : ' Esta acción no se puede deshacer y todos los datos extraídos se perderán.'}
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowDeleteAllConfirm(false)}
                  className="flex-1 border border-[#141414] py-3 text-xs uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={deleteFilteredRecords}
                  className="flex-1 bg-red-600 text-white py-3 text-xs uppercase tracking-widest hover:bg-red-700 transition-colors"
                >
                  Sí, Eliminar {isFiltered ? 'Filtrados' : 'Todo'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Summary Modal */}
      <AnimatePresence>
        {uploadSummary && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-[#141414] bg-opacity-90 flex items-center justify-center p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#E4E3E0] p-8 max-w-2xl w-full rounded-lg border border-[#141414] shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-serif italic text-2xl">Resumen de Carga</h2>
                <button onClick={() => setUploadSummary(null)} className="p-1 hover:bg-black hover:bg-opacity-5 rounded">
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-white p-4 rounded border border-[#141414] border-opacity-10 text-center">
                  <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1">Total</p>
                  <p className="text-2xl font-mono">{uploadSummary.total}</p>
                </div>
                <div className="bg-green-50 p-4 rounded border border-green-200 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-green-600 mb-1">Éxito</p>
                  <p className="text-2xl font-mono text-green-700">{uploadSummary.success}</p>
                </div>
                <div className="bg-red-50 p-4 rounded border border-red-200 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-red-600 mb-1">Fallidos</p>
                  <p className="text-2xl font-mono text-red-700">{uploadSummary.failed.length}</p>
                </div>
              </div>

              {uploadSummary.failed.length > 0 && (
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-50 mb-2">Fotos que no se pudieron procesar:</p>
                  {uploadSummary.failed.map((f, i) => (
                    <div key={i} className="bg-white p-3 rounded border border-red-100 flex flex-col gap-1">
                      <p className="text-sm font-mono truncate" title={f.name}>{f.name}</p>
                      <p className="text-[10px] text-red-500 italic">
                        {f.error.startsWith('{') ? (
                          (() => {
                            try {
                              const parsed = JSON.parse(f.error);
                              return parsed.error?.message || f.error;
                            } catch {
                              return f.error;
                            }
                          })()
                        ) : f.error}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <button 
                onClick={() => setUploadSummary(null)}
                className="mt-8 w-full bg-[#141414] text-[#E4E3E0] py-4 text-xs uppercase tracking-widest hover:bg-opacity-90 transition-colors"
              >
                Entendido
              </button>
            </motion.div>
          </motion.div>
        )}

        {showReportSummary && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-8 max-w-sm w-full rounded-2xl shadow-2xl flex flex-col relative"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-bold text-lg uppercase tracking-widest opacity-50">Resumen de Reporte</h2>
                <button onClick={() => setShowReportSummary(null)} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-1 text-xs font-mono mb-8">
                <p><span className="font-bold">FECHA:</span> {new Date(showReportSummary.timestamp).toLocaleDateString()}</p>
                <p><span className="font-bold">HORA:</span> {new Date(showReportSummary.timestamp).toLocaleTimeString()}</p>
                <p><span className="font-bold">PROYECTO:</span> {kmzProject?.name || 'N/A'}</p>
                <br />
                <p><span className="font-bold">TECNICO:</span> {showReportSummary.technician}</p>
                <br />
                <p><span className="font-bold">TRAMO:</span> {kmzProject?.tendidos.find(t => t.id === showReportSummary.tendidoId)?.name}</p>
                <br />
                <p><span className="font-bold">Punta Inicial:</span> {showReportSummary.startMeter}m</p>
                <p><span className="font-bold">Punta Final:</span> {showReportSummary.endMeter}m</p>
                <p><span className="font-bold">Tendido:</span> {Math.abs(showReportSummary.endMeter - showReportSummary.startMeter)}m</p>
                
                {[
                  { key: 'preformado', label: 'PREFORMADO' },
                  { key: 'clevi', label: 'CLEVIS' },
                  { key: 'brazo060', label: 'BRAZO 60' },
                  { key: 'cintaBandi', label: 'CINTA BANDI' },
                  { key: 'hevillas', label: 'HEBILLA' },
                  { key: 'etiquetas', label: 'ETIQETAS' },
                  { key: 'cruceta', label: 'CRUZETA' },
                  { key: 'alambre', label: 'ALAMBRE' },
                  { key: 'brazoCruceta', label: 'BRAZO CRUZETA' },
                  { key: 'mensajero', label: 'MENSAJERO' },
                  { key: 'chapas', label: 'CHAPA' },
                  { key: 'grillete', label: 'GRILLETE' },
                  { key: 'brazo1m', label: 'BRAZO DE 1MT' }
                ].map(item => {
                  const val = showReportSummary.hardware[item.key as keyof typeof showReportSummary.hardware];
                  if (typeof val === 'number' && val > 0) {
                    return <p key={item.key}><span className="font-bold">{item.label}:</span> {val}</p>;
                  }
                  return null;
                })}
                {showReportSummary.hardware.otros && (
                  <p><span className="font-bold">OTROS:</span> {showReportSummary.hardware.otros}</p>
                )}
                {showReportSummary.notes && (
                  <>
                    <br />
                    <p><span className="font-bold">OBSERVACIONES:</span></p>
                    <p className="italic opacity-60">{showReportSummary.notes}</p>
                  </>
                )}
              </div>

              <div className="absolute bottom-4 right-4 flex gap-2">
                <button 
                  onClick={() => {
                    startEditingReport(showReportSummary);
                    setShowReportSummary(null);
                  }}
                  className="p-3 bg-gray-100 text-gray-600 rounded-full shadow-lg hover:bg-gray-200 transition-all"
                  title="Editar reporte"
                >
                  <Pencil size={20} />
                </button>
                <button 
                  onClick={() => copyReportToClipboard(showReportSummary)}
                  className={`p-3 rounded-full shadow-lg transition-all ${
                    isCopied ? 'bg-green-500 text-white scale-110' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  title="Copiar reporte"
                >
                  {isCopied ? <CheckCircle size={20} /> : <Copy size={20} />}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="p-12 border-t border-[#141414] border-opacity-10 mt-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <h3 className="font-serif italic text-lg">Inventory System V2.0</h3>
            <p className="text-[11px] uppercase tracking-widest opacity-50 mt-1">Powered by Gemini AI Vision</p>
            <p className="text-[10px] uppercase tracking-widest opacity-30 mt-4">Created by Joel Rivas & AI Studio</p>
          </div>
          <div className="flex gap-12 text-[10px] uppercase tracking-[0.2em] opacity-30">
            <span>Precision Data</span>
            <span>GPS Verified</span>
            <span>Cloud Sync Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
