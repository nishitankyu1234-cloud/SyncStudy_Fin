import { GoogleGenAI, Type } from "@google/genai";
import { TestQuestion, UserProfile } from "../types";

// --- APIキーの状態管理 ---
interface ApiKeyStatus {
  key: string;
  isBroken: boolean;
  lastFailureTime: number;
}

const getApiKeys = (): ApiKeyStatus[] => {
  const keys = Object.entries(import.meta.env)
    .filter(([key, value]) => key.startsWith('VITE_GEMINI_API_KEY_') && value)
    .map(([_, value]) => ({
      key: value as string,
      isBroken: false,
      lastFailureTime: 0
    }));
  // 万が一1つも取れなかった時のための最終防衛ライン
  return keys.length > 0 ? keys : [{ key: import.meta.env.VITE_GEMINI_API_KEY_1 || '', isBroken: false, lastFailureTime: 0 }];
};

const API_POOL = getApiKeys();
const COOL_DOWN_MS = 1000 * 60 * 5; 

// モデルは現在最も安定している「1.5 Flash」に固定します。
// 2.0系やThinking機能は、これが動いてから戻しましょう。
const STABLE_MODEL = 'gemini-1.5-flash';

const getActiveAiInstance = () => {
  const now = Date.now();
  API_POOL.forEach(s => {
    if (s.isBroken && now - s.lastFailureTime > COOL_DOWN_MS) s.isBroken = false;
  });

  const availableKeys = API_POOL.filter(s => !s.isBroken);
  const selectedStatus = availableKeys.length > 0 
    ? availableKeys[Math.floor(Math.random() * availableKeys.length)]
    : API_POOL.sort((a, b) => a.lastFailureTime - b.lastFailureTime)[0];

  return {
    // 成功したコードと同じ「new GoogleGenAI({ apiKey: ... })」の形にします
    ai: new GoogleGenAI({ apiKey: selectedStatus.key }),
    markAsBroken: () => {
      selectedStatus.isBroken = true;
      selectedStatus.lastFailureTime = Date.now();
    }
  };
};

const generateSystemInstruction = (userProfile?: UserProfile): string => {
  return `あなたは予備校講師です。${userProfile?.targetUniversity ? `志望校は${userProfile.targetUniversity}です。` : ''}親身に教えてください。`;
};

/**
 * チャットストリーム：成功したコードの構造を完全再現
 */
export const createChatStream = async function* (
  history: any[],
  newMessage: string,
  imageDataUrl?: string,
  userProfile?: UserProfile
) {
  const { ai, markAsBroken } = getActiveAiInstance();
  
  try {
    // 成功したコードと同じ「ai.chats.create」を使います
    const chat = ai.chats.create({
      model: STABLE_MODEL,
      history: history,
      config: { systemInstruction: generateSystemInstruction(userProfile) }
    });

    let messageContent: any = newMessage;
    if (imageDataUrl) {
      const [header, base64Data] = imageDataUrl.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
      messageContent = [
        { text: newMessage || "解説してください" },
        { inlineData: { mimeType, data: base64Data } }
      ];
    }

    const result = await chat.sendMessageStream({ message: messageContent });

    for await (const chunk of result) {
      yield chunk.text;
    }
  } catch (error) {
    markAsBroken();
    console.error("Chat Error:", error);
    throw error;
  }
};

/**
 * 問題生成：成功したコードの構造を完全再現
 */
export const generateTestQuestions = async (topic: string, userProfile?: UserProfile): Promise<TestQuestion[]> => {
  const { ai, markAsBroken } = getActiveAiInstance();
  try {
    const prompt = `「${topic}」の4択問題を3問、JSON形式で作成してください。`;
    const response = await ai.models.generateContent({
      model: STABLE_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswerIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING }
            },
            required: ["question", "options", "correctAnswerIndex", "explanation"]
          }
        }
      }
    });
    return JSON.parse(response.text) as TestQuestion[];
  } catch (error) {
    markAsBroken();
    throw error;
  }
};
