import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { TestQuestion, UserProfile } from "../types";

// --- APIキーの管理 (サーキットブレーカー) ---
interface ApiKeyStatus {
  key: string;
  isBroken: boolean;
  lastFailureTime: number;
}

// 環境変数 VITE_GEMINI_API_KEY_1 〜 5 を取得
const getApiKeys = (): ApiKeyStatus[] => {
  const keys = Object.entries(import.meta.env)
    .filter(([key, value]) => key.startsWith('VITE_GEMINI_API_KEY_') && value)
    .map(([_, value]) => ({
      key: value as string,
      isBroken: false,
      lastFailureTime: 0
    }));
  return keys.length > 0 ? keys : [];
};

const API_POOL = getApiKeys();
const COOL_DOWN_MS = 1000 * 60 * 5; // エラーの出たキーは5分間休止

// モデル設定（動くことを優先した最新の思考モデル）
const MODEL_TEXT = 'gemini-2.0-flash-thinking-exp-01-21'; 
const MODEL_FLASH = 'gemini-2.0-flash';

/**
 * 利用可能なAPIキーを選択し、SDKインスタンスを返す
 */
const getActiveAiInstance = () => {
  const now = Date.now();
  
  // 復旧チェック
  API_POOL.forEach(s => {
    if (s.isBroken && now - s.lastFailureTime > COOL_DOWN_MS) {
      s.isBroken = false;
    }
  });

  const availableKeys = API_POOL.filter(s => !s.isBroken);
  
  // 使えるキーがなければ、一番古いやつを試す
  const selectedStatus = availableKeys.length > 0 
    ? availableKeys[Math.floor(Math.random() * availableKeys.length)]
    : API_POOL.sort((a, b) => a.lastFailureTime - b.lastFailureTime)[0];

  if (!selectedStatus) {
    throw new Error("APIキーが設定されていません。VercelのEnvironment Variablesを確認してください。");
  }

  return {
    genAI: new GoogleGenAI(selectedStatus.key),
    markAsBroken: () => {
      selectedStatus.isBroken = true;
      selectedStatus.lastFailureTime = Date.now();
      console.warn("Key error: skipping this key for a while.");
    }
  };
};

/**
 * システムプロンプト生成
 */
const generateSystemInstruction = (userProfile?: UserProfile): string => {
  let instruction = `あなたは日本トップクラスの予備校講師です。
【指導方針】
1. 最高品質の解説 2. 誤字脱字の徹底排除 3. 誘導的指導（ソクラテス式） 4. 共通テスト・難関大対応
【ハルシネーション防止】
根拠に基づき、不明な点は正直に伝え、論理的矛盾がないかステップバイステップで検証してください。`;

  if (userProfile) {
    if (userProfile.targetUniversity) {
      instruction += `\n\n【生徒の目標】第一志望：${userProfile.targetUniversity}。入試傾向に合わせた具体的な助言を盛り込んでください。`;
    }
    if (userProfile.major) {
      const majorText = userProfile.major === 'arts' ? '文系' : '理系';
      instruction += `\n\n【生徒の属性】「${majorText}」です。${majorText === 'arts' ? '具体的なイメージや比喩を多用' : '厳密な論理と応用への展開'}を意識してください。`;
    }
  }
  return instruction;
};

/**
 * チャットストリーム生成
 */
export const createChatStream = async function* (
  history: { role: 'user' | 'model'; parts: { text?: string; inlineData?: any }[] }[],
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
        model: MODEL_TEXT,
        systemInstruction: generateSystemInstruction(userProfile),
      });

      // メッセージ構築
      let currentParts: any[] = [{ text: newMessage }];
      if (imageDataUrl) {
        const [header, base64Data] = imageDataUrl.split(',');
        const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
        currentParts.push({ inlineData: { mimeType, data: base64Data } });
      }

      const chat = model.startChat({
        history: history,
        generationConfig: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          maxOutputTokens: 4000,
        }
      });

      const result = await chat.sendMessageStream(currentParts);

      for await (const chunk of result.stream) {
        yielded = true;
        yield chunk.text();
      }
      return; 
    } catch (error) {
      if (yielded) throw error; 
      markAsBroken();
      lastError = error;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  throw lastError;
};

/**
 * テスト問題生成
 */
export const generateTestQuestions = async (topic: string, userProfile?: UserProfile, count: number = 3, difficulty: string = 'intermediate'): Promise<TestQuestion[]> => {
  const maxRetries = Math.max(API_POOL.length, 2);
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { genAI, markAsBroken } = getActiveAiInstance();
    try {
      const model = genAI.getGenerativeModel({
        model: MODEL_FLASH, // 構造化出力はFlashの方が高速で安定します
        generationConfig: {
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

      const prompt = `「${topic}」に関する${difficulty}レベルの4択問題を${count}問作成してください。
      ${userProfile?.targetUniversity ? `ターゲット：${userProfile.targetUniversity}` : ''}`;

      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text()) as TestQuestion[];
    } catch (error) {
      markAsBroken();
      lastError = error;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw lastError;
};
