import { GoogleGenAI, Type } from "@google/genai";
import { TestQuestion, UserProfile } from "../types";

// --- APIキーの状態管理（サーキットブレーカー） ---
interface ApiKeyStatus {
  key: string;
  isBroken: boolean;
  lastFailureTime: number;
}

const getApiKeys = (): ApiKeyStatus[] => {
  // 環境変数 VITE_GEMINI_API_KEY_1, 2, 3... を取得
  const keys = Object.entries(import.meta.env)
    .filter(([key, value]) => key.startsWith('VITE_GEMINI_API_KEY_') && value)
    .map(([_, value]) => ({
      key: value as string,
      isBroken: false,
      lastFailureTime: 0
    }));
  return keys;
};

const API_POOL = getApiKeys();
const COOL_DOWN_MS = 1000 * 60 * 5; // 5分間休止

// 安定性を重視したモデル選択（1.5系は非常に安定しています）
const MODEL_NAME = 'gemini-1.5-pro'; 

/**
 * 正常なAPIキーを選択し、SDKインスタンスを作成
 */
const getActiveAiInstance = () => {
  const now = Date.now();
  
  // 復活チェック
  API_POOL.forEach(s => {
    if (s.isBroken && now - s.lastFailureTime > COOL_DOWN_MS) {
      s.isBroken = false;
    }
  });

  const availableKeys = API_POOL.filter(s => !s.isBroken);
  const selectedStatus = availableKeys.length > 0 
    ? availableKeys[Math.floor(Math.random() * availableKeys.length)]
    : API_POOL.sort((a, b) => a.lastFailureTime - b.lastFailureTime)[0];

  if (!selectedStatus) {
    throw new Error("APIキーが設定されていません。Vercelの環境変数を確認してください。");
  }

  return {
    genAI: new GoogleGenAI(selectedStatus.key),
    markAsBroken: () => {
      selectedStatus.isBroken = true;
      selectedStatus.lastFailureTime = Date.now();
      console.warn("APIキー故障: 一時的に除外します");
    }
  };
};

/**
 * システムプロンプト生成
 */
const generateSystemInstruction = (userProfile?: UserProfile): string => {
  let instruction = `あなたは日本トップクラスの予備校講師です。難解な概念も平易に解説し、生徒のモチベーションを高めてください。`;
  if (userProfile?.targetUniversity) {
    instruction += `目標大学：${userProfile.targetUniversity}。入試傾向を踏まえた指導を行ってください。`;
  }
  return instruction;
};

/**
 * チャットストリーム（ローテーション対応・安定版）
 */
export const createChatStream = async function* (
  history: any[],
  newMessage: string,
  imageDataUrl?: string,
  userProfile?: UserProfile
) {
  const maxRetries = Math.max(API_POOL.length, 2);
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { genAI, markAsBroken } = getActiveAiInstance();
    let yielded = false;
    try {
      const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        systemInstruction: generateSystemInstruction(userProfile),
      });

      // 画像がある場合のコンテンツ作成
      let parts: any[] = [{ text: newMessage || "解説をお願いします。" }];
      if (imageDataUrl) {
        const [header, base64Data] = imageDataUrl.split(',');
        const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
        parts.push({ inlineData: { mimeType, data: base64Data } });
      }

      const result = await model.generateContentStream({
        contents: [...history, { role: 'user', parts }]
      });

      for await (const chunk of result.stream) {
        yielded = true;
        yield chunk.text();
      }
      return; 
    } catch (error) {
      if (yielded) throw error; 
      markAsBroken();
      lastError = error;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw lastError;
};

/**
 * テスト問題生成（JSON出力安定版）
 */
export const generateTestQuestions = async (topic: string, userProfile?: UserProfile, count: number = 3, difficulty: string = 'intermediate'): Promise<TestQuestion[]> => {
  const maxRetries = Math.max(API_POOL.length, 2);
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { genAI, markAsBroken } = getActiveAiInstance();
    try {
      const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      const prompt = `「${topic}」の4択問題を${count}問作成し、JSON形式で返してください。
      スキーマ: Array<{question: string, options: string[], correctAnswerIndex: number, explanation: string}>`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return JSON.parse(response.text()) as TestQuestion[];
    } catch (error) {
      markAsBroken();
      lastError = error;
    }
  }
  throw lastError;
};
