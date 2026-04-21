import { GoogleGenerativeAI, SchemaType } from "@google/genai";
import { TestQuestion, UserProfile } from "../types";

// --- APIキーの状態管理（サーキットブレーカー） ---
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
  
  // フォールバック
  if (keys.length === 0 && import.meta.env.VITE_GEMINI_API_KEY_1) {
    keys.push({ key: import.meta.env.VITE_GEMINI_API_KEY_1, isBroken: false, lastFailureTime: 0 });
  }
  return keys;
};

const API_POOL = getApiKeys();
const COOL_DOWN_MS = 1000 * 60 * 5; 
const MODEL_NAME = 'gemini-1.5-flash'; // 2024年現在の安定版。3-flash-previewが存在しない場合はこちらを推奨

/**
 * 有効なAPIキーからモデルインスタンスを生成して返す
 */
const getActiveModel = (systemInstruction: string) => {
  const now = Date.now();
  
  // 復旧チェック
  API_POOL.forEach(s => {
    if (s.isBroken && now - s.lastFailureTime > COOL_DOWN_MS) {
      s.isBroken = false;
    }
  });

  const availableKeys = API_POOL.filter(s => !s.isBroken);
  const selectedStatus = availableKeys.length > 0 
    ? availableKeys[Math.floor(Math.random() * availableKeys.length)]
    : API_POOL.sort((a, b) => a.lastFailureTime - b.lastFailureTime)[0];

  const genAI = new GoogleGenerativeAI(selectedStatus.key);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: systemInstruction,
  });

  return {
    model,
    markAsBroken: () => {
      selectedStatus.isBroken = true;
      selectedStatus.lastFailureTime = Date.now();
      console.warn(`API Key broken. Remaining: ${API_POOL.filter(k => !k.isBroken).length}`);
    }
  };
};

/**
 * プロンプト生成（予備校講師）
 */
const generateSystemInstruction = (userProfile?: UserProfile): string => {
  let instruction = `あなたは日本トップクラスの予備校講師です。以下の指針に従って生徒を指導してください。
【指導方針】
1. 最高品質の解説: 本質を突いた平易な言葉で説明。
2. 誤字脱字排除。
3. 誘導的指導: ソクラテス式問答法。
4. 共通テスト対応: 思考力・判断力を養う。
【トーン】温かみのある「です・ます」調。`;

  if (userProfile) {
    if (userProfile.targetUniversity) {
      instruction += `\n第一志望：${userProfile.targetUniversity}。この大学の入試傾向を踏まえた指導をしてください。`;
    }
    if (userProfile.major) {
      instruction += `\n生徒は${userProfile.major === 'arts' ? '文系' : '理系'}です。`;
    }
  }
  return instruction;
};

/**
 * チャットストリーム生成
 */
export const createChatStream = async function* (
  history: any[],
  newMessage: string,
  imageDataUrl?: string,
  userProfile?: UserProfile
) {
  const maxRetries = Math.max(API_POOL.length, 2);
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const systemInstruction = generateSystemInstruction(userProfile);
    const { model, markAsBroken } = getActiveModel(systemInstruction);
    let yielded = false;

    try {
      const chat = model.startChat({ history });

      let messageParts: any[] = [{ text: newMessage }];
      if (imageDataUrl) {
        const [header, base64Data] = imageDataUrl.split(',');
        const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
        messageParts = [
          { text: newMessage || "この画像を解説してください。" },
          { inlineData: { mimeType, data: base64Data } }
        ];
      }

      const result = await chat.sendMessageStream(messageParts);

      for await (const chunk of result.stream) {
        yielded = true;
        yield chunk.text();
      }
      return;
    } catch (error) {
      if (yielded) throw error;
      markAsBroken();
      lastError = error;
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastError;
};

/**
 * テスト問題生成 (Structured Output版)
 */
export const generateTestQuestions = async (topic: string, userProfile?: UserProfile, count: number = 3, difficulty: string = 'intermediate'): Promise<TestQuestion[]> => {
  const maxRetries = Math.max(API_POOL.length, 2);
  let lastError: any;

  const difficultyText = difficulty === 'advanced' ? '難関大レベル' : '標準レベル';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const systemMsg = "あなたは予備校講師です。高品質な4択問題をJSONで作成してください。";
    const { model, markAsBroken } = getActiveModel(systemMsg);

    try {
      const prompt = `${topic}について、${difficultyText}の問題を${count}問作成してください。`;
      
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                question: { type: SchemaType.STRING },
                options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                correctAnswerIndex: { type: SchemaType.NUMBER },
                explanation: { type: SchemaType.STRING }
              },
              required: ["question", "options", "correctAnswerIndex", "explanation"]
            }
          }
        }
      });

      const text = result.response.text();
      return JSON.parse(text) as TestQuestion[];
    } catch (error) {
      markAsBroken();
      lastError = error;
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastError;
};
