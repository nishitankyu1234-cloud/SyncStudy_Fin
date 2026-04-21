import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
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
  return keys.length > 0 ? keys : [];
};

const API_POOL = getApiKeys();
const COOL_DOWN_MS = 1000 * 60 * 5; 

// モデル設定：思考機能(Thinking)と検索が使える最新モデルを指定
const MODEL_THINKING = 'gemini-2.0-flash-thinking-exp-01-21'; 
const MODEL_FLASH = 'gemini-2.0-flash'; // 問題生成用（速さ重視）

/**
 * 正常なAPIキーを選択
 */
const getActiveAiInstance = () => {
  const now = Date.now();
  API_POOL.forEach(s => {
    if (s.isBroken && now - s.lastFailureTime > COOL_DOWN_MS) s.isBroken = false;
  });

  const availableKeys = API_POOL.filter(s => !s.isBroken);
  const selectedStatus = availableKeys.length > 0 
    ? availableKeys[Math.floor(Math.random() * availableKeys.length)]
    : API_POOL.sort((a, b) => a.lastFailureTime - b.lastFailureTime)[0];

  if (!selectedStatus) throw new Error("APIキーが未設定です");

  return {
    genAI: new GoogleGenAI(selectedStatus.key),
    markAsBroken: () => {
      selectedStatus.isBroken = true;
      selectedStatus.lastFailureTime = Date.now();
      console.warn("APIキーを一時除外しました");
    }
  };
};

/**
 * 講師プロンプト生成（1つ目の詳細な指示を継承）
 */
const generateSystemInstruction = (userProfile?: UserProfile): string => {
  let instruction = `あなたは日本トップクラスの予備校講師です。
【指導方針】
1. 最高品質の解説：論理的かつ構造的に回答してください。
2. 誤字脱字の徹底排除。
3. 誘導的指導：ソクラテス式問答法を用いて生徒自身が気付けるようにしてください。
4. 共通テスト・難関大対応：思考力・判断力を養う「使える知識」を伝授してください。
【ハルシネーション防止】
最新の入試情報や事実はGoogle検索を行い、正確性を担保してください。`;

  if (userProfile) {
    if (userProfile.targetUniversity) {
      instruction += `\n第一志望：${userProfile.targetUniversity}。「${userProfile.targetUniversity}の入試ではここが合否を分ける」といった助言を盛り込んでください。`;
    }
    if (userProfile.major) {
      const isArts = userProfile.major === 'arts';
      instruction += `\n属性：${isArts ? '文系' : '理系'}。${isArts ? 'イメージや比喩を用いて直感的に' : '論理の飛躍がないよう厳密に'}解説してください。`;
    }
  }
  return instruction;
};

/**
 * チャットストリーム（Thinking ＆ Google検索 有効化）
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
        model: MODEL_THINKING,
        systemInstruction: generateSystemInstruction(userProfile),
        // 1つ目のコードの強み「Google検索」を有効化
        tools: [{ googleSearch: {} }] as any, 
      });

      const chat = model.startChat({
        history: history,
        generationConfig: {
          // 思考レベルを設定
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          maxOutputTokens: 4000
        }
      });

      let content: any = newMessage;
      if (imageDataUrl) {
        const [header, base64Data] = imageDataUrl.split(',');
        const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
        content = [{ text: newMessage || "解説してください" }, { inlineData: { mimeType, data: base64Data } }];
      }

      const result = await chat.sendMessageStream(content);

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
 * テスト問題生成（2つ目の安定版を継承）
 */
export const generateTestQuestions = async (topic: string, userProfile?: UserProfile, count: number = 3, difficulty: string = 'intermediate'): Promise<TestQuestion[]> => {
  const { genAI, markAsBroken } = getActiveAiInstance();
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_FLASH,
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `「${topic}」の4択問題を${count}問作成。JSON形式で。`;
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text()) as TestQuestion[];
  } catch (error) {
    markAsBroken();
    throw error;
  }
};
