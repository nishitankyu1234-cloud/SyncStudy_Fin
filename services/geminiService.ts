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
  // 環境変数が1つしかない場合や取得失敗時のフォールバック
  return keys.length > 0 ? keys : [{ key: import.meta.env.VITE_GEMINI_API_KEY_1, isBroken: false, lastFailureTime: 0 }];
};

const API_POOL = getApiKeys();
const COOL_DOWN_MS = 1000 * 60 * 5; // 5分間除外
const MODEL_TEXT = 'gemini-3.1-pro-preview';

/**
 * 正常なAPIキーを選択し、インスタンスと故障報告関数を返す
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
  // 全滅時は一番古いやつを試す
  const selectedStatus = availableKeys.length > 0 
    ? availableKeys[Math.floor(Math.random() * availableKeys.length)]
    : API_POOL.sort((a, b) => a.lastFailureTime - b.lastFailureTime)[0];

  return {
    ai: new GoogleGenAI({ apiKey: selectedStatus.key }),
    markAsBroken: () => {
      selectedStatus.isBroken = true;
      selectedStatus.lastFailureTime = Date.now();
      console.warn(`Key error. Remaining: ${API_POOL.filter(k => !k.isBroken).length}`);
    }
  };
};

/**
 * システムインストラクション生成
 */
const generateSystemInstruction = (userProfile?: UserProfile): string => {
  let instruction = `
あなたは日本トップクラスの予備校講師です。以下の指針に従って生徒を指導してください。

【指導方針】
1. **最高品質の解説**: 難解な概念も、本質を突いた平易な言葉で説明し、論理的かつ構造的に回答してください。
2. **誤字脱字の徹底排除**: 生成されたテキストは送信前に必ず校正し、誤字脱字や不自然な日本語がないようにしてください。
3. **誘導的指導**: すぐに答えを教えるのではなく、ソクラテス式問答法を用いて生徒自身が気付けるように誘導してください。
4. **共通テスト・難関大対応**: 共通テストの傾向（思考力・判断力・表現力）を意識し、単なる暗記ではない「使える知識」を授けてください。

【ハルシネーション防止とファクトチェック】
1. **根拠に基づく回答**: 推測や不確かな情報ではなく、常に信頼できる事実に基づいた回答をしてください。
2. **ファクトチェックの徹底**: 回答を生成する前に、必ず事実関係を確認してください。
3. **不確実性の明示**: 情報が不足している場合は正直に伝え、断定を避けてください。
4. **論理的検証**: 数学やコードはステップバイステップで検証してください。

【トーン＆マナー】
* 自信に満ち、頼りがいがあるが、威圧的ではない。
* 温かみのある「です・ます」調。
* 箇条書きや太字を適切に使用する。
`;

  if (userProfile) {
    if (userProfile.targetUniversity) {
      instruction += `\n\n【生徒の目標】\n第一志望：${userProfile.targetUniversity}\n${userProfile.targetUniversity}の入試傾向を熟知したプロとして「${userProfile.targetUniversity}ではここが合否を分けます」といった具体的なアドバイスを盛り込んでください。`;
    }
    if (userProfile.major) {
      const majorText = userProfile.major === 'arts' ? '文系' : '理系';
      instruction += `\n\n【生徒の属性】\nこの生徒は「${majorText}」です。`;
      if (userProfile.major === 'arts') {
        instruction += `\n・数理には具体的イメージや比喩を多用してください。\n・国社には背景知識を広げ記述力を高めてください。`;
      } else {
        instruction += `\n・数理には論理的厳密さを保ち応用を。 \n・国社には因果関係や対比を明確に整理してください。`;
      }
    }
  }
  return instruction;
};

/**
 * チャットストリーム（ローテーション対応）
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
    const { ai, markAsBroken } = getActiveAiInstance();
    let yielded = false;
    try {
      const chat = ai.chats.create({
        model: MODEL_TEXT,
        history: history,
        config: {
          systemInstruction: generateSystemInstruction(userProfile),
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
        }
      });

      let messageContent: any = newMessage;
      if (imageDataUrl) {
        const [header, base64Data] = imageDataUrl.split(',');
        const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
        messageContent = [
          { text: newMessage || "この画像を入試問題の視点から解説してください。" },
          { inlineData: { mimeType, data: base64Data } }
        ];
      }

      const result = await chat.sendMessageStream({ message: messageContent });

      for await (const chunk of result) {
        yielded = true;
        yield chunk.text;
      }
      return; 
    } catch (error) {
      if (yielded) throw error;
      console.error(`Attempt ${attempt + 1} with a key failed:`, error);
      markAsBroken();
      lastError = error;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  throw lastError;
};

/**
 * テスト問題生成（ローテーション対応）
 */
export const generateTestQuestions = async (topic: string, userProfile?: UserProfile, count: number = 3, difficulty: string = 'intermediate'): Promise<TestQuestion[]> => {
  const difficultyMap: Record<string, string> = {
    'beginner': '基礎レベル', 'intermediate': '標準・共通テストレベル', 'advanced': '難関大レベル'
  };

  const maxRetries = Math.max(API_POOL.length, 2);
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { ai, markAsBroken } = getActiveAiInstance();
    try {
      let prompt = `「${topic}」に関する${difficultyMap[difficulty] || '標準'}の4択問題を作成してください。（全${count}問）`;
      if (userProfile?.targetUniversity) prompt += `\n【ターゲット：${userProfile.targetUniversity}】入試傾向を反映させてください。`;

      const response = await ai.models.generateContent({
        model: MODEL_TEXT,
        contents: prompt,
        config: {
          systemInstruction: "あなたは予備校講師です。正確な情報に基づき、学習効果の高い問題をJSONで生成してください。ハルシネーションを徹底排除してください。",
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }],
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

      if (response.text) return JSON.parse(response.text) as TestQuestion[];
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      markAsBroken();
      lastError = error;
    }
  }
  throw lastError;
};
