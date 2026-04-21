import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { TestQuestion, UserProfile } from "../types";

// --- APIキーの状態管理（サーキットブレーカー） ---
interface ApiKeyStatus {
  key: string;
  isBroken: boolean;
  lastFailureTime: number;
}

const getApiKeys = (): ApiKeyStatus[] => {
  // VITE_GEMINI_API_KEY_1 から順に取得
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
const COOL_DOWN_MS = 1000 * 60 * 5; // 故障したキーは5分間封印
const MODEL_TEXT = 'gemini-3.1-pro-preview';
const MODEL_FLASH = 'gemini-3-flash-preview';

/**
 * 正常なAPIキーをローテーションで選択
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
  
  // 全滅時は一番古いやつを無理やり使う
  const selectedStatus = availableKeys.length > 0 
    ? availableKeys[Math.floor(Math.random() * availableKeys.length)]
    : API_POOL.sort((a, b) => a.lastFailureTime - b.lastFailureTime)[0];

  if (!selectedStatus) {
    throw new Error("APIキーが設定されていません。Vercelの環境変数を確認してください。");
  }

  return {
    ai: new GoogleGenAI(selectedStatus.key),
    markAsBroken: () => {
      selectedStatus.isBroken = true;
      selectedStatus.lastFailureTime = Date.now();
      console.warn(`Key error detected. Skiping this key for 5 mins.`);
    }
  };
};

/**
 * システムインストラクション生成
 */
const generateSystemInstruction = (userProfile?: UserProfile): string => {
  let instruction = `あなたは日本トップクラスの予備校講師です。以下の指針に従って生徒を指導してください。

【指導方針】
1. **最高品質の解説**: 難解な概念も、本質を突いた平易な言葉で説明してください。
2. **誤字脱字の徹底排除**: 送信前に必ず校正してください。
3. **誘導的指導**: ソクラテス式問答法を用いて生徒自身が気付けるように誘導してください。
4. **共通テスト・難関大対応**: 単なる暗記ではない「使える知識」を授けてください。

【ハルシネーション防止とファクトチェック】
1. **根拠に基づく回答**: 信頼できる事実に基づいた回答をしてください。
2. **ファクトチェックの徹底**: 特に歴史的事実や最新の入試情報はGoogle検索などを参照してください。
3. **不確実性の明示**: 断定的な表現を避けてください。
4. **プログラム実行前の検証**: 数学の解法等はステップバイステップで検証してください。

【トーン＆マナー】
* 自信に満ち、頼りがいがあるが、威圧的ではない。
* 温かみのある「です・ます」調。
* 箇条書きや太字を適切に使用する。`;

  if (userProfile) {
    if (userProfile.targetUniversity) {
      instruction += `\n\n【生徒の目標】\n第一志望：${userProfile.targetUniversity}\n「${userProfile.targetUniversity}ではここが合否を分けます」といった具体的なアドバイスを盛り込んでください。`;
    }
    if (userProfile.major) {
      const majorText = userProfile.major === 'arts' ? '文系' : '理系';
      instruction += `\n\n【生徒の属性】\nこの生徒は「${majorText}」です。`;
      if (userProfile.major === 'arts') {
        instruction += `具体的なイメージや比喩を用いて直感的に理解できるよう工夫してください。背景知識を豊かに広げる指導を意識してください。`;
      } else {
        instruction += `論理の飛躍がないよう厳密さを大切にしつつ、応用問題への展開を示唆してください。効率的に知識を整理できるよう指導してください。`;
      }
    }
  }
  return instruction;
};

/**
 * チャットストリーム生成（ローテーション対応）
 */
export const createChatStream = async function* (
  history: { role: 'user' | 'model'; parts: { text?: string; inlineData?: any }[] }[],
  newMessage: string,
  imageDataUrl?: string,
  userProfile?: UserProfile
) {
  // キーの数だけリトライを試みる
  const maxRetries = Math.max(API_POOL.length, 2);
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { ai, markAsBroken } = getActiveAiInstance();
    let yielded = false;
    try {
      const model = ai.getGenerativeModel({
        model: MODEL_TEXT,
        systemInstruction: generateSystemInstruction(userProfile),
        tools: [{ googleSearch: {} }],
      });

      // メッセージ構築
      let parts: any[] = [{ text: newMessage }];
      if (imageDataUrl) {
        const [header, base64Data] = imageDataUrl.split(',');
        const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
        parts.push({ inlineData: { mimeType, data: base64Data } });
      }

      const chat = model.startChat({
        history: history,
        generationConfig: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
        }
      });

      const result = await chat.sendMessageStream(parts);

      for await (const chunk of result.stream) {
        yielded = true;
        yield chunk.text();
      }
      return; 
    } catch (error) {
      if (yielded) throw error; 
      console.error(`Attempt ${attempt + 1} failed:`, error);
      markAsBroken(); // 失敗したキーを「故障」に設定
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  throw lastError;
};

/**
 * テスト問題生成（ローテーション対応）
 */
export const generateTestQuestions = async (topic: string, userProfile?: UserProfile, count: number = 3, difficulty: string = 'intermediate'): Promise<TestQuestion[]> => {
  const maxRetries = Math.max(API_POOL.length, 2);
  let lastError: any;

  const difficultyMap: Record<string, string> = {
    'beginner': '基礎・基本レベル',
    'intermediate': '標準・共通テストレベル',
    'advanced': '応用・難関大入試レベル'
  };

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { ai, markAsBroken } = getActiveAiInstance();
    try {
      const model = ai.getGenerativeModel({
        model: MODEL_TEXT,
        systemInstruction: "あなたは予備校講師です。ファクトチェックを徹底し、高品質な問題をJSONで生成してください。",
        tools: [{ googleSearch: {} }]
      });

      let prompt = `「${topic}」に関する${difficultyMap[difficulty]}の4択問題を作成してください。（全${count}問）`;
      if (userProfile?.targetUniversity) prompt += `\n【ターゲット：${userProfile.targetUniversity}】`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
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

      const responseText = result.response.text();
      if (responseText) return JSON.parse(responseText) as TestQuestion[];
    } catch (error) {
      console.error(`Question generation attempt ${attempt + 1} failed:`, error);
      markAsBroken();
      lastError = error;
    }
  }
  throw lastError;
};
