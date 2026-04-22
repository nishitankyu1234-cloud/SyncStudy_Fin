import { GoogleGenAI, Type } from "@google/genai";
import { TestQuestion, UserProfile } from "../types";

// --- 1. APIキーの取得 ---
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY_1 || import.meta.env.VITE_GEMINI_API_KEY || "";

// --- 2. SDKの初期化 ---
const genAI = new GoogleGenAI(API_KEY);

const MODEL_NAME = "gemini-1.5-flash";

/**
 * 講師のキャラクター設定
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
  if (!API_KEY) throw new Error("APIキーが設定されていません。");

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: getSystemInstruction(userProfile),
    });

    const chat = model.startChat({
      history: history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.parts?.[0]?.text || "" }]
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
 * 問題作成機能 (SchemaType を Type に修正)
 */
export const generateTestQuestions = async (topic: string, userProfile?: UserProfile): Promise<TestQuestion[]> => {
  try {
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

    const prompt = `「${topic}」に関する4択問題を3問作成してください。`;
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text()) as TestQuestion[];
  } catch (error) {
    console.error("Test Generation Error:", error);
    throw error;
  }
};
