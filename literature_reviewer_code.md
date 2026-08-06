# AI Literature Reviewer Module

This document extracts the exact code for the Literature Reviewer module, so you can easily drop it into another React/Next.js and Express.js project.

The module is broken into two parts:
1. **Frontend**: A React component for the UI (File Upload, Chat, Document View).
2. **Backend**: An Express.js controller that handles text extraction (`pdf-parse`) and communicates with the Google Gemini API.

---

## 1. Backend Code (Express.js)

First, install the required dependency on your backend:
```bash
npm install pdf-parse
```

Create a controller file (e.g., `literatureController.ts` or `literatureController.js`) and paste this code:

```typescript
import { Request, Response } from 'express';
// Using require to load pdf-parse dynamically
const pdfParse = require('pdf-parse');

// Helper for fetch with timeout (if you don't have one)
async function fetchWithTimeout(url: string, options: any, timeoutMs = 60000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Endpoint to extract plain text from an uploaded PDF base64 stream.
 * Helps optimize subsequent chat speeds by eliminating large file payloads.
 */
export async function extractTextFromPdf(req: Request, res: Response) {
  const { fileBase64 } = req.body;

  if (!fileBase64) return res.status(400).json({ error: 'fileBase64 parameter is required.' });
  
  try {
    const cleanBase64 = fileBase64.split(';base64,').pop() || '';
    const buffer = Buffer.from(cleanBase64, 'base64');
    
    // Parse PDF buffer
    const data = await pdfParse(buffer);
    const text = data.text || '';
    
    res.json({ text: text.trim() });
  } catch (error: any) {
    console.error('[PDF Extraction Error]:', error);
    res.status(500).json({ error: 'Failed to extract text from PDF.' });
  }
}

/**
 * Handle chat queries against an uploaded PDF leaflet or paper
 * Supports fast text-based context payload, or fallback multimodal base64.
 */
export async function chatWithDocument(req: Request, res: Response) {
  const { fileBase64, documentText, question, history } = req.body;

  if (!question) return res.status(400).json({ error: 'question parameter is required.' });
  if (!fileBase64 && !documentText) return res.status(400).json({ error: 'Either fileBase64 or documentText must be provided.' });

  // 1. Resolve Gemini API Key (Backend env config or client-header pass)
  const apiKey = process.env.GEMINI_API_KEY || (req.headers['x-gemini-key'] as string);

  if (!apiKey) {
    return res.status(400).json({ error: 'Google Gemini API key not found.' });
  }

  try {
    // 2. Build contents payload matching Gemini API spec
    const contents: any[] = [];
    const systemPrompt = `You are a highly precise pharmaceutical, chemical, and medical AI research assistant. 
Your task is to answer the user's question accurately, professionally, and in detail based strictly on the uploaded PDF document context.
- Quote or reference sections where appropriate.
- If the document does not contain information to answer the question, state that clearly rather than hallucinating.
- Format all outputs with clear Markdown (tables, bullet points, headers, and bold text) for readability.`;

    // Map conversation history if present
    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        if (msg.role === 'user') contents.push({ role: 'user', parts: [{ text: msg.content }] });
        else contents.push({ role: 'model', parts: [{ text: msg.content }] });
      });
    }

    // Current turn payload assembly
    if (documentText) {
      // FAST TEXT-ONLY RAG PATH
      contents.push({
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\nDOCUMENT CONTEXT:\n${documentText}\n\nUser Question: ${question}` }]
      });
    } else {
      // MULTIMODAL BASE64 FALLBACK (Slow path for scanned images/tables)
      const cleanBase64 = fileBase64.split(';base64,').pop() || '';
      contents.push({
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: cleanBase64 } },
          { text: `${systemPrompt}\n\nUser Question: ${question}` }
        ]
      });
    }
    
    // We try models in fallback order. 1.5-flash is extremely reliable for PDF multimodal tasks.
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
    let lastError: any = null;
    let replyText = '';

    for (const model of models) {
      try {
        // MUST use v1beta to properly process PDF multimodal requests!
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        const response = await fetchWithTimeout(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({ contents })
        }, 60000);

        if (!response.ok) throw new Error('Model error');

        const resData = await response.json();
        const candidateText = resData?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (candidateText) {
          replyText = candidateText;
          break;
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!replyText) throw lastError || new Error('All configured Gemini models failed.');

    res.json({ answer: replyText });
  } catch (error: any) {
    console.error('[Gemini API Error]:', error);
    res.status(502).json({ error: 'Failed to process document analysis.' });
  }
}
```

Then, map these functions to your Express routes:
```typescript
import express from 'express';
import { extractTextFromPdf, chatWithDocument } from './literatureController';

const app = express();
// Increase body parser limit to handle base64 PDFs
app.use(express.json({ limit: '10mb' })); 

app.post('/api/literature/extract', extractTextFromPdf);
app.post('/api/literature/chat', chatWithDocument);
```

---

## 2. Frontend Code (React / Next.js)

First, install the UI dependencies in your React project:
```bash
npm install lucide-react react-markdown remark-gfm
```

Create your UI component (`LiteratureReviewer.tsx`) and paste the following:

```tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Upload, Send, FileText, Trash2, Key, AlertTriangle, CheckCircle, RefreshCw, Sparkles, Brain, Search } from 'lucide-react';

