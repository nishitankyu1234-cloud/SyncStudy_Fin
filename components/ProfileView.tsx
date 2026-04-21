import React, { useState } from 'react';
import { APP_THEME } from '../constants';
import { UserProfile } from '../types';
import { School, User, Save, GraduationCap, BookOpen, Calculator } from 'lucide-react';

interface ProfileViewProps {
  profile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ profile, onUpdateProfile }) => {
  const { tokens } = APP_THEME;
  const [formData, setFormData] = useState<UserProfile>(profile);
  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentSchoolYear = currentMonth >= 4 ? currentYear : currentYear - 1;
    
    onUpdateProfile({ ...formData, lastUpdatedYear: currentSchoolYear });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">設定・目標</h2>
        <p className="text-slate-500 mt-1">あなたのプロフィールと志望校を設定します。</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className={`${tokens.bgPanel} p-6 md:p-8 ${tokens.rounded} ${tokens.shadow} border border-slate-200`}>
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
              <User size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">基本情報</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ニックネーム
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                placeholder="学生"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                学年
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setFormData({ ...formData, grade: g })}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      formData.grade === g
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-500'
                    }`}
                  >
                    <span className="font-bold">高校{g}年生</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                文理選択
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, major: 'arts' })}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                    formData.major === 'arts'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-500'
                  }`}
                >
                  <BookOpen size={24} />
                  <span className="font-bold">文系</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, major: 'science' })}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                    formData.major === 'science'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-500'
                  }`}
                >
                  <Calculator size={24} />
                  <span className="font-bold">理系</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={`${tokens.bgPanel} p-6 md:p-8 ${tokens.rounded} ${tokens.shadow} border border-slate-200`}>
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <School size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">志望校設定</h3>
              <p className="text-xs text-slate-500">設定すると、AI先生や小テストが志望校対策向けに調整されます。</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                第一志望大学
              </label>
              <div className="relative">
                <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  value={formData.targetUniversity}
                  onChange={(e) => setFormData({ ...formData, targetUniversity: e.target.value })}
                  className="w-full pl-10 p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  placeholder="例：東京大学、早稲田大学"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className={`${tokens.primary} px-8 py-3 rounded-xl font-medium flex items-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95`}
          >
            {isSaved ? '保存しました！' : '設定を保存'}
            {!isSaved && <Save size={18} />}
          </button>
        </div>
      </form>
    </div>
  );
};