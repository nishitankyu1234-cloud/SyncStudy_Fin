import { GoogleGenAI, SchemaType } from "@google/genai";
import { TestQuestion, UserProfile } from "../types";

// --- 1. APIキーの取得 (Vite/Vercel用) ---
// VITE_GEMINI_API_KEY_1 があればそれ、なければ VITE_GEMINI_API_KEY を使います
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY_1 || import.meta.env.VITE_GEMINI_API_KEY || "";

// --- 2. SDKの初期化 (エラーが出ていた部分を修正) ---
// new GoogleGenAI({ apiKey: ... }) ではなく、直接文字列を渡すのが最新の正解です
const genAI = new GoogleGenAI(API_KEY);

// モデルの指定（安定している 1.5 Flash を使用）
const MODEL_NAME = "gemini-1.5-flash";

/**
 * 講師のキャラクター設定（システムプロンプト）
 */
const getSystemInstruction = (userProfile?: UserProfile): string => {
  let instruction = `あなたは日本トップクラスの予備校講師です。
1. 論理的で分かりやすい解説。
2. 生徒自身に考えさせるソクラテス式問答法。
3. 共通テスト・難関大入試を意識した実践的アドバイス。`;

  if (userProfile?.targetUniversity) {
    instruction += `\n目標：${userProfile.targetUniversity}合格。その大学の傾向に合わせた指導をしてください。`;
  }
  return instruction;
};

/**
 * チャット機能
 */
export const createChatStream = async function* (
  history: any[],
  newMessage: string,
  imageDataUrl?: string,
  userProfile?: UserProfile
) {
  if (!API_KEY) throw new Error("APIキーが設定されていません。VercelのEnvironment Variablesを確認してください。");

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: getSystemInstruction(userProfile),
    });

    const chat = model.startChat({
      history: history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: h.parts.map((p: any) => ({ text: p.text }))
      })),
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

    const result = await chat.sendMessageStream(messageContent);

    for await (const chunk of result.stream) {
      yield chunk.text();
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

/**
 * 問題作成機能
 */
export const generateTestQuestions = async (topic: string, userProfile?: UserProfile): Promise<TestQuestion[]> => {
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              question: { type: SchemaType.STRING },
              options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              correctAnswerIndex: { type: SchemaType.INTEGER },
              explanation: { type: SchemaType.STRING }
            },
            required: ["question", "options", "correctAnswerIndex", "explanation"]
          }
        }
      }
    });

    const prompt = `「${topic}」に関する4択問題を3問作成してください。`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text) as TestQuestion[];
  } catch (error) {
    console.error("Test Generation Error:", error);
    throw error;
  }
};
