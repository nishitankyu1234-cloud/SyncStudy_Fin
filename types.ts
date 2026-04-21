export interface Theme {
  id: string;
  name: string;
  description: string;
  tokens: {
    bgApp: string;
    bgPanel: string;
    bgSurface: string;
    textMain: string;
    textMuted: string;
    textAccent: string;
    primary: string;
    secondary: string;
    border: string;
    font: string;
    rounded: string;
    shadow: string;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string; // Data URL (base64)
  isLoading?: boolean;
}

export interface TestQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number; // 0-3
  explanation: string;
}

export interface TestResult {
  id: string;
  date: string;
  topic: string;
  score: number;
  totalQuestions: number;
  questions: TestQuestion[];
  userAnswers: (number | null)[];
}

export interface TestData {
  topic: string;
  questions: TestQuestion[];
}

export interface UserProfile {
  name: string;
  targetUniversity: string;
  major?: 'arts' | 'science' | 'undecided'; // 文系 | 理系 | 未定
  grade?: number; // 1, 2, 3
  lastUpdatedYear?: number; // 年度更新の判定用
}

export interface Subject {
  id: string;
  name: string;
  icon: string;
  children?: Subject[];
}

export type ViewState = 'dashboard' | 'chat' | 'test' | 'profile';
