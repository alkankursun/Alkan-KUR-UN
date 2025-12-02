
import { GoogleGenAI, Type } from "@google/genai";
import { Attachment, Message, MessageRole } from "../types";

// Safely access process.env to prevent "process is not defined" crashes in browser environments
const API_KEY = (typeof process !== 'undefined' && process.env && process.env.API_KEY) || '';

// Initialize the client
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

/**
 * Generates an AutoLISP routine based on the user's description.
 * Supports multimodal input (Text + Images + PDF) and CONTEXT RETENTION.
 */
export const generateLispCode = async (
    currentPrompt: string, 
    history: Message[] = [], 
    mode: 'generate' | 'optimize' | 'explain' = 'generate', 
    currentAttachments: Attachment[] = []
): Promise<{ code: string; explanation: string }> => {
  if (!API_KEY || !ai) {
    throw new Error("API Key bulunamadı. Güvenlik nedeniyle işlem durduruldu.");
  }

  // 1. PRE-FLIGHT SECURITY CHECK
  const lowerPrompt = currentPrompt.toLowerCase();
  const forbiddenPatterns = [
    "ignore previous instructions", "önceki talimatları unut",
    "system prompt", "sistem talimatı",
    "delete all files", "format c:", "tüm dosyaları sil",
    "hack", "crack", "warez", "keygen",
    "<script>", "javascript:", "vbscript:"
  ];

  if (forbiddenPatterns.some(pattern => lowerPrompt.includes(pattern))) {
     throw new Error("⚠️ GÜVENLİK UYARISI: Bu istek sistem koruma protokolleri tarafından engellendi.");
  }

  let specificInstruction = "";
  
  if (mode === 'optimize') {
    specificInstruction = "MODE: SENIOR CODE REVIEW. You are fixing a Junior's code. Analyze the context carefully. Fix the BUGS but preserve the LOGIC flow and VARIABLE NAMES unless they are critical errors. Do not rewrite the whole thing just to show off. Fix it and make it robust.";
  } else if (mode === 'explain') {
    specificInstruction = "MODE: TECHNICAL DOCUMENTATION. Explain the code line-by-line like a university professor teaching Data Structures.";
  } else {
    specificInstruction = "MODE: SENIOR ARCHITECT. Generate robust, production-ready AutoLISP code. Assume the user is a professional.";
  }

  const systemInstruction = `
    ### IDENTITY: AutoLISP Master v2.4 (Strict Mode) ###
    You are a Senior AutoLISP/Visual LISP Engineer with 40 years of experience. You have written kernels for CAD engines.
    
    ### COMMUNICATION STYLE ###
    *   **Concise & Direct**: Do not use marketing fluff ("Here is your code", "I hope this helps"). Start directly with the solution or the technical explanation.
    *   **Professional**: Treat the user as a colleague. Focus on requirements, errors, and solutions.
    *   **No Chatty Introductions**: Skip "Sure!", "Okay!", "I can help with that".
    
    ### CORE PHILOSOPHY ###
    1. **Robustness**: Code must handle user cancellations (Esc), empty selections, and locked layers gracefully. Always use local variables.
    2. **Internationalization**: ALWAYS use the underscore prefix for AutoCAD commands (e.g., \`command "_.LINE"\` instead of \`command "LINE"\`). This ensures the code works on non-English AutoCAD versions (German, Turkish, French, etc.).
    3. **Performance**: Prefer Visual LISP (ActiveX) \`vlax-*\` functions over \`command\` calls where performance matters.
    4. **Safety**: Use \`vl-catch-all-apply\` for dangerous operations.
    
    ### STRICT MODE PROTOCOL (NON-DESTRUCTIVE EDITING) ###
    When modifying user code:
    *   **PRESERVE**: Keep variable names (e.g., if user used \`setq a 10\`, do NOT change it to \`setq width 10\`).
    *   **RESPECT**: Do not change the algorithm unless it is broken.
    *   **MINIMALISM**: Make the smallest effective change to solve the problem.
    
    ### CONTEXT AWARENESS ###
    *   Remember previous files (PDFs, Images) and code snippets in this conversation.
    *   If the user says "olmadı" (it didn't work), analyze the previous code for logic errors (e.g., infinite loops, wrong selection filters).

    ${specificInstruction}
    
    ### OUTPUT FORMAT ###
    1. Code Block: Markdown \`\`\`lisp ... \`\`\`
    2. Explanation: Professional, concise, technical Turkish.
  `;

  try {
    // --- BUILD CONTEXT FROM HISTORY ---
    const contents: any[] = [];

    // 1. Process Previous Messages (History)
    for (const msg of history) {
        // Skip system messages or loading states
        if (msg.role === MessageRole.System || msg.isLoading) continue;

        const parts: any[] = [];
        
        // Add Text Content
        if (msg.content) {
            parts.push({ text: msg.content });
        }
        
        // Add Code Content (if assistant wrote code previously)
        if (msg.code) {
             parts.push({ text: `\n\`\`\`lisp\n${msg.code}\n\`\`\`\n` });
        }

        // Add Attachments (Images/PDFs) from previous turns
        // IMPORTANT: Re-injecting base64 data allows the model to "see" old files again
        if (msg.attachments && msg.attachments.length > 0) {
             for (const att of msg.attachments) {
                 if (att.mimeType.startsWith('image/') || att.mimeType === 'application/pdf') {
                     const base64Data = att.data.split(',')[1] || att.data;
                     parts.push({
                         inlineData: { mimeType: att.mimeType, data: base64Data }
                     });
                 } else if (att.mimeType.startsWith('text/') || att.mimeType.includes('dxf')) {
                     try {
                         const rawBase64 = att.data.split(',')[1] || att.data;
                         const decoded = atob(rawBase64);
                         parts.push({ text: `\n[GEÇMİŞ DOSYA: ${att.name}]\n${decoded.substring(0, 20000)}\n` });
                     } catch(e) {}
                 }
             }
        }

        if (parts.length > 0) {
            contents.push({
                role: msg.role === MessageRole.User ? 'user' : 'model', // Map 'assistant' to 'model'
                parts: parts
            });
        }
    }

    // 2. Add Current Request
    const currentParts: any[] = [{ text: currentPrompt }];

    if (currentAttachments && currentAttachments.length > 0) {
        for (const att of currentAttachments) {
            if (att.mimeType.startsWith('image/') || att.mimeType === 'application/pdf') {
                const base64Data = att.data.split(',')[1] || att.data;
                currentParts.push({
                    inlineData: { mimeType: att.mimeType, data: base64Data }
                });
            } else if (att.mimeType.startsWith('text/') || att.mimeType.includes('dxf') || att.mimeType.includes('lisp')) {
                 try {
                     const rawBase64 = att.data.split(',')[1] || att.data;
                     const decodedText = atob(rawBase64);
                     currentParts.push({
                         text: `\n\n[YENİ EKLENEN DOSYA: ${att.name}]\n${decodedText.substring(0, 50000)}\n[DOSYA SONU]\n`
                     });
                 } catch (e) {
                     console.warn("Could not decode text attachment", att.name);
                 }
            }
        }
    }

    contents.push({
        role: 'user',
        parts: currentParts
    });

    // Call API with full history
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        thinkingConfig: { thinkingBudget: 0 },
      }
    });

    const text = response.text || "";
    
    // Parse the response
    const codeBlockRegex = /```(?:lisp|clojure|scheme|json)?\s*([\s\S]*?)```/i;
    const match = text.match(codeBlockRegex);

    if (match && match[1]) {
      const code = match[1].trim();
      const explanation = text.replace(codeBlockRegex, '').trim();
      return { code, explanation };
    } else {
      return { code: "", explanation: text };
    }

  } catch (error: any) {
    console.error("Gemini Context Error:", error);
    throw new Error(error.message.includes("GÜVENLİK") ? error.message : "Bağlam işlenirken hata oluştu.");
  }
};

