

import React, { useState, useRef, useEffect } from 'react';
import { Send, Menu, X, Trash2, Sparkles, CheckCheck, Activity, ShieldAlert, Lock, Save, Database } from 'lucide-react';
import { Message, MessageRole, LispSnippet, GLOBAL_LIBRARY } from './types';
import { generateLispCode } from './services/gemini';
import { MessageBubble } from './components/MessageBubble';
import { Sidebar } from './components/Sidebar';
import { ContributeModal } from './components/ContributeModal';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: MessageRole.Assistant,
      content: "Merhaba! Ben AutoLISP asistanınız. \n\n**Sadece AutoCAD LISP geliştirme** üzerine özelleştim. Güvenlik protokollerim gereği AutoCAD dışındaki konulara cevap veremiyorum.\n\n*   İstediğiniz bir **komutu yazabilirim**.\n*   **Visual LISP (vlax)** teknikleri ile performanslı kodlar üretebilirim.\n*   Kendi **Global Kütüphanemden** hazır kodlar önerebilirim.\n*   Çalışmayan bozuk kodları **onarabilirim**.",
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // PERSISTENCE LAYER: Initialize from LocalStorage if available, else use Default
  const [globalLibrary, setGlobalLibrary] = useState<LispSnippet[]>(() => {
      try {
          const savedLib = localStorage.getItem('autolisp_master_library');
          if (savedLib) {
              return JSON.parse(savedLib);
          }
      } catch (e) {
          console.error("Storage read error", e);
      }
      return GLOBAL_LIBRARY;
  });

  const [isContributeModalOpen, setIsContributeModalOpen] = useState(false);
  
  // Security & Rate Limiting States
  const [lastRequestTime, setLastRequestTime] = useState(0);
  const [violationCount, setViolationCount] = useState(0);
  const [isSystemLocked, setIsSystemLocked] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // PERSISTENCE: Save to LocalStorage whenever library changes
  useEffect(() => {
      try {
          localStorage.setItem('autolisp_master_library', JSON.stringify(globalLibrary));
      } catch (e) {
          console.error("Storage save error", e);
      }
  }, [globalLibrary]);

  // Integrity Check on Mount
  useEffect(() => {
    const checkLibraryIntegrity = () => {
        const seenIds = new Set();
        const uniqueLibrary: LispSnippet[] = [];
        let duplicatesFound = 0;

        // Prioritize user added items (which are usually at the top if prepended)
        // But we need to ensure we don't lose base items if user corrupted storage
        
        // Merge current state with defaults to ensure base items always exist if missing
        const baseIds = new Set(GLOBAL_LIBRARY.map(i => i.id));
        const currentIds = new Set(globalLibrary.map(i => i.id));
        
        // If default items are missing (deleted by mistake), re-add them
        let fixedLibrary = [...globalLibrary];
        let addedDefaults = 0;
        
        GLOBAL_LIBRARY.forEach(defaultItem => {
            if (!currentIds.has(defaultItem.id)) {
                fixedLibrary.push(defaultItem);
                addedDefaults++;
            }
        });

        // Dedup
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
     // Skip search if intention is clearly analysis or debugging
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

  // Enhanced Static Analysis for LISP
  const validateLispCode = (code: string): { isValid: boolean; issues: string[]; score: number } => {
      const issues: string[] = [];
      let score = 100;
      const lowerCode = code.toLowerCase();

      // 1. Parenthesis Balance
      let openParen = 0;
      for (let i = 0; i < code.length; i++) {
          if (code[i] === '(') openParen++;
          if (code[i] === ')') openParen--;
          if (openParen < 0) {
              issues.push("Kritik: Fazla kapatma parantezi ')' tespit edildi.");
              score -= 50;
              break;
          }
      }
      if (openParen > 0) {
          issues.push(`Kritik: ${openParen} adet kapatılmamış parantez '(' mevcut.`);
          score -= 50;
      }

      // 2. Basic Structure
      if (!/\(defun\s+c:[a-zA-Z0-9_]+/i.test(code)) {
          issues.push("Uyarı: Standart 'defun c:' komut tanımı bulunamadı.");
          score -= 20;
      }

      // 3. Visual LISP Safety
      if ((lowerCode.includes("vla-") || lowerCode.includes("vlax-")) && !lowerCode.includes("(vl-load-com)")) {
          issues.push("Hata: Visual LISP fonksiyonları var ama '(vl-load-com)' eksik.");
          score -= 30;
      }

      // 4. Infinite Loop Check
      if (lowerCode.includes("(while t") && !lowerCode.includes("exit") && !lowerCode.includes("quit")) {
          issues.push("Risk: 'While T' sonsuz döngü riski taşıyor.");
          score -= 10;
      }

      // 5. International Compatibility (Bonus check)
      if (lowerCode.includes("command \"") && !lowerCode.includes("command \"_.") && !lowerCode.includes("command \".")) {
           // This is a minor suggestion, doesn't affect score too much
           // issues.push("Bilgi: Komutlarda '_.command' kullanarak dil uyumluluğu artırılabilir.");
      }

      // 6. Clean Exit
      if (!lowerCode.includes("(princ)")) {
           issues.push("Bilgi: Komut sonunda sessiz çıkış için '(princ)' önerilir.");
           score -= 5;
      }

      return { isValid: score > 60, issues, score: Math.max(0, score) };
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
          let healthyCount = 0;
          let warningCount = 0;
          let reportMarkdown = "## 🛡️ Sistem Bütünlük ve Güvenlik Taraması\n\n**Analiz Kapsamı:**\n*   Sözdizimi (Syntax) Doğrulama\n*   Parantez Dengesi\n*   Visual LISP Yükleme Kontrolü\n*   Sonsuz Döngü Riski\n\n| Sağlık | LISP Adı | Skor | Durum / Notlar |\n| :---: | :--- | :---: | :--- |\n";

          globalLibrary.forEach(item => {
              const check = validateLispCode(item.code);
              if (check.isValid && check.issues.length === 0) {
                  healthyCount++;
                  reportMarkdown += `| ✅ | **${item.title}** | ${check.score}% | Mükemmel |\n`;
              } else if (check.isValid) {
                   // Valid but has warnings
                   healthyCount++;
                   reportMarkdown += `| ⚠️ | **${item.title}** | ${check.score}% | ${check.issues.join(', ')} |\n`;
              } else {
                  warningCount++;
                  reportMarkdown += `| ❌ | **${item.title}** | ${check.score}% | **KRİTİK:** ${check.issues.join(', ')} |\n`;
              }
          });

          reportMarkdown += `\n---\n**SONUÇ RAPORU:**\n*   **Toplam Taranan:** ${globalLibrary.length} Öğe\n*   **Güvenli:** ${healthyCount}\n*   **Riskli:** ${warningCount}\n\nTüm kütüphane öğeleri AutoCAD ortamında çalıştırılmaya uygundur.`;

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
      }, 2000); // Slightly longer delay for "Deep Scan" feeling
  };

  const processRequest = async (userText: string, codeContext?: string, mode: 'generate' | 'optimize' | 'explain' = 'generate', skipUserMessage = false, forceCustom = false) => {
    if (isLoading || isSystemLocked) return;

    // --- SECURITY LAYER: RATE LIMITING ---
    const now = Date.now();
    if (now - lastRequestTime < 1500) { // Minimum 1.5 seconds between requests
        const warningMsg: Message = {
            id: Date.now().toString(),
            role: MessageRole.System,
            content: "⚠️ Çok hızlı işlem yapıyorsunuz. Lütfen sistemin yanıt vermesini bekleyin.",
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, warningMsg]);
        return;
    }
    setLastRequestTime(now);
    // -------------------------------------

    // Diagnostic Command Trigger
    const lowerInput = userText.toLowerCase();
    const isDiagnosticsRequest = mode === 'generate' && !forceCustom && (
        lowerInput.includes("sistem taraması") ||
        lowerInput.includes("teşhis") ||
        lowerInput.includes("check") ||
        (lowerInput.includes("tüm") && lowerInput.includes("kontrol")) ||
        (lowerInput.includes("kütüphane") && lowerInput.includes("analiz")) ||
        (lowerInput.includes("lisp") && lowerInput.includes("analiz"))
    );

    if (isDiagnosticsRequest && !codeContext) {
        runSystemDiagnostics();
        setInput('');
        return;
    }

    if (!skipUserMessage) {
        if (mode === 'generate' && !codeContext) {
            const userMessage: Message = {
                id: Date.now().toString(),
                role: MessageRole.User,
                content: userText,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, userMessage]);

            // INTERCEPT: Check Global Library (Only if not forcing custom generation)
            if (!forceCustom) {
                const libraryMatch = searchLibrary(userText);
                
                if (libraryMatch) {
                    setIsLoading(true);
                    // Pause to simulate finding
                    setTimeout(() => {
                        const proposalMsg: Message = {
                            id: (Date.now() + 1).toString(),
                            role: MessageRole.Assistant,
                            content: "", // Content is handled by the UI component for proposals
                            timestamp: Date.now(),
                            proposalSnippet: libraryMatch,
                            originalRequest: userText
                        };
                        setMessages(prev => [...prev, proposalMsg]);
                        setIsLoading(false);
                    }, 600);
                    setInput('');
                    return; // STOP HERE to wait for user choice
                }
            }
        } else if (mode === 'optimize') {
            const userMessage: Message = {
                id: Date.now().toString(),
                role: MessageRole.User,
                content: "Bu kodda hatalar olabilir. Lütfen güvenlik kontrolü yap ve onar.",
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, userMessage]);
        } else if (mode === 'explain') {
            const userMessage: Message = {
                id: Date.now().toString(),
                role: MessageRole.User,
                content: "Bu kodun nasıl çalıştığını açıkla.",
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, userMessage]);
        }
    }

    setInput('');
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
      
      if (mode === 'optimize' && codeContext) {
          promptToSend = `Aşağıdaki LISP kodunu detaylı analiz et. Kodda çalışmasını engelleyen HATA (parantez, değişken, mantık) varsa önce onları bul ve düzelt. Ardından kodu Visual LISP (ActiveX) standartlarında optimize et, undo gruplaması ve hata yönetimi ekle:\n\n${codeContext}`;
      } else if (mode === 'explain' && codeContext) {
          promptToSend = `Aşağıdaki LISP kodunu analiz et ve ne yaptığını satır satır açıkla:\n\n${codeContext}`;
      }

      const { code, explanation } = await generateLispCode(promptToSend, mode);

      setMessages(prev => prev.map(msg => {
        if (msg.id === thinkingId) {
          return {
            ...msg,
            content: explanation || (mode === 'explain' ? "Analiz tamamlandı." : "İşte güvenli ve optimize edilmiş kodunuz:"),
            code: code,
            isLoading: false
          };
        }
        return msg;
      }));
      
      // Reset violation count on success
      if (violationCount > 0) setViolationCount(Math.max(0, violationCount - 1));

    } catch (error: any) {
      // Handle Security Violations
      const errorMessage = error.message || "Hata";
      const isSecurityError = errorMessage.includes("GÜVENLİK") || errorMessage.includes("Malicious");
      
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
               role: MessageRole.System, // Change role to system for errors
               content: isSecurityError 
                  ? `⛔ **ERİŞİM ENGELLENDİ**\n\n${errorMessage}\n\nSistem güvenliği gereği bu işlem gerçekleştirilemez. Lütfen sadece AutoCAD ile ilgili yasal isteklerde bulunun.` 
                  : "İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.",
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
      if (!input.trim() || isSystemLocked) return;

      // Input Sanitization
      if (input.length > 2000) {
          alert("Girdi çok uzun. Lütfen 2000 karakterden az veri girin.");
          return;
      }
      if (input.includes("<script>") || input.includes("javascript:")) {
          alert("Girişinizde yasaklı karakterler tespit edildi.");
          return;
      }

      // Heuristic Detection for LISP code
      const codeRegex = /^\s*\(|defun|setq|vl-|command|entmake/i;
      const isLispCode = codeRegex.test(input) && input.includes(")");

      if (isLispCode) {
         const lowerInput = input.toLowerCase();
         const isExplainRequest = lowerInput.includes("açıkla") || lowerInput.includes("anlat") || lowerInput.includes("nedir") || lowerInput.includes("analiz");
         const targetMode = isExplainRequest ? 'explain' : 'optimize';

         const userMsg: Message = {
              id: Date.now().toString(),
              role: MessageRole.User,
              content: isExplainRequest ? "Bu kodu satır satır detaylı açıkla:" : "Bu kodu analiz et, hataları düzelt ve iyileştir:",
              code: input,
              timestamp: Date.now()
         };
         setMessages(prev => [...prev, userMsg]);

         processRequest("", input, targetMode, true);
         return;
      }

      processRequest(input);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCodeAction = (code: string, action: 'optimize' | 'explain' | 'download') => {
      if (action === 'download') {
          // Download Logic
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

  // --- LIBRARY PROPOSAL HANDLER ---
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
          // Generate custom
          const customRequest = originalRequest || `Bana ${snippet.title} benzeri ama farklı çalışan özgün bir komut yaz.`;
          // We send an empty user message just to trigger the process, or we just call processRequest directly
          // Better to add a small "Okay, I'll write a new one" message from the bot first? 
          // No, let's just trigger the generation.
          setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: MessageRole.Assistant,
              content: "Anlaşıldı, sizin için sıfırdan özel bir kod tasarlıyorum... ⚡",
              timestamp: Date.now()
          }]);
          
          processRequest(customRequest, undefined, 'generate', true, true); // Force custom generation
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
      setGlobalLibrary(prev => [snippet, ...prev]);
      
      const timestamp = new Date().toLocaleTimeString();
      const reportMarkdown = `## 🎉 Teşekkürler, ${snippet.author || 'Değerli Kullanıcı'}!

> **"Bilgi paylaştıkça çoğalır."**

Katkınız **AutoLISP Master Global Kütüphanesi**ne başarıyla eklendi.
Bu veri şu anda **tarayıcınızın yerel hafızasına (Local Storage)** kaydedildi. Sayfayı yenileseniz bile kaybolmayacaktır.

### 📝 Kayıt Detayları
| Parametre | Değer |
| :--- | :--- |
| **Dosya Adı** | \`${snippet.title}\` |
| **Kategori** | \`${snippet.category?.toUpperCase()}\` |
| **Erişim** | 🔒 **Yerel (Size Özel)** |
| **İşlem Zamanı** | ${timestamp} |

`;

      const reportMsg: Message = {
          id: Date.now().toString(),
          role: MessageRole.Assistant,
          content: reportMarkdown,
          timestamp: Date.now()
      };
      setMessages(prev => [...prev, reportMsg]);
  };

  // --- IMPORT / EXPORT HANDLERS ---
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
          content: "✅ Kütüphane başarıyla dışa aktarıldı (Backup created).",
          timestamp: Date.now()
      }]);
  };

  const handleImportLibrary = (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const result = e.target?.result as string;
              const importedData = JSON.parse(result);

              if (!Array.isArray(importedData)) {
                  throw new Error("Geçersiz format: Dosya bir liste içermiyor.");
              }
              if (importedData.length > 0 && (!importedData[0].id || !importedData[0].code)) {
                   throw new Error("Geçersiz veri yapısı: Eksik alanlar var.");
              }

              const existingIds = new Set(globalLibrary.map(i => i.id));
              let addedCount = 0;
              const newItems: LispSnippet[] = [];

              importedData.forEach((item: LispSnippet) => {
                  if (!existingIds.has(item.id)) {
                      newItems.push(item);
                      existingIds.add(item.id);
                      addedCount++;
                  }
              });

              if (addedCount > 0) {
                  setGlobalLibrary(prev => [...newItems, ...prev]);
                  setMessages(prev => [...prev, {
                      id: Date.now().toString(),
                      role: MessageRole.System,
                      content: `✅ İçe aktarma başarılı! **${addedCount}** yeni LISP komutu kütüphaneye eklendi.`,
                      timestamp: Date.now()
                  }]);
              } else {
                  alert("Bu dosyadaki tüm komutlar zaten kütüphanenizde mevcut.");
              }

          } catch (err) {
              alert("İçe aktarma başarısız oldu. Dosya bozuk veya format hatalı.");
              console.error(err);
          }
      };
      reader.readAsText(file);
  };

  const clearChat = () => {
     setMessages([messages[0]]); 
     setViolationCount(0);
     setIsSystemLocked(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900 text-slate-200 font-sans">
      
      <Sidebar 
        library={globalLibrary}
        onSelectSnippet={loadSnippet} 
        onSelectExample={loadExample}
        onOpenContribute={() => setIsContributeModalOpen(true)}
        onImportLibrary={handleImportLibrary}
        onExportLibrary={handleExportLibrary}
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <ContributeModal 
        isOpen={isContributeModalOpen} 
        onClose={() => setIsContributeModalOpen(false)}
        onSave={handleAddSnippetToLibrary}
        currentLibrary={globalLibrary}
      />

      <main className="flex-1 flex flex-col min-w-0 relative bg-grid-pattern">
        <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-800 rounded-lg md:hidden text-slate-400"
            >
              {isSidebarOpen ? <Menu size={20} /> : <Menu size={20} />}
            </button>
            <div className="flex flex-col">
              <span className="font-bold text-lg text-white tracking-tight flex items-center gap-2">
                AutoLISP <span className="text-emerald-500">Master</span>
              </span>
              <span className="text-[10px] text-slate-400 hidden md:block">Advanced AutoCAD Automation Assistant</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
             {isSystemLocked ? (
                 <div className="flex items-center gap-2 px-3 py-1 bg-red-900/20 border border-red-800/50 rounded-full animate-pulse">
                    <Lock size={12} className="text-red-500" />
                    <span className="text-[10px] text-red-400 font-bold">SİSTEM KİLİTLENDİ</span>
                 </div>
             ) : (
                 <>
                    <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-[10px] text-slate-400" title="Verileriniz tarayıcınızda saklanıyor">
                        <Database size={10} />
                        Storage: Local
                    </div>
                    <button
                    onClick={runSystemDiagnostics}
                    className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-purple-900/20 border border-purple-800/30 rounded-full text-[10px] text-purple-300 hover:bg-purple-900/40 transition-colors"
                    title="Tüm kütüphaneyi güvenlik için tara"
                    >
                        <Activity size={12} />
                        Güvenlik Taraması
                    </button>
                    <div className="hidden sm:flex items-center gap-1 px-3 py-1 bg-blue-900/20 border border-blue-800/30 rounded-full text-[10px] text-blue-300/70" title="Koruma kalkanı aktif">
                        <ShieldAlert size={12} />
                        Protected Mode
                    </div>
                 </>
             )}
             <button 
               onClick={clearChat}
               className="p-2 hover:bg-red-900/30 text-slate-500 hover:text-red-400 rounded-lg transition-colors flex items-center gap-2 text-xs"
               title="Sohbeti Temizle"
             >
                <Trash2 size={16} />
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar scroll-smooth">
          <div className="max-w-4xl mx-auto space-y-6 pb-4">
            {messages.map((msg) => (
              <MessageBubble 
                key={msg.id} 
                message={msg} 
                onCodeAction={!msg.isLoading && !isSystemLocked ? handleCodeAction : undefined}
                onLibraryAction={handleLibraryChoice}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/90 backdrop-blur">
          <div className="max-w-4xl mx-auto relative">
            {isSystemLocked ? (
                 <div className="bg-red-950/50 border border-red-900/50 rounded-xl p-4 flex items-center gap-3 text-red-400">
                     <Lock size={24} />
                     <div>
                         <h4 className="font-bold text-sm">Erişim Durduruldu</h4>
                         <p className="text-xs opacity-80">Çok fazla güvenlik ihlali. Lütfen sayfayı yenileyin.</p>
                     </div>
                 </div>
            ) : (
              <div className="relative flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Bir AutoLISP komutu isteyin veya kodu buraya yapıştırın..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-4 pr-12 py-3.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all shadow-lg shadow-black/20"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 p-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white rounded-lg transition-all duration-200 shadow-lg shadow-emerald-900/30"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send size={20} />
                  )}
                </button>
              </div>
            )}
            
            <div className="mt-3 flex justify-center gap-4 text-[10px] text-slate-500">
               <span className="flex items-center gap-1"><CheckCheck size={10} /> AutoLISP & Visual LISP</span>
               <span className="hidden sm:flex items-center gap-1"><Sparkles size={10} /> AI Optimized</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;