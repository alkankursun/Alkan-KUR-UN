
import React, { useState, useRef } from 'react';
import { X, Upload, Play, CheckCircle, AlertCircle, FileText, Loader2, ShieldAlert, Info, FileCode, Lock, RefreshCw } from 'lucide-react';
import { analyzeSubmittedCode } from '../services/gemini';
import { LispSnippet } from '../types';

interface ContributeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (snippet: LispSnippet) => void;
  currentLibrary: LispSnippet[];
}

export const ContributeModal: React.FC<ContributeModalProps> = ({ isOpen, onClose, onSave, currentLibrary }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [rawCode, setRawCode] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<LispSnippet | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showFileInfo, setShowFileInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security Constants
  const MAX_FILE_SIZE_BYTES = 50 * 1024; // 50KB Limit (LISP files are text, usually small)

  if (!isOpen) return null;

  const processFile = (file: File) => {
    // Security Check: File Size
    if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(`Güvenlik Uyarısı: Dosya boyutu çok büyük (${(file.size/1024).toFixed(1)}KB). Maksimum ${MAX_FILE_SIZE_BYTES/1024}KB yükleyebilirsiniz.`);
        return;
    }

    // Security Check: File Extension
    const fileName = file.name.toLowerCase();
    const validExtensions = ['.lsp', '.txt', '.mnl', '.scr', '.fas', '.vlx']; // Added .fas/.vlx to catch them and warn specifically
    
    // Check if extension is valid
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));

    if (!hasValidExtension) {
        setError(`Desteklenmeyen dosya türü: "${file.name}".\nLütfen sadece .lsp, .mnl, .scr veya .txt uzantılı kaynak kod dosyaları yükleyin.`);
        return;
    }

    // Reject compiled LISP specifically
    if (fileName.endsWith('.fas') || fileName.endsWith('.vlx')) {
        setError(`"${file.name}" derlenmiş (compiled) bir dosyadır ve metin olarak okunamaz.\nLütfen açık kaynak kodlu (.lsp) versiyonunu yükleyin.`);
        return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const content = event.target.result as string;
        // Basic check for binary content
        if (content.includes('\0')) {
             setError("Dosya ikili (binary) veri içeriyor ve okunamıyor. Lütfen düz metin dosyası yükleyin.");
             return;
        }
        setRawCode(content);
      }
    };
    reader.onerror = () => {
        setError("Dosya okunurken bir hata oluştu.");
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
  };

  const normalizeCode = (code: string) => {
      return code.replace(/\s+/g, '').toLowerCase();
  };

  const handleAnalyze = async () => {
    if (!rawCode.trim()) {
        setError("Lütfen kod giriniz. / Please enter code.");
        return;
    }
    // Basic Input Sanitization
    if (rawCode.length > 20000) {
        setError("Kod bloğu çok uzun. Lütfen daha kısa bir parça deneyin.");
        return;
    }

    if (!authorName.trim()) {
        setError("Yazar adı gerekli. / Author name required.");
        return;
    }

    setIsAnalyzing(true);
    setError(null);
    setDuplicateWarning(null);

    try {
      const result = await analyzeSubmittedCode(rawCode);
      if (result.error) {
          throw new Error(result.error); // This catches the security error from backend
      }

      // DUPLICATE CHECK LOGIC
      const incomingCodeNorm = normalizeCode(result.cleanedCode);
      const foundDuplicate = currentLibrary.find(existing => {
          const titleMatch = existing.title.toLowerCase() === result.title.toLowerCase();
          const codeMatch = normalizeCode(existing.code) === incomingCodeNorm;
          return titleMatch || codeMatch;
      });

      if (foundDuplicate) {
          setDuplicateWarning(foundDuplicate);
          setAnalysisResult(result); 
          setStep(2);
          return;
      }

      setAnalysisResult(result);
      setStep(2);
    } catch (err: any) {
      const msg = err.message || "Bilinmeyen hata. / Unknown error.";
      setError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFinalSave = () => {
      if (!analysisResult || duplicateWarning) return;

      const newSnippet: LispSnippet = {
          id: Date.now().toString(),
          title: analysisResult.title,
          description: analysisResult.description,
          code: analysisResult.cleanedCode,
          category: analysisResult.category,
          keywords: analysisResult.keywords,
          author: authorName,
          downloads: 0,
          likes: 0
      };

      onSave(newSnippet);
      onClose();
      setStep(1);
      setRawCode("");
      setAnalysisResult(null);
      setDuplicateWarning(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Upload size={20} className="text-emerald-500" />
              Global Kütüphaneye Katkıda Bulun
            </h2>
            <p className="text-xs text-slate-400 mt-1">Sadece güvenli ve onaylanmış LISP kodları kabul edilir.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 relative">
          
          {step === 1 && (
            <div className="space-y-6">
              
              {/* File Type Info Toggle */}
              <button 
                onClick={() => setShowFileInfo(!showFileInfo)}
                className="flex items-center gap-2 text-[10px] text-blue-400 hover:text-blue-300 bg-blue-900/20 px-3 py-2 rounded-lg border border-blue-800/30 w-full transition-colors"
              >
                <Info size={14} />
                <span>Hangi dosyalar yüklenebilir? (.LSP vs .FAS/.VLX farkı nedir?)</span>
              </button>

              {showFileInfo && (
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg text-[10px] text-slate-400 space-y-3 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-start gap-3">
                          <FileCode size={16} className="text-emerald-500 shrink-0" />
                          <div>
                              <strong className="text-emerald-400 block mb-1">✅ .LSP (AutoLISP Source) - Kabul Edilir</strong>
                              <p>Açık kaynak kodlu metin dosyalarıdır. Yapay zeka içeriğini okuyabilir, analiz edebilir ve güvenliğini doğrulayabilir.</p>
                          </div>
                      </div>
                      <div className="flex items-start gap-3">
                          <Lock size={16} className="text-red-500 shrink-0" />
                          <div>
                              <strong className="text-red-400 block mb-1">❌ .FAS / .VLX (Compiled) - Reddedilir</strong>
                              <p>Bunlar şifrelenmiş (derlenmiş) dosyalardır. "Decompile" (Tersine mühendislik) yapılmaya çalışılsa bile orijinal değişken isimleri ve yorumlar kaybolur, ortaya "Spagetti Kod" çıkar. Bu yüzden güvenlik riski taşırlar ve sisteme kabul edilmezler.</p>
                          </div>
                      </div>
                      <div className="flex items-start gap-3">
                           <RefreshCw size={16} className="text-amber-500 shrink-0" />
                           <div>
                               <strong className="text-amber-400 block mb-1">⚠️ Geri Dönüşüm İmkansızlığı</strong>
                               <p>Kodu FAS'a çevirmek, yumurtadan kek yapmaya benzer. Keki tekrar yumurtaya çeviremezsiniz. Orijinal kaynak kodu (.lsp) olmadan düzenleme yapılamaz.</p>
                           </div>
                      </div>
                  </div>
              )}
              
              {/* File Upload Area */}
              <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer group relative
                    ${isDragging 
                        ? 'border-emerald-500 bg-emerald-900/20 scale-[1.02]' 
                        : 'border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800/50'
                    }
                `}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className={`bg-slate-800 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 transition-transform ${!isDragging && 'group-hover:scale-110'}`}>
                    <FileText size={32} className={isDragging ? "text-white" : "text-emerald-500"} />
                </div>
                <p className="text-slate-300 font-medium mb-1">
                    {isDragging ? 'Dosyayı Buraya Bırakın' : 'Dosya Seç veya Sürükle (Max 50KB)'}
                </p>
                <p className="text-xs text-slate-500">Desteklenenler: .lsp, .mnl, .scr, .txt</p>
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".lsp,.txt,.mnl,.scr"
                    className="hidden"
                />
              </div>

              <div className="flex items-center gap-4">
                  <div className="h-px bg-slate-800 flex-1"></div>
                  <span className="text-xs text-slate-500 font-bold uppercase">VEYA Kodu Yapıştır</span>
                  <div className="h-px bg-slate-800 flex-1"></div>
              </div>

              {/* Text Area */}
              <textarea
                value={rawCode}
                onChange={(e) => setRawCode(e.target.value)}
                placeholder="(defun c:MyCommand ()...)"
                className="w-full h-40 bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-300 focus:border-emerald-500/50 focus:outline-none"
                maxLength={20000}
              />

              {/* Author Input */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">Yazar Adı / Takma Ad</label>
                <input 
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Örn: Ahmet Yılmaz"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                />
              </div>

              {/* ERROR & GUIDANCE PANEL */}
              {error && (
                <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-start gap-3">
                        <div className="bg-red-900/20 p-2 rounded-full">
                            <ShieldAlert size={20} className="text-red-500" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-red-400 font-bold text-sm mb-1">Dosya/Analiz Hatası</h4>
                            <p className="text-red-300/80 text-xs mb-3 whitespace-pre-line">{error}</p>
                            
                            <div className="grid grid-cols-1 gap-4 bg-red-950/40 rounded-lg p-3 border border-red-900/30">
                                <div>
                                    <span className="text-[10px] text-red-400 font-bold uppercase block mb-1 border-b border-red-900/50 pb-1">
                                        Kabul Edilen Formatlar
                                    </span>
                                    <ul className="text-[10px] text-red-200/60 space-y-1 list-disc list-inside">
                                        <li>Kaynak Kod: <strong>.lsp, .mnl, .scr, .txt</strong></li>
                                        <li>Derlenmiş (FAS/VLX) dosyalar güvenlik gereği okunamaz.</li>
                                        <li>Dosya boyutu 50KB altında olmalıdır.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
              )}

            </div>
          )}

          {step === 2 && analysisResult && (
             <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                {duplicateWarning ? (
                   <div className="bg-amber-900/20 border border-amber-700/50 p-4 rounded-xl flex flex-col gap-3">
                       <div className="flex items-center gap-3">
                           <AlertCircle size={24} className="text-amber-500" />
                           <div>
                               <h3 className="text-amber-400 font-bold text-sm">Benzer Kayıt Bulundu</h3>
                               <p className="text-xs text-amber-200/70 mt-1">Bu LISP komutu zaten kütüphanemizde mevcut görünüyor.</p>
                           </div>
                       </div>
                       <div className="bg-slate-950/50 p-3 rounded border border-amber-900/30 flex items-center justify-between">
                           <span className="text-xs text-slate-400">Mevcut Kayıt:</span>
                           <span className="text-sm font-bold text-white">{duplicateWarning.title}</span>
                           <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400">Yazar: {duplicateWarning.author || 'Bilinmiyor'}</span>
                       </div>
                   </div>
                ) : (
                   <div className="bg-emerald-900/20 border border-emerald-900/50 p-4 rounded-xl flex items-start gap-3">
                       <CheckCircle size={20} className="text-emerald-500 mt-0.5" />
                       <div>
                           <h3 className="text-emerald-400 font-bold text-sm">Güvenlik Taraması Başarılı</h3>
                           <p className="text-xs text-emerald-200/70 mt-1">Kod güvenli bulundu ve optimize edildi.</p>
                       </div>
                   </div>
                )}

                <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${duplicateWarning ? 'opacity-50 grayscale' : ''}`}>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Başlık</span>
                        <div className="text-white text-sm font-medium">{analysisResult.title}</div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Kategori</span>
                        <div className="text-emerald-400 text-sm font-mono bg-emerald-950/30 inline-block px-2 py-0.5 rounded">{analysisResult.category}</div>
                    </div>
                </div>

                <div className={`bg-slate-950 p-3 rounded-lg border border-slate-800 ${duplicateWarning ? 'opacity-50 grayscale' : ''}`}>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Açıklama</span>
                    <div className="text-slate-300 text-sm">{analysisResult.description}</div>
                </div>

                
                <div className="border border-slate-800 rounded-lg overflow-hidden">
                    <div className="bg-slate-950 px-3 py-2 border-b border-slate-800 text-xs text-slate-500 font-mono">Optimize Edilmiş Kod Önizleme</div>
                    <pre className="bg-[#0d1117] p-3 text-[10px] text-slate-400 font-mono h-32 overflow-y-auto">
                        {analysisResult.cleanedCode}
                    </pre>
                </div>
             </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-800/50 rounded-b-2xl flex justify-end gap-3">
          {step === 1 ? (
              <button 
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/20"
              >
                {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                {isAnalyzing ? 'Analiz Et ve Devam Et' : 'Analiz Et ve Devam Et'}
              </button>
          ) : (
              <>
                <button 
                    onClick={() => {
                        setStep(1);
                        setDuplicateWarning(null);
                    }}
                    className="text-slate-400 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                    Geri Dön
                </button>
                <button 
                    onClick={handleFinalSave}
                    disabled={!!duplicateWarning}
                    className={`px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg
                        ${duplicateWarning 
                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'
                        }`}
                >
                    {duplicateWarning ? <X size={18} /> : <CheckCircle size={18} />}
                    {duplicateWarning ? 'Eklenemez' : 'Kütüphaneye Ekle'}
                </button>
              </>
          )}
        </div>

      </div>
    </div>
  );
};
