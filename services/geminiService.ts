import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { TestQuestion, UserProfile } from "../types";

// Vite環境では import.meta.env を使用
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenAI(API_KEY);

const MODEL_NAME = 'gemini-3-flash';

/**
 * システムプロンプト生成（あなたの力作をそのまま活かします）
 */
const getSystemInstruction = (userProfile?: UserProfile): string => {
  let instruction = `あなたは日本トップクラスの予備校講師です...（中略）`; // 元のプロンプトをここに
  if (userProfile?.targetUniversity) {
    instruction += `\n\n【目標】${userProfile.targetUniversity}合格。`;
  }
  return instruction;
};

export const createChatStream = async function* (
  history: any[],
  newMessage: string,
  imageDataUrl?: string,
  userProfile?: UserProfile
) {
  const maxRetries = 2;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // モデルの初期化（ここで設定をまとめる）
      const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        systemInstruction: getSystemInstruction(userProfile),
        tools: [{ googleSearch: {} }] as any, // 検索機能を有効化
      });

      const chat = model.startChat({
        history: history,
        generationConfig: {
          // Thinking機能を有効化（対応モデルの場合）
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          maxOutputTokens: 4000,
        },
      });

      // メッセージの構築
      let parts: any[] = [{ text: newMessage }];
      if (imageDataUrl) {
        const [header, base64Data] = imageDataUrl.split(',');
        const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
        parts.push({ inlineData: { mimeType, data: base64Data } });
      }

      const result = await chat.sendMessageStream(parts);

      for await (const chunk of result.stream) {
        yield chunk.text();
      }
      return;
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries) throw error;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
};

/**
 * テスト問題生成
 */
export const generateTestQuestions = async (topic: string, userProfile?: UserProfile): Promise<TestQuestion[]> => {
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
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

  const prompt = `「${topic}」に関する4択問題を生成してください。`;
  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
};
