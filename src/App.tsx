import React, { useState, useRef, useEffect, ErrorInfo } from 'react';
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
  ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EquipmentRecord } from './types';
import { extractEquipmentData } from './services/geminiService';
import { storage } from './lib/storage';

// Error Boundary Component (Disabled due to linting issues)
/*
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#E4E3E0] p-8">
          <div className="max-w-md w-full bg-white p-8 border-2 border-[#141414] shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
            <h1 className="font-serif italic text-2xl mb-4">Algo salió mal</h1>
            <p className="text-sm mb-6 opacity-70">
              La aplicación ha encontrado un error inesperado. Por favor, intenta recargar la página.
            </p>
            <div className="bg-red-50 p-4 border border-red-200 mb-6 overflow-auto max-h-40">
              <code className="text-xs text-red-600">{this.state.error?.message}</code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-[#141414] text-[#E4E3E0] font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
*/

export default function App() {
  const [records, setRecords] = useState<EquipmentRecord[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CTO' | 'MUFA' | 'RESERVA'>('ALL');
  const [sortOrder, setSortOrder] = useState<'NEWEST' | 'OLDEST' | 'SERIAL_ASC' | 'SERIAL_DESC' | 'POWER_ASC' | 'POWER_DESC'>('NEWEST');
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadSummary, setUploadSummary] = useState<{
    total: number;
    success: number;
    failed: { name: string; error: string }[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ code: string; coordinates: string }>({ code: '', coordinates: '' });

  useEffect(() => {
    const initStorage = async () => {
      // 1. Try to migrate from localStorage if exists
      const migrated = await storage.migrateFromLocalStorage();
      if (migrated) {
        setRecords(migrated);
      } else {
        // 2. Otherwise load from IndexedDB
        const loaded = await storage.loadRecords();
        setRecords(loaded);
      }
      setIsInitialLoad(false);
    };
    initStorage();
  }, []);

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

  const startEditing = (record: EquipmentRecord) => {
    setEditingId(record.id);
    setEditValues({ code: record.code, coordinates: record.coordinates });
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveEdit = (id: string) => {
    setRecords(prev => prev.map(r => 
      r.id === id ? { ...r, code: editValues.code, coordinates: editValues.coordinates } : r
    ));
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
    
    await processFiles(Array.from(files));
  };

  const processFiles = async (files: File[]) => {
    setIsUploading(true);
    setError(null);
    setUploadSummary(null);
    setUploadProgress({ current: 0, total: files.length });

    const failed: { name: string; error: string }[] = [];
    let successCount = 0;
    
    // Process in small batches
    const batchSize = 2; // Reduced batch size to be safer with rate limits
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (file) => {
        try {
          const resizedBase64 = await resizeImage(file);
          const result = await extractEquipmentData(resizedBase64, 'image/jpeg');
          
          const newRecord: EquipmentRecord = {
            id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
            imageUrl: resizedBase64,
            code: result.code || 'S/N',
            type: (result.type as 'CTO' | 'MUFA' | 'RESERVA') || 'CTO',
            coordinates: result.coordinates || '0,0',
            timestamp: result.timestamp || new Date().toLocaleString(),
            power: result.power || 'N/A',
            extractedAt: new Date().toLocaleString()
          };
          
          successCount++;
          return newRecord;
        } catch (err) {
          console.error(`Error processing ${file.name}:`, err);
          failed.push({ 
            name: file.name, 
            error: err instanceof Error ? err.message : 'Error desconocido' 
          });
          return null;
        } finally {
          setUploadProgress(prev => ({ ...prev, current: Math.min(prev.current + 1, files.length) }));
        }
      });

      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter((r): r is EquipmentRecord => r !== null);
      
      if (validResults.length > 0) {
        setRecords(prev => [...validResults, ...prev]);
      }
    }
    
    setUploadSummary({
      total: files.length,
      success: successCount,
      failed: failed
    });
    
    setIsUploading(false);
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
          const MAX_WIDTH = 1200; // Slightly smaller for better performance
          const MAX_HEIGHT = 1200;
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
          
          resolve(canvas.toDataURL('image/jpeg', 0.7));
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

  const deleteRecord = (id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  const deleteFilteredRecords = () => {
    const filteredIds = new Set(filteredRecords.map(r => r.id));
    setRecords(prev => prev.filter(r => !filteredIds.has(r.id)));
    setShowDeleteAllConfirm(false);
  };

  const isFiltered = searchQuery !== '' || typeFilter !== 'ALL';

  const exportToCSV = () => {
    const dataToExport = filteredRecords;
    if (dataToExport.length === 0) return;
    
    // Match the headers and order seen in the UI table
    const headers = ['TIPO', 'CODIGO SERIAL', 'POTENCIA', 'COORDENADAS', 'FECHA/HORA FOTO', 'FECHA PROCESADO'];
    const rows = dataToExport.map(r => [
      r.type,
      r.code,
      r.power,
      r.coordinates,
      r.timestamp,
      r.extractedAt
    ]);
    
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
    link.setAttribute("download", `datos_equipos_${new Date().toISOString().split('T')[0]}.csv`);
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

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex justify-between items-center">
        <div>
          <h1 className="font-serif italic text-2xl tracking-tight">Optical Data Extractor</h1>
          <p className="text-[11px] uppercase tracking-widest opacity-50 mt-1">Inventario Automatizado y Registro GPS</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={exportToKML}
            disabled={records.length === 0}
            className="flex items-center gap-2 border border-[#141414] px-4 py-2 text-xs uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Map size={14} />
            Exportar KMZ
          </button>
          <button 
            onClick={exportToCSV}
            disabled={records.length === 0}
            className="flex items-center gap-2 border border-[#141414] px-4 py-2 text-xs uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            Exportar CSV
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-4 py-2 text-xs uppercase tracking-widest hover:bg-opacity-90 transition-colors"
          >
            <Plus size={14} />
            Subir Foto
          </button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-8">
        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative flex justify-between items-center"
            >
              <span className="text-sm">{error}</span>
              <button onClick={() => setError(null)}><X size={16} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Area */}
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
                Analizando datos del equipo ({uploadProgress.current} de {uploadProgress.total})...
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
          <div className="flex items-center justify-between border-b border-[#141414] pb-2">
            <h2 className="font-serif italic text-lg">Registros Extraídos</h2>
            <div className="flex items-center gap-4">
              { (searchQuery || typeFilter !== 'ALL') && (
                <button 
                  onClick={() => { setSearchQuery(''); setTypeFilter('ALL'); setSortOrder('NEWEST'); }}
                  className="text-[10px] uppercase tracking-widest text-red-500 hover:underline"
                >
                  Limpiar Filtros
                </button>
              )}
              {records.length > 0 && (
                <button 
                  onClick={() => setShowDeleteAllConfirm(true)}
                  className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                >
                  <Trash2 size={10} />
                  {isFiltered ? 'Eliminar Filtrados' : 'Eliminar Todo'}
                </button>
              )}
              <span className="text-[11px] uppercase tracking-widest opacity-50">
                {sortedRecords.length} de {records.length} Entradas
              </span>
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
                      className="group border-b border-[#141414] border-opacity-5 hover:bg-[#141414] hover:text-[#E4E3E0] transition-all cursor-default"
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
      </main>

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
                      <p className="text-[10px] text-red-500 italic">{f.error}</p>
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
      </AnimatePresence>

      {/* Footer */}
      <footer className="p-12 border-t border-[#141414] border-opacity-10 mt-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <h3 className="font-serif italic text-lg">Inventory System v1.0</h3>
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
