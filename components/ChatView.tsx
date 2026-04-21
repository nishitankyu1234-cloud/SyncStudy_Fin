import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { APP_THEME } from '../constants';
import { ChatMessage, UserProfile } from '../types';
import { createChatStream } from '../services/geminiService';
import { Send, Bot, User, Sparkles, Image as ImageIcon, X, GraduationCap, Trash2 } from 'lucide-react';

interface ChatViewProps {
  initialContext?: string | null;
  userProfile: UserProfile;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export const ChatView: React.FC<ChatViewProps> = ({ initialContext, userProfile, messages, setMessages }) => {
  const { tokens } = APP_THEME;
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize welcome message if empty
  useEffect(() => {
    if (messages.length === 0) {
      let initialText = '';
      if (initialContext) {
        initialText = `${initialContext}についてですね。`;
        if (userProfile.targetUniversity) {
          initialText += `${userProfile.targetUniversity}合格に向けたプロの視点で解説します。`;
        } else {
          initialText += `何でも聞いてください。`;
        }
      } else {
        if (userProfile.targetUniversity) {
          initialText = `こんにちは。${userProfile.targetUniversity}合格を目指すあなたの専属講師です。入試問題の解説から学習計画まで、何でも相談してください。`;
        } else {
          initialText = 'こんにちは。日本トップクラスのAI講師がサポートします。分からない問題や学習の悩みがあれば、遠慮なく聞いてください。';
        }
      }

      setMessages([{
        id: 'welcome',
        role: 'model',
        text: initialText
      }]);
    } else if (initialContext) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role !== 'user') {
         setInput(`${initialContext}について教えてください`);
      }
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, selectedImage, isStreaming]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
  };

  const handleClearHistory = () => {
    if (confirm('チャット履歴をすべて削除しますか？')) {
      setMessages([]);
      localStorage.removeItem('syncstudy_chat_history');
      setMessages([{
        id: Date.now().toString(),
        role: 'model',
        text: '履歴をリセットしました。新たな気持ちで学習を始めましょう。'
      }]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImage) || isStreaming) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      image: selectedImage || undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSelectedImage(null);
    setIsStreaming(true);

    const history = messages.map(m => {
      const parts: any[] = [];
      if (m.text) parts.push({ text: m.text });
      if (m.image) {
        const [header, base64Data] = m.image.split(',');
        const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        });
      }
      return {
        role: m.role,
        parts: parts
      };
    });

    try {
      const stream = createChatStream(
        history, 
        userMessage.text, 
        userMessage.image, 
        userProfile
      );
      
      const responseId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: responseId, role: 'model', text: '', isLoading: true }]);

      let fullText = '';
      
      for await (const chunk of stream) {
        fullText += chunk;
        setMessages(prev => 
          prev.map(msg => 
            msg.id === responseId 
              ? { ...msg, text: fullText, isLoading: false } 
              : msg
          )
        );
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'model', 
        text: '申し訳ありません。エラーが発生しました。もう一度試してください。' 
      }]);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] animate-in fade-in duration-500 relative">
      <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center pointer-events-none px-2">
         <div></div>
         <div className="flex gap-2 pointer-events-auto">
            {userProfile.targetUniversity && (
              <div className="flex items-center gap-1 text-xs text-indigo-900 bg-indigo-50 px-2 py-1 rounded-full border border-indigo-100 shadow-sm">
                <GraduationCap size={12} />
                <span>{userProfile.targetUniversity}コース</span>
              </div>
            )}
            <button 
              onClick={handleClearHistory} 
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              title="履歴を削除"
            >
              <Trash2 size={16} />
            </button>
         </div>
      </div>

      <div className={`flex-1 overflow-y-auto mb-4 space-y-6 pr-2 custom-scrollbar pt-8`}>
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                isUser ? 'bg-slate-200' : 'bg-indigo-900 text-white shadow-md'
              }`}>
                {isUser ? <User size={20} className="text-slate-600" /> : <Bot size={20} />}
              </div>
              
              <div className={`max-w-[85%] md:max-w-[70%] space-y-1`}>
                <div className={`p-4 rounded-2xl ${
                  isUser 
                    ? 'bg-slate-900 text-white rounded-tr-sm' 
                    : `${tokens.bgPanel} border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm`
                }`}>
                  {msg.image && (
                    <div className="mb-3">
                      <img 
                        src={msg.image} 
                        alt="Uploaded content" 
                        className="rounded-lg max-h-60 object-contain bg-black/10" 
                      />
                    </div>
                  )}
                  
                  {isUser ? (
                    <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">
                      {msg.text}
                    </p>
                  ) : (
                    <div className="text-sm md:text-base leading-relaxed">
                      <ReactMarkdown
                        components={{
                          h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-4 mb-2 border-b-2 border-indigo-100 pb-1 text-indigo-900" {...props} />,
                          h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-3 mb-2 text-indigo-800" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-md font-bold mt-2 mb-1 text-slate-800" {...props} />,
                          p: ({node, ...props}) => <p className="mb-3 last:mb-0" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
                          li: ({node, ...props}) => <li className="pl-1" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-bold text-indigo-600 bg-indigo-50 px-0.5 rounded" {...props} />,
                          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-indigo-300 pl-4 py-2 my-3 bg-indigo-50/30 italic text-slate-700 rounded-r-lg" {...props} />,
                          code: ({node, ...props}) => <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-pink-600" {...props} />,
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                      {msg.isLoading && msg.text.length === 0 && (
                        <div className="flex gap-1 items-center mt-1">
                          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-100"></span>
                          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-200"></span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {msg.role === 'model' && !msg.isLoading && (
                   <div className="flex items-center gap-2 mt-1">
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest pl-1">
                       Elite AI Lecturer
                     </p>
                     <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 text-green-600 rounded-full border border-green-100">
                        <Sparkles size={8} />
                        <span className="text-[8px] font-bold uppercase">Fact-Checked</span>
                     </div>
                   </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className={`${tokens.bgPanel} p-2 rounded-2xl border border-slate-200 shadow-sm relative`}>
        {selectedImage && (
          <div className="absolute bottom-full left-0 mb-2 p-2 bg-white rounded-xl shadow-lg border border-slate-100 animate-in slide-in-from-bottom-2 fade-in">
            <div className="relative">
              <img src={selectedImage} alt="Preview" className="h-24 rounded-lg object-cover" />
              <button 
                onClick={handleRemoveImage}
                className="absolute -top-2 -right-2 bg-slate-900 text-white rounded-full p-1 hover:bg-red-500 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <input 
            type="file" 
            accept="image/*" 
            capture="environment"
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileSelect}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-3 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
            title="画像をアップロード"
          >
            <ImageIcon size={20} />
          </button>
          
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={selectedImage ? "画像について質問する..." : "分からないことを入力..."}
            className="flex-1 bg-transparent border-none focus:ring-0 resize-none p-3 max-h-32 text-slate-900 placeholder:text-slate-400"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={(!input.trim() && !selectedImage) || isStreaming}
            className={`p-3 rounded-xl flex items-center justify-center transition-all ${
              (input.trim() || selectedImage) && !isStreaming
                ? 'bg-indigo-900 text-white shadow-md hover:bg-indigo-800'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isStreaming ? (
              <Sparkles size={20} className="animate-pulse" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};