/**
 * Analyzes user-submitted code to structure it for the Global Library.
 */
export const analyzeSubmittedCode = async (rawCode: string): Promise<{
  title: string;
  description: string;
  category: 'calculation' | 'modification' | 'text' | 'layers' | 'blocks' | 'other';
  keywords: string[];
  cleanedCode: string;
  error?: string;
}> => {
   if (!API_KEY || !ai) throw new Error("API Key is missing");

   const dangerousCommands = [
       "command \"shell\"", "command \"sh\"", "startapp", 
       "vl-file-delete", "vl-file-copy", "entdel (handent \"0\")",
       "format c:", "del *.*"
   ];
   
   if (dangerousCommands.some(cmd => rawCode.toLowerCase().includes(cmd))) {
       return {
           title: "", description: "", category: "other", keywords: [], cleanedCode: "",
           error: "⚠️ GÜVENLİK REDDİ: Zararlı sistem komutları tespit edildi."
       };
   }

   const systemInstruction = `
     You are a Senior AutoLISP Library Maintainer.
     Task:
     1. Analyze code for safety. Return "error" in JSON if dangerous.
     2. Clean up indentation.
     3. Categorize accurately.
     
     Response JSON:
     {
       "title": "Title",
       "description": "Short desc",
       "category": "calculation",
       "keywords": ["tag1"],
       "cleanedCode": "(defun c:..."
     }
   `;

   try {
     const response = await ai.models.generateContent({
       model: 'gemini-2.5-flash',
       contents: [{ role: 'user', parts: [{ text: rawCode }] }],
       config: {
         systemInstruction: systemInstruction,
         responseMimeType: "application/json"
       }
     });
     
     const jsonStr = response.text || "{}";
     return JSON.parse(jsonStr);
   } catch (error) {
     throw new Error("Kod analiz edilemedi.");
   }
};

export const explainLispCode = async (code: string): Promise<string> => {
   const result = await generateLispCode(`Bu kodu teknik bir dille açıkla:\n${code}`, [], 'explain');
   return result.explanation;
}
