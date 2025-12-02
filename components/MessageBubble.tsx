import React from 'react';
import { Message, MessageRole, LispSnippet } from '../types';
import { Bot, User, Copy, Check, Wrench, BookOpen, Sparkles, ShieldCheck, Download, Zap, FileText, FileCode, Image as ImageIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface MessageBubbleProps {
  message: Message;
  onCodeAction?: (code: string, action: 'optimize' | 'explain' | 'download') => void;
  onLibraryAction?: (snippet: LispSnippet, originalRequest: string | undefined, action: 'accept' | 'custom') => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onCodeAction, onLibraryAction }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUser = message.role === MessageRole.User;
  const isLibrary = message.isLibraryResult;
  const isProposal = !!message.proposalSnippet;

  const renderAttachment = (att: { name: string, mimeType: string, data: string }, idx: number) => {
      const isImage = att.mimeType.startsWith('image/');
      
      if (isImage) {
          return (
              <img 
                  key={idx} 
                  src={att.data} 
                  alt={att.name} 
                  className="w-24 h-24 object-cover rounded-lg border border-white/20 hover:scale-105 transition-transform cursor-pointer bg-slate-900" 
                  title={att.name}
              />
          );
      }
      
      // Non-image rendering
      let Icon = FileText;
      let colorClass = "text-slate-300";
      
      if (att.mimeType === 'application/pdf') {
          Icon = FileText; 
          colorClass = "text-red-400";
      } else if (att.mimeType.includes('dxf') || att.mimeType.includes('lisp') || att.mimeType.includes('plain')) {
          Icon = FileCode;
          colorClass = "text-emerald-400";
      }

      return (
          <div key={idx} className="w-24 h-24 rounded-lg border border-white/10 bg-slate-900/50 flex flex-col items-center justify-center p-2 gap-2 hover:bg-slate-900 transition-colors" title={att.name}>
              <Icon size={24} className={colorClass} />
              <span className="text-[10px] text-center text-slate-400 line-clamp-2 leading-tight break-all w-full">
                  {att.name}
              </span>
              <span className="text-[8px] text-slate-600 uppercase font-bold">{att.name.split('.').pop()}</span>
          </div>
      );
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[90%] md:max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser ? 'bg-blue-600' : (isLibrary || isProposal) ? 'bg-amber-500' : 'bg-emerald-600'
        }`}>
          {isUser ? <User size={18} className="text-white" /> : (isLibrary || isProposal) ? <Sparkles size={18} className="text-white" /> : <Bot size={18} className="text-white" />}
        </div>

        {/* Content */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} w-full min-w-0`}>
          
          {/* Proposal Card (Decision UI) */}
          {isProposal && message.proposalSnippet && (
              <div className="w-full bg-slate-800 border border-amber-500/50 rounded-2xl rounded-tl-none shadow-lg overflow-hidden mb-2 animate-in fade-in slide-in-from-bottom-2">
                  <div className="bg-amber-900/20 p-4 border-b border-amber-500/20">
                      <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-2">
                          <Sparkles size={16} />
                          <span>Benzer bir LISP Kütüphanede bulundu!</span>
                      </div>
                      <p className="text-slate-300 text-xs">İsteğinize çok benzeyen onaylanmış bir kodumuz var. Bunu kullanmak mı istersiniz, yoksa tamamen size özel yeni bir tane mi yazalım?</p>
                  </div>
                  
                  <div className="p-4 space-y-4">
                      <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                          <h4 className="text-white font-bold text-sm">{message.proposalSnippet.title}</h4>
                          <p className="text-slate-400 text-xs mt-1 line-clamp-2">{message.proposalSnippet.description}</p>
                          <div className="mt-2 flex gap-2">
                               {message.proposalSnippet.keywords?.slice(0, 3).map(k => (
                                   <span key={k} className="text-[10px] bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">{k}</span>
                               ))}
                          </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                          <button 
                              onClick={() => onLibraryAction && onLibraryAction(message.proposalSnippet!, message.originalRequest, 'accept')}
                              className="flex-1 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                          >
                              <Check size={14} />
                              Kütüphanedekini Kullan
                          </button>
                          <button 
                              onClick={() => onLibraryAction && onLibraryAction(message.proposalSnippet!, message.originalRequest, 'custom')}
                              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 border border-slate-600"
                          >
                              <Zap size={14} className="text-emerald-400" />
                              Yeni Özel Kod Yaz
                          </button>
                      </div>
                  </div>
              </div>
          )}

          {/* Standard Text Bubble */}
          {!isProposal && (message.content || (message.attachments && message.attachments.length > 0)) && (
            <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-md break-words max-w-full relative
              ${isUser 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : isLibrary 
                    ? 'bg-slate-800 text-slate-200 border border-amber-500/50 rounded-tl-none shadow-amber-900/20' 
                    : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'
              }`}>
              
              {isLibrary && (
                  <div className="absolute -top-2.5 left-0 px-2 py-0.5 bg-amber-500 text-slate-900 text-[10px] font-bold rounded-full flex items-center gap-1 shadow-lg">
                      <ShieldCheck size={10} /> Verified Library Item
                  </div>
              )}

              {/* Render Attachments (Images, PDF, etc) */}
              {message.attachments && message.attachments.length > 0 && (
                  <div className={`flex flex-wrap gap-2 mb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                      {message.attachments.map((att, idx) => renderAttachment(att, idx))}
                  </div>
              )}

              {message.isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              ) : (
                 <div className="markdown-body">
                   <ReactMarkdown>{message.content}</ReactMarkdown>
                 </div>
              )}
            </div>
          )}

          {/* Code Block separate if exists */}
          {message.code && (
            <div className={`mt-3 w-full bg-[#0d1117] border rounded-lg overflow-hidden shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-500
                ${isLibrary ? 'border-amber-500/30 shadow-amber-900/10' : isUser ? 'border-blue-500/30' : 'border-slate-700'}
            `}>
              <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700 gap-2">
                <span className={`text-xs font-mono font-bold flex items-center gap-2 ${isLibrary ? 'text-amber-400' : isUser ? 'text-blue-400' : 'text-emerald-400'}`}>
                    {isLibrary && <Sparkles size={12} />}
                    {isLibrary ? 'Global Library Standard' : isUser ? 'Girdiğiniz Kod / Input Code' : 'AutoLISP Master v2.4 Strict Mode'}
                </span>
                
                <div className="flex items-center gap-2">
                  {onCodeAction && !isUser && (
                    <>
                      <button 
                        onClick={() => onCodeAction(message.code!, 'explain')}
                        className="flex items-center gap-1.5 text-[10px] md:text-xs text-blue-400 hover:text-blue-300 transition-colors hover:bg-blue-900/30 px-2 py-1 rounded border border-blue-900/50"
                        title="Kodu satır satır açıkla"
                      >
                        <BookOpen size={12} />
                        Açıkla
                      </button>
                      <button 
                        onClick={() => onCodeAction(message.code!, 'optimize')}
                        className="flex items-center gap-1.5 text-[10px] md:text-xs text-orange-400 hover:text-orange-300 transition-colors hover:bg-orange-900/30 px-2 py-1 rounded border border-orange-900/50"
                        title="Hataları bul, onar ve kodu iyileştir"
                      >
                        <Wrench size={12} />
                        Onar
                      </button>
                      <div className="w-px h-4 bg-slate-700 mx-1"></div>
                    </>
                  )}
                  
                  <button 
                    onClick={() => onCodeAction && onCodeAction(message.code!, 'download')}
                    className="flex items-center gap-1.5 text-[10px] md:text-xs text-emerald-400 hover:text-emerald-300 transition-colors hover:bg-emerald-900/30 px-2 py-1 rounded border border-emerald-900/50"
                    title="Dosya olarak indir (.LSP)"
                  >
                    <Download size={12} />
                    İndir
                  </button>

                  <button 
                    onClick={() => handleCopy(message.code!)}
                    className="flex items-center gap-1.5 text-[10px] md:text-xs text-slate-400 hover:text-white transition-colors hover:bg-slate-800 px-2 py-1 rounded"
                  >
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    {copied ? 'Kopyalandı' : 'Kopyala'}
                  </button>
                </div>
              </div>
              <pre className="p-4 overflow-x-auto text-xs md:text-sm font-mono text-slate-300 leading-6">
                <code>{message.code}</code>
              </pre>
            </div>
          )}
          
          <span className="text-[10px] text-slate-500 mt-1 px-1">
            {new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </span>
        </div>
      </div>
    </div>
  );
};