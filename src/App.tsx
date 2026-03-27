import React, { useState, useRef, useEffect } from 'react';
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
  Map
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EquipmentRecord } from './types';
import { extractEquipmentData } from './services/geminiService';

export default function App() {
  const [records, setRecords] = useState<EquipmentRecord[]>(() => {
    const saved = localStorage.getItem('equipment_records');
    return saved ? JSON.parse(saved) : [];
  });
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CTO' | 'MUFA' | 'RESERVA'>('ALL');
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('equipment_records', JSON.stringify(records));
  }, [records]);

  const filteredRecords = records.filter(record => {
    const matchesSearch = record.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'ALL' || record.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    await processFiles(Array.from(files));
  };

  const processFiles = async (files: File[]) => {
    setIsUploading(true);
    setError(null);
    setUploadProgress({ current: 0, total: files.length });

    for (let i = 0; i < files.length; i++) {
      setUploadProgress(prev => ({ ...prev, current: i + 1 }));
      const file = files[i];
      try {
        const base64 = await fileToBase64(file);
        const result = await extractEquipmentData(base64, file.type);
        
        const newRecord: EquipmentRecord = {
          id: crypto.randomUUID(),
          imageUrl: base64,
          code: result.code,
          type: result.type as 'CTO' | 'MUFA' | 'RESERVA',
          coordinates: result.coordinates,
          timestamp: result.timestamp,
          power: result.power,
          extractedAt: new Date().toLocaleString()
        };

        setRecords(prev => [newRecord, ...prev]);
      } catch (err) {
        console.error("Error processing file:", err);
        setError(`Failed to process ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
    
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
    
    const headers = ['ID', 'Code', 'Type', 'Coordinates', 'Timestamp', 'Power', 'Extracted At'];
    const rows = dataToExport.map(r => [
      r.id,
      `"${r.code}"`,
      `"${r.type}"`,
      `"${r.coordinates}"`,
      `"${r.timestamp}"`,
      `"${r.power}"`,
      `"${r.extractedAt}"`
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `equipment_data_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCoordinates = (coordStr: string) => {
    // Handles formats like:
    // "12.11894S 77.02391W"
    // "-12.11894 -77.02391"
    // "12.11894, -77.02391"
    const cleanStr = coordStr.replace(/,/g, ' ').trim();
    const parts = cleanStr.split(/\s+/);
    if (parts.length < 2) return null;

    const parsePart = (part: string, isLat: boolean) => {
      // Check for NSEW suffix
      const match = part.match(/([+-]?[\d.]+)\s*([NSEW])?/i);
      if (!match) return null;

      let val = parseFloat(match[1]);
      const dir = match[2]?.toUpperCase();

      if (dir) {
        if (dir === 'S' || dir === 'W') val = -Math.abs(val);
        if (dir === 'N' || dir === 'E') val = Math.abs(val);
      }
      return val;
    };

    const lat = parsePart(parts[0], true);
    const lon = parsePart(parts[1], false);

    if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) return null;

    return { lat, lon };
  };

  const exportToKML = () => {
    const dataToExport = filteredRecords;
    if (dataToExport.length === 0) return;

    let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Optical Equipment Records - ${new Date().toLocaleDateString()}</name>
    <description>Extracted data from optical equipment photos</description>`;

    dataToExport.forEach(record => {
      const coords = parseCoordinates(record.coordinates);
      if (coords) {
        kmlContent += `
    <Placemark>
      <name>${record.type}: ${record.code}</name>
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
          <p className="text-[11px] uppercase tracking-widest opacity-50 mt-1">Automated Inventory & GPS Logging</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={exportToKML}
            disabled={records.length === 0}
            className="flex items-center gap-2 border border-[#141414] px-4 py-2 text-xs uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Map size={14} />
            Export KML
          </button>
          <button 
            onClick={exportToCSV}
            disabled={records.length === 0}
            className="flex items-center gap-2 border border-[#141414] px-4 py-2 text-xs uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            Export CSV
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-4 py-2 text-xs uppercase tracking-widest hover:bg-opacity-90 transition-colors"
          >
            <Plus size={14} />
            Upload Photo
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
                Analyzing equipment data ({uploadProgress.current} of {uploadProgress.total})...
              </p>
            </div>
          ) : (
            <>
              <Upload size={48} className="mb-4 opacity-20" />
              <p className="font-serif italic text-xl mb-2">Drop equipment photos here</p>
              <p className="text-[11px] uppercase tracking-widest opacity-50">or click to browse files</p>
            </>
          )}
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-lg border border-[#141414] border-opacity-10 shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={16} />
            <input 
              type="text"
              placeholder="Search by serial code..."
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
              <option value="ALL">All Equipment</option>
              <option value="CTO">CTO Only</option>
              <option value="MUFA">MUFA Only</option>
              <option value="RESERVA">RESERVA Only</option>
            </select>
          </div>
        </div>

        {/* Data Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#141414] pb-2">
            <h2 className="font-serif italic text-lg">Extracted Records</h2>
            <div className="flex items-center gap-4">
              { (searchQuery || typeFilter !== 'ALL') && (
                <button 
                  onClick={() => { setSearchQuery(''); setTypeFilter('ALL'); }}
                  className="text-[10px] uppercase tracking-widest text-red-500 hover:underline"
                >
                  Clear Filters
                </button>
              )}
              {records.length > 0 && (
                <button 
                  onClick={() => setShowDeleteAllConfirm(true)}
                  className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                >
                  <Trash2 size={10} />
                  {isFiltered ? 'Delete Filtered' : 'Delete All'}
                </button>
              )}
              <span className="text-[11px] uppercase tracking-widest opacity-50">
                {filteredRecords.length} of {records.length} Entries
              </span>
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="py-20 text-center opacity-30 bg-white rounded-lg border border-dashed border-[#141414] border-opacity-10">
              <p className="font-serif italic">
                {records.length === 0 
                  ? "No records found. Upload a photo to begin." 
                  : "No matches found for your current filters."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-white rounded-lg border border-[#141414] border-opacity-10">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left border-b border-[#141414] border-opacity-10">
                    <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Preview</th>
                    <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Type</th>
                    <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Serial Code</th>
                    <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Potencia</th>
                    <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Coordinates</th>
                    <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Timestamp</th>
                    <th className="p-4 font-serif italic text-[11px] uppercase tracking-widest opacity-50">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
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
                      <td className="p-4 font-mono text-sm tracking-tight">
                        <div className="flex items-center gap-2">
                          <Hash size={12} className="opacity-30 group-hover:opacity-100" />
                          {record.code}
                        </div>
                      </td>
                      <td className="p-4 font-mono text-sm tracking-tight">
                        <div className="flex items-center gap-2">
                          <Zap size={12} className="opacity-30 group-hover:opacity-100" />
                          {record.power}
                        </div>
                      </td>
                      <td className="p-4 font-mono text-sm tracking-tight">
                        <div className="flex items-center gap-2">
                          <MapPin size={12} className="opacity-30 group-hover:opacity-100" />
                          {record.coordinates}
                        </div>
                      </td>
                      <td className="p-4 font-mono text-sm tracking-tight">
                        <div className="flex items-center gap-2">
                          <Calendar size={12} className="opacity-30 group-hover:opacity-100" />
                          {record.timestamp}
                        </div>
                      </td>
                      <td className="p-4">
                        <button 
                          onClick={() => deleteRecord(record.id)}
                          className="p-2 hover:bg-red-500 hover:text-white rounded transition-colors"
                          title="Delete record"
                        >
                          <Trash2 size={16} />
                        </button>
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
                Confirm {isFiltered ? 'Filtered' : 'Total'} Deletion
              </h2>
              <p className="text-sm mb-8 opacity-70 leading-relaxed">
                Are you sure you want to delete <strong>{isFiltered ? `the ${filteredRecords.length} filtered` : `all ${records.length}`} records</strong>? 
                {isFiltered ? ' Other records will be kept.' : ' This action cannot be undone and all extracted data will be lost.'}
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowDeleteAllConfirm(false)}
                  className="flex-1 border border-[#141414] py-3 text-xs uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={deleteFilteredRecords}
                  className="flex-1 bg-red-600 text-white py-3 text-xs uppercase tracking-widest hover:bg-red-700 transition-colors"
                >
                  Yes, Delete {isFiltered ? 'Filtered' : 'All'}
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
