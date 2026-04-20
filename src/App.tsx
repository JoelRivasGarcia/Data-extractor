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
  UploadCloud,
  CheckCircle,
  AlertCircle,
  UserPlus,
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
  Briefcase,
  Copy,
  ChevronDown,
  Pencil,
  Send,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import EXIF from 'exif-js';
import Tesseract from 'tesseract.js';
import { EquipmentRecord, Project, InventoryItem, KmzProject, TendidoItem, TendidoReport, EquipmentRecordSummary, ProjectIndex } from './types';
import { parseKmz, calculateDistance } from './services/kmzService';
import { extractEquipmentData } from './services/geminiService';
import { extractWithOpenRouter, fetchOpenRouterModels } from './services/openRouterService';
import { storage, PendingUpload } from './lib/storage';
import { compressImage, getImageHash } from './lib/utils';
import { auth, googleProvider, signInWithPopup, signOut, db, collection, query, where, onSnapshot, doc, setDoc, getDoc, updateDoc, limit, getDocs, writeBatch, arrayUnion, arrayRemove, deleteDoc } from './firebase';
import { useAuth, handleFirestoreError, OperationType } from './FirebaseProvider';

export default function App() {
  const { user, loading: authLoading, isAdmin: isGoogleAdmin, quotaExceeded, setQuotaExceeded } = useAuth();
  const isSuperAdmin = user?.email?.toLowerCase() === 'joelrivasgarciagy@gmail.com';
  const [techSession, setTechSession] = useState<{ contractorId: string; technicianId: string; name: string } | null>(
    JSON.parse(localStorage.getItem('techSession') || 'null')
  );
  const [techLoginForm, setTechLoginForm] = useState({ contractorId: '', pin: '' });
  const [isLoggingInTech, setIsLoggingInTech] = useState(false);
  
  const isAdmin = isGoogleAdmin || isSuperAdmin;
  const isTechnician = techSession !== null;
  const [activeContractorId, setActiveContractorId] = useState<string | null>(localStorage.getItem('activeContractorId'));
  const currentContractorId = techSession?.contractorId || activeContractorId;

  const [records, setRecords] = useState<EquipmentRecord[]>([]);
  const [displayLimit, setDisplayLimit] = useState(20);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CTO' | 'MUFA' | 'RESERVA'>('ALL');
  const [uploadType, setUploadType] = useState<'CTO' | 'MUFA' | 'RESERVA'>('CTO');
  const [sortOrder, setSortOrder] = useState<'NEWEST' | 'OLDEST' | 'SERIAL_ASC' | 'SERIAL_DESC' | 'POWER_ASC' | 'POWER_DESC'>('NEWEST');
  const [selectedModel, setSelectedModel] = useState<string>("gemini-flash-latest");
  const [pendingCount, setPendingCount] = useState(0);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [showDeleteKmzConfirm, setShowDeleteKmzConfirm] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [telegramBotToken, setTelegramBotToken] = useState<string>(localStorage.getItem('telegramBotToken') || '');
  const [isSavingBotToken, setIsSavingBotToken] = useState(false);
  const [isSavingChatId, setIsSavingChatId] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<{
    total: number;
    success: number;
    failed: { name: string; error: string }[];
  } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
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
  const [activeTab, setActiveTab] = useState<'EXTRACTION' | 'INVENTORY' | 'REPORTS' | 'TEAM' | 'SYSTEM'>('REPORTS');
  const [inventorySubTab, setInventorySubTab] = useState<'EQUIPOS' | 'TENDIDOS'>('EQUIPOS');
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState<'ALL' | 'CTO' | 'MUFA' | 'RESERVA'>('ALL');
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<'ALL' | 'PENDING' | 'INSTALLED'>('ALL');
  const [inventoryCeldaFilter, setInventoryCeldaFilter] = useState('ALL');
  const [inventoryTechFilter, setInventoryTechFilter] = useState('ALL');
  const [selectedInventoryItems, setSelectedInventoryItems] = useState<Set<string>>(new Set());
  const [assignmentTechId, setAssignmentTechId] = useState<string>('');
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [techSearchQuery, setTechSearchQuery] = useState('');
  const [contractors, setContractors] = useState<any[]>([]);
  const [isCreatingTech, setIsCreatingTech] = useState(false);
  const [newTechName, setNewTechName] = useState('');
  const [newTechPin, setNewTechPin] = useState('');
  const [isCreatingContractor, setIsCreatingContractor] = useState(false);
  const [newContractorName, setNewContractorName] = useState('');
  const [tendidoTypeFilter, setTendidoTypeFilter] = useState<'ALL' | '96H' | '48H' | '24H' | 'OTRO'>('ALL');
  const [tendidoStatusFilter, setTendidoStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  const [tendidoCeldaFilter, setTendidoCeldaFilter] = useState('ALL');
  const [tendidoTechFilter, setTendidoTechFilter] = useState('ALL');
  const [kmzProject, setKmzProject] = useState<KmzProject | null>(null);
  const [tendidoReports, setTendidoReports] = useState<TendidoReport[]>([]);
  const [editingTendidoId, setEditingTendidoId] = useState<string | null>(null);
  const [editTendidoName, setEditTendidoName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [editingContractorId, setEditingContractorId] = useState<string | null>(null);
  const [editingContractorName, setEditingContractorName] = useState('');
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
  const [reportDateFilter, setReportDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [activeReportMode, setActiveReportMode] = useState<'TENDIDO' | 'EQUIPOS'>('TENDIDO');
  const [equipmentReportFile, setEquipmentReportFile] = useState<File | null>(null);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string>('');
  const [equipmentReportNotes, setEquipmentReportNotes] = useState('');
  const [isSubmittingEquipment, setIsSubmittingEquipment] = useState(false);
  const [showMetersSummary, setShowMetersSummary] = useState(false);
  const [showHardwareSummary, setShowHardwareSummary] = useState(false);
  const [storageMode, setStorageMode] = useState<'cloud' | 'local'>(localStorage.getItem('storageMode') as any || 'cloud');
  const [localDataGenerated, setLocalDataGenerated] = useState(false);
  const generateLocalTestData = async () => {
    try {
      setLocalDataGenerated(true);
      
      const mockContractors = [
        { id: 'mock-contractor-1', name: 'Contratista de Prueba', createdAt: new Date().toISOString() }
      ];
      
      const mockTechnicians = [
        { id: 'mock-tech-1', contractorId: 'mock-contractor-1', name: 'Técnico Demo', pin: '1234', role: 'TECH', createdAt: new Date().toISOString() }
      ];
      
      const mockProjects: Project[] = [
        { 
          id: 'mock-project-1', 
          name: 'Proyecto Local Demo', 
          contractorId: 'mock-contractor-1', 
          members: [user?.uid || 'system'],
          createdAt: new Date().toISOString(),
          createdBy: user?.uid || 'system',
          status: 'active'
        }
      ];
      
      await storage.saveLocalContractors(mockContractors);
      await storage.saveLocalTechnicians('mock-contractor-1', mockTechnicians);
      await storage.saveLocalProjects('mock-contractor-1', mockProjects);
      
      setContractors(mockContractors);
      setTechnicians(mockTechnicians);
      setProjects(mockProjects);
      
      if (!currentContractorId) {
        setActiveContractorId('mock-contractor-1');
        localStorage.setItem('activeContractorId', 'mock-contractor-1');
      }
      
      // Removed alert for better responsiveness
    } catch (e) {
      console.error(e);
    } finally {
      setLocalDataGenerated(false);
    }
  };

  const switchStorageMode = async (mode: 'cloud' | 'local') => {
    // Reactive switch without blocking reload
    if (mode === 'local') {
      // Load current cloud data to local before switching if possible
      if (contractors.length > 0) await storage.saveLocalContractors(contractors);
      if (activeContractorId && technicians.length > 0) await storage.saveLocalTechnicians(activeContractorId, technicians);
      if (activeContractorId && projects.length > 0) await storage.saveLocalProjects(activeContractorId, projects);
    }
    
    setStorageMode(mode);
    localStorage.setItem('storageMode', mode);
    // Removed window.location.reload() for better responsiveness
  };
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const kmzFileInputRef = useRef<HTMLInputElement>(null);
  const isKmzInitialLoad = useRef(true);
  const lastProjectId = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading || (!user && !techSession)) return;

    if (storageMode === 'local') {
      const loadLocal = async () => {
        const list = await storage.getLocalContractors();
        setContractors(list);
        if (!localStorage.getItem('activeContractorId') && list.length > 0) {
          localStorage.setItem('activeContractorId', list[0].id);
          setActiveContractorId(list[0].id);
        }
      };
      loadLocal();
      return;
    }

    let q;
    if (user?.email === 'joelrivasgarciagy@gmail.com') {
      q = query(collection(db, 'contractors'));
    } else if (currentContractorId) {
      q = query(collection(db, 'contractors'), where('id', '==', currentContractorId));
    } else {
      return;
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setContractors(list);
      
      if (!localStorage.getItem('activeContractorId') && list.length > 0) {
        localStorage.setItem('activeContractorId', list[0].id);
        setActiveContractorId(list[0].id);
      }
    });

    return () => unsubscribe();
  }, [user, techSession, authLoading, currentContractorId, isSuperAdmin, storageMode]);

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
        setInventoryTechFilter('ALL');
        setTendidoTechFilter('ALL');
        setTendidoTypeFilter('ALL');
        setTendidoStatusFilter('ALL');
        setInventorySearchQuery('');
      }

      if (isKmzInitialLoad.current) {
        // Cleanup old global keys from previous versions
        localStorage.removeItem('kmzProject');
        localStorage.removeItem('tendidoReports');
        
        const savedKmz = localStorage.getItem(`kmzProject_${currentProjectId}`);
        setKmzProject(savedKmz ? JSON.parse(savedKmz) : null);
        isKmzInitialLoad.current = false;
      } else {
        // Save only after initial load
        if (kmzProject) {
          localStorage.setItem(`kmzProject_${currentProjectId}`, JSON.stringify(kmzProject));
        } else {
          localStorage.removeItem(`kmzProject_${currentProjectId}`);
        }
      }
    } else {
      setKmzProject(null);
      setTendidoReports([]);
      isKmzInitialLoad.current = true;
      lastProjectId.current = null;
    }
  }, [kmzProject, currentProjectId]);

  useEffect(() => {
    if (authLoading || (!user && !techSession) || !currentContractorId) return;

    if (storageMode === 'local') {
      const loadLocal = async () => {
        const list = await storage.getLocalProjects(currentContractorId);
        setProjects(list);
        setProjectsLoaded(true);
        if (list.length > 0) {
          const isCurrentProjectValid = list.some(p => p.id === currentProjectId);
          if (!currentProjectId || !isCurrentProjectValid) {
            const firstId = list[0].id;
            setCurrentProjectId(firstId);
            localStorage.setItem('currentProjectId', firstId);
          }
        } else {
          setCurrentProjectId(null);
          localStorage.removeItem('currentProjectId');
        }
      };
      loadLocal();
      return;
    }

    const effectiveUserId = user?.uid || techSession?.technicianId;
    if (!effectiveUserId) return;

    // Load projects only for the current contractor and user membership
    const q = query(
      collection(db, 'projects'), 
      where('contractorId', '==', currentContractorId), 
      where('status', '==', 'active'),
      where('members', 'array-contains', effectiveUserId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      setProjects(list);
      setProjectsLoaded(true);
      
      // Auto-select first project if none active OR if current project doesn't belong to this contractor
      if (list.length > 0) {
        const isCurrentProjectValid = list.some(p => p.id === currentProjectId);
        if (!currentProjectId || !isCurrentProjectValid) {
          const firstId = list[0].id;
          setCurrentProjectId(firstId);
          localStorage.setItem('currentProjectId', firstId);
        }
      } else {
        setCurrentProjectId(null);
        localStorage.removeItem('currentProjectId');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });

    return () => unsubscribe();
  }, [user, techSession, authLoading, currentContractorId, storageMode]);

  useEffect(() => {
    if (!currentContractorId) return;
    
    if (storageMode === 'local') {
      const loadLocal = async () => {
        const list = await storage.getLocalTechnicians(currentContractorId);
        setTechnicians(list);
      };
      loadLocal();
      return;
    }

    const q = query(collection(db, 'technicians'), where('contractorId', '==', currentContractorId));
    const unsubTechs = onSnapshot(q, (snapshot) => {
      setTechnicians(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubTechs();
  }, [currentContractorId, storageMode]);

  useEffect(() => {
    if (!isSuperAdmin || storageMode === 'local') return;
    const loadBotToken = async () => {
      try {
        const docRef = doc(db, 'system_settings', 'telegram');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const token = docSnap.data().botToken;
          setTelegramBotToken(token);
          localStorage.setItem('telegramBotToken', token);
        }
      } catch (err) {
        console.error("Error loading bot token:", err);
      }
    };
    loadBotToken();
  }, [isSuperAdmin, storageMode]);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
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

  const sendTelegramNotification = async (message: string, chatId?: string) => {
    const token = telegramBotToken;
    if (!token || !chatId) return;

    const queueMessage = (msg: string, cid: string) => {
      const queue = JSON.parse(localStorage.getItem('telegram_queue') || '[]');
      queue.push({ msg, cid, timestamp: new Date().toISOString() });
      localStorage.setItem('telegram_queue', JSON.stringify(queue));
    };

    if (!navigator.onLine) {
      queueMessage(message, chatId);
      return;
    }

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown'
        })
      });
      if (!response.ok) {
        queueMessage(message, chatId);
      }
    } catch (err) {
      console.error("Error sending Telegram message:", err);
      queueMessage(message, chatId);
    }
  };

  useEffect(() => {
    if (isOnline && telegramBotToken) {
      const processQueue = async () => {
        const queue: { msg: string, cid: string }[] = JSON.parse(localStorage.getItem('telegram_queue') || '[]');
        if (queue.length === 0) return;

        console.log(`Processing ${queue.length} queued Telegram reports...`);
        const remaining = [];
        for (const item of queue) {
          try {
            const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: item.cid,
                text: item.msg,
                parse_mode: 'Markdown'
              })
            });
            if (!response.ok) remaining.push(item);
          } catch (err) {
            remaining.push(item);
          }
        }
        localStorage.setItem('telegram_queue', JSON.stringify(remaining));
      };
      processQueue();
    }
  }, [isOnline, telegramBotToken]);

  const saveTelegramBotToken = async (token: string) => {
    if (!isSuperAdmin) return;
    setIsSavingBotToken(true);
    try {
      if (storageMode === 'local') {
        setTelegramBotToken(token);
        localStorage.setItem('telegramBotToken', token);
      } else {
        await setDoc(doc(db, 'system_settings', 'telegram'), { botToken: token });
        setTelegramBotToken(token);
        localStorage.setItem('telegramBotToken', token);
      }
    } catch (err) {
      console.error("Error saving bot token:", err);
      setError("Error al guardar token de Telegram.");
    } finally {
      setIsSavingBotToken(false);
    }
  };

  const updateProjectChatId = async (projectId: string, chatId: string) => {
    if (!isAdmin) return;
    setIsSavingChatId(true);
    try {
      if (storageMode === 'local') {
        const updated = projects.map(p => p.id === projectId ? { ...p, telegramChatId: chatId } : p);
        setProjects(updated);
        if (currentContractorId) {
          await storage.saveLocalProjects(currentContractorId, updated);
        }
      } else {
        await updateDoc(doc(db, 'projects', projectId), { telegramChatId: chatId });
      }
    } catch (err) {
      console.error("Error updating chat ID:", err);
      setError("Error al actualizar Chat ID.");
    } finally {
      setIsSavingChatId(false);
    }
  };

  useEffect(() => {
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
                  contractorId: currentContractorId || '',
                  members: [user.uid],
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

  const [memberManagementProject, setMemberManagementProject] = useState<Project | null>(null);

  const toggleManualStatus = async (itemId: string, type: 'EQUIPO' | 'TENDIDO') => {
    if (!kmzProject || !currentProjectId) return;

    const newKmz = { ...kmzProject };
    if (type === 'EQUIPO') {
      newKmz.items = newKmz.items.map(item => {
        if (item.id === itemId) {
          const newStatus = item.manualStatus === 'INSTALLED' ? 'PENDING' : 'INSTALLED';
          return { ...item, manualStatus: newStatus };
        }
        return item;
      });
    } else {
      newKmz.tendidos = newKmz.tendidos.map(t => {
        if (t.id === itemId) {
          const newStatus = t.manualStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
          return { ...t, manualStatus: newStatus };
        }
        return t;
      });
    }

    setKmzProject(newKmz);

    // Save to storage
    try {
      if (storageMode === 'local') {
        localStorage.setItem(`kmzProject_${currentProjectId}`, JSON.stringify(newKmz));
      } else {
        await setDoc(doc(db, 'kmz_projects', currentProjectId), newKmz);
        // Also update the project's last update timestamp
        await updateDoc(doc(db, 'projects', currentProjectId), { lastKmzUpdate: new Date().toISOString() });
      }
    } catch (err) {
      console.error("Error toggling manual status:", err);
      setError("Error al actualizar el estado manual.");
    }
  };

  const toggleProjectMember = async (projectId: string, techId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const isMember = project.members.includes(techId);
    const updatedMembers = isMember 
      ? project.members.filter(id => id !== techId)
      : [...project.members, techId];

    try {
      if (storageMode === 'local') {
        const updated = projects.map(p => p.id === projectId ? { ...p, members: updatedMembers } : p);
        setProjects(updated);
        if (currentContractorId) {
          await storage.saveLocalProjects(currentContractorId, updated);
        }
      } else {
        await updateDoc(doc(db, 'projects', projectId), { members: updatedMembers });
      }
      
      // Update local state for modal if open
      if (memberManagementProject?.id === projectId) {
        setMemberManagementProject({ ...project, members: updatedMembers });
      }
    } catch (err) {
      console.error("Error toggling member:", err);
      setError("Error al asignar técnico al proyecto.");
    }
  };

  // 3. Consolidated Cloud Synchronization
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    if (authLoading || !user || !currentProjectId) {
      if (!currentProjectId) {
        setRecords([]);
        setIsInitialLoad(false);
      }
      return;
    }

    // Reset records when project changes to avoid showing old data
    setRecords([]);
    setSelectedInventoryItems(new Set());
    setNewlyAddedIds(new Set());
    setIsInitialLoad(true);

    const syncRecords = async () => {
      if (storageMode === 'local') {
        const localRecords = await storage.loadRecords(currentProjectId);
        setRecords(localRecords);
        setIsInitialLoad(false);
        return;
      }
      try {
        // 1. Load from cache first
        const localRecords = await storage.loadRecords(currentProjectId);
        if (localRecords.length > 0) {
          setRecords(localRecords);
          setIsInitialLoad(false);
        }

        const projectDoc = projects.find(p => p.id === currentProjectId);
        const lastSync = await storage.getLastSync(currentProjectId);
        
        // Metadata comparison to avoid fetching the index if no changes occurred
        if (!projectDoc?.lastRecordsUpdate || (lastSync && projectDoc.lastRecordsUpdate <= lastSync)) {
          console.log("Records are up to date in cache (No read).");
        } else {
          const indexDoc = await getDoc(doc(db, 'project_indexes', currentProjectId));
          if (indexDoc.exists()) {
            const indexData = indexDoc.data() as ProjectIndex;
            console.log(`Loading ${indexData.items.length} records from index bucket.`);
            
            const indexRecords: EquipmentRecord[] = indexData.items.map(item => ({
              ...item,
              timestamp: item.extractedAt,
              projectId: currentProjectId,
              imageUrl: undefined
            } as EquipmentRecord));

            setRecords(prev => {
              let combined = [...prev];
              indexRecords.forEach(ir => {
                if (!combined.some(r => r.id === ir.id)) combined.push(ir);
              });
              storage.saveRecords(currentProjectId, combined);
              return combined;
            });
            
            // Mark last sync as the current metadata time to avoid re-reading
            if (projectDoc.lastRecordsUpdate) {
               await storage.setLastSync(currentProjectId, projectDoc.lastRecordsUpdate);
            }
          }
        }

        // 3. Incremental sync for live updates
        let q = query(
          collection(db, 'records'), 
          where('projectId', '==', currentProjectId),
          limit(200)
        );

        // Security filtering
        if (isTechnician) {
          // Technicians only see their assignments or records if assigned
          // Note: In reality, we'd add where('assignedTo', '==', techSession.technicianId) 
          // but records are usually identified by userId in the extraction mode.
          // For now, let's allow them to see records they uploaded or were assigned.
        }

        if (!isAdmin && user) {
          q = query(q, where('userId', '==', user.uid));
        }
        
        if (lastSync) {
          q = query(q, where('extractedAt', '>', lastSync));
        }

        unsubscribe = onSnapshot(q, (snapshot) => {
          let hasChanges = false;
          let latestTimestamp = lastSync || '';

          setRecords(prev => {
            let newRecords = [...prev];
            
            snapshot.docChanges().forEach((change: any) => {
              const data = change.doc.data() as EquipmentRecord;
              hasChanges = true;
              
              if (data.extractedAt > latestTimestamp) {
                latestTimestamp = data.extractedAt;
              }

              if (change.type === 'removed') {
                newRecords = newRecords.filter(r => r.id !== data.id);
              } else {
                const index = newRecords.findIndex(r => r.id === data.id);
                if (index >= 0) {
                  newRecords[index] = data;
                } else {
                  newRecords.push(data);
                }
              }
            });

            if (hasChanges) {
              const filtered = newRecords.filter(r => r.projectId === currentProjectId);
              storage.saveRecords(currentProjectId, filtered);
              if (latestTimestamp) {
                storage.setLastSync(currentProjectId, latestTimestamp);
              }
              return filtered;
            }
            return prev;
          });
          
          setIsInitialLoad(false);
        }, (error) => {
          if (error.message?.includes('quota')) {
            setQuotaExceeded(true);
            console.warn("Quota exceeded, switching to local mode.");
          } else {
            handleFirestoreError(error, OperationType.LIST, 'records');
          }
        });
      } catch (e) {
        console.error("Error en syncRecords:", e);
      }
    };

    syncRecords();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, authLoading, currentProjectId, isAdmin, storageMode]);

  // 4. Sync Tendido Reports
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    if (authLoading || !currentProjectId) {
      if (!currentProjectId) setTendidoReports([]);
      return;
    }

    const syncReports = async () => {
      // 1. Load from cache first (migrate if needed)
      let localReports = await storage.getLocalReports(currentProjectId);
      
      const legacy = localStorage.getItem(`tendidoReports_${currentProjectId}`);
      if (legacy && localReports.length === 0) {
        try {
          localReports = JSON.parse(legacy);
          await storage.saveLocalReports(currentProjectId, localReports);
          localStorage.removeItem(`tendidoReports_${currentProjectId}`);
        } catch (e) {
          console.error("Error migrating legacy reports:", e);
        }
      }
      
      setTendidoReports(localReports);

      // If we are in local mode OR no user to sync with, stop here
      if (storageMode === 'local' || !user) return;

      // 2. Identify last sync time for differential fetch
      const lastSyncTime = localReports.length > 0 
        ? localReports.reduce((max, r) => r.timestamp > max ? r.timestamp : max, localReports[0].timestamp)
        : null;

      try {
        let q = query(
          collection(db, 'tendido_reports'),
          where('projectId', '==', currentProjectId)
        );

        if (lastSyncTime) {
          q = query(q, where('timestamp', '>', lastSyncTime));
        }

        unsubscribe = onSnapshot(q, (snapshot) => {
          if (snapshot.empty && localReports.length > 0) return;

          setTendidoReports(prev => {
            let combined = [...prev];
            snapshot.docChanges().forEach((change: any) => {
              const data = change.doc.data() as TendidoReport;
              if (change.type === 'added') {
                if (!combined.find(r => r.id === data.id)) combined.push(data);
              } else if (change.type === 'modified') {
                combined = combined.map(r => r.id === data.id ? data : r);
              } else if (change.type === 'removed') {
                combined = combined.filter(r => r.id !== data.id);
              }
            });
            
            const sorted = combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            storage.saveLocalReports(currentProjectId, sorted);
            return sorted;
          });
        }, (error) => {
          if (error.message?.includes('quota')) {
            setQuotaExceeded(true);
            console.warn("Quota exceeded in reports, using cache.");
          } else {
            console.error("Firestore Error in reports:", error);
          }
        });
      } catch (e) {
        console.error("Error setting up reports sync:", e);
      }
    };

    syncReports();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, authLoading, currentProjectId, storageMode]);

  // 5. Sync KMZ Project Data (Items & Tendidos)
  const currentProjectMetadata = projects.find(p => p.id === currentProjectId);
  const lastKmzUpdate = currentProjectMetadata?.lastKmzUpdate;

  useEffect(() => {
    if (authLoading || !user || !currentProjectId) {
      // Don't clear if we're parsing or just uploaded
      if (!currentProjectId && !isParsingKmz) {
        setKmzProject(null);
      }
      return;
    }

    const loadProjectData = async () => {
      // 1. Try local storage first
      const saved = localStorage.getItem(`kmzProject_${currentProjectId}`);
      let localData: KmzProject | null = null;
      if (saved) {
        try {
          localData = JSON.parse(saved);
          setKmzProject(localData);
        } catch (e) {
          console.error("Error parsing cached KMZ:", e);
        }
      }

      // 2. Fetch from Cloud ONLY if metadata says it's newer or we have no local data
      if (storageMode === 'local') return;

      const projectDoc = projects.find(p => p.id === currentProjectId);
      const needsReload = !localData || (projectDoc?.lastKmzUpdate && localData.uploadedAt !== projectDoc.lastKmzUpdate);

      if (!needsReload && localData) {
        console.log("KMZ structure loaded from cache (Static).");
        return;
      }

      try {
        const docSnap = await getDoc(doc(db, 'kmz_projects', currentProjectId));
        if (docSnap.exists()) {
          const cloudData = docSnap.data() as KmzProject;
          // Ensure uploadedAt is consistent with project metadata if available
          if (projectDoc?.lastKmzUpdate) {
            cloudData.uploadedAt = projectDoc.lastKmzUpdate;
          }
          
          setKmzProject(cloudData);
          localStorage.setItem(`kmzProject_${currentProjectId}`, JSON.stringify(cloudData));
          console.log("KMZ structure refreshed from cloud.");
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('quota')) {
          setQuotaExceeded(true);
        } else {
          console.error("Error loading KMZ project from cloud:", error);
        }
      }
    };

    if (!isParsingKmz) {
      loadProjectData();
    }
  }, [user, authLoading, currentProjectId, isParsingKmz, lastKmzUpdate, storageMode]);

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
        setError("Dominio no autorizado. Si estás usando una URL compartida o de vista previa, debes añadir este dominio en la Consola de Firebase > Authentication > Settings > Authorized domains.");
      } else if (err.code === 'auth/cancelled-popup-request') {
        // User closed the popup, no need to show error
      } else {
        setError("Error al iniciar sesión: " + (err.message || "Error desconocido"));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleTechLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!techLoginForm.contractorId || !techLoginForm.pin) return;
    
    setIsLoggingInTech(true);
    setError(null);
    try {
      let techData: any = null;
      let techId: string = '';

      if (storageMode === 'local') {
        const localTechs = await storage.getLocalTechnicians(techLoginForm.contractorId.trim().toUpperCase());
        const found = localTechs.find(t => t.pin === techLoginForm.pin.trim());
        if (!found) {
          throw new Error("ID de Contrata o PIN incorrecto (Modo Local)");
        }
        techData = found;
        techId = found.id;
      } else {
        const q = query(
          collection(db, 'technicians'), 
          where('contractorId', '==', techLoginForm.contractorId.trim().toUpperCase()),
          where('pin', '==', techLoginForm.pin.trim())
        );
        
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          throw new Error("ID de Contrata o PIN incorrecto");
        }
        techData = snapshot.docs[0].data();
        techId = snapshot.docs[0].id;
      }

      const session = {
        contractorId: techLoginForm.contractorId.trim().toUpperCase(),
        technicianId: techId,
        name: techData.name
      };

      setTechSession(session);
      localStorage.setItem('techSession', JSON.stringify(session));
      
      if (storageMode === 'local') {
        const localTechs = await storage.getLocalTechnicians(session.contractorId);
        const updated = localTechs.map(t => t.id === session.technicianId ? { ...t, lastLogin: new Date().toISOString() } : t);
        await storage.saveLocalTechnicians(session.contractorId, updated);
      } else {
        await setDoc(doc(db, 'technicians', session.technicianId), { lastLogin: new Date().toISOString() }, { merge: true });
      }
    } catch (err: any) {
      console.error("Tech Login Error:", err);
      setError(err.message || "Error al validar técnico");
    } finally {
      setIsLoggingInTech(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (techSession) {
        setTechSession(null);
        localStorage.removeItem('techSession');
      } else {
        await signOut(auth);
      }
      setCurrentProjectId(null);
      localStorage.removeItem('currentProjectId');
      setActiveTab('REPORTS');
    } catch (err) {
      console.error("Error logging out:", err);
    }
  };

  const createTechnician = async () => {
    if (!newTechName.trim() || !newTechPin.trim() || !currentContractorId) {
      setModalError("Nombre y PIN son obligatorios");
      return;
    }
    
    if (newTechPin.length < 4) {
      setModalError("El PIN debe tener al menos 4 dígitos");
      return;
    }

    try {
      if (storageMode === 'local') {
        const id = `tech_${Date.now()}`;
        const newTech = { id, contractorId: currentContractorId, name: newTechName.trim(), pin: newTechPin.trim(), role: 'TECH', createdAt: new Date().toISOString() };
        const updated = [...technicians, newTech];
        setTechnicians(updated);
        await storage.saveLocalTechnicians(currentContractorId, updated);
        setNewTechName('');
        setNewTechPin('');
        setIsCreatingTech(false);
        return;
      }
      setIsSaving(true);
      setModalError(null);
      const id = `tech_${Date.now()}`;
      await setDoc(doc(db, 'technicians', id), {
        id,
        contractorId: currentContractorId,
        name: newTechName.trim(),
        pin: newTechPin.trim(),
        role: 'TECH',
        createdAt: new Date().toISOString()
      });
      setIsCreatingTech(false);
      setNewTechName('');
      setNewTechPin('');
      setError(null);
    } catch (err: any) {
      console.error("Error creating technician:", err);
      setModalError(err.message || "Error al crear técnico");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTechnician = async (techId: string) => {
    if (!isAdmin) return;
    // Removed blocking confirm for iFrame compatibility
    
    try {
      setIsSaving(true);
      if (storageMode === 'local') {
        const updated = technicians.filter(t => t.id !== techId);
        setTechnicians(updated);
        if (currentContractorId) {
          await storage.saveLocalTechnicians(currentContractorId, updated);
        }
      } else {
        await deleteDoc(doc(db, 'technicians', techId));
      }
      setError(null);
    } catch (err: any) {
      console.error("Error deleting technician:", err);
      setError("Error al eliminar técnico: " + (err.message || "Permiso denegado"));
    } finally {
      setIsSaving(false);
    }
  };

  const assignSelectedItems = async () => {
    if (!assignmentTechId || selectedInventoryItems.size === 0 || !currentProjectId || !kmzProject) return;
    
    try {
      setIsUploading(true);
      const now = new Date().toISOString();
      const itemsToUpdate = kmzProject.items.map(item => {
        if (selectedInventoryItems.has(item.id)) {
          return { ...item, assignedTo: assignmentTechId, assignedAt: now };
        }
        return item;
      });

      const tendidosToUpdate = kmzProject.tendidos.map(t => {
        if (selectedInventoryItems.has(t.id)) {
          return { ...t, assignedTo: assignmentTechId, assignedAt: now };
        }
        return t;
      });
      
      const updatedKmz = { ...kmzProject, items: itemsToUpdate, tendidos: tendidosToUpdate };
      await setDoc(doc(db, 'kmz_projects', currentProjectId), updatedKmz);
      setKmzProject(updatedKmz);
      setSelectedInventoryItems(new Set());
      setAssignmentTechId('');
    } catch (err: any) {
      setError("Error al asignar tareas: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());

  const fetchRecordImage = async (recordId: string) => {
    if (loadingImages.has(recordId)) return;
    
    setLoadingImages(prev => new Set(prev).add(recordId));
    try {
      // 1. Check local storage first
      const localBlob = await storage.getBlob(recordId);
      if (localBlob) {
        const localUrl = URL.createObjectURL(localBlob);
        setRecords(prev => prev.map(r => r.id === recordId ? { ...r, imageUrl: localUrl } : r));
        return;
      }

      // 2. Fallback to Cloud
      const imgDoc = await getDoc(doc(db, 'record_images', recordId));
      if (imgDoc.exists()) {
        const data = imgDoc.data();
        setRecords(prev => prev.map(r => r.id === recordId ? { ...r, imageUrl: data.imageUrl } : r));
      }
    } catch (error) {
      console.error("Error loading image:", error);
    } finally {
      setLoadingImages(prev => {
        const next = new Set(prev);
        next.delete(recordId);
        return next;
      });
    }
  };
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
    const effectiveUserId = user?.uid || techSession?.technicianId;
    if (!effectiveUserId) {
      setProjects([]);
      setCurrentProjectId(null);
      return;
    }

    const q = query(
      collection(db, 'projects'), 
      where('status', '==', 'active'),
      where('members', 'array-contains', effectiveUserId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      setProjects(projectsData);
      setProjectsLoaded(true);
      
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
        if (currentProjectId) {
          await storage.saveRecords(currentProjectId, records);
        }
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
      
      // Check if project with same name exists to reuse ID and keep photos linked
      const existingProject = projects.find(p => p.name.toUpperCase() === name.toUpperCase());
      const newProjectId = existingProject ? existingProject.id : crypto.randomUUID();
      
      // Prevent useEffect from overwriting the fresh upload with empty localStorage
      isKmzInitialLoad.current = false;
      lastProjectId.current = newProjectId;

      setKmzProject({
        id: newProjectId,
        name,
        items,
        tendidos,
        uploadedAt: new Date().toISOString()
      });
      
      setCurrentProjectId(newProjectId);
      localStorage.setItem('currentProjectId', newProjectId);
      localStorage.setItem(`kmzProject_${newProjectId}`, JSON.stringify({
        id: newProjectId,
        name,
        items,
        tendidos,
        uploadedAt: new Date().toISOString()
      }));

      // Save project metadata and KMZ structure to Firestore
      if (user) {
        const newProject: Project = {
          id: newProjectId,
          name,
          contractorId: currentContractorId || '',
          members: [user.uid],
          createdAt: new Date().toISOString(),
          createdBy: user.uid,
          status: 'active',
          lastKmzUpdate: new Date().toISOString()
        };
        
        // Use a batch to ensure both are saved or none
        const batch = writeBatch(db);
        batch.set(doc(db, 'projects', newProjectId), newProject);
        batch.set(doc(db, 'kmz_projects', newProjectId), {
          id: newProjectId,
          name,
          items,
          tendidos,
          uploadedAt: newProject.lastKmzUpdate
        });
        
        await batch.commit();
      }

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

  const deleteReport = async (id: string) => {
    if (!currentProjectId) return;
    
    try {
      if (storageMode === 'local') {
        const updated = tendidoReports.filter(r => r.id !== id);
        setTendidoReports(updated);
        await storage.saveLocalReports(currentProjectId, updated);
      } else if (user) {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'tendido_reports', id));
        batch.update(doc(db, 'projects', currentProjectId), {
          lastReportsUpdate: new Date().toISOString()
        });
        await batch.commit();
      } else {
        // Fallback for technician in cloud mode (should ideally not happen if rules allow, 
        // but for now we just update state)
        setTendidoReports(prev => prev.filter(r => r.id !== id));
      }
    } catch (error) {
      console.error("Error deleting report:", error);
      if (storageMode === 'cloud') {
        handleFirestoreError(error, OperationType.DELETE, `tendido_reports/${id}`);
      } else {
        setError("Error al eliminar localmente.");
      }
    }
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

  const saveReport = async () => {
    if (!newReport.tendidoId) {
      setError("Por favor selecciona un tramo (tendido).");
      return;
    }
    if (newReport.startMeter === undefined || newReport.endMeter === undefined) {
      setError("Las abscisas de inicio y fin son obligatorias.");
      return;
    }
    if (!currentProjectId) {
      setError("No hay un proyecto activo seleccionado.");
      return;
    }
    
    setIsSaving(true);
    try {
      let finalReport: TendidoReport;
      
      if (editingReportId) {
        const report = tendidoReports.find(r => r.id === editingReportId);
        if (!report) return;

        finalReport = {
          ...report,
          tendidoId: newReport.tendidoId!,
          startMeter: newReport.startMeter!,
          endMeter: newReport.endMeter!,
          hardware: newReport.hardware as any,
          notes: newReport.notes,
          technician: newReport.technician || report.technician
        };

        if (storageMode === 'local') {
          const updated = tendidoReports.map(r => r.id === editingReportId ? finalReport : r);
          setTendidoReports(updated);
          await storage.saveLocalReports(currentProjectId, updated);
        } else {
          const batch = writeBatch(db);
          batch.set(doc(db, 'tendido_reports', editingReportId), finalReport);
          batch.update(doc(db, 'projects', currentProjectId), {
            lastReportsUpdate: new Date().toISOString()
          });
          await batch.commit();
        }
        setEditingReportId(null);
      } else {
        finalReport = {
          id: crypto.randomUUID(),
          projectId: currentProjectId,
          contractorId: currentContractorId || '',
          tendidoId: newReport.tendidoId!,
          startMeter: newReport.startMeter!,
          endMeter: newReport.endMeter!,
          hardware: newReport.hardware as any,
          notes: newReport.notes,
          timestamp: new Date().toISOString(),
          technician: techSession ? techSession.name : (user?.displayName || user?.email || 'Admin'),
          technicianId: techSession?.technicianId
        };

        if (storageMode === 'local') {
          const updated = [finalReport, ...tendidoReports];
          setTendidoReports(updated);
          await storage.saveLocalReports(currentProjectId, updated);
        } else {
          const batch = writeBatch(db);
          batch.set(doc(db, 'tendido_reports', finalReport.id), finalReport);
          batch.update(doc(db, 'projects', currentProjectId), {
            lastReportsUpdate: finalReport.timestamp
          });
          await batch.commit();
        }
        setShowReportSummary(finalReport);
      }

      // Send Telegram Notification
      const currentProject = projects.find(p => p.id === currentProjectId);
      if (currentProject?.telegramChatId && telegramBotToken) {
        const tendido = kmzProject?.tendidos.find(t => t.id === finalReport.tendidoId);
        const hwLabels: Record<string, string> = {
          cintaBandi: 'Cinta Bandi', hevillas: 'Hevillas', etiquetas: 'Etiquetas',
          alambre: 'Alambre', mensajero: 'Mensajero', cruceta: 'Cruceta',
          brazoCruceta: 'Brazo Cruceta', grillete: 'Grillete', chapas: 'Chapas',
          clevi: 'Clevi', preformado: 'Preformado', brazo060: 'Brazo 0.60m',
          brazo1m: 'Brazo 1m'
        };
        
        let hwText = '';
        Object.entries(finalReport.hardware).forEach(([key, val]) => {
          if (typeof val === 'number' && val > 0 && hwLabels[key]) {
            hwText += `- ${hwLabels[key]}: ${val}\n`;
          }
        });
        if (finalReport.hardware.otros) {
          hwText += `- Otros: ${finalReport.hardware.otros}\n`;
        }

        const msg = `✅ *REPORTE DE TENDIDO*\n` +
          `📁 *Tramo:* ${tendido?.name || 'N/A'}\n` +
          `📏 *Distancia:* ${finalReport.startMeter}m - ${finalReport.endMeter}m (Total: ${Math.abs(finalReport.endMeter - finalReport.startMeter)}m)\n` +
          `🎞️ *Tipo:* ${tendido?.type || 'N/A'}\n` +
          `👷 *Técnico:* ${finalReport.technician}\n` +
          `📁 *Proyecto:* ${currentProject.name}\n` +
          `🕐 ${new Date(finalReport.timestamp).toLocaleString()}\n\n` +
          `📦 *FERRETERÍA:*\n${hwText || '- Ninguna reported'}`;
        
        sendTelegramNotification(msg, currentProject.telegramChatId);
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
      setError(null);
    } catch (error: any) {
      console.error("Error saving report:", error);
      if (storageMode === 'cloud') {
        handleFirestoreError(error, OperationType.WRITE, 'tendido_reports');
      } else {
        setError("Error al guardar localmente: " + (error.message || "Error desconocido"));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const submitEquipmentReport = async () => {
    if (!equipmentReportFile || !currentProjectId || !user) {
      setError("Faltan datos obligatorios para el reporte de equipo.");
      return;
    }

    setIsSubmittingEquipment(true);
    try {
      const { coordinates, timestamp: exifTimestamp } = await getExifData(equipmentReportFile);
      const item = kmzProject?.items.find(i => i.id === selectedInventoryItemId);
      const newRecordId = crypto.randomUUID();
      const newRecord: EquipmentRecord = {
        id: newRecordId,
        projectId: currentProjectId,
        contractorId: currentContractorId || '',
        userId: user.uid,
        imageUrl: '', // Will be updated later or handled in sync
        code: 'SIN_PROCESAR', 
        type: item?.type || 'CTO', 
        coordinates: coordinates || '0, 0',
        timestamp: exifTimestamp || new Date().toISOString(),
        power: 'PENDIENTE',
        extractedAt: new Date().toISOString(),
        isNew: true,
        method: 'LOCAL',
        linkedItemId: selectedInventoryItemId || undefined
      };

      const extraNotes = `[Reportado desde Inventario: ${item?.name || 'Desconocido'}] ${equipmentReportNotes}`;
      const recordToSave = { ...newRecord, notes: extraNotes };

      // Save the blob locally regardless of storage mode for testing/preview
      await storage.saveBlob(newRecordId, equipmentReportFile);

      if (storageMode === 'local') {
        const currentRecords = await storage.loadRecords(currentProjectId);
        const updated = [recordToSave as any, ...currentRecords];
        await storage.saveRecords(currentProjectId, updated);
        setRecords(updated);
      } else {
        await setDoc(doc(db, 'records', newRecordId), recordToSave);
        await updateDoc(doc(db, 'projects', currentProjectId), { 
          lastRecordsUpdate: new Date().toISOString() 
        });
        // Optimistic update for cloud mode to ensure immediate feedback
        setRecords(prev => [recordToSave, ...prev]);
      }

      // Automatically trigger extraction for faster feedback on photo validity
      processFiles([recordToSave]);

      // Send Telegram Notification
      const currentProject = projects.find(p => p.id === currentProjectId);
      if (currentProject?.telegramChatId && telegramBotToken) {
        const msg = `✅ *${item?.type || 'EQUIPO'} CERTIFICADO*\n` +
          `📋 *Código:* ${item?.name || 'S/N'} (Pendiente Validación IA)\n` +
          `📍 *Coordenadas:* ${recordToSave.coordinates}\n` +
          `👷 *Técnico:* ${techSession ? techSession.name : (user?.displayName || user?.email || 'Admin')}\n` +
          `📁 *Proyecto:* ${currentProject.name}\n` +
          `🕐 ${new Date().toLocaleString()}\n` +
          (equipmentReportNotes ? `\n📝 *Nota:* ${equipmentReportNotes}` : '');
        
        sendTelegramNotification(msg, currentProject.telegramChatId);
      }

      setEquipmentReportFile(null);
      setSelectedInventoryItemId('');
      setEquipmentReportNotes('');
      setError(null);
      // Removed alert for a smoother experience, maybe a toast could be added later
      // But adding a small notification or just relying on the list update is better.

    } catch (err: any) {
      console.error(err);
      setError("Error al enviar el reporte: " + (err.message || "Error desconocido"));
    } finally {
      setIsSubmittingEquipment(false);
    }
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
      // Prioritize newly added items if in NEWEST mode
      if (sortOrder === 'NEWEST') {
        const aIsNew = newlyAddedIds.has(a.id);
        const bIsNew = newlyAddedIds.has(b.id);
        if (aIsNew && !bIsNew) return -1;
        if (!aIsNew && bIsNew) return 1;
        // If both are new or both are not, sort by extractedAt descending
        const bTime = b.extractedAt ? new Date(b.extractedAt).getTime() : 0;
        const aTime = a.extractedAt ? new Date(a.extractedAt).getTime() : 0;
        return (isNaN(bTime) ? 0 : bTime) - (isNaN(aTime) ? 0 : aTime);
      }
      if (sortOrder === 'OLDEST') {
        const bTime = b.extractedAt ? new Date(b.extractedAt).getTime() : 0;
        const aTime = a.extractedAt ? new Date(a.extractedAt).getTime() : 0;
        return (isNaN(aTime) ? 0 : aTime) - (isNaN(bTime) ? 0 : bTime);
      }
      if (sortOrder === 'SERIAL_ASC') return (a.code || '').localeCompare(b.code || '');
      if (sortOrder === 'SERIAL_DESC') return (b.code || '').localeCompare(a.code || '');
      if (sortOrder === 'POWER_ASC') return extractPowerValue(a.power || '') - extractPowerValue(b.power || '');
      if (sortOrder === 'POWER_DESC') return extractPowerValue(b.power || '') - extractPowerValue(a.power || '');
      return 0;
    });

  // sortedRecords is now handled by the sort above for NEWEST/OLDEST
  const sortedRecords = filteredRecords;

  const paginatedRecords = useMemo(() => {
    return sortedRecords.slice(0, displayLimit);
  }, [sortedRecords, displayLimit]);

  const activeTechnicians = isAdmin ? technicians : technicians.filter(t => t.id === techSession?.technicianId);

  const toggleInventoryItemSelected = (id: string) => {
    setSelectedInventoryItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllInventoryItems = (items: InventoryItem[]) => {
    if (selectedInventoryItems.size === items.length) {
      setSelectedInventoryItems(new Set());
    } else {
      setSelectedInventoryItems(new Set(items.map(i => i.id)));
    }
  };

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

  const createContractor = async () => {
    if (!newContractorName.trim() || !isSuperAdmin) return;
    
    // Use the name as the ID (trimmed and uppercase)
    const id = newContractorName.trim().toUpperCase();

    try {
      if (storageMode === 'local') {
        const contractor = { id, name: newContractorName.trim(), createdAt: new Date().toISOString() };
        const updated = [...contractors, contractor];
        setContractors(updated);
        await storage.saveLocalContractors(updated);
        setNewContractorName('');
        setIsCreatingContractor(false);
        if (!activeContractorId) {
          localStorage.setItem('activeContractorId', id);
          setActiveContractorId(id);
        }
        return;
      }
      setIsSaving(true);
      setModalError(null);
      
      const contractor = { 
        id, 
        name: newContractorName.trim(), 
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'contractors', id), contractor);
      setNewContractorName('');
      setIsCreatingContractor(false);
      
      // Auto-set as active if it's the first one
      if (!activeContractorId) {
        localStorage.setItem('activeContractorId', id);
        setActiveContractorId(id);
      }
    } catch (error: any) {
      console.error("Error creating contractor:", error);
      setModalError(error.message || "Error al crear espacio");
    } finally {
      setIsSaving(false);
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    if (!currentContractorId) {
      setError("Por favor selecciona una Contrata (Espacio) primero.");
      setIsCreatingProject(false);
      return;
    }
    if (!user && !techSession) return;
    
    // Use the project name as the ID (trimmed and uppercase)
    const projectId = newProjectName.trim().toUpperCase();
    const newProject: Project = {
      id: projectId,
      name: newProjectName.trim(),
      contractorId: currentContractorId,
      members: [user?.uid || techSession?.technicianId || 'system'],
      createdAt: new Date().toISOString(),
      createdBy: user?.uid || techSession?.technicianId || 'system',
      status: 'active'
    };

    try {
      if (storageMode === 'local') {
        const updated = [...projects, newProject];
        setProjects(updated);
        await storage.saveLocalProjects(currentContractorId, updated);
        setNewProjectName('');
        setIsCreatingProject(false);
        setCurrentProjectId(projectId);
        localStorage.setItem('currentProjectId', projectId);
        return;
      }
      await setDoc(doc(db, 'projects', projectId), newProject);
      setNewProjectName('');
      setIsCreatingProject(false);
      setCurrentProjectId(projectId);
      localStorage.setItem('currentProjectId', projectId);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `projects/${projectId}`);
    }
  };

  const processFiles = async (items: (File | PendingUpload | EquipmentRecord)[], isResumingBatch = false) => {
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
      setSortOrder('NEWEST');
    }
    setUploadProgress({ current: 0, total: items.length });

    const failed: { name: string; error: string }[] = [];
    let successCount = 0;
    
    // Process in small batches
    const batchSize = 2;
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (item) => {
        let originalFile: File | null = null;
        let itemId: string | null = null;
        let existingRecord: EquipmentRecord | null = null;

        if ('blob' in item) {
          originalFile = new File([item.blob], item.name, { type: item.blob.type });
          itemId = item.id;
        } else if (item instanceof File) {
          originalFile = item;
        } else {
          // This is an existing EquipmentRecord
          existingRecord = item;
          itemId = item.id;
          const localBlob = await storage.getBlob(item.id);
          if (localBlob) {
            originalFile = new File([localBlob], `record_${item.id}.jpg`, { type: 'image/jpeg' });
          }
        }

        if (!originalFile) {
          throw new Error("No se pudo recuperar la imagen del registro.");
        }

        try {
          // 0. Compress image before anything else to save storage/bandwidth
          const compressedBlob = await compressImage(originalFile);
          const file = new File([compressedBlob], originalFile.name, { type: 'image/jpeg' });
          
          // 1. Try Local Extraction (EXIF + OCR)
          const exif = await getExifData(originalFile); // Use original for EXIF
          const ocrText = await runLocalOCR(file);
          
          let localData = {
            code: extractSerialFromText(ocrText) || '',
            coordinates: exif.coordinates || extractCoordsFromText(ocrText) || '',
            timestamp: exif.timestamp || '',
            power: extractPowerFromText(ocrText) || '',
            type: existingRecord ? existingRecord.type : uploadType,
            method: 'LOCAL' as const
          };

          const validation = validateData({ ...localData, type: localData.type });
          let finalData: { code: string; coordinates: string; timestamp: string; power: string; type: 'CTO' | 'MUFA' | 'RESERVA'; method: 'LOCAL' | 'GEMINI' | 'HYBRID' } = { ...localData, power: localData.power || 'N/A' };
          let extractionMethod: 'LOCAL' | 'GEMINI' | 'HYBRID' = 'LOCAL';

          // 2. Fallback to Gemini if local is incomplete or invalid
          if (!validation.isValid) {
            let geminiResult = null;
            let usedModel = "";
            
            // Check Gemini Cache first to avoid API call
            const imageHash = getImageHash(originalFile);
            const cachedResult = await storage.getGeminiCache(imageHash);
            
            if (cachedResult) {
              console.log("Using cached Gemini result for:", originalFile.name);
              geminiResult = cachedResult.result;
              usedModel = cachedResult.model || "Cache";
            } else {
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
              
              let usedModelId = selectedModel;

              const tryModel = async (model: string, label: string) => {
                try {
                  const { result } = await extractEquipmentData(resizedBase64, 'image/jpeg', model);
                  return { result, label };
                } catch (err: any) {
                  const msg = err.message?.toLowerCase() || "";
                  const isRetryable = msg.includes('429') || msg.includes('quota') || msg.includes('503') || msg.includes('limit') || msg.includes('overloaded') || msg.includes('not found');
                  return { error: err, retryable: isRetryable };
                }
              };

              const models = [
                { id: "gemini-flash-latest", label: "Gemini Flash (Estable)" },
                { id: "gemini-3.1-flash-lite-preview", label: "Gemini Lite" }
              ];

              const otherModels = models.filter(m => m.id !== selectedModel);
              
              let extraction = await tryModel(selectedModel, models.find(m => m.id === selectedModel)?.label || selectedModel);
              
              // Fallback logic between Gemini models
              if (extraction.error && extraction.retryable) {
                for (const model of otherModels) {
                  console.warn(`${usedModelId} falló. Probando respaldo: ${model.label}...`);
                  extraction = await tryModel(model.id, model.label);
                  if (extraction.result) {
                    usedModelId = model.id;
                    usedModel = extraction.label || model.label;
                    break;
                  }
                }
              }

              if (extraction.result) {
                geminiResult = extraction.result;
                usedModel = extraction.label || "Gemini";
                // Save to local cache
                await storage.saveGeminiCache(imageHash, { result: geminiResult, model: usedModel });
              } else {
                throw extraction.error || new Error("No se pudo procesar con ninguna versión de IA");
              }
            }

            if (geminiResult) {
              // Merge results: prefer local if valid, otherwise use Gemini
              finalData = {
                code: validation.isCodeValid ? localData.code : (geminiResult.code || 'S/N'),
                coordinates: (validation.isCoordsValid && localData.coordinates !== '0,0') ? localData.coordinates : (geminiResult.coordinates || (existingRecord?.coordinates !== '0, 0' ? existingRecord?.coordinates : '0,0') || '0,0'),
                timestamp: validation.isTimestampValid ? localData.timestamp : (geminiResult.timestamp || (existingRecord?.timestamp || new Date().toLocaleString())),
                power: geminiResult.power || localData.power || 'N/A',
                type: geminiResult.type || (existingRecord ? existingRecord.type : uploadType),
                method: validation.isValid ? 'LOCAL' : (Object.values(validation).some(v => v) ? 'HYBRID' : 'GEMINI')
              };
              extractionMethod = finalData.method;
              (finalData as any).aiModel = usedModel;
            }
          }

          const resizedBase64 = await resizeImage(file);
          
          const newRecord: EquipmentRecord = {
            ...existingRecord,
            id: existingRecord ? existingRecord.id : (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)),
            contractorId: existingRecord?.contractorId || currentContractorId || '',
            imageUrl: resizedBase64,
            code: finalData.code || 'S/N',
            type: finalData.type,
            coordinates: finalData.coordinates || (existingRecord?.coordinates || '0,0'),
            timestamp: finalData.timestamp || (existingRecord?.timestamp || new Date().toLocaleString()),
            power: finalData.power || 'N/A',
            extractedAt: new Date().toISOString(),
            method: extractionMethod,
            aiModel: (finalData as any).aiModel || (extractionMethod === 'LOCAL' ? 'N/A' : 'Gemini 3'),
            projectId: existingRecord?.projectId || currentProjectId,
            userId: existingRecord?.userId || (techSession ? techSession.technicianId : (user?.uid || 'anonymous')),
            isNew: !existingRecord
          };

          if (user) {
            try {
              const batch = writeBatch(db);
              
              // 1. Heavy image in its own collection
              batch.set(doc(db, 'record_images', newRecord.id), { imageUrl: resizedBase64 });
              
              // 2. Metadata without photo in records collection
              const { imageUrl, ...metadata } = newRecord;
              batch.set(doc(db, 'records', newRecord.id), metadata);
              
              // 3. Update the Project Index (The BUCKET pattern)
              // This single write adds a small metadata summary to the index document
              const summary: EquipmentRecordSummary = {
                id: newRecord.id,
                code: newRecord.code,
                type: newRecord.type,
                coordinates: newRecord.coordinates,
                power: newRecord.power,
                extractedAt: newRecord.extractedAt
              };
              
              if (!existingRecord) {
                batch.set(doc(db, 'project_indexes', currentProjectId), {
                  projectId: currentProjectId,
                  lastUpdated: new Date().toISOString(),
                  items: arrayUnion(summary)
                }, { merge: true });
              } else {
                // If existing, we should ideally replace it in the index, but simpler to remove/add if needed
                // For now, let's just make sure we update the project last update
              }

              batch.update(doc(db, 'projects', currentProjectId), {
                lastRecordsUpdate: new Date().toISOString()
              });

              await batch.commit();
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, `records_batch/${newRecord.id}`);
            }
          }
          
          if (!existingRecord) {
            setNewlyAddedIds(prev => new Set(prev).add(newRecord.id));
          } else {
            // Update the record in the local list
            setRecords(prev => prev.map(r => r.id === newRecord.id ? newRecord : r));
          }
          
          successCount++;
          // Remove from pending queue after success
          if (itemId && !existingRecord) {
            await storage.removePendingUpload(itemId);
          }
          return newRecord;
        } catch (err) {
          const fileName = ('name' in item) ? item.name : (('code' in item) ? `Registro ${item.code}` : 'Archivo');
          console.error(`Error processing ${fileName}:`, err);
          failed.push({ 
            name: fileName, 
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
    if (user && currentProjectId && storageMode === 'cloud') {
      try {
        const batch = writeBatch(db);
        const record = records.find(r => r.id === id);
        
        batch.delete(doc(db, 'records', id));
        batch.delete(doc(db, 'record_images', id));
        
        if (record) {
          const summary: EquipmentRecordSummary = {
            id: record.id,
            code: record.code,
            type: record.type,
            coordinates: record.coordinates,
            power: record.power,
            extractedAt: record.extractedAt
          };
          batch.update(doc(db, 'project_indexes', currentProjectId), {
            items: arrayRemove(summary)
          });
          
          batch.update(doc(db, 'projects', currentProjectId), {
            lastRecordsUpdate: new Date().toISOString()
          });
        }
        
        await batch.commit();
      } catch (error: any) {
        console.error("Error deleting record:", error);
        setError("Error al borrar registro: " + (error.message || "Permiso denegado"));
      }
    }
    
    // Always update local state for immediate feedback or if in local mode
    setRecords(prev => prev.filter(r => r.id !== id));
    setRecordToDelete(null);
  };

  const deleteFilteredRecords = async () => {
    const filteredIds = filteredRecords.map(r => r.id);
    
    if (user && currentProjectId && storageMode === 'cloud') {
      try {
        const batch = writeBatch(db);
        
        filteredIds.forEach(id => {
          batch.delete(doc(db, 'records', id));
          batch.delete(doc(db, 'record_images', id));
        });

        // Update Project Index efficiently by removing all filtered items
        const indexDoc = await getDoc(doc(db, 'project_indexes', currentProjectId));
        if (indexDoc.exists()) {
          const indexData = indexDoc.data() as ProjectIndex;
          const remainingItems = indexData.items.filter(item => !filteredIds.includes(item.id));
          batch.update(doc(db, 'project_indexes', currentProjectId), {
            items: remainingItems,
            lastUpdated: new Date().toISOString()
          });
        }
        
        batch.update(doc(db, 'projects', currentProjectId), {
          lastRecordsUpdate: new Date().toISOString()
        });
        
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'multiple records');
      }
    }
    
    // Always update local state
    setRecords(prev => prev.filter(r => !filteredIds.includes(r.id)));
    
    if (!isFiltered) {
      await storage.clearPendingUploads();
    }
    
    setShowDeleteAllConfirm(false);
  };

  const isFiltered = searchQuery !== '' || typeFilter !== 'ALL';

  const exportToCSV = () => {
    if (!kmzProject) return;
    
    // --- SHEET 1: EQUIPOS ---
    const equipData = kmzProject.items.map(item => {
      const match = records.find(r => r.id === item.recordId);
      return {
        'ETAPA': 'INVENTARIO',
        'TIPO': item.type,
        'NOMBRE KMZ': item.name,
        'ESTADO': item.status === 'INSTALLED' ? 'COMPLETO' : 'INCOMPLETO',
        'CELDA': item.celda || 'N/A',
        'METRADO/COORD KMZ': `${item.coordinates.lat}, ${item.coordinates.lng}`,
        'REPORTE REAL (CODIGO)': match ? match.code : 'PENDIENTE',
        'POTENCIA LEIDA': match ? match.power : 'N/A',
        'FECHA REPORTE': match ? match.extractedAt : 'N/A',
        'TECNICO': match ? (match.userId || 'Sistema') : 'N/A'
      };
    });

    // --- SHEET 2: TENDIDOS ---
    const tendidoData = kmzProject.tendidos.map(t => {
      const reports = tendidoReports.filter(r => r.tendidoId === t.id);
      const isComplete = reports.length > 0;
      const totalReal = reports.reduce((acc, r) => acc + Math.abs(r.endMeter - r.startMeter), 0);
      const diff = isComplete ? totalReal - t.totalDistance : 0;
      
      // Aggregate hardware from all reports of this tendido
      const hw = reports.reduce((acc, r) => {
        const h = r.hardware;
        return {
          cintaBandi: acc.cintaBandi + (h.cintaBandi || 0),
          hevillas: acc.hevillas + (h.hevillas || 0),
          etiquetas: acc.etiquetas + (h.etiquetas || 0),
          alambre: acc.alambre + (h.alambre || 0),
          mensajero: acc.mensajero + (h.mensajero || 0),
          cruceta: acc.cruceta + (h.cruceta || 0),
          brazoCruceta: acc.brazoCruceta + (h.brazoCruceta || 0),
          grillete: acc.grillete + (h.grillete || 0),
          chapas: acc.chapas + (h.chapas || 0),
          clevi: acc.clevi + (h.clevi || 0),
          preformado: acc.preformado + (h.preformado || 0),
          brazo060: acc.brazo060 + (h.brazo060 || 0),
          brazo1m: acc.brazo1m + (h.brazo1m || 0),
          otros: acc.otros + (h.otros ? (acc.otros ? '; ' : '') + h.otros : '')
        };
      }, {
        cintaBandi: 0, hevillas: 0, etiquetas: 0, alambre: 0, mensajero: 0, 
        cruceta: 0, brazoCruceta: 0, grillete: 0, chapas: 0, clevi: 0, 
        preformado: 0, brazo060: 0, brazo1m: 0, otros: ''
      });

      return {
        'ETAPA': 'TENDIDO',
        'TIPO': t.type,
        'NOMBRE TENDIDO': t.name,
        'CELDA': t.celda || 'N/A',
        'ESTADO': isComplete ? 'COMPLETO' : 'INCOMPLETO',
        'DIST. LINEAL (M)': Math.round(t.linearDistance),
        'TOTAL PROYECTADO (M)': Math.round(t.totalDistance),
        'LONGITUD REAL (M)': isComplete ? Math.round(totalReal) : 0,
        'DIFERENCIA (M)': isComplete ? Math.round(diff) : 'N/A',
        'RES. 50M': t.equipmentCount.reserva50,
        'RES. 60M': t.equipmentCount.reserva60,
        'CTO/MUFA PASANTE': t.equipmentCount.ctoMufa,
        'OTRO PASANTE': t.equipmentCount.pasantes,
        'CINTA BAND-IT': hw.cintaBandi,
        'HEVILLAS': hw.hevillas,
        'ETIQUETAS': hw.etiquetas,
        'ALAMBRE HEBILLA': hw.alambre,
        'CRUZ MENSAJERO': hw.mensajero,
        'CRUCETA': hw.cruceta,
        'BRAZO CRUCETA': hw.brazoCruceta,
        'GRILLETE': hw.grillete,
        'CHAPAS 1-2': hw.chapas,
        'CLEVIS': hw.clevi,
        'PREFORMADO': hw.preformado,
        'BRAZO 0.60': hw.brazo060,
        'BRAZO 1.0M': hw.brazo1m,
        'OTROS': hw.otros,
        'FECHA REPORTE': reports.length > 0 ? reports[0].timestamp : 'N/A',
        'TECNICO': reports.length > 0 ? (reports[0].technician || 'Tecnico') : 'N/A'
      };
    });

    // Create Workbook
    const wb = XLSX.utils.book_new();
    
    // Create Sheets
    const wsEquip = XLSX.utils.json_to_sheet(equipData);
    const wsTendido = XLSX.utils.json_to_sheet(tendidoData);

    // Add Sheets to Workbook
    XLSX.utils.book_append_sheet(wb, wsEquip, "Equipos");
    XLSX.utils.book_append_sheet(wb, wsTendido, "Tendidos");

    // Write File
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    
    saveAs(blob, `Reporte_Inventario_${kmzProject.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
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
          <div style="font-family: Arial, sans-serif; padding: 10px; width: 300px;">
            <h3 style="color: #1a73e8; margin-bottom: 5px;">Equipo: ${record.type}</h3>
            <p><strong>Código:</strong> ${record.code}</p>
            <p><strong>Potencia:</strong> <span style="color: ${record.power.startsWith('-') && parseFloat(record.power) < -25 ? '#d93025' : '#188038'}">${record.power}</span></p>
            <p><strong>Fecha/Hora:</strong> ${record.timestamp}</p>
            <p><strong>ID Técnico:</strong> ${record.userId || 'N/A'}</p>
            ${record.imageUrl ? `<div style="margin-top:10px;"><img src="${record.imageUrl}" width="280" style="border-radius:8px;"/></div>` : '<p style="color:#666; font-style:italic;">Imagen alojada en App</p>'}
          </div>
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

  if (!user && !techSession) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white p-8 sm:p-10 rounded-2xl border-2 border-[#141414] shadow-[12px_12px_0px_0px_rgba(20,20,20,1)]"
          >
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="bg-[#141414] p-4 rounded-full shadow-lg">
                <Table className="text-[#E4E3E0]" size={32} />
              </div>
              
              <div>
                <h1 className="text-3xl font-heading italic leading-none">OPDE</h1>
                <p className="text-[10px] uppercase tracking-[0.3em] opacity-40 mt-2 font-bold">FTTH Management Tool</p>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="w-full p-4 bg-red-50 border-l-4 border-red-600 rounded-r text-red-600 text-xs flex items-start gap-3 text-left"
                >
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </motion.div>
              )}

              <div className="w-full space-y-4">
                {/* Tech PIN Login Form */}
                <form onSubmit={handleTechLogin} className="space-y-3">
                  <div className="text-left space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-50 ml-1">ID Contrata</label>
                    <input 
                      type="text"
                      placeholder="EJ: NORTEC"
                      value={techLoginForm.contractorId}
                      onChange={e => setTechLoginForm(prev => ({ ...prev, contractorId: e.target.value.toUpperCase() }))}
                      className="w-full bg-[#F8F9FA] border border-[#141414]/10 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-blue-600/10 outline-none transition-all"
                    />
                  </div>
                  <div className="text-left space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-50 ml-1">PIN Técnico</label>
                    <input 
                      type="password"
                      placeholder="****"
                      inputMode="numeric"
                      value={techLoginForm.pin}
                      onChange={e => setTechLoginForm(prev => ({ ...prev, pin: e.target.value }))}
                      className="w-full bg-[#F8F9FA] border border-[#141414]/10 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-blue-600/10 outline-none transition-all tracking-[0.5em]"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={isLoggingInTech || !techLoginForm.contractorId || !techLoginForm.pin}
                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold uppercase tracking-widest text-[11px] hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoggingInTech ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                    Ingresar con Código
                  </button>
                </form>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#141414]/5"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
                    <span className="bg-white px-3 opacity-30">O también</span>
                  </div>
                </div>

                <button 
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-3 border-2 border-[#141414] py-4 rounded-xl font-bold uppercase tracking-widest text-[11px] hover:bg-[#F8F9FA] transition-all disabled:opacity-50"
                >
                  <LogIn size={16} />
                  Ingresar con Google
                </button>
              </div>

              <p className="text-[9px] uppercase tracking-widest opacity-30 pt-4">
                Admin & Ops Team v1.0 • Joel Rivas
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Dev Mode Banner */}
      {storageMode === 'local' && (
        <div className="bg-amber-500 text-white text-[10px] font-bold uppercase tracking-[0.2em] py-1.5 text-center shadow-inner relative z-[60]">
          Modo Desarrollo (Local) — No se consumen lecturas de Firebase • Datos locales solamente
        </div>
      )}
      {/* Header */}
      {/* Quota Exceeded Banner */}
      <AnimatePresence>
        {quotaExceeded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-600 text-white overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between gap-4 text-xs font-bold">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} />
                <span>Límite de Firebase excedido (Cuota de lectura diaria). Los datos podrían no aparecer hasta mañana.</span>
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors"
              >
                Reintentar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="border-b border-[#141414] bg-[#E4E3E0] sticky top-0 z-40 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          {/* Top Row: Brand and User */}
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="bg-[#141414] p-1.5 sm:p-2">
                <Table className="text-[#E4E3E0]" size={20} sm:size={24} />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-heading italic leading-none">OPDE</h1>
                <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.2em] opacity-50 mt-0.5">FTTH TOOL</p>
              </div>
              {isAdmin && contractors.length > 0 && (
                <div className="flex items-center gap-2 ml-4 pl-4 border-l border-[#141414]/10">
                  <Briefcase size={14} className="opacity-40" />
                  <select 
                    value={activeContractorId || ''}
                    onChange={(e) => {
                      const newContractorId = e.target.value;
                      localStorage.setItem('activeContractorId', newContractorId);
                      setActiveContractorId(newContractorId);
                      // Clear project selection when contractor changes to ensure data independence
                      setCurrentProjectId(null);
                      localStorage.removeItem('currentProjectId');
                      setRecords([]);
                      setKmzProject(null);
                      setTendidoReports([]);
                    }}
                    className="bg-transparent border-none text-[9px] font-bold uppercase tracking-widest outline-none cursor-pointer hover:text-blue-600 transition-colors"
                  >
                    {!activeContractorId && <option value="">Seleccionar Contrata</option>}
                    {contractors.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                  {(isAdmin || techSession) && <ShieldCheck size={12} className={isAdmin ? "text-blue-600" : "text-green-600"} />}
                  <span className="max-w-[80px] sm:max-w-none truncate">
                    {techSession ? techSession.name : (user?.displayName || (user?.email?.split('@')[0]) || 'Usuario')}
                  </span>
                </div>
                <div className="text-[9px] opacity-40 uppercase tracking-tighter leading-none">
                  {isAdmin ? 'Administrador' : (techSession ? 'Técnico Campo' : 'Técnico')}
                </div>
              </div>
              <button 
                onClick={() => setShowSettings(true)}
                className="p-1.5 hover:bg-[#141414]/5 text-[#141414]/60 rounded-full transition-colors"
                title="Configuración Avanzada"
              >
                <Settings size={18} />
              </button>
              <button 
                onClick={handleLogout}
                className="p-1.5 hover:bg-red-50 text-red-600 rounded-full transition-colors"
                title="Cerrar Sesión"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-[#141414]/5">
            {/* Project Selector */}
            <div className="flex items-center gap-3 bg-white/60 px-3 py-1.5 rounded border border-[#141414]/10 flex-1 sm:flex-none">
              <div className="flex flex-col flex-1 sm:flex-none">
                <span className="text-[8px] uppercase tracking-widest opacity-40 font-bold">Proyecto</span>
                <select 
                  value={currentProjectId || ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    setCurrentProjectId(id);
                    localStorage.setItem('currentProjectId', id);
                  }}
                  className="bg-transparent border-none text-[11px] font-bold outline-none cursor-pointer p-0 appearance-none min-w-[100px]"
                >
                  {projects.length === 0 && !kmzProject && <option value="">Sin Proyectos</option>}
                  {kmzProject && !projects.find(p => p.id === kmzProject.id) && (
                    <option value={kmzProject.id}>{kmzProject.name} (Local)</option>
                  )}
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              
              {isAdmin && (
                <div className="flex items-center gap-1.5 ml-1 pl-3 border-l border-[#141414]/10">
                  <button 
                    onClick={() => {
                      const currentProject = projects.find(p => p.id === currentProjectId);
                      if (currentProject) {
                        setMemberManagementProject(currentProject);
                      }
                    }}
                    className="p-1 hover:bg-[#141414] hover:text-[#E4E3E0] rounded transition-all text-orange-500"
                    title="Asignar técnicos"
                  >
                    <UserPlus size={12} />
                  </button>
                  <button 
                    onClick={() => {
                      const currentProject = projects.find(p => p.id === currentProjectId);
                      if (currentProject) {
                        setEditingProjectName(currentProject.name);
                        setEditingProjectId(currentProject.id);
                      }
                    }}
                    className="p-1 hover:bg-[#141414] hover:text-[#E4E3E0] rounded transition-all text-[#141414]/40"
                    title="Renombrar"
                  >
                    <Edit3 size={12} />
                  </button>
                  <button 
                    onClick={() => {
                      const currentProject = projects.find(p => p.id === currentProjectId);
                      if (!currentProject) return;
                      setProjectToDelete(currentProject);
                    }}
                    className="p-1 hover:bg-red-500 hover:text-white rounded transition-all text-red-400"
                    title="Eliminar"
                  >
                    <Trash2 size={12} />
                  </button>
                  <button 
                    onClick={() => setIsCreatingProject(true)}
                    className="p-1 hover:bg-blue-600 hover:text-white rounded transition-all text-blue-500"
                    title="Nuevo"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between sm:justify-end gap-4">
              {/* Status Indicators */}
              <div className="flex items-center gap-4">
                {pendingCount > 0 && (
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-blue-600">
                      <CloudUpload size={10} className="animate-bounce" />
                      {pendingCount}
                    </div>
                  </div>
                )}
              </div>

              {pendingCount > 0 && isOnline && (
                <button 
                  onClick={async () => {
                    const pending = await storage.getPendingUploads();
                    processFiles(pending, true);
                  }}
                  className="bg-blue-600 text-white px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest hover:bg-opacity-90 rounded transition-all flex items-center gap-2"
                >
                  <RotateCcw size={10} />
                  <span>Sincronizar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-[#F8F9FA] p-1 rounded-xl border border-[#141414]/5 w-fit overflow-x-auto max-w-full no-scrollbar font-sans">
          {[
            { id: 'REPORTS', icon: Activity, label: 'Reportes' },
            { id: 'INVENTORY', icon: Map, label: 'Inventario' },
            { id: 'EXTRACTION', icon: ImageIcon, label: 'Extracción' },
            { id: 'TEAM', icon: UserIcon, label: 'Equipo', adminOnly: true },
            { id: 'SYSTEM', icon: ShieldCheck, label: 'Sistema', superAdminOnly: true },
          ].filter(tab => {
            if (techSession) return tab.id === 'REPORTS';
            if (tab.adminOnly && !isAdmin && !isSuperAdmin) return false;
            if (tab.superAdminOnly && !isSuperAdmin) return false;
            return true;
          }).map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-white text-blue-600 shadow-sm border border-[#141414]/5' 
                  : 'text-[#141414]/40 hover:text-[#141414]/60'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.id === 'INVENTORY' && kmzProject && kmzProject.items.length > 0 && (
                <span className="bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded-full ml-1">
                  {Math.round((kmzProject.items.filter(i => i.status === 'INSTALLED').length / kmzProject.items.length) * 100)}%
                </span>
              )}
            </button>
          ))}
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#141414] pb-2 gap-2 sm:gap-4">
            <h2 className="font-serif italic text-lg">Registros Extraídos</h2>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              {records.some(r => r.code === 'SIN_PROCESAR') && isOnline && (
                <button 
                  onClick={() => processFiles(records.filter(r => r.code === 'SIN_PROCESAR'))}
                  className="bg-purple-600 text-white px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm active:scale-95 flex items-center gap-2 hover:bg-purple-700"
                >
                  <Zap size={12} />
                  <span>Procesar Reportes Pendientes</span>
                </button>
              )}
              <button 
                onClick={exportToKML}
                disabled={records.length === 0}
                className={`
                  flex items-center gap-2 px-4 py-1.5 border border-[#141414] rounded text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm active:scale-95
                  ${records.length === 0 
                    ? 'opacity-30 cursor-not-allowed grayscale' 
                    : 'hover:bg-[#141414] hover:text-white border-opacity-100'}
                `}
                title={records.length === 0 ? "No hay datos para exportar" : "Exportar puntos KML"}
              >
                <Map size={14} />
                KML
              </button>
              
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
            <>
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
                    {paginatedRecords.map((record) => {
                      const inventoryItem = kmzProject?.items.find(i => i.id === record.linkedItemId);
                      const isMismatch = record.code !== 'SIN_PROCESAR' && inventoryItem && (
                        record.type !== inventoryItem.type || 
                        (record.code !== 'S/N' && record.code !== inventoryItem.name)
                      );

                      return (
                        <motion.tr 
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          key={record.id}
                          className={`group border-b border-[#141414] border-opacity-5 transition-all cursor-default ${
                            newlyAddedIds.has(record.id) 
                              ? 'bg-amber-50 hover:bg-[#141414] hover:text-[#E4E3E0]' 
                              : isMismatch
                              ? 'bg-red-50 hover:bg-red-600 hover:text-white'
                              : 'hover:bg-[#141414] hover:text-[#E4E3E0]'
                          }`}
                        >
                        <td className="p-4">
                          <div 
                            className="w-12 h-12 bg-slate-200 rounded overflow-hidden cursor-pointer flex items-center justify-center relative group/img"
                            onClick={() => record.imageUrl ? setSelectedImage(record.imageUrl) : fetchRecordImage(record.id)}
                          >
                            {record.imageUrl ? (
                              <img 
                                src={record.imageUrl} 
                                alt="Equipment" 
                                className="w-full h-full object-cover transition-transform group-hover/img:scale-110"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center w-full h-full bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors">
                                {loadingImages.has(record.id) ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <ImageIcon size={16} />
                                )}
                              </div>
                            )}
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
                            {record.code === 'SIN_PROCESAR' && (
                              <button 
                                onClick={() => processFiles([record])}
                                className="p-2 hover:bg-blue-500 hover:text-white rounded transition-colors text-blue-600"
                                title="Procesar con IA"
                              >
                                <Zap size={16} />
                              </button>
                            )}
                            <button 
                              onClick={() => setRecordToDelete(record.id)}
                              className="p-2 hover:bg-red-500 hover:text-white rounded transition-colors text-red-600"
                              title="Eliminar"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    )})}
                  </tbody>
                </table>
              </div>

              {/* Pagination Button */}
              {sortedRecords.length > displayLimit && (
                <div className="mt-8 flex justify-center">
                  <button 
                    onClick={() => setDisplayLimit(prev => prev + 20)}
                    className="flex items-center gap-3 px-8 py-3 bg-[#141414] text-[#E4E3E0] text-xs font-bold uppercase tracking-[0.2em] hover:bg-[#141414]/90 transition-all rounded shadow-lg hover:shadow-xl active:scale-95"
                  >
                    <Plus size={16} strokeWidth={3} />
                    Cargar más registros ({sortedRecords.length - displayLimit} restantes)
                  </button>
                </div>
              )}
            </>
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
              {/* Project Title & Progress */}
              <div className="bg-white p-6 rounded-2xl border border-[#141414]/5 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black tracking-tighter uppercase">{kmzProject.name}</h2>
                    <p className="text-xs opacity-50 font-medium">Proyecto cargado el {new Date(kmzProject.uploadedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setRecords([])}
                      className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                      title="Reiniciar matcheo local"
                    >
                      <RotateCcw size={14} />
                      Reset
                    </button>
                    <button 
                      onClick={exportToCSV}
                      className="bg-[#18A058] text-white px-6 py-2 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-[#18A058]/90 transition-all shadow-md active:scale-95 flex items-center gap-2"
                    >
                      <FileSpreadsheet size={16} />
                      CSV
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                    <span>Avance General de Inventario</span>
                    <span className="text-blue-600">{Math.round((kmzProject.items.filter(i => i.status === 'INSTALLED').length / kmzProject.items.length) * 100)}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(kmzProject.items.filter(i => i.status === 'INSTALLED').length / kmzProject.items.length) * 100}%` }}
                      className="h-full bg-blue-600 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.3)]"
                    />
                  </div>
                </div>
              </div>

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
                      {isAdmin && selectedInventoryItems.size > 0 && (
                        <div className="flex items-center gap-2 bg-blue-600/10 px-3 py-1.5 rounded-lg border border-blue-600/20 mr-2">
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{selectedInventoryItems.size} seleccionados</span>
                          <select 
                            value={assignmentTechId}
                            onChange={(e) => setAssignmentTechId(e.target.value)}
                            className="bg-white border border-blue-600/30 rounded py-0.5 px-2 text-[10px] outline-none"
                          >
                            <option value="">Asignar a...</option>
                            {technicians.map(tech => (
                              <option key={tech.id} value={tech.id}>{tech.name}</option>
                            ))}
                          </select>
                          <button 
                            onClick={assignSelectedItems}
                            disabled={!assignmentTechId}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-[9px] font-bold uppercase tracking-widest disabled:opacity-50"
                          >
                            OK
                          </button>
                        </div>
                      )}
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
                      <select 
                        value={inventoryTechFilter}
                        onChange={(e) => setInventoryTechFilter(e.target.value)}
                        className="bg-white border border-[#141414]/10 rounded-lg text-xs py-1.5 px-3 outline-none focus:border-blue-600 transition-all cursor-pointer"
                      >
                        <option value="ALL">Todos Técnicos</option>
                        <option value="NONE">Sin Asignar</option>
                        {technicians.map(tech => (
                          <option key={tech.id} value={tech.id}>{tech.name}</option>
                        ))}
                      </select>
                      {(inventorySearchQuery || inventoryTypeFilter !== 'ALL' || inventoryStatusFilter !== 'ALL' || inventoryCeldaFilter !== 'ALL' || inventoryTechFilter !== 'ALL') && (
                        <button 
                          onClick={() => {
                            setInventorySearchQuery('');
                            setInventoryTypeFilter('ALL');
                            setInventoryStatusFilter('ALL');
                            setInventoryCeldaFilter('ALL');
                            setInventoryTechFilter('ALL');
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
                      {isAdmin && selectedInventoryItems.size > 0 && (
                        <div className="flex items-center gap-2 bg-blue-600/10 px-3 py-1.5 rounded-lg border border-blue-600/20 mr-2">
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{selectedInventoryItems.size} seleccionados</span>
                          <select 
                            value={assignmentTechId}
                            onChange={(e) => setAssignmentTechId(e.target.value)}
                            className="bg-white border border-blue-600/30 rounded py-0.5 px-2 text-[10px] outline-none"
                          >
                            <option value="">Asignar a...</option>
                            {technicians.map(tech => (
                              <option key={tech.id} value={tech.id}>{tech.name}</option>
                            ))}
                          </select>
                          <button 
                            onClick={assignSelectedItems}
                            disabled={!assignmentTechId}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-[9px] font-bold uppercase tracking-widest disabled:opacity-50"
                          >
                            OK
                          </button>
                        </div>
                      )}
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
                      <select 
                        value={tendidoTechFilter}
                        onChange={(e) => setTendidoTechFilter(e.target.value)}
                        className="bg-white border border-[#141414]/10 rounded-lg text-xs py-1.5 px-3 outline-none focus:border-blue-600 transition-all cursor-pointer"
                      >
                        <option value="ALL">Todos Técnicos</option>
                        <option value="NONE">Sin Asignar</option>
                        {technicians.map(tech => (
                          <option key={tech.id} value={tech.id}>{tech.name}</option>
                        ))}
                      </select>
                      {(inventorySearchQuery || tendidoTypeFilter !== 'ALL' || tendidoStatusFilter !== 'ALL' || tendidoCeldaFilter !== 'ALL' || tendidoTechFilter !== 'ALL') && (
                        <button 
                          onClick={() => {
                            setInventorySearchQuery('');
                            setTendidoTypeFilter('ALL');
                            setTendidoStatusFilter('ALL');
                            setTendidoCeldaFilter('ALL');
                            setTendidoTechFilter('ALL');
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
                          {isAdmin && (
                            <th className="p-4 w-10">
                              <input 
                                type="checkbox"
                                checked={selectedInventoryItems.size > 0 && selectedInventoryItems.size === (kmzProject?.items || []).filter(item => {
                                  const searchLower = inventorySearchQuery.toLowerCase().trim();
                                  const matchesSearch = !searchLower || item.name.toLowerCase().includes(searchLower) || (item.celda && item.celda.toLowerCase().includes(searchLower));
                                  const matchesType = inventoryTypeFilter === 'ALL' ? (item.type !== 'RESERVA') : item.type === inventoryTypeFilter;
                                  const matchesStatus = inventoryStatusFilter === 'ALL' || item.status === inventoryStatusFilter;
                                  const itemCelda = (item.celda || '').trim();
                                  const filterCelda = (inventoryCeldaFilter || 'ALL').trim();
                                  let matchesCelda = filterCelda === 'ALL' || (filterCelda === 'NONE' ? itemCelda === '' : (itemCelda !== '' && itemCelda === filterCelda));
                                  return matchesSearch && matchesType && matchesStatus && matchesCelda;
                                }).length}
                                onChange={() => {
                                  const visible = (kmzProject?.items || []).filter(item => {
                                    const searchLower = inventorySearchQuery.toLowerCase().trim();
                                    const matchesSearch = !searchLower || item.name.toLowerCase().includes(searchLower) || (item.celda && item.celda.toLowerCase().includes(searchLower));
                                    const matchesType = inventoryTypeFilter === 'ALL' ? (item.type !== 'RESERVA') : item.type === inventoryTypeFilter;
                                    const matchesStatus = inventoryStatusFilter === 'ALL' || item.status === inventoryStatusFilter;
                                    const itemCelda = (item.celda || '').trim();
                                    const filterCelda = (inventoryCeldaFilter || 'ALL').trim();
                                    let matchesCelda = filterCelda === 'ALL' || (filterCelda === 'NONE' ? itemCelda === '' : (itemCelda !== '' && itemCelda === filterCelda));
                                    return matchesSearch && matchesType && matchesStatus && matchesCelda;
                                  });
                                  toggleAllInventoryItems(visible);
                                }}
                                className="rounded border-[#141414]/20"
                              />
                            </th>
                          )}
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Estado</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Nombre / Serial</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Tipo</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Celda</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Asignado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(kmzProject?.items || [])
                          .filter(item => {
                            const searchLower = inventorySearchQuery.toLowerCase().trim();
                            const matchesSearch = !searchLower || 
                              item.name.toLowerCase().includes(searchLower) ||
                              (item.celda && item.celda.toLowerCase().includes(searchLower));
                            
                            const matchesType = inventoryTypeFilter === 'ALL' 
                              ? (item.type !== 'RESERVA') 
                              : item.type === inventoryTypeFilter;
                            const matchesStatus = inventoryStatusFilter === 'ALL' || item.status === inventoryStatusFilter;
                            
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
                            
                            // Technician filtering
                            if (isTechnician && item.assignedTo !== techSession?.technicianId) {
                               return false;
                            }

                            if (inventoryTechFilter !== 'ALL') {
                              if (inventoryTechFilter === 'NONE') {
                                if (item.assignedTo) return false;
                              } else if (item.assignedTo !== inventoryTechFilter) {
                                return false;
                              }
                            }

                            return matchesSearch && matchesType && matchesStatus && matchesCelda;
                          })
                          .map((item) => {
                            const linkedRecord = records.find(r => r.linkedItemId === item.id);
                            const isMismatch = linkedRecord && linkedRecord.code !== 'SIN_PROCESAR' && (
                              linkedRecord.type !== item.type || 
                              (linkedRecord.code !== 'S/N' && linkedRecord.code !== item.name)
                            );

                            return (
                              <tr key={item.id} className={`border-b border-[#141414]/5 transition-colors ${
                                selectedInventoryItems.has(item.id) 
                                  ? 'bg-blue-50/50' 
                                  : isMismatch 
                                  ? 'bg-red-50 hover:bg-red-100' 
                                  : 'hover:bg-[#F8F9FA]'
                              }`}>
                              {isAdmin && (
                                <td className="p-4">
                                  <input 
                                    type="checkbox"
                                    checked={selectedInventoryItems.has(item.id)}
                                    onChange={() => toggleInventoryItemSelected(item.id)}
                                    className="rounded border-[#141414]/20 text-blue-600 focus:ring-blue-600/10"
                                  />
                                </td>
                              )}
                              <td className="p-4">
                                {item.status === 'INSTALLED' || item.manualStatus === 'INSTALLED' ? (
                                  <div 
                                    className="flex items-center gap-2 text-green-600 cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => toggleManualStatus(item.id, 'EQUIPO')}
                                    title="Click para cambiar a Pendiente"
                                  >
                                    <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                                      <CheckCircle size={12} className="text-white" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest">
                                      {item.status === 'INSTALLED' ? 'Completo' : 'Man. Completo'}
                                    </span>
                                  </div>
                                ) : (
                                  <div 
                                    className="flex items-center gap-2 text-gray-400 cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => toggleManualStatus(item.id, 'EQUIPO')}
                                    title="Click para marcar como Completo"
                                  >
                                    <div className="w-4 h-4 rounded-full bg-gray-300" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Pendiente</span>
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
                              <td className="p-4">
                                {item.assignedTo ? (
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-blue-600 truncate max-w-[100px]">
                                      {technicians.find(t => t.id === item.assignedTo)?.name || 'Desconocido'}
                                    </span>
                                    <span className="text-[8px] opacity-40">{item.assignedAt ? new Date(item.assignedAt).toLocaleDateString() : ''}</span>
                                  </div>
                                ) : (
                                  <span className="text-[9px] opacity-30 italic">Sin asignar</span>
                                )}
                              </td>
                            </tr>
                          )})}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {/* Subtle Totals Bar */}
                    {(() => {
                      const filteredTendidos = kmzProject.tendidos.filter(t => {
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
                        
                        const matchesTechnician = !isTechnician || t.assignedTo === techSession?.technicianId;
                          
                        return matchesSearch && matchesType && matchesCelda && matchesStatus && matchesTechnician;
                      });

                      const totalLinear = filteredTendidos.reduce((acc, t) => acc + t.linearDistance, 0);
                      const totalProjected = filteredTendidos.reduce((acc, t) => acc + t.totalDistance, 0);
                      const totalReal = filteredTendidos.reduce((acc, t) => {
                        const reports = tendidoReports.filter(r => r.tendidoId === t.id);
                        return acc + reports.reduce((rAcc, r) => rAcc + Math.abs(r.endMeter - r.startMeter), 0);
                      }, 0);

                      if (filteredTendidos.length === 0) return null;

                      return (
                        <div className="flex items-center gap-6 px-4 py-1.5 bg-blue-50/80 border border-blue-100 rounded-lg text-[10px]">
                          <div className="flex items-center gap-2">
                            <span className="font-serif italic text-blue-800/60 uppercase tracking-widest">Total Lineal:</span>
                            <span className="font-mono font-bold text-blue-900">{Math.round(totalLinear).toLocaleString()}m</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-serif italic text-blue-800/60 uppercase tracking-widest">Total Proyectado:</span>
                            <span className="font-mono font-bold text-blue-600">{Math.round(totalProjected).toLocaleString()}m</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-serif italic text-blue-800/60 uppercase tracking-widest">Longitud Real:</span>
                            <span className="font-mono font-bold text-green-700">{Math.round(totalReal).toLocaleString()}m</span>
                          </div>
                          <div className="ml-auto flex items-center gap-2">
                            <span className="font-serif italic text-blue-800/40 uppercase tracking-widest">Items:</span>
                            <span className="font-bold text-blue-900/40">{filteredTendidos.length}</span>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-[#F8F9FA] text-left">
                          {isAdmin && (
                            <th className="p-4 w-10">
                              <input 
                                type="checkbox"
                                checked={kmzProject.tendidos.length > 0 && kmzProject.tendidos.every(t => selectedInventoryItems.has(t.id))}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const allIds = new Set(selectedInventoryItems);
                                    kmzProject.tendidos.forEach(t => allIds.add(t.id));
                                    setSelectedInventoryItems(allIds);
                                  } else {
                                    const allIds = new Set(selectedInventoryItems);
                                    kmzProject.tendidos.forEach(t => allIds.delete(t.id));
                                    setSelectedInventoryItems(allIds);
                                  }
                                }}
                                className="rounded border-[#141414]/20 text-blue-600 focus:ring-blue-600/10"
                              />
                            </th>
                          )}
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Estado</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Nombre del Tendido</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Tipo</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Celda</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Dist. Lineal</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Extras</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Total Proyectado</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Asignado</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Longitud Real</th>
                          <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const filteredTendidos = kmzProject.tendidos.filter(t => {
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
                              // Coincidencia exacta para tendidos: debe tener celda y ser igual al filtro
                              matchesCelda = tCelda !== '' && tCelda === fCelda;
                            }
                            
                            const hasReports = tendidoReports.some(r => r.tendidoId === t.id);
                            const matchesStatus = tendidoStatusFilter === 'ALL' || 
                              (tendidoStatusFilter === 'COMPLETED' && hasReports) ||
                              (tendidoStatusFilter === 'PENDING' && !hasReports);
                              
                            const matchesTechnicianRole = !isTechnician || t.assignedTo === techSession?.technicianId;
                            let matchesTechnicianFilter = true;
                            if (tendidoTechFilter !== 'ALL') {
                              if (tendidoTechFilter === 'NONE') {
                                matchesTechnicianFilter = !t.assignedTo;
                              } else {
                                matchesTechnicianFilter = t.assignedTo === tendidoTechFilter;
                              }
                            }

                            return matchesSearch && matchesType && matchesCelda && matchesStatus && matchesTechnicianRole && matchesTechnicianFilter;
                          });

                          const totalLinear = filteredTendidos.reduce((acc, t) => acc + t.linearDistance, 0);
                          const totalProjected = filteredTendidos.reduce((acc, t) => acc + t.totalDistance, 0);
                          const totalReal = filteredTendidos.reduce((acc, t) => {
                            const reports = tendidoReports.filter(r => r.tendidoId === t.id);
                            return acc + reports.reduce((rAcc, r) => rAcc + Math.abs(r.endMeter - r.startMeter), 0);
                          }, 0);

                          return (
                            <>
                              {filteredTendidos.map((tendido) => (
                                <tr key={tendido.id} className={`border-b border-[#141414]/5 hover:bg-[#F8F9FA] transition-colors ${selectedInventoryItems.has(tendido.id) ? 'bg-blue-50' : ''}`}>
                                  {isAdmin && (
                                    <td className="p-4">
                                      <input 
                                        type="checkbox"
                                        checked={selectedInventoryItems.has(tendido.id)}
                                        onChange={() => {
                                          const newSet = new Set(selectedInventoryItems);
                                          if (newSet.has(tendido.id)) newSet.delete(tendido.id);
                                          else newSet.add(tendido.id);
                                          setSelectedInventoryItems(newSet);
                                        }}
                                        className="rounded border-[#141414]/20 text-blue-600 focus:ring-blue-600/10"
                                      />
                                    </td>
                                  )}
                                  <td className="p-4">
                                    {(() => {
                                      const hasReports = tendidoReports.some(r => r.tendidoId === tendido.id);
                                      const isCompleted = hasReports || tendido.manualStatus === 'COMPLETED';
                                      
                                      return isCompleted ? (
                                        <div 
                                          className="flex items-center gap-2 text-green-600 cursor-pointer hover:opacity-80 transition-opacity"
                                          onClick={() => toggleManualStatus(tendido.id, 'TENDIDO')}
                                          title="Click para cambiar a Incompleto"
                                        >
                                          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                                            <CheckCircle size={12} className="text-white" />
                                          </div>
                                          <span className="text-[10px] font-bold uppercase tracking-widest">
                                            {hasReports ? 'Completo' : 'Man. Completo'}
                                          </span>
                                        </div>
                                      ) : (
                                        <div 
                                          className="flex items-center gap-2 text-gray-400 cursor-pointer hover:opacity-80 transition-opacity"
                                          onClick={() => toggleManualStatus(tendido.id, 'TENDIDO')}
                                          title="Click para marcar como Completo"
                                        >
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
                                      {tendido.extrasDetails && tendido.extrasDetails.length > 0 ? (
                                        tendido.extrasDetails.map((detail, idx) => (
                                          <span key={idx} className={`text-[9px] font-bold ${detail.includes('Extremos') ? 'text-blue-600' : 'opacity-60'}`}>
                                            {detail}
                                          </span>
                                        ))
                                      ) : (
                                        <>
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
                                        </>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-4 font-mono text-sm font-bold text-blue-600">
                                    {Math.round(tendido.totalDistance)}m
                                  </td>
                                  <td className="p-4">
                                    {tendido.assignedTo ? (
                                      <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-blue-600 truncate max-w-[100px]">
                                          {technicians.find(tech => tech.id === tendido.assignedTo)?.name || 'Desconocido'}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-[9px] opacity-30 italic">Sin asignar</span>
                                    )}
                                  </td>
                                  <td className="p-4">
                                    {(() => {
                                      const reports = tendidoReports.filter(r => r.tendidoId === tendido.id);
                                      if (reports.length === 0) return <span className="text-[10px] opacity-30">Sin reportes</span>;
                                      
                                      const totalReal = reports.reduce((acc, r) => acc + Math.abs(r.endMeter - r.startMeter), 0);
                                      const diffMeters = Math.abs(totalReal - tendido.totalDistance);
                                      const isWithinLimit = diffMeters <= 20;
                                      
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
                            </>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'SYSTEM' && isSuperAdmin && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-[#141414] text-white rounded-2xl shadow-xl">
                <ShieldCheck size={32} />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tighter uppercase leading-none">Sistema</h2>
                <p className="text-xs opacity-50 font-bold uppercase tracking-widest mt-1">Gestión Global de Contratas</p>
              </div>
            </div>
            <button 
              onClick={() => {
                setModalError(null);
                setIsCreatingContractor(true);
              }}
              className="bg-blue-600 text-white px-8 py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95"
            >
              <Plus size={18} />
              Añadir Nueva Empresa
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div className="bg-white rounded-3xl border border-[#141414]/5 shadow-sm overflow-hidden border-b-2 border-b-[#141414]/10">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#F8F9FA] text-left border-b border-[#141414]/5">
                      <th className="p-6 font-serif italic text-[11px] uppercase tracking-[0.2em] opacity-50">Contratista</th>
                      <th className="p-6 font-serif italic text-[11px] uppercase tracking-[0.2em] opacity-50">ID Espacio</th>
                      <th className="p-6 font-serif italic text-[11px] uppercase tracking-[0.2em] opacity-50">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141414]/5">
                    {contractors.map(c => (
                      <tr key={c.id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-bold text-lg">
                              {c.name[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold tracking-tight text-sm uppercase">{c.name}</div>
                              <div className="text-[10px] opacity-40 uppercase tracking-widest leading-none mt-1">
                                Creado {new Date(c.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <code className="bg-[#F8F9FA] px-2 py-1 rounded text-[10px] font-mono border border-[#141414]/5 opacity-60">
                            {c.id}
                          </code>
                        </td>
                        <td className="p-6">
                          <div className="flex items-center gap-2">
                             <button 
                               onClick={() => {
                                 setEditingContractorName(c.name);
                                 setEditingContractorId(c.id);
                               }}
                               className="p-2 hover:bg-black hover:text-white rounded-lg transition-all text-[#141414]/30"
                               title="Editar nombre"
                               disabled={isSaving}
                             >
                               <Edit3 size={16} />
                             </button>
                             <button 
                               onClick={async () => {
                                 // Removed blocking confirm
                                 try {
                                   setIsSaving(true);
                                   if (storageMode === 'local') {
                                     const updated = contractors.filter(ct => ct.id !== c.id);
                                     setContractors(updated);
                                     await storage.saveLocalContractors(updated);
                                   } else {
                                     await deleteDoc(doc(db, 'contractors', c.id));
                                   }
                                   
                                   if (activeContractorId === c.id) {
                                     setActiveContractorId(null);
                                     localStorage.removeItem('activeContractorId');
                                   }
                                   setError(null);
                                 } catch (err: any) {
                                   console.error("Error deleting contractor:", err);
                                   setError("Error al eliminar empresa: " + (err.message || "Permiso denegado"));
                                 } finally {
                                   setIsSaving(false);
                                 }
                               }}
                               className="p-2 hover:bg-red-600 hover:text-white rounded-lg transition-all text-red-300"
                               title="Eliminar empresa"
                               disabled={isSaving}
                             >
                               {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                             </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-[#141414] p-8 rounded-3xl text-[#E4E3E0] shadow-2xl space-y-4">
                <Send size={32} className="text-blue-400" />
                <h3 className="text-xl font-bold italic font-serif leading-tight">Bot de Telegram</h3>
                <p className="text-[11px] opacity-60 leading-relaxed font-medium">
                  Configura el token global del bot para las notificaciones inmediatas.
                </p>
                <div className="pt-4 border-t border-white/10 space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-50">Bot Token (BotFather)</label>
                    <div className="flex gap-2">
                      <input 
                        type="password"
                        value={telegramBotToken}
                        onChange={(e) => setTelegramBotToken(e.target.value)}
                        placeholder="7483...:AAH..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-blue-400 font-mono"
                      />
                      <button 
                        onClick={() => saveTelegramBotToken(telegramBotToken)}
                        disabled={isSavingBotToken}
                        className="bg-blue-600 p-3 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
                      >
                        {isSavingBotToken ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#141414] p-8 rounded-3xl text-[#E4E3E0] shadow-2xl space-y-4">
                <ShieldCheck size={32} className="text-blue-400" />
                <h3 className="text-xl font-bold italic font-serif leading-tight">Control de Super-Admin</h3>
                <p className="text-[11px] opacity-60 leading-relaxed font-medium">
                  Este panel es exclusivo para <strong>{user?.email}</strong>. 
                  Desde aquí creas los espacios aislados para cada cliente (Contratas).
                  Cada empresa solo tendrá acceso a los proyectos que cree dentro de su ID asignado.
                </p>
                <div className="pt-4 border-t border-white/10 space-y-4">
                  <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold">
                    <span>Total Empresas</span>
                    <span className="text-blue-400">{contractors.length}</span>
                  </div>

                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Modo Local</p>
                        <p className="text-[9px] opacity-40 leading-tight">Usa base de datos local (Ahorro de lecturas)</p>
                      </div>
                      <button 
                        onClick={() => switchStorageMode(storageMode === 'local' ? 'cloud' : 'local')}
                        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${storageMode === 'local' ? 'bg-blue-600' : 'bg-white/10'}`}
                      >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${storageMode === 'local' ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                    {storageMode === 'local' && (
                      <button 
                         onClick={generateLocalTestData}
                         disabled={localDataGenerated}
                         className="w-full py-2 bg-blue-600/20 text-blue-400 text-[8px] font-bold uppercase tracking-[0.2em] rounded border border-blue-600/30 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2"
                      >
                        {localDataGenerated ? <Loader2 size={10} className="animate-spin" /> : <Database size={10} />}
                        Generar Datos de Prueba
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'TEAM' && isAdmin && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-2xl font-black tracking-tighter uppercase">Gestión de Equipo</h2>
              <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold mt-1">Personal técnico asignado a {currentContractorId}</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#141414]/30" />
                <input 
                  type="text"
                  placeholder="Buscar técnico..."
                  value={techSearchQuery}
                  onChange={(e) => setTechSearchQuery(e.target.value)}
                  className="bg-white border border-[#141414]/10 pl-9 pr-4 py-2.5 rounded-xl text-xs outline-none focus:ring-4 ring-blue-600/5 focus:border-blue-600/30 transition-all w-full md:w-[200px]"
                />
              </div>
              <button 
                onClick={() => {
                  setModalError(null);
                  setIsCreatingTech(true);
                }}
                className="flex items-center gap-2 bg-[#141414] text-white px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-[#141414]/10 active:scale-95"
              >
                <Plus size={14} />
                Nuevo ingreso
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            <AnimatePresence>
              {technicians
                .filter(t => t.name.toLowerCase().includes(techSearchQuery.toLowerCase()) || t.pin.includes(techSearchQuery))
                .map((tech) => (
                <motion.div 
                  key={tech.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white p-3 rounded-2xl border border-[#141414]/5 shadow-sm group hover:border-blue-600/30 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div className="bg-blue-50 text-blue-600 p-2 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <UserIcon size={14} />
                      </div>
                      <button 
                        onClick={() => deleteTechnician(tech.id)}
                        className="p-1.5 text-[#141414]/10 hover:text-red-600 transition-colors disabled:opacity-50"
                        disabled={isSaving}
                        title="Eliminar técnico"
                      >
                        {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                    <h3 className="font-bold text-xs truncate leading-tight mb-3" title={tech.name}>{tech.name}</h3>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between py-1.5 px-2 bg-[#F8F9FA] rounded-lg border border-[#141414]/5">
                      <span className="text-[8px] uppercase tracking-widest font-bold opacity-30">PIN</span>
                      <span className="font-mono font-bold text-blue-600 text-[10px] tracking-widest">{tech.pin}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 px-2 bg-[#F8F9FA] rounded-lg border border-[#141414]/5">
                      <span className="text-[8px] uppercase tracking-widest font-bold opacity-30">Visto</span>
                      <span className="text-[8px] font-bold opacity-50 uppercase tracking-tighter">
                        {tech.lastLogin ? new Date(tech.lastLogin).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '---'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {technicians.length === 0 && (
            <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-[#141414]/5 h-full flex flex-col items-center justify-center">
              <div className="max-w-xs mx-auto space-y-4">
                <div className="w-12 h-12 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto">
                  <UserIcon size={24} />
                </div>
                <p className="text-[10px] uppercase tracking-widest font-bold opacity-30">Base de datos vacía</p>
                <button 
                  onClick={() => setIsCreatingTech(true)}
                  className="text-blue-600 font-bold uppercase tracking-widest text-[10px] hover:underline"
                >
                  Registrar primer técnico
                </button>
              </div>
            </div>
          )}
          
          {technicians.length > 0 && technicians.filter(t => t.name.toLowerCase().includes(techSearchQuery.toLowerCase()) || t.pin.includes(techSearchQuery)).length === 0 && (
            <div className="py-12 text-center">
              <p className="text-xs opacity-40 italic">No se encontraron técnicos para "{techSearchQuery}"</p>
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
              {isAdmin && (
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-600/10 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600 text-white rounded-lg">
                      <Send size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest">Telegram Group Chat ID</p>
                      <p className="text-[9px] opacity-50">Ingrese el ID numérico (Ej: -100123456789). No use enlaces.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <input 
                      type="text"
                      value={projects.find(p => p.id === currentProjectId)?.telegramChatId || ''}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        if (val.includes('t.me/')) {
                          setError("Por favor ingrese el ID numérico del grupo (ej: -100...), no el enlace de invitación.");
                        }
                        updateProjectChatId(currentProjectId, val);
                      }}
                      placeholder="-100123456789"
                      className="bg-white border border-[#141414]/10 rounded-lg p-2 text-xs outline-none focus:border-blue-600 w-full md:w-48 font-mono"
                    />
                    {isSavingChatId && <Loader2 size={16} className="animate-spin text-blue-600" />}
                  </div>
                </div>
              )}

              <div className="flex bg-[#F8F9FA] p-1 rounded-xl w-fit border border-[#141414]/5">
                <button 
                  onClick={() => setActiveReportMode('TENDIDO')}
                  className={`px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                    activeReportMode === 'TENDIDO' ? 'bg-white text-blue-600 shadow-sm' : 'text-[#141414]/40 hover:text-[#141414]'
                  }`}
                >
                  Reporte de Tendido
                </button>
                <button 
                  onClick={() => setActiveReportMode('EQUIPOS')}
                  className={`px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                    activeReportMode === 'EQUIPOS' ? 'bg-white text-blue-600 shadow-sm' : 'text-[#141414]/40 hover:text-[#141414]'
                  }`}
                >
                  Equipos y Reservas
                </button>
              </div>

              {activeReportMode === 'TENDIDO' ? (
                /* New Report Form (Tendido) */
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
                        {kmzProject.tendidos
                          .filter(t => !isTechnician || t.assignedTo === techSession?.technicianId)
                          .map(t => (
                            <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                          ))
                        }
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
              ) : (
                /* Equipment Report Form */
                <div className="bg-blue-50/30 p-6 rounded-xl border border-blue-600/10">
                   <h3 className="text-sm font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Box size={16} className="text-blue-600" />
                    Reportar Foto de Equipo/Reserva
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold opacity-50">Seleccionar CTO/Mufa/Reserva</label>
                        <select 
                          value={selectedInventoryItemId}
                          onChange={(e) => setSelectedInventoryItemId(e.target.value)}
                          className="w-full bg-white border border-[#141414]/10 rounded-lg p-3 text-xs outline-none focus:border-blue-600"
                        >
                          <option value="">Seleccione elemento del inventario...</option>
                          {kmzProject.items
                            .filter(i => !isTechnician || i.assignedTo === techSession?.technicianId)
                            .map(item => (
                              <option key={item.id} value={item.id}>{item.name} ({item.type} - {item.celda || 'Sin Celda'})</option>
                            ))
                          }
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold opacity-50">Observaciones / Comprobantes</label>
                        <textarea 
                          value={equipmentReportNotes}
                          onChange={(e) => setEquipmentReportNotes(e.target.value)}
                          placeholder="Nota sobre la instalación, potencia medida, etc..."
                          className="w-full bg-white border border-[#141414]/10 rounded-lg p-3 text-xs outline-none focus:border-blue-600 min-h-[100px] resize-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold opacity-50">Subir Fotografía</label>
                        <div className="relative">
                          <input 
                            type="file"
                            accept="image/*"
                            onChange={(e) => setEquipmentReportFile(e.target.files?.[0] || null)}
                            className="hidden"
                            id="equipment-report-file"
                            disabled={isSubmittingEquipment}
                          />
                          <label 
                            htmlFor="equipment-report-file"
                            className={`flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                              equipmentReportFile ? 'bg-blue-50 border-blue-600/30' : 'bg-white border-[#141414]/10 hover:border-blue-600/30'
                            }`}
                          >
                            {equipmentReportFile ? (
                              <div className="text-center">
                                <FileText className="mx-auto text-blue-600 mb-2" size={24} />
                                <p className="text-[10px] font-bold text-blue-600 truncate max-w-[200px]">{equipmentReportFile.name}</p>
                                <p className="text-[8px] opacity-40 uppercase tracking-tighter mt-1">Click para cambiar</p>
                              </div>
                            ) : (
                              <>
                                <UploadCloud size={32} className="text-[#141414]/20" />
                                <div className="text-center">
                                  <p className="text-[10px] font-bold uppercase tracking-widest">Seleccionar Imagen</p>
                                  <p className="text-[8px] opacity-40 uppercase tracking-widest mt-1">Fotos de instalación con GPS preferiblemente</p>
                                </div>
                              </>
                            )}
                          </label>
                        </div>
                      </div>

                      <button 
                        onClick={submitEquipmentReport}
                        disabled={!selectedInventoryItemId || !equipmentReportFile || isSubmittingEquipment}
                        className="w-full bg-blue-600 text-white p-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                      >
                        {isSubmittingEquipment ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <FileText size={16} />
                            Enviar Reporte de Equipo
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Reports List */}
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold uppercase tracking-widest opacity-50">Historial de Reportes</h3>
                    <p className="text-[10px] opacity-30 uppercase tracking-widest font-mono">Resumen de actividad diaria</p>
                  </div>
                  
                  <div className="flex items-center gap-3 bg-[#F8F9FA] p-2 rounded-xl border border-[#141414]/5">
                    <Calendar size={14} className="text-blue-600 opacity-50" />
                    <input 
                      type="date"
                      value={reportDateFilter}
                      onChange={(e) => setReportDateFilter(e.target.value)}
                      className="bg-transparent text-xs font-bold font-mono outline-none cursor-pointer"
                    />
                    <div className="w-px h-4 bg-[#141414]/10 mx-1" />
                    <button 
                      onClick={() => setReportDateFilter('')}
                      className="text-[9px] font-bold uppercase text-blue-600 hover:underline"
                    >
                      Ver todos
                    </button>
                  </div>
                </div>

                {/* Daily Summary Card (Only for Tendidos) */}
                {activeReportMode === 'TENDIDO' && (() => {
                  const filtered = tendidoReports.filter(r => {
                    const matchesUser = !isTechnician || r.technicianId === techSession?.technicianId;
                    if (!reportDateFilter) return matchesUser;
                    return matchesUser && r.timestamp.startsWith(reportDateFilter);
                  });

                  if (filtered.length === 0) return null;

                  const totalMeters = filtered.reduce((acc, r) => acc + Math.abs(r.endMeter - r.startMeter), 0);
                  const totalHardware = filtered.reduce((acc, r) => {
                    if (!r.hardware) return acc;
                    return acc + Object.entries(r.hardware).reduce((hAcc, [k, v]) => {
                      return hAcc + (typeof v === 'number' ? v : 0);
                    }, 0);
                  }, 0);

                  const metersByType = filtered.reduce((acc, r) => {
                    const tendido = kmzProject?.tendidos.find(t => t.id === r.tendidoId);
                    const type = tendido?.type || 'OTRO';
                    const dist = Math.abs(r.endMeter - r.startMeter);
                    acc[type] = (acc[type] || 0) + dist;
                    return acc;
                  }, {} as Record<string, number>);

                  const hardwareBreakdown = filtered.reduce((acc, r) => {
                    if (!r.hardware) return acc;
                    Object.entries(r.hardware).forEach(([k, v]) => {
                      if (typeof v === 'number' && v > 0) {
                        acc[k] = (acc[k] || 0) + v;
                      }
                    });
                    return acc;
                  }, {} as Record<string, number>);

                  const hardwareLabels: Record<string, string> = {
                    cintaBandi: 'Cinta Bandi', hevillas: 'Hevillas', etiquetas: 'Etiquetas',
                    alambre: 'Alambre', mensajero: 'Mensajero', cruceta: 'Cruceta',
                    brazoCruceta: 'Brazo Cruceta', grillete: 'Grillete', chapas: 'Chapas',
                    clevi: 'Clevi', preformado: 'Preformado', brazo060: 'Brazo 0.60m',
                    brazo1m: 'Brazo 1m'
                  };

                  return (
                    <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div 
                        onClick={() => setShowMetersSummary(!showMetersSummary)}
                        className="bg-[#141414] text-white p-4 rounded-xl border border-[#141414] flex items-center justify-between group overflow-hidden relative cursor-pointer hover:ring-4 hover:ring-blue-600/10 transition-all"
                      >
                        <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12 transition-transform group-hover:scale-110">
                          <Activity size={80} />
                        </div>
                        <div className="relative z-10">
                          <p className="text-[9px] uppercase tracking-widest font-black opacity-40 mb-1">Mts Instalados (Día)</p>
                          <p className="text-3xl font-mono tracking-tighter leading-none">{Math.round(totalMeters)}m</p>
                          {showMetersSummary && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              className="mt-4 pt-4 border-t border-white/10 space-y-1.5"
                            >
                              {Object.entries(metersByType).map(([type, meters]) => (
                                <div key={type} className="flex justify-between items-center text-[10px] font-mono">
                                  <span className="opacity-40">{type}:</span>
                                  <span className="font-bold">{Math.round(meters as number)}m</span>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </div>
                        <div className="bg-white/10 p-2 rounded-lg relative z-10 self-start">
                          <Zap size={20} className="text-blue-400" />
                        </div>
                      </div>
                      
                      <div 
                        onClick={() => setShowHardwareSummary(!showHardwareSummary)}
                        className="bg-white p-4 rounded-xl border border-[#141414]/5 flex items-center justify-between group overflow-hidden relative cursor-pointer hover:ring-4 hover:ring-blue-600/10 transition-all font-sans"
                      >
                        <div className="absolute -right-4 -bottom-4 opacity-5 rotate-12 transition-transform group-hover:scale-110">
                          <Box size={80} />
                        </div>
                        <div className="relative z-10 w-full pr-12">
                          <p className="text-[9px] uppercase tracking-widest font-black opacity-40 mb-1">Ferretería (Total)</p>
                          <p className="text-3xl font-mono tracking-tighter leading-none text-[#141414]">{totalHardware}</p>
                          {showHardwareSummary && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              className="mt-4 pt-4 border-t border-[#141414]/5 grid grid-cols-2 gap-x-4 gap-y-1.5"
                            >
                              {Object.entries(hardwareBreakdown).map(([key, count]) => (
                                <div key={key} className="flex justify-between items-center text-[9px]">
                                  <span className="opacity-50 truncate mr-2">{hardwareLabels[key] || key}:</span>
                                  <span className="font-bold font-mono">{count as number}</span>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </div>
                        <div className="absolute right-4 top-4 bg-gray-50 p-2 rounded-lg z-10">
                          <Box size={20} className="text-gray-400" />
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-xl border border-[#141414]/5 flex items-center justify-between group overflow-hidden relative">
                        <div className="absolute -right-4 -bottom-4 opacity-5 rotate-12 transition-transform group-hover:scale-110">
                          <FileText size={80} />
                        </div>
                        <div className="relative z-10">
                          <p className="text-[9px] uppercase tracking-widest font-black opacity-40 mb-1">Tramos Reportados</p>
                          <p className="text-3xl font-mono tracking-tighter leading-none text-[#141414]">{filtered.length}</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-lg relative z-10">
                          <CheckCircle size={20} className="text-green-500" />
                        </div>
                      </div>
                    </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 gap-3">
                  {activeReportMode === 'TENDIDO' ? (
                    tendidoReports.length === 0 ? (
                      <div className="py-12 text-center bg-[#F8F9FA] rounded-xl border border-dashed border-[#141414]/10">
                        <p className="text-sm opacity-40 italic">No hay reportes técnicos generados para este proyecto.</p>
                      </div>
                    ) : (
                      tendidoReports
                        .filter(r => {
                          const matchesUser = !isTechnician || r.technicianId === techSession?.technicianId;
                          if (!reportDateFilter) return matchesUser;
                          return matchesUser && r.timestamp.startsWith(reportDateFilter);
                        })
                        .length === 0 ? (
                          <div className="py-12 text-center bg-[#F8F9FA] rounded-xl border border-[#141414]/5">
                            <p className="text-sm opacity-40">No hay reportes de tendido para la fecha seleccionada ({reportDateFilter}).</p>
                          </div>
                        ) : (
                          tendidoReports
                            .filter(r => {
                              const matchesUser = !isTechnician || r.technicianId === techSession?.technicianId;
                              if (!reportDateFilter) return matchesUser;
                              return matchesUser && r.timestamp.startsWith(reportDateFilter);
                            })
                            .map(report => {
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
                        )
                    )
                  ) : (
                    /* Equipment History mode */
                    records.filter(r => (r as any).linkedItemId).length === 0 ? (
                      <div className="py-12 text-center bg-[#F8F9FA] rounded-xl border border-dashed border-[#141414]/10">
                        <p className="text-sm opacity-40 italic">No hay reportes de equipos fotos-comprobantes para este proyecto.</p>
                      </div>
                    ) : (
                      records
                        .filter(r => {
                          const isEquipmentReport = (r as any).linkedItemId;
                          const matchesUser = !isTechnician || r.userId === user?.uid;
                          if (!isEquipmentReport || !matchesUser) return false;
                          if (!reportDateFilter) return true;
                          return r.extractedAt.startsWith(reportDateFilter) || r.timestamp.startsWith(reportDateFilter);
                        })
                        .length === 0 ? (
                          <div className="py-12 text-center bg-[#F8F9FA] rounded-xl border border-[#141414]/5">
                            <p className="text-sm opacity-40">No hay reportes de equipos para la fecha seleccionada ({reportDateFilter}).</p>
                          </div>
                        ) : (
                          records
                            .filter(r => {
                              const isEquipmentReport = (r as any).linkedItemId;
                              const matchesUser = !isTechnician || r.userId === user?.uid;
                              if (!isEquipmentReport || !matchesUser) return false;
                              if (!reportDateFilter) return true;
                              return r.extractedAt.startsWith(reportDateFilter) || r.timestamp.startsWith(reportDateFilter);
                            })
                            .map(record => {
                              const inventoryItem = kmzProject?.items.find(i => i.id === (record as any).linkedItemId);
                              const isMismatch = record.code !== 'SIN_PROCESAR' && inventoryItem && (
                                record.type !== inventoryItem.type || 
                                (record.code !== 'S/N' && record.code !== inventoryItem.name)
                              );

                              return (
                                <div 
                                  key={record.id} 
                                  className={`border transition-all rounded-xl p-4 shadow-sm flex items-center justify-between group/hist ${
                                    isMismatch ? 'bg-red-50 border-red-200' : 'bg-white border-[#141414]/5 hover:shadow-md'
                                  }`}
                                >
                                  <div className="flex items-center gap-4 flex-1">
                                    <div 
                                      className={`w-12 h-12 rounded overflow-hidden flex items-center justify-center cursor-pointer relative border ${
                                        isMismatch ? 'border-red-300 shadow-sm' : 'bg-slate-100 border-transparent'
                                      }`}
                                      onClick={() => record.imageUrl ? setSelectedImage(record.imageUrl) : fetchRecordImage(record.id)}
                                    >
                                      {record.imageUrl ? (
                                        <img 
                                          src={record.imageUrl} 
                                          alt="Equip" 
                                          className="w-full h-full object-cover transition-transform group-hover/hist:scale-110"
                                          referrerPolicy="no-referrer"
                                        />
                                      ) : (
                                        loadingImages.has(record.id) ? (
                                          <Loader2 size={12} className="animate-spin text-blue-600" />
                                        ) : (
                                          <ImageIcon size={16} className="text-slate-300" />
                                        )
                                      )}
                                      {isMismatch && (
                                        <div className="absolute top-0 right-0 p-0.5 bg-red-600 text-white rounded-bl shadow-sm">
                                          <AlertCircle size={8} />
                                        </div>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <h4 className={`font-bold text-sm tracking-tight ${isMismatch ? 'text-red-900' : ''}`}>
                                            {inventoryItem?.name || 'Equipo Desconocido'}
                                          </h4>
                                          {isMismatch && (
                                            <span className="text-[8px] bg-red-600 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">Incorrecto</span>
                                          )}
                                        </div>
                                        <p className="text-[9px] opacity-40 uppercase tracking-widest">
                                          {record.method === 'LOCAL' ? 'Enviado' : 'Procesado'} • {new Date(record.extractedAt).toLocaleDateString()}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-[8px] uppercase tracking-widest opacity-40 mb-0.5">Tipo {isMismatch && record.type !== inventoryItem?.type ? '(Detectado)' : ''}</p>
                                        <div className="flex items-center gap-1.5">
                                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                                            isMismatch && record.type !== inventoryItem?.type ? 'bg-red-200 text-red-900' : 'bg-blue-100 text-blue-800'
                                          }`}>
                                            {record.type}
                                          </span>
                                          {isMismatch && record.type !== inventoryItem?.type && (
                                            <span className="text-[9px] opacity-30 italic">vs {inventoryItem?.type}</span>
                                          )}
                                        </div>
                                      </div>
                                      <div>
                                        <p className="text-[8px] uppercase tracking-widest opacity-40 mb-0.5">Código Extraído {isMismatch && record.code !== inventoryItem?.name ? '(Error)' : ''}</p>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                                          record.code === 'SIN_PROCESAR' ? 'bg-gray-100 text-gray-400' : (isMismatch && record.code !== 'S/N' && record.code !== inventoryItem?.name ? 'bg-red-200 text-red-900' : 'bg-blue-100 text-blue-800')
                                        }`}>
                                          {record.code === 'SIN_PROCESAR' ? 'Pendiente' : (record.code === 'S/N' ? 'No legible' : record.code)}
                                        </span>
                                      </div>
                                      <div>
                                        <p className="text-[8px] uppercase tracking-widest opacity-40 mb-0.5">Nota Técnica</p>
                                        <p className="text-[10px] italic truncate max-w-[150px] opacity-60">{(record as any).notes || '-'}</p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 ml-4">
                                    <button 
                                      onClick={() => setActiveTab('EXTRACTION')}
                                      className="text-[9px] font-bold uppercase text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                      <RotateCcw size={10} />
                                      Ver Extracción
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                        )
                    )
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
                        <strong> Debes usar OpenRouter</strong> para extraer datos en esta vista previa.
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
                          if (currentProjectId) {
                            const localRecords = await storage.loadRecords(currentProjectId);
                            if (localRecords.length > 0 && user) {
                              for (const record of localRecords) {
                                await setDoc(doc(db, 'records', record.id), {
                                  ...record,
                                  projectId: record.projectId || currentProjectId,
                                  userId: record.userId || user.uid
                                }, { merge: true });
                              }
                              await storage.saveRecords(currentProjectId, []);
                            }
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
                            console.log(`Búsqueda completada. Se recuperaron ${recoveredCount} registros huérfanos.`);
                          } else {
                            console.log("Búsqueda completada. Si había datos locales, se han sincronizado.");
                          }
                        } catch (e) {
                          console.error(e);
                          setError("Error durante la recuperación.");
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

                <div className="space-y-4 pt-4 border-t border-[#141414]/5">
                  <div className="flex items-center gap-2">
                    <Database size={16} className="text-blue-600" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">Optimización de Lecturas</h3>
                  </div>
                  
                  <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[11px] font-bold text-amber-900">Modo de Funcionamiento</p>
                        <p className="text-[10px] text-amber-800/60 leading-relaxed max-w-[200px]">
                          Prueba la APP sin consumir tu cuota de Firebase usando datos locales.
                        </p>
                      </div>
                      <div className="flex bg-white rounded-lg p-1 border border-amber-200">
                        <button 
                          onClick={() => switchStorageMode('cloud')}
                          className={`px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-widest transition-all ${
                            storageMode === 'cloud' ? 'bg-blue-600 text-white shadow-sm' : 'text-amber-900/40 hover:text-amber-900'
                          }`}
                        >
                          Cloud
                        </button>
                        <button 
                          onClick={() => switchStorageMode('local')}
                          className={`px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-widest transition-all ${
                            storageMode === 'local' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-900/40 hover:text-amber-900'
                          }`}
                        >
                          Local
                        </button>
                      </div>
                    </div>

                    {storageMode === 'local' && (
                      <div className="pt-4 border-t border-amber-200">
                        <button 
                          onClick={generateLocalTestData}
                          disabled={localDataGenerated}
                          className="w-full py-2.5 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-amber-600 transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                          {localDataGenerated ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
                          Cargar Datos de Prueba Locales
                        </button>
                      </div>
                    )}
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
        {recordToDelete && (
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
                Eliminar Registro
              </h2>
              <p className="text-sm mb-8 opacity-70 leading-relaxed">
                ¿Estás seguro de que deseas eliminar este registro? Esta acción se sincronizará con la base de datos y borrará tanto los metadatos como la imagen asociada.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setRecordToDelete(null)}
                  className="flex-1 border border-[#141414] py-3 text-xs uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => deleteRecord(recordToDelete)}
                  className="flex-1 bg-red-600 text-white py-3 text-xs uppercase tracking-widest hover:bg-red-700 transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {projectToDelete && (
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
                Eliminar Proyecto
              </h2>
              <p className="text-sm mb-8 opacity-70 leading-relaxed">
                ¿Estás seguro de que deseas eliminar el proyecto <strong>"{projectToDelete.name}"</strong>? 
                Esta acción no se puede deshacer y se borrarán todos los datos técnicos, fotos vinculadas y reportes de este proyecto.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setProjectToDelete(null)}
                  className="flex-1 border border-[#141414] py-3 text-xs uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                    const idToDelete = projectToDelete.id;
                    try {
                      if (storageMode === 'local') {
                        const updated = projects.filter(p => p.id !== idToDelete);
                        setProjects(updated);
                        if (currentContractorId) {
                          await storage.saveLocalProjects(currentContractorId, updated);
                        }
                      } else {
                        await deleteDoc(doc(db, 'projects', idToDelete));
                        await deleteDoc(doc(db, 'kmz_projects', idToDelete));
                        await deleteDoc(doc(db, 'project_indexes', idToDelete));
                      }
                      
                      // Clean up persistence for both modes
                      localStorage.removeItem(`kmzProject_${idToDelete}`);
                      await storage.deleteLocalReports(idToDelete);
                      localStorage.removeItem(`lastSync_${idToDelete}`);
                      
                      const remaining = projects.filter(p => p.id !== idToDelete);
                      if (remaining.length > 0) {
                        setCurrentProjectId(remaining[0].id);
                        localStorage.setItem('currentProjectId', remaining[0].id);
                      } else {
                        setCurrentProjectId(null);
                        localStorage.removeItem('currentProjectId');
                      }
                      setProjectToDelete(null);
                    } catch (err: any) {
                      console.error("Error deleting project:", err);
                      setError("No se pudo eliminar el proyecto: " + (err.message || "Permiso denegado"));
                      setProjectToDelete(null);
                    }
                  }}
                  className="flex-1 bg-red-600 text-white py-3 text-xs uppercase tracking-widest hover:bg-red-700 transition-colors"
                >
                  Confirmar Borrado
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        <AnimatePresence>
          {isCreatingTech && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#141414]/80 backdrop-blur-md z-[110] flex items-center justify-center p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setIsCreatingTech(false);
              }}
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white p-8 max-w-sm w-full rounded-3xl shadow-2xl space-y-6 relative border border-[#141414]/10"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-black tracking-tighter uppercase">Nuevo Técnico</h2>
                  <button onClick={() => setIsCreatingTech(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-50 px-1">Nombre Completo</label>
                    <input 
                      type="text"
                      value={newTechName}
                      onChange={(e) => setNewTechName(e.target.value)}
                      placeholder="Ej: Juan Perez"
                      className="w-full bg-[#F8F9FA] border border-[#141414]/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-600 transition-all font-medium"
                      onKeyDown={(e) => e.key === 'Enter' && createTechnician()}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-50 px-1">PIN de Acceso (Min 4 dígitos)</label>
                    <input 
                      type="text"
                      maxLength={6}
                      value={newTechPin}
                      onChange={(e) => setNewTechPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="Ej: 1234"
                      className="w-full bg-[#F8F9FA] border border-[#141414]/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-600 transition-all font-mono font-bold tracking-[0.2em]"
                      onKeyDown={(e) => e.key === 'Enter' && createTechnician()}
                    />
                  </div>
                </div>

                {modalError && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-xl flex items-center gap-2 border border-red-100 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle size={14} className="shrink-0" />
                    <span className="text-[10px] font-bold leading-tight uppercase tracking-tight">{modalError}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setIsCreatingTech(false)}
                    className="flex-1 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest border border-[#141414]/10 hover:bg-gray-50 transition-all"
                    disabled={isSaving}
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={createTechnician}
                    disabled={!newTechName.trim() || !newTechPin.trim() || isSaving}
                    className="flex-1 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : 'Confirmar'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
        {editingProjectId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-[#141414]/80 backdrop-blur-md flex items-center justify-center p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#E4E3E0] p-10 max-w-md w-full rounded-3xl border border-[#141414] shadow-2xl space-y-8"
            >
              <div className="space-y-2">
                <h2 className="font-serif italic text-4xl leading-tight text-[#141414]">Renombrar Proyecto</h2>
                <p className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-40">Gestión de Identidad de Proyecto</p>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] uppercase tracking-widest font-black opacity-50 ml-1">Nuevo Nombre</label>
                  <input 
                    type="text"
                    value={editingProjectName}
                    onChange={(e) => setEditingProjectName(e.target.value)}
                    className="w-full bg-white border-2 border-[#141414] px-6 py-5 outline-none focus:ring-8 ring-blue-600/10 transition-all font-black text-sm uppercase tracking-tight"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setEditingProjectId(null)}
                  className="flex-1 border-2 border-[#141414]/10 py-5 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all rounded-2xl"
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                    if (!editingProjectName.trim()) return;
                    setIsSaving(true);
                    try {
                      if (storageMode === 'local') {
                        const updated = projects.map(p => 
                          p.id === editingProjectId ? { ...p, name: editingProjectName.trim() } : p
                        );
                        setProjects(updated);
                        if (currentContractorId) {
                          await storage.saveLocalProjects(currentContractorId, updated);
                        }
                      } else {
                        const batch = writeBatch(db);
                        const trimmedName = editingProjectName.trim();
                        batch.update(doc(db, 'projects', editingProjectId!), { name: trimmedName, lastKmzUpdate: new Date().toISOString() });
                        batch.update(doc(db, 'kmz_projects', editingProjectId!), { name: trimmedName });
                        await batch.commit();
                      }
                      
                      if (kmzProject && kmzProject.id === editingProjectId) {
                        setKmzProject({ ...kmzProject, name: editingProjectName.trim() });
                      }
                      setEditingProjectId(null);
                    } catch (err: any) {
                      console.error("Error renaming project:", err);
                      setError("Error al renombrar: " + (err.message || "Permiso denegado"));
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  disabled={isSaving || !editingProjectName.trim()}
                  className="flex-1 bg-blue-600 text-white py-5 text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 rounded-2xl shadow-xl shadow-blue-600/30 active:scale-95"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin inline mr-2" /> : 'Guardar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {memberManagementProject && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-[#141414]/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#E4E3E0] p-6 sm:p-10 max-w-lg w-full rounded-3xl border border-[#141414] shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h2 className="font-serif italic text-2xl sm:text-3xl leading-tight text-[#141414]">Asignar Técnicos</h2>
                  <p className="text-[9px] uppercase tracking-widest font-bold opacity-40">Proyecto: {memberManagementProject.name}</p>
                </div>
                <button onClick={() => setMemberManagementProject(null)} className="p-2 hover:bg-black/5 rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div className="max-h-[350px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {technicians.length === 0 ? (
                  <p className="text-xs opacity-40 italic py-8 text-center">No hay técnicos registrados en la contrata.</p>
                ) : (
                  technicians.map(tech => {
                    const isAssigned = memberManagementProject.members.includes(tech.id);
                    return (
                      <div 
                        key={tech.id} 
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                          isAssigned ? 'bg-blue-50 border-blue-200' : 'bg-white border-[#141414]/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isAssigned ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {tech.name[0].toUpperCase()}
                          </div>
                          <div>
                            <p className={`text-xs font-bold ${isAssigned ? 'text-blue-600' : ''}`}>{tech.name}</p>
                            <p className="text-[10px] opacity-40">PIN: {tech.pin}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => toggleProjectMember(memberManagementProject.id, tech.id)}
                          className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                            isAssigned ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-[#141414] text-white hover:bg-blue-600'
                          }`}
                        >
                          {isAssigned ? 'Retirar' : 'Asignar'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="pt-4">
                <button 
                  onClick={() => setMemberManagementProject(null)}
                  className="w-full bg-[#141414] text-white py-4 text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all rounded-2xl"
                >
                  Listo
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {editingContractorId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-[#141414]/80 backdrop-blur-md flex items-center justify-center p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#E4E3E0] p-10 max-w-md w-full rounded-3xl border border-[#141414] shadow-2xl space-y-8"
            >
              <div className="space-y-2">
                <h2 className="font-serif italic text-4xl leading-tight text-[#141414]">Editar Contrata</h2>
                <p className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-40">Gestión de Espacio Maestro</p>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] uppercase tracking-widest font-black opacity-50 ml-1">Nuevo Nombre</label>
                  <input 
                    type="text"
                    value={editingContractorName}
                    onChange={(e) => setEditingContractorName(e.target.value)}
                    className="w-full bg-white border-2 border-[#141414] px-6 py-5 outline-none focus:ring-8 ring-blue-600/10 transition-all font-black text-sm uppercase tracking-tight"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setEditingContractorId(null)}
                  className="flex-1 border-2 border-[#141414]/10 py-5 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all rounded-2xl"
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                    if (!editingContractorName.trim()) return;
                    setIsSaving(true);
                    try {
                      if (storageMode === 'local') {
                        const updated = contractors.map(c => 
                          c.id === editingContractorId ? { ...c, name: editingContractorName.trim() } : c
                        );
                        setContractors(updated);
                        await storage.saveLocalContractors(updated);
                      } else {
                        await updateDoc(doc(db, 'contractors', editingContractorId!), { name: editingContractorName.trim() });
                      }
                      setEditingContractorId(null);
                    } catch (err: any) {
                      console.error("Error renaming contractor:", err);
                      setError("Error al renombrar: " + (err.message || "Permiso denegado"));
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  disabled={isSaving || !editingContractorName.trim()}
                  className="flex-1 bg-blue-600 text-white py-5 text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 rounded-2xl shadow-xl shadow-blue-600/30 active:scale-95"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin inline mr-2" /> : 'Guardar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {isCreatingContractor && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-[#141414]/80 backdrop-blur-md flex items-center justify-center p-8"
            onClick={(e) => {
               if (e.target === e.currentTarget) setIsCreatingContractor(false);
            }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#E4E3E0] p-10 max-w-md w-full rounded-3xl border border-[#141414] shadow-2xl space-y-8"
            >
              <div className="space-y-2">
                <h2 className="font-serif italic text-4xl leading-tight text-[#141414]">Nueva Contrata</h2>
                <p className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-40">Provisión de Espacio Empresarial</p>
              </div>
              
              <div className="space-y-6">
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] uppercase tracking-widest font-black opacity-50 ml-1">Nombre Comercial de la Empresa</label>
                  <input 
                    type="text"
                    value={newContractorName}
                    onChange={(e) => setNewContractorName(e.target.value)}
                    placeholder="Ej. ELECTRA PERU S.A.C."
                    className="w-full bg-white border-2 border-[#141414] px-6 py-5 outline-none focus:ring-8 ring-blue-600/10 transition-all font-black text-sm uppercase tracking-tight"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && createContractor()}
                  />
                  {modalError && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 border border-red-100 animate-in fade-in slide-in-from-top-1 mt-2">
                      <AlertCircle size={18} className="shrink-0" />
                      <span className="text-xs font-bold leading-tight uppercase tracking-tight">{modalError}</span>
                    </div>
                  )}
                  <p className="text-[9px] opacity-40 leading-relaxed px-1">
                    Este nombre será visible en el selector de contratistas para la gestión de proyectos y técnicos.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => {
                    setIsCreatingContractor(false);
                    setNewContractorName('');
                  }}
                  className="flex-1 border-2 border-[#141414]/10 py-5 text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all rounded-2xl"
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button 
                  onClick={createContractor}
                  disabled={!newContractorName.trim() || isSaving}
                  className="flex-1 bg-blue-600 text-white py-5 text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 rounded-2xl shadow-xl shadow-blue-600/30 active:scale-95 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : 'Confirmar Espacio'}
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
            <h3 className="font-serif italic text-lg">OPDE V1.0</h3>
            <p className="text-[11px] uppercase tracking-widest opacity-50 mt-1">Sistemas de Gestión de Fibra Óptica</p>
            <p className="text-[10px] uppercase tracking-widest opacity-30 mt-4">Created by Joel Rivas</p>
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
