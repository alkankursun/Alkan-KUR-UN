
import React, { useState, useRef } from 'react';
import { Book, Terminal, Code2, ChevronRight, ChevronDown, Cpu, Search, Layers, Calculator, Type, Box, PenTool, UploadCloud, User, Download, Grid, Database, Save, Upload } from 'lucide-react';
import { LispSnippet } from '../types';

interface SidebarProps {
  library: LispSnippet[];
  onSelectSnippet: (snippet: LispSnippet) => void;
  onSelectExample: (prompt: string) => void;
  onOpenContribute: () => void;
  onImportLibrary: (file: File) => void;
  onExportLibrary: () => void;
  isOpen: boolean;
  toggleSidebar: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ library, onSelectSnippet, onSelectExample, onOpenContribute, onImportLibrary, onExportLibrary, isOpen, toggleSidebar }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleCategory = (catId: string) => {
      setCollapsedCategories(prev => ({
          ...prev,
          [catId]: !prev[catId]
      }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          onImportLibrary(file);
          // Reset input value to allow same file selection again
          e.target.value = "";
      }
  };

  const categories = [
    { id: 'calculation', label: 'Hesaplama', icon: <Calculator size={14} /> },
    { id: 'modification', label: 'Düzenleme', icon: <PenTool size={14} /> },
    { id: 'text', label: 'Yazı & Not', icon: <Type size={14} /> },
    { id: 'layers', label: 'Layerlar', icon: <Layers size={14} /> },
    { id: 'blocks', label: 'Bloklar', icon: <Box size={14} /> },
    { id: 'other', label: 'Diğer Araçlar', icon: <Grid size={14} /> },
  ];

  const filteredLibrary = library.filter(item => 
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.keywords?.some(k => k.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Internal example prompts
  const examplePrompts = [
    "Tüm layerları '0' yap ve purge et",
    "Seçilen çizgilerin toplam uzunluğunu hesapla",
    "Layer isminde 'DUVAR' geçen objeleri seç",
    "Seçilen text objelerine önek (prefix) ekle",
    "Otomatik artan numaralandırma komutu yaz"
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm"
          onClick={toggleSidebar}
        />
      )}

      <aside className={`
        fixed top-0 left-0 h-full w-72 bg-slate-900 border-r border-slate-700 z-30 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:relative flex flex-col
      `}>
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-lg shadow-lg shadow-emerald-900/20">
            <Cpu size={24} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white tracking-tight">AutoLISP Gen</h1>
            <p className="text-xs text-slate-400">AI Powered CAD Tools</p>
          </div>
        </div>

        {/* Search Box */}
        <div className="px-3 pt-4 pb-2">
            <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                <input 
                    type="text" 
                    placeholder="Kütüphanede ara..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
                {searchTerm && (
                    <div className="absolute right-3 top-2.5 text-[10px] text-slate-500">
                        {filteredLibrary.length} sonuç
                    </div>
                )}
            </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-3 space-y-6 custom-scrollbar">
          
          {/* Contribute Button */}
          <div className="px-2">
             <button 
                onClick={onOpenContribute}
                className="w-full bg-gradient-to-r from-blue-900/40 to-slate-800 border border-blue-800/50 hover:border-blue-500/50 rounded-lg px-4 py-3 flex items-center justify-center gap-2 group transition-all shadow-lg shadow-blue-900/10"
             >
                 <UploadCloud size={16} className="text-blue-400 group-hover:text-blue-300" />
                 <span className="text-xs font-bold text-blue-200 group-hover:text-white">LISP Paylaş / Yükle</span>
             </button>
          </div>

          {/* Global Library Render */}
          <div>
            <h3 className="px-2 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-2"><Book size={14} /> Global Kütüphane</span>
              <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[10px]">{filteredLibrary.length}</span>
            </h3>
            
            {filteredLibrary.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-800 rounded-lg mx-2">
                    <p className="text-xs text-slate-500">Aradığınız kriterde LISP bulunamadı.</p>
                    <button onClick={() => setSearchTerm('')} className="text-[10px] text-blue-400 hover:underline mt-2">Filtreyi Temizle</button>
                </div>
            ) : (
                <div className="space-y-2">
                   {/* Group by Categories logic */}
                   {categories.map(cat => {
                       const items = filteredLibrary.filter(l => l.category === cat.id);
                       if (items.length === 0) return null;
                       
                       const isCollapsed = collapsedCategories[cat.id];

                       return (
                           <div key={cat.id} className="space-y-1">
                               <button 
                                    onClick={() => toggleCategory(cat.id)}
                                    className="w-full flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase px-2 py-1.5 hover:bg-slate-800/50 rounded cursor-pointer transition-colors"
                               >
                                   <span className="flex items-center gap-1.5">
                                       {cat.icon} {cat.label} <span className="text-slate-600">({items.length})</span>
                                   </span>
                                   {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                               </button>
                               
                               {!isCollapsed && (
                                   <div className="space-y-1 animate-in slide-in-from-top-1 duration-200">
                                       {items.map(snippet => (
                                           <button
                                              key={snippet.id}
                                              onClick={() => onSelectSnippet(snippet)}
                                              className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-all group border border-transparent hover:border-slate-700 flex flex-col gap-1"
                                            >
                                              <div className="flex items-center justify-between w-full">
                                                <span className="font-medium text-xs">{snippet.title}</span>
                                                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 text-slate-500 transition-opacity" />
                                              </div>
                                              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                                                 {snippet.author && (
                                                     <span className="flex items-center gap-1 truncate max-w-[90px]">
                                                         <User size={10} /> {snippet.author}
                                                     </span>
                                                 )}
                                                 {snippet.downloads ? (
                                                     <span className="flex items-center gap-1">
                                                         <Download size={10} /> {snippet.downloads > 1000 ? (snippet.downloads/1000).toFixed(1) + 'k' : snippet.downloads}
                                                     </span>
                                                 ) : null}
                                              </div>
                                            </button>
                                       ))}
                                   </div>
                               )}
                           </div>
                       )
                   })}
                   
                   {/* Uncategorized - Fallback for items with no matching category in the list */}
                   {filteredLibrary.some(l => !categories.some(c => c.id === l.category)) && (
                       <div className="space-y-1 mt-2 pt-2 border-t border-slate-800/50">
                           <h4 className="text-[10px] text-slate-500 font-bold uppercase px-2 mb-1">Diğer (Sınıflandırılmamış)</h4>
                           {filteredLibrary.filter(l => !categories.some(c => c.id === l.category)).map(snippet => (
                               <button
                                  key={snippet.id}
                                  onClick={() => onSelectSnippet(snippet)}
                                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-all group border border-transparent hover:border-slate-700"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-xs">{snippet.title}</span>
                                  </div>
                                </button>
                           ))}
                       </div>
                   )}
                </div>
            )}
          </div>

          {/* Example Prompts */}
          {!searchTerm && (
            <div>
                <h3 className="px-2 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Terminal size={14} />
                Hızlı İstek
                </h3>
                <div className="space-y-2">
                {examplePrompts.map((prompt, idx) => (
                    <button
                    key={idx}
                    onClick={() => onSelectExample(prompt)}
                    className="w-full text-left px-3 py-2 rounded-md text-xs text-slate-400 hover:bg-slate-800 hover:text-emerald-400 transition-colors border border-slate-800 hover:border-emerald-900/50"
                    >
                    "{prompt}"
                    </button>
                ))}
                </div>
            </div>
          )}

          {/* Data Management & Info */}
          <div className="space-y-3 pb-6">
              <div className="px-2">
                 <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 flex items-center gap-2 mb-2 border-b border-slate-700 pb-1">
                       <Database size={12} /> Veri Tabanı Yönetimi
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={onExportLibrary}
                            className="flex flex-col items-center justify-center gap-1 bg-slate-900 hover:bg-slate-700 p-2 rounded-lg border border-slate-800 hover:border-emerald-500/30 transition-all text-[10px] text-slate-300 hover:text-emerald-400"
                            title="Kütüphaneyi JSON olarak indir"
                        >
                            <Save size={14} />
                            <span>Dışa Aktar (Yedekle)</span>
                        </button>
                        
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex flex-col items-center justify-center gap-1 bg-slate-900 hover:bg-slate-700 p-2 rounded-lg border border-slate-800 hover:border-blue-500/30 transition-all text-[10px] text-slate-300 hover:text-blue-400"
                            title="JSON dosyasından kütüphane yükle"
                        >
                            <Upload size={14} />
                            <span>İçe Aktar (Yükle)</span>
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".json"
                            className="hidden"
                        />
                    </div>
                 </div>
              </div>

              {/* Info Box */}
              <div className="px-2">
                 <div className="bg-blue-900/20 border border-blue-800/50 rounded-xl p-3">
                    <h4 className="text-xs font-bold text-blue-400 mb-1 flex items-center gap-1">
                       <Code2 size={12} /> Nasıl Yüklenir?
                    </h4>
                    <p className="text-[10px] text-blue-200/70 leading-relaxed">
                       Kodu <code>.lsp</code> uzantısıyla kaydedin. AutoCAD içine sürükleyip bırakın veya <code>APPLOAD</code> komutunu kullanın.
                    </p>
                 </div>
              </div>
          </div>

        </div>
      </aside>
    </>
  );
};
