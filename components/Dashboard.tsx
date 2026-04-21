import React, { useState } from 'react';
import { APP_THEME, SUBJECTS } from '../constants';
import { ArrowRight, BookOpen, Star, Trophy, School, Settings, Calculator, ChevronLeft, Clock } from 'lucide-react';
import { UserProfile, Subject } from '../types';

interface DashboardProps {
  onSelectSubject: (subject: string) => void;
  onNavigate: (view: any) => void;
  userProfile: UserProfile;
  stats: {
    totalCorrect: number;
    streak: number;
    studyTime: number;
  };
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectSubject, onNavigate, userProfile, stats }) => {
  const { tokens } = APP_THEME;
  const [selectedParentSubject, setSelectedParentSubject] = useState<Subject | null>(null);

  const handleSubjectClick = (subject: Subject) => {
    if (subject.children) {
      setSelectedParentSubject(subject);
    } else {
      onSelectSubject(subject.name);
      onNavigate('chat');
    }
  };

  const getMajorLabel = () => {
    if (userProfile.major === 'arts') return { label: '文系', icon: BookOpen };
    if (userProfile.major === 'science') return { label: '理系', icon: Calculator };
    return null;
  };

  const majorInfo = getMajorLabel();
  const displaySubjects = selectedParentSubject ? selectedParentSubject.children || [] : SUBJECTS;

  const formatStudyTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}分`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}時間${m > 0 ? `${m}分` : ''}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            こんにちは、{userProfile.name}さん 👋
            {userProfile.grade && (
              <span className="ml-2 text-lg font-medium text-slate-500">
                (高校{userProfile.grade > 3 ? '卒業' : `${userProfile.grade}年生`})
              </span>
            )}
          </h2>
          <p className="text-slate-500">
            {userProfile.targetUniversity 
              ? `${userProfile.targetUniversity}合格に向けて、実力は着実に積み上がっています。` 
              : '今日も一緒に勉強を頑張りましょう。'}
          </p>
        </div>
        {!userProfile.targetUniversity && (
          <button 
            onClick={() => onNavigate('profile')}
            className="hidden md:flex items-center gap-2 text-indigo-600 font-medium hover:text-indigo-800 transition-colors"
          >
            <Settings size={16} />
            志望校を登録する
          </button>
        )}
      </section>

      {/* Target University Card */}
      {userProfile.targetUniversity && !selectedParentSubject && (
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden group">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-1.5 text-indigo-200">
                   <School size={20} />
                   <span className="text-sm font-semibold uppercase tracking-wider">Target</span>
                </div>
                {majorInfo && (
                  <span className="flex items-center gap-1 text-xs font-bold bg-white/20 px-2 py-0.5 rounded text-white border border-white/10">
                    <majorInfo.icon size={12} />
                    {majorInfo.label}
                  </span>
                )}
              </div>
              <h3 className="text-3xl font-bold">{userProfile.targetUniversity}</h3>
            </div>
            <button 
              onClick={() => onNavigate('profile')}
              className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors"
            >
              <Settings size={20} />
            </button>
          </div>
          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
             <School size={200} />
          </div>
        </div>
      )}

      {/* Stats Cards - Only show on top level */}
      {!selectedParentSubject && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '学習時間', value: formatStudyTime(stats.studyTime), icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'テスト正解数', value: `${stats.totalCorrect}問`, icon: Trophy, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: '連続日数', value: `${stats.streak}日`, icon: Star, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          ].map((stat, i) => (
            <div key={i} className={`${tokens.bgPanel} p-4 md:p-6 ${tokens.rounded} ${tokens.shadow} border border-slate-100`}>
              <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center mb-3`}>
                <stat.icon size={20} />
              </div>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
            </div>
          ))}
          
          <div 
            onClick={() => onNavigate('test')}
            className="bg-indigo-600 p-4 md:p-6 rounded-2xl shadow-lg cursor-pointer hover:bg-indigo-700 transition-colors group relative overflow-hidden text-white"
          >
            <div className="relative z-10">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-lg font-bold">小テスト</p>
              <p className="text-xs text-indigo-100">実力を確認する</p>
            </div>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
          </div>
        </div>
      )}

      <section>
        <div className="flex items-center gap-3 mb-4">
          {selectedParentSubject && (
            <button 
              onClick={() => setSelectedParentSubject(null)}
              className="p-1 rounded-full hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft size={24} className="text-slate-600" />
            </button>
          )}
          <h3 className="text-lg font-bold text-slate-900">
            {selectedParentSubject ? selectedParentSubject.name : '科目を学習する'}
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displaySubjects.map((subject) => (
            <button
              key={subject.id}
              onClick={() => handleSubjectClick(subject)}
              className={`${tokens.bgPanel} p-5 ${tokens.rounded} ${tokens.shadow} border border-slate-100 hover:border-indigo-300 hover:shadow-md transition-all duration-200 text-left group animate-in fade-in slide-in-from-bottom-2`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-lg text-slate-900">{subject.name}</span>
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                  <ArrowRight size={16} className="text-slate-400 group-hover:text-indigo-600" />
                </div>
              </div>
              <p className="text-sm text-slate-500">
                {subject.children ? '詳細を選択' : 'AI先生に質問・解説してもらう'}
              </p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};