export default function LiteratureReviewer() {
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [documentText, setDocumentText] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [inputValue, setInputValue] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'document'>('chat');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  const processFile = (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf') return alert('Only PDF documents are supported.');
    if (selectedFile.size > 7 * 1024 * 1024) return alert('PDF must be 7 MB or smaller.');
    
    setFile(selectedFile);
    setFileUrl(URL.createObjectURL(selectedFile));
    setMessages([]);
    setDocumentText(null);
    setChatError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setFileBase64(base64);
      
      setIsExtracting(true);
      try {
        const res = await fetch('/api/literature/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileBase64: base64 })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.text) setDocumentText(data.text);
        }
      } catch (err) {
        console.error('Extraction failed, falling back to visual PDF mode.');
      } finally {
        setIsExtracting(false);
      }
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleClearFile = () => {
    setFile(null);
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileUrl(null);
    setFileBase64(null);
    setDocumentText(null);
    setMessages([]);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || !fileBase64 || chatLoading) return;

    const userMessage = inputValue;
    setInputValue('');
    setChatError(null);

    const updatedMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(updatedMessages);
    setChatLoading(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['x-gemini-key'] = apiKey;

      const payload: any = {
        question: userMessage,
        history: messages,
        fileBase64: documentText ? undefined : fileBase64,
        documentText: documentText || undefined
      };

      const res = await fetch('/api/literature/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to process document analysis.');

      const data = await res.json();
      setMessages([...updatedMessages, { role: 'assistant' as const, content: data.answer }]);
    } catch (err: any) {
      setChatError(err.message);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-6 bg-slate-50 p-6 min-h-screen font-sans">
      
      {/* Optional: API Key Input Box */}
      {showKeyInput && (
        <div className="bg-slate-900 text-white rounded-xl p-5 mb-6">
          <h3 className="font-bold mb-2">Setup API Key</h3>
          <input
            type="password"
            placeholder="Paste Gemini API Key..."
            className="w-full max-w-md px-4 py-2 bg-slate-800 rounded-lg focus:outline-none"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch h-[600px]">
        {/* Left Sidebar: Upload */}
        <div className="lg:col-span-4 flex flex-col bg-white rounded-xl border p-5 shadow-sm">
          <h2 className="text-sm font-bold border-b pb-2 mb-4">DOCUMENT SOURCE</h2>
          
          {!file ? (
            <label className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 flex-1">
              <Upload className="w-8 h-8 text-blue-500 mb-2" />
              <span className="text-sm font-bold text-slate-700">Select PDF File</span>
              <input type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files && processFile(e.target.files[0])} />
            </label>
          ) : (
            <div className="bg-slate-50 border rounded-xl p-4">
              <p className="font-bold truncate">{file.name}</p>
              <div className="mt-2 text-xs font-bold text-slate-500">
                {isExtracting ? 'Extracting text...' : documentText ? 'Fast Text Mode Ready' : 'Visual Scan Mode Ready'}
              </div>
              <button onClick={handleClearFile} className="mt-4 w-full bg-white border text-red-500 py-2 rounded-lg font-bold">
                Remove Document
              </button>
            </div>
          )}
        </div>

        {/* Right Content: Tabs, Chat & Viewer */}
        <div className="lg:col-span-8 flex flex-col bg-white rounded-xl border shadow-sm h-full overflow-hidden">
          
          {/* Header Tabs */}
          <div className="px-5 py-4 border-b bg-slate-50 flex justify-between items-center">
            <h2 className="font-bold flex items-center gap-2"><Brain className="text-blue-500"/> AI ASSISTANT</h2>
            
            {fileBase64 && (
              <div className="flex gap-1 bg-slate-200 p-1 rounded-lg">
                <button onClick={() => setActiveTab('chat')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'chat' ? 'bg-white text-blue-600' : 'text-slate-600'}`}>Chat</button>
                <button onClick={() => setActiveTab('document')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'document' ? 'bg-white text-blue-600' : 'text-slate-600'}`}>Document</button>
              </div>
            )}
          </div>

          {/* Active Tab Body */}
          {activeTab === 'document' && fileUrl ? (
            <div className="flex-1 overflow-hidden">
              <object data={`${fileUrl}#view=FitH`} type="application/pdf" className="w-full h-full">
                <embed src={`${fileUrl}#view=FitH`} type="application/pdf" className="w-full h-full" />
                <div className="p-6 text-center">
                  <p>Your browser does not support inline PDF viewing.</p>
                  <a href={fileUrl} target="_blank" className="text-blue-500 underline">Open in New Tab</a>
                </div>
              </object>
            </div>
          ) : (
            <>
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-slate-400 mt-20"><Search className="mx-auto w-10 h-10 mb-2"/><p>Upload a document to start asking questions.</p></div>
                ) : (
                  messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>
                        {msg.role === 'user' ? msg.content : <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>}
                      </div>
                    </div>
                  ))
                )}
                {chatLoading && <div className="text-slate-500 text-sm flex items-center gap-2"><RefreshCw className="animate-spin w-4 h-4"/> Analyzing...</div>}
                {chatError && <div className="text-red-600 bg-red-50 p-3 rounded-lg text-sm">{chatError}</div>}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t flex gap-3">
                <input
                  type="text"
                  placeholder="Ask a question..."
                  disabled={!fileBase64 || chatLoading}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                />
                <button type="submit" disabled={!fileBase64 || chatLoading} className="bg-blue-600 text-white px-4 py-2 rounded-lg">
                  <Send className="w-5 h-5"/>
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```
