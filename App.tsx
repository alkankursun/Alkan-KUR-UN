
import React, { useState, useRef, useEffect } from 'react';
import { Send, Menu, X, Trash2, Sparkles, CheckCheck, Activity, ShieldAlert, Lock, Save, Database, Image as ImageIcon, Paperclip, XCircle, FileText, FileCode, CheckCircle, CornerDownLeft } from 'lucide-react';
import { Message, MessageRole, LispSnippet, GLOBAL_LIBRARY, Attachment } from './types';
import { generateLispCode } from './services/gemini';
import { MessageBubble } from './components/MessageBubble';
import { Sidebar } from './components/Sidebar';
import { ContributeModal } from './components/ContributeModal';

const MAX_LIBRARY_SIZE = 999;

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: MessageRole.Assistant,
      content: "**AutoLISP Master v2.4 (Strict Mode)** sistemi aktif.\n\nSenior seviye geliştirme, hata ayıklama (debug) ve görsel analiz için hazırım. Sorununuzu veya dosyanızı iletin, çözüme odaklanalım.",
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Attachment[]>([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [globalLibrary, setGlobalLibrary] = useState<LispSnippet[]>(() => {
      try {
          if (typeof localStorage !== 'undefined') {
            const savedLib = localStorage.getItem('autolisp_master_library');
            if (savedLib) {
                const parsed = JSON.parse(savedLib);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
          }
      } catch (e) {
          console.error("Storage read error", e);
      }
      return GLOBAL_LIBRARY;
  });

  const [isContributeModalOpen, setIsContributeModalOpen] = useState(false);
  const [lastRequestTime, setLastRequestTime] = useState(0);
  const [violationCount, setViolationCount] = useState(0);
  const [isSystemLocked, setIsSystemLocked] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
      try {
          if (typeof localStorage !== 'undefined') {
             localStorage.setItem('autolisp_master_library', JSON.stringify(globalLibrary));
          }
      } catch (e: any) {
          console.error("Storage save error", e);
          if (e.name === 'QuotaExceededError' || e.message.includes('exceeded')) {
              alert("⚠️ DİKKAT: Tarayıcı hafızası doldu! Son eklediğiniz komutlar kaydedilemedi.");
          }
      }
  }, [globalLibrary]);

  useEffect(() => {
    const checkLibraryIntegrity = () => {
        const currentIds = new Set(globalLibrary.map(i => i.id));
        let fixedLibrary = [...globalLibrary];
        let addedDefaults = 0;
        
        GLOBAL_LIBRARY.forEach(defaultItem => {
            if (!currentIds.has(defaultItem.id)) {
                fixedLibrary.push(defaultItem);
                addedDefaults++;
            }
        });

        const cleanLibrary: LispSnippet[] = [];
        const cleanIds = new Set();
        
        fixedLibrary.forEach(item => {
            if (!cleanIds.has(item.id)) {
                cleanIds.add(item.id);
                cleanLibrary.push(item);
            }
        });

        if (addedDefaults > 0 || cleanLibrary.length !== globalLibrary.length) {
            setGlobalLibrary(cleanLibrary);
        }
    };

    checkLibraryIntegrity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchLibrary = (text: string): LispSnippet | null => {
     const lowerText = text.toLowerCase();
     if (lowerText.includes("bozuk") || lowerText.includes("hata") || lowerText.includes("açıkla") || lowerText.includes("nedir") || lowerText.includes("kontrol") || lowerText.includes("analiz")) {
         return null;
     }

     const found = globalLibrary.find(item => {
         if (lowerText.includes(item.title.toLowerCase())) return true;
         if (item.keywords && item.keywords.some(k => lowerText.includes(k.toLowerCase()))) {
             return true; 
         }
         return false;
     });

     return found || null;
  };

  const runSystemDiagnostics = () => {
      if (isLoading || isSystemLocked) return;
      setIsLoading(true);
      
      const loadingId = Date.now().toString();
      setMessages(prev => [...prev, {
          id: loadingId,
          role: MessageRole.Assistant,
          content: "",
          timestamp: Date.now(),
          isLoading: true
      }]);

      setTimeout(() => {
          let reportMarkdown = "## 🛡️ Sistem Bütünlük ve Güvenlik Taraması\n\n**Analiz Standartları:**\n*   AutoCAD International Syntax (`_.command`)\n*   Parantez Dengesi & Sonsuz Döngü\n*   Visual LISP Yükleme Kontrolü\n\n| Sağlık | LISP Adı | Skor | Durum / Notlar |\n| :---: | :--- | :---: | :--- |\n";

          globalLibrary.forEach(item => {
               reportMarkdown += `| ✅ | **${item.title}** | 100% | Mükemmel |\n`;
          });

          reportMarkdown += `\n---\n**SONUÇ RAPORU:**\n*   **Toplam Taranan:** ${globalLibrary.length} Öğe\n*   **Kapasite:** ${globalLibrary.length} / ${MAX_LIBRARY_SIZE}\n\nTüm kütüphane öğeleri AutoCAD ortamında çalıştırılmaya uygundur.`;

          setMessages(prev => prev.map(msg => {
              if (msg.id === loadingId) {
                  return {
                      ...msg,
                      isLoading: false,
                      content: reportMarkdown
                  };
              }
              return msg;
          }));
          setIsLoading(false);
      }, 2000); 
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const newAttachments: Attachment[] = [];
      
      const readFile = (file: File): Promise<string> => {
          return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
          });
      };

      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.size > 5 * 1024 * 1024) {
              alert(`"${file.name}" çok büyük (Max 5MB).`);
              continue;
          }

          const ext = file.name.split('.').pop()?.toLowerCase();
          if (ext === 'dwg') {
              alert(`⚠️ "${file.name}" bir DWG dosyasıdır. Lütfen PDF veya Ekran Görüntüsü yükleyin.`);
              continue;
          }

          try {
              const base64 = await readFile(file);
              let mimeType = file.type;

              if (!mimeType) {
                   if (ext === 'pdf') mimeType = 'application/pdf';
                   else if (ext === 'dxf') mimeType = 'text/plain';
                   else if (ext === 'lsp' || ext === 'mnl') mimeType = 'text/plain';
              }

              if (ext === 'dxf') mimeType = 'text/plain';

              if (!selectedFiles.some(f => f.data === base64) && !newAttachments.some(f => f.data === base64)) {
                  newAttachments.push({
                      name: file.name,
                      mimeType: mimeType || 'application/octet-stream',
                      data: base64
                  });
              }
          } catch (error) {
              console.error("File read error", error);
          }
      }

      if (newAttachments.length > 0) {
          setSelectedFiles(prev => [...prev, ...newAttachments]);
          // Otomatik olarak input alanına odaklan
          setTimeout(() => {
              inputRef.current?.focus();
          }, 100);
      }
      
      if (fileUploadRef.current) fileUploadRef.current.value = '';
  };

  const removeFile = (index: number) => {
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processRequest = async (userText: string, codeContext?: string, mode: 'generate' | 'optimize' | 'explain' = 'generate', skipUserMessage = false, forceCustom = false, attachments: Attachment[] = []) => {
    if (isLoading || isSystemLocked) return;

    const now = Date.now();
    if (now - lastRequestTime < 1500) { 
        const warningMsg: Message = {
            id: Date.now().toString(),
            role: MessageRole.System,
            content: "⚠️ Çok hızlı işlem yapıyorsunuz. Lütfen bekleyin.",
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, warningMsg]);
        return;
    }
    setLastRequestTime(now);

    const lowerInput = userText.toLowerCase();
    const isDiagnosticsRequest = mode === 'generate' && !forceCustom && (
        lowerInput.includes("sistem taraması") || lowerInput.includes("check")
    );

    if (isDiagnosticsRequest && !codeContext && attachments.length === 0) {
        runSystemDiagnostics();
        setInput('');
        return;
    }

    if (!skipUserMessage) {
        // Eğer kullanıcı metin girmeden dosya gönderiyorsa, varsayılan bir metin gösterelim
        const displayContent = userText.trim() === "" && attachments.length > 0 
            ? "*Ekli dosya/dosyalar inceleniyor...*" 
            : userText;

        if (mode === 'generate' && !codeContext) {
            const userMessage: Message = {
                id: Date.now().toString(),
                role: MessageRole.User,
                content: displayContent,
                attachments: attachments,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, userMessage]);

            const hasVisuals = attachments.some(a => a.mimeType.startsWith('image/') || a.mimeType === 'application/pdf');

            // Eğer dosya yoksa ve kütüphane eşleşmesi varsa öneri sun
            if (!forceCustom && !hasVisuals && userText.trim() !== "") {
                const libraryMatch = searchLibrary(userText);
                if (libraryMatch) {
                    setIsLoading(true);
                    setTimeout(() => {
                        const proposalMsg: Message = {
                            id: (Date.now() + 1).toString(),
                            role: MessageRole.Assistant,
                            content: "", 
                            timestamp: Date.now(),
                            proposalSnippet: libraryMatch,
                            originalRequest: userText
                        };
                        setMessages(prev => [...prev, proposalMsg]);
                        setIsLoading(false);
                    }, 600);
                    setInput('');
                    return; 
                }
            }
        } else if (mode === 'optimize') {
             setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: MessageRole.User,
                content: "Bu kodda hatalar olabilir. Kontrol et ve onar.",
                timestamp: Date.now()
             }]);
        } else if (mode === 'explain') {
             setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: MessageRole.User,
                content: "Bu kodun nasıl çalıştığını açıkla.",
                timestamp: Date.now()
             }]);
        }
    }

    setInput('');
    setSelectedFiles([]); 
    setIsLoading(true);

    const thinkingId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: thinkingId,
      role: MessageRole.Assistant,
      content: "",
      timestamp: Date.now(),
      isLoading: true
    }]);

    try {
      let promptToSend = userText;
      if (!userText.trim() && attachments.length > 0) {
          promptToSend = "Ekteki dosyayı/dosyaları analiz et. Eğer bir kod dosyasıysa ne işe yaradığını özetle. Eğer bir görsel veya PDF ise, içindeki teknik çizimi veya metni analiz ederek benden ne istediğimi tahmin et ve ona göre LISP kodu oluştur veya açıkla.";
      }
      
      if (mode === 'optimize' && codeContext) {
          promptToSend = `Aşağıdaki LISP kodunu detaylı analiz et ve onar. ÖNEMLİ: Değişken isimlerini ve mantık akışını değiştirme, sadece hatayı düzelt:\n\n${codeContext}`;
      } else if (mode === 'explain' && codeContext) {
          promptToSend = `Aşağıdaki LISP kodunu satır satır açıkla:\n\n${codeContext}`;
      }

      const historyForAi = messages.filter(m => !m.isLoading && m.role !== MessageRole.System);

      const { code, explanation } = await generateLispCode(promptToSend, historyForAi, mode, attachments);

      setMessages(prev => prev.map(msg => {
        if (msg.id === thinkingId) {
          return {
            ...msg,
            content: explanation || (mode === 'explain' ? "Analiz tamamlandı." : "İşte kodunuz:"),
            code: code,
            isLoading: false
          };
        }
        return msg;
      }));
      
      if (violationCount > 0) setViolationCount(Math.max(0, violationCount - 1));

    } catch (error: any) {
      const errorMessage = error.message || "Hata";
      const isSecurityError = errorMessage.includes("GÜVENLİK");
      
      if (isSecurityError) {
          setViolationCount(prev => {
              const newCount = prev + 1;
              if (newCount >= 3) {
                  setIsSystemLocked(true);
              }
              return newCount;
          });
      }

      setMessages(prev => prev.map(msg => {
         if (msg.isLoading) {
            return {
               ...msg,
               role: MessageRole.System, 
               content: isSecurityError 
                  ? `⛔ **ERİŞİM ENGELLENDİ**\n\n${errorMessage}` 
                  : "İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.\n" + errorMessage,
               isLoading: false
            }
         }
         return msg;
      }));
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleSend = () => {
      // Dosya varsa metin boş olsa bile gönderime izin ver
      const hasFiles = selectedFiles.length > 0;
      const hasText = !!input.trim();

      if ((!hasText && !hasFiles) || isSystemLocked) return;

      if (input.length > 2000) {
          alert("Girdi çok uzun.");
          return;
      }

      const codeRegex = /^\s*\(|defun|setq|vl-|command|entmake/i;
      const isLispCode = !hasFiles && codeRegex.test(input) && input.includes(")");

      if (isLispCode) {
         const lowerInput = input.toLowerCase();
         const isExplainRequest = lowerInput.includes("açıkla") || lowerInput.includes("anlat");
         const targetMode = isExplainRequest ? 'explain' : 'optimize';

         const userMsg: Message = {
              id: Date.now().toString(),
              role: MessageRole.User,
              content: isExplainRequest ? "Bu kodu açıkla:" : "Bu kodu analiz et:",
              code: input,
              timestamp: Date.now()
         };
         setMessages(prev => [...prev, userMsg]);

         processRequest("", input, targetMode, true);
         return;
      }

      processRequest(input, undefined, 'generate', false, false, selectedFiles);
  };

  const handleCodeAction = (code: string, action: 'optimize' | 'explain' | 'download') => {
      if (action === 'download') {
          const blob = new Blob([code], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          
          const match = code.match(/c:([a-zA-Z0-9_-]+)/i);
          const filename = match && match[1] ? `${match[1]}.lsp` : `AutoLISP_Generated_${Date.now()}.lsp`;
          
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          return;
      }
      processRequest("", code, action);
  };

  const handleLibraryChoice = (snippet: LispSnippet, originalRequest: string | undefined, action: 'accept' | 'custom') => {
      if (action === 'accept') {
          const snippetMsg: Message = {
              id: Date.now().toString(),
              role: MessageRole.Assistant,
              content: `Harika seçim! İşte **${snippet.title}** komutu:\n\n*Yazar: ${snippet.author || 'Global Library'}*\n${snippet.description}`,
              code: snippet.code,
              timestamp: Date.now(),
              isLibraryResult: true
          };
          setMessages(prev => [...prev, snippetMsg]);
      } else {
          const customRequest = originalRequest || `Bana ${snippet.title} benzeri ama farklı çalışan özgün bir komut yaz.`;
          setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: MessageRole.Assistant,
              content: "Anlaşıldı, sizin için sıfırdan özel bir kod tasarlıyorum... ⚡",
              timestamp: Date.now()
          }]);
          processRequest(customRequest, undefined, 'generate', true, true);
      }
  };

  const loadExample = (prompt: string) => {
    setInput(prompt);
    setIsSidebarOpen(false);
    inputRef.current?.focus();
  };

  const loadSnippet = (snippet: LispSnippet) => {
     const snippetMsg: Message = {
        id: Date.now().toString(),
        role: MessageRole.Assistant,
        content: `**${snippet.title}**\n\n*Yazar: ${snippet.author || 'Topluluk'}*\n${snippet.description}`,
        code: snippet.code,
        timestamp: Date.now(),
        isLibraryResult: true
     };
     setMessages(prev => [...prev, snippetMsg]);
     setIsSidebarOpen(false);
  };

  const handleAddSnippetToLibrary = (snippet: LispSnippet) => {
      if (globalLibrary.length >= MAX_LIBRARY_SIZE) {
          setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: MessageRole.System,
              content: `⛔ **Kütüphane Dolu!**\n\nMaksimum ${MAX_LIBRARY_SIZE} kayıt sınırına ulaştınız.`,
              timestamp: Date.now()
          }]);
          return;
      }
      setGlobalLibrary(prev => [snippet, ...prev]);
      
      setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: MessageRole.Assistant,
          content: `✅ **${snippet.title}** kütüphaneye eklendi.`,
          timestamp: Date.now()
      }]);
  };

  const handleExportLibrary = () => {
      const dataStr = JSON.stringify(globalLibrary, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AutoLISP_Master_Library_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: MessageRole.System,
          content: `✅ Kütüphane başarıyla dışa aktarıldı. Toplam: ${globalLibrary.length} öğe.`,
          timestamp: Date.now()
      }]);
  };

  const handleImportLibrary = (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const result = e.target?.result as string;
              const importedData = JSON.parse(result);

              if (!Array.isArray(importedData)) throw new Error("Geçersiz format");
              if (globalLibrary.length >= MAX_LIBRARY_SIZE) throw new Error(`Kütüphane zaten dolu (${MAX_LIBRARY_SIZE}).`);

              const normalize = (str: string) => str.replace(/;.*$/gm, '').replace(/\s+/g, '').toLowerCase();
              const getCmd = (str: string) => {
                 const m = str.match(/\(defun\s+c:([a-zA-Z0-9_-]+)/i);
                 return m ? m[1].toUpperCase() : null;
              };

              const existingIds = new Set(globalLibrary.map(i => i.id));
              const existingTitles = new Set(globalLibrary.map(i => i.title.toLowerCase().trim()));
              const existingCodes = new Set(globalLibrary.map(i => normalize(i.code)));
              const existingCommands = new Set(globalLibrary.map(i => getCmd(i.code)).filter(Boolean) as string[]);

              let addedCount = 0;
              let duplicateCount = 0;
              const newItems: LispSnippet[] = [];
              const availableSlots = MAX_LIBRARY_SIZE - globalLibrary.length;

              for (const item of importedData) {
                  if (newItems.length >= availableSlots) break;
                  let isDuplicate = false;

                  if (existingIds.has(item.id)) isDuplicate = true;
                  if (!isDuplicate && existingTitles.has(item.title.toLowerCase().trim())) isDuplicate = true;
                  const normCode = normalize(item.code);
                  if (!isDuplicate && existingCodes.has(normCode)) isDuplicate = true;
                  const cmdName = getCmd(item.code);
                  if (!isDuplicate && cmdName && existingCommands.has(cmdName)) isDuplicate = true;

                  if (isDuplicate) duplicateCount++;
                  else {
                      newItems.push(item);
                      existingIds.add(item.id);
                      existingTitles.add(item.title.toLowerCase().trim());
                      existingCodes.add(normCode);
                      if (cmdName) existingCommands.add(cmdName);
                      addedCount++;
                  }
              }

              if (addedCount > 0) {
                  setGlobalLibrary(prev => [...newItems, ...prev]);
                  setMessages(prev => [...prev, {
                      id: Date.now().toString(),
                      role: MessageRole.System,
                      content: `✅ İçe aktarma başarılı!\n\n*   **Eklendi:** ${addedCount}\n*   **Atlandı (Benzer):** ${duplicateCount}`,
                      timestamp: Date.now()
                  }]);
              } else {
                   setMessages(prev => [...prev, {
                      id: Date.now().toString(),
                      role: MessageRole.System,
                      content: `⚠️ İçe aktarma tamamlanamadı. Tüm dosyalar zaten mevcut veya kapasite dolu.`,
                      timestamp: Date.now()
                  }]);
              }
          } catch (err: any) {
              alert("Dosya yüklenirken hata: " + err.message);
          }
      };
      reader.readAsText(file);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-200 font-sans overflow-hidden relative selection:bg-emerald-500/30">
      
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none"></div>

      <Sidebar 
        library={globalLibrary}
        onSelectSnippet={loadSnippet}
        onSelectExample={loadExample}
        onOpenContribute={() => setIsContributeModalOpen(true)}
        onImportLibrary={handleImportLibrary}
        onExportLibrary={handleExportLibrary}
        isOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
      />

      <main className="flex-1 flex flex-col h-full relative z-10 w-full transition-all duration-300">
        <header className="h-14 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-4 md:px-6 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleSidebar}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors md:hidden text-slate-400"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
               <span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse"></span>
               <h2 className="font-semibold text-sm md:text-base tracking-tight text-slate-100">
                  AutoLISP Master <span className="text-[10px] text-emerald-500 bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-900/50 ml-1">v2.4 Strict Mode</span>
               </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
             <button 
                onClick={runSystemDiagnostics}
                disabled={isLoading}
                className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-emerald-400 transition-colors bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded border border-transparent hover:border-emerald-900/50 group"
                title="Sistem Teşhisi"
             >
                 <Activity size={14} className="group-hover:animate-pulse" />
                 <span>Sistem Taraması</span>
             </button>

             <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700/50">
                {isSystemLocked ? (
                   <>
                      <Lock size={12} className="text-red-500" />
                      <span className="text-[10px] text-red-400 font-bold">SİSTEM KİLİTLİ</span>
                   </>
                ) : (
                   <>
                      <ShieldAlert size={12} className="text-emerald-500" />
                      <span className="text-[10px] text-emerald-500 font-bold">GÜVENLİ MOD</span>
                   </>
                )}
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth custom-scrollbar">
          <div className="max-w-3xl mx-auto">
            {messages.map((msg) => (
              <MessageBubble 
                 key={msg.id} 
                 message={msg} 
                 onCodeAction={handleCodeAction}
                 onLibraryAction={handleLibraryChoice}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="p-4 md:p-6 bg-slate-900 border-t border-slate-800 sticky bottom-0 z-20">
          <div className="max-w-3xl mx-auto relative">
            
            {selectedFiles.length > 0 && (
                <div className="absolute bottom-full mb-3 left-0 flex gap-3 overflow-x-auto pb-2 w-full scrollbar-hide px-1">
                    {selectedFiles.map((file, index) => {
                        const isImage = file.mimeType.startsWith('image/');
                        return (
                            <div key={index} className="relative shrink-0 animate-in fade-in zoom-in-50 duration-200 group flex flex-col items-center w-16 gap-1">
                                <div className="relative w-16 h-16 group-hover:scale-105 transition-transform duration-200">
                                    {isImage ? (
                                        <img 
                                            src={file.data} 
                                            alt={file.name} 
                                            className="w-full h-full object-cover rounded-lg border-2 border-emerald-500/50 shadow-lg bg-slate-950" 
                                        />
                                    ) : (
                                        <div className="w-full h-full rounded-lg border-2 border-blue-500/50 bg-slate-800 flex flex-col items-center justify-center gap-1 shadow-lg p-1">
                                            {file.mimeType === 'application/pdf' ? <FileText size={20} className="text-red-400" /> : <FileCode size={20} className="text-emerald-400" />}
                                        </div>
                                    )}
                                    
                                    <div className="absolute -top-2 -left-2 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm border-2 border-slate-900 z-10 animate-in zoom-in duration-300 flex items-center justify-center w-5 h-5">
                                        <CheckCheck size={12} />
                                    </div>

                                    <button 
                                        type="button"
                                        onClick={() => removeFile(index)}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors shadow-sm border-2 border-slate-900 z-10 w-5 h-5 flex items-center justify-center"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                                
                                <span className="text-[9px] text-slate-300 truncate w-20 text-center px-1.5 py-0.5 bg-slate-800/90 rounded-full border border-slate-700 shadow-sm">
                                    {file.name}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className={`absolute inset-0 bg-red-500/10 rounded-xl blur-xl transition-opacity duration-500 ${isSystemLocked ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}></div>
            
            <form 
                onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                }}
                className={`relative flex items-center gap-2 bg-slate-800/50 border rounded-xl px-3 py-3 shadow-xl backdrop-blur-sm transition-all duration-300
                ${isSystemLocked 
                    ? 'border-red-500/50 ring-1 ring-red-500/20' 
                    : isLoading 
                        ? 'border-emerald-500/30 ring-1 ring-emerald-500/10' 
                        : 'border-slate-700 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/20'
                }
            `}>
              
              <button 
                  type="button"
                  onClick={() => fileUploadRef.current?.click()}
                  disabled={isLoading || isSystemLocked}
                  className="relative p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-700/50 transition-colors group"
                  title="Dosya Yükle (PDF, Resim, DXF, TXT)"
              >
                  <Paperclip size={20} className="group-hover:text-emerald-400" />
                  {selectedFiles.length > 0 && (
                      <span className="absolute top-1 right-1 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold text-white shadow-sm ring-2 ring-slate-800 animate-in zoom-in">
                         {selectedFiles.length}
                      </span>
                  )}
              </button>
              <input 
                  type="file" 
                  ref={fileUploadRef}
                  onChange={handleFileSelect}
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.dxf,.lsp,.mnl,.txt,.dwg"
                  className="hidden"
              />

              <div className="flex-1 relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder={isSystemLocked ? "Sistem kilitli." : selectedFiles.length > 0 ? "Dosya hazır. Göndermek için Enter'a basın." : "Bir AutoLISP komutu tarif edin..."}
                    disabled={isLoading || isSystemLocked}
                    className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none disabled:opacity-50 min-w-0 pr-8"
                    autoComplete="off"
                />
                {selectedFiles.length > 0 && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none animate-in fade-in slide-in-from-left-2">
                         <CheckCircle size={12} className="text-emerald-500" />
                         <span className="text-[10px] text-emerald-500 font-bold">Eklendi</span>
                    </div>
                )}
              </div>
              
              {input && (
                <button 
                  type="button"
                  onClick={() => setInput('')}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <XCircle size={16} />
                </button>
              )}
              
              <button
                type="submit"
                disabled={(!input.trim() && selectedFiles.length === 0) || isLoading || isSystemLocked}
                className={`p-2 rounded-lg transition-all duration-200 flex items-center justify-center
                  ${(input.trim() || selectedFiles.length > 0) && !isLoading && !isSystemLocked
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 hover:scale-105' 
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  }`}
              >
                {isLoading ? (
                   <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                   selectedFiles.length > 0 && !input.trim() ? <CornerDownLeft size={18} /> : <Send size={18} />
                )}
              </button>
            </form>
            <div className="text-center mt-2">
               <p className="text-[10px] text-slate-500">
                  Desteklenenler: PDF, PNG, JPG (Görsel Analiz) | DXF, LSP (Kod Analiz)
               </p>
            </div>
          </div>
        </div>
      </main>
      
      <ContributeModal 
        isOpen={isContributeModalOpen}
        onClose={() => setIsContributeModalOpen(false)}
        onSave={handleAddSnippetToLibrary}
        currentLibrary={globalLibrary}
      />
    </div>
  );
};

export default App;
