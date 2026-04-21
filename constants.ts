import { Theme, Subject } from './types';

export const APP_THEME: Theme = {
  "id": "modern-minimal",
  "name": "モダン・ミニマル",
  "description": "清潔感があり、余白を活かしたミニマルなデザイン。集中力を高めるシンプルなスタイル。",
  "tokens": {
    "bgApp": "bg-slate-50",
    "bgPanel": "bg-white",
    "bgSurface": "bg-slate-100",
    "textMain": "text-slate-900",
    "textMuted": "text-slate-500",
    "textAccent": "text-indigo-600",
    "primary": "bg-slate-900 text-white hover:bg-slate-800 transition-colors",
    "secondary": "bg-slate-200 text-slate-800 hover:bg-slate-300 transition-colors",
    "border": "border border-slate-200",
    "font": "font-sans",
    "rounded": "rounded-2xl",
    "shadow": "shadow-sm"
  }
};

export const SUBJECTS: Subject[] = [
  { id: 'japanese', name: '国語', icon: 'BookOpen' },
  { id: 'math', name: '数学', icon: 'Calculator' },
  { id: 'english', name: '外国語(英語)', icon: 'Languages' },
  { 
    id: 'geography', 
    name: '地理', 
    icon: 'Map',
    children: [
      { id: 'geography_comprehensive', name: '地理総合', icon: 'Map' },
      { id: 'geography_inquiry', name: '地理探究', icon: 'Map' }
    ]
  },
  { 
    id: 'history', 
    name: '歴史', 
    icon: 'Landmark',
    children: [
      { id: 'history_comprehensive', name: '歴史総合', icon: 'Landmark' },
      { id: 'japanese_history', name: '日本史探究', icon: 'Landmark' },
      { id: 'world_history', name: '世界史探究', icon: 'Globe' }
    ]
  },
  { 
    id: 'civics', 
    name: '公民', 
    icon: 'Scale',
    children: [
      { id: 'public', name: '公共', icon: 'Users' },
      { id: 'ethics', name: '倫理', icon: 'Scale' },
      { id: 'politics_economy', name: '政治・経済', icon: 'Building2' }
    ]
  },
  { 
    id: 'science_basic', 
    name: '理科基礎', 
    icon: 'FlaskConical',
    children: [
      { id: 'physics_basic', name: '物理基礎', icon: 'Zap' },
      { id: 'chemistry_basic', name: '化学基礎', icon: 'FlaskConical' },
      { id: 'biology_basic', name: '生物基礎', icon: 'Dna' },
      { id: 'earth_science_basic', name: '地学基礎', icon: 'Mountain' }
    ]
  },
  { 
    id: 'science_advanced', 
    name: '理科(発展)', 
    icon: 'Atom',
    children: [
      { id: 'physics', name: '物理', icon: 'Zap' },
      { id: 'chemistry', name: '化学', icon: 'FlaskConical' },
      { id: 'biology', name: '生物', icon: 'Dna' },
      { id: 'earth_science', name: '地学', icon: 'Mountain' }
    ]
  },
  { id: 'information', name: '情報', icon: 'Terminal' },
];