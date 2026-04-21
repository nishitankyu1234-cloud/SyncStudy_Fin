import React, { useState } from 'react';
import { APP_THEME, SUBJECTS } from '../constants';
import { generateTestQuestions } from '../services/geminiService';
import { TestQuestion } from '../types';
import { CheckCircle2, XCircle, ArrowRight, RefreshCcw, Loader2, BrainCircuit } from 'lucide-react';

export const QuizView: React.FC = () => {
  const { tokens } = APP_THEME;
  const [viewState, setViewState] = useState<'setup' | 'loading' | 'playing' | 'results'>('setup');
  const [topic, setTopic] = useState('');
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const startQuiz = async (selectedTopic: string) => {
    setTopic(selectedTopic);
    setViewState('loading');
    try {
      const generatedQuestions = await generateTestQuestions(selectedTopic, undefined, 3);
      setQuestions(generatedQuestions);
      setCurrentIndex(0);
      setScore(0);
      setSelectedOption(null);
      setShowExplanation(false);
      setViewState('playing');
    } catch (error) {
      console.error(error);
      alert('クイズの作成に失敗しました。もう一度試してください。');
      setViewState('setup');
    }
  };

  const handleOptionSelect = (index: number) => {
    if (selectedOption !== null) return;
    
    setSelectedOption(index);
    setShowExplanation(true);
    if (index === questions[currentIndex].correctAnswerIndex) {
      setScore(prev => prev + 1);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setShowExplanation(false);
    } else {
      setViewState('results');
    }
  };

  if (viewState === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <BrainCircuit size={24} className="text-indigo-600" />
          </div>
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900">クイズを作成中...</h3>
          <p className="text-slate-500 mt-2">AIが「{topic}」の問題を考えています</p>
        </div>
      </div>
    );
  }

  if (viewState === 'setup') {
    return (
      <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">クイズに挑戦</h2>
          <p className="text-slate-500">トピックを選んで、理解度をチェックしましょう。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SUBJECTS.map((subject) => (
            <button
              key={subject.id}
              onClick={() => startQuiz(subject.name)}
              className={`${tokens.bgPanel} p-6 ${tokens.rounded} border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all text-left flex items-center justify-between group`}
            >
              <span className="font-bold text-lg text-slate-800">{subject.name}</span>
              <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                <ArrowRight size={16} />
              </span>
            </button>
          ))}
          {/* Custom Topic Input could go here */}
        </div>
      </div>
    );
  }

  if (viewState === 'playing') {
    const question = questions[currentIndex];
    return (
      <div className="max-w-2xl mx-auto animate-in fade-in duration-300">
        <div className="mb-6 flex justify-between items-center text-sm font-medium text-slate-500">
          <span>{topic}</span>
          <span>Question {currentIndex + 1} / {questions.length}</span>
        </div>

        <div className="mb-8">
          <h3 className="text-xl md:text-2xl font-bold text-slate-900 leading-relaxed mb-6">
            {question.question}
          </h3>

          <div className="space-y-3">
            {question.options.map((option, idx) => {
              let stateStyle = "border-slate-200 hover:bg-slate-50 hover:border-slate-300";
              let icon = null;

              if (selectedOption !== null) {
                if (idx === question.correctAnswerIndex) {
                  stateStyle = "bg-green-50 border-green-500 text-green-900";
                  icon = <CheckCircle2 className="text-green-600" size={20} />;
                } else if (idx === selectedOption) {
                  stateStyle = "bg-red-50 border-red-500 text-red-900";
                  icon = <XCircle className="text-red-600" size={20} />;
                } else {
                  stateStyle = "opacity-50 border-slate-100";
                }
              }

              return (
                <button
                  key={idx}
                  disabled={selectedOption !== null}
                  onClick={() => handleOptionSelect(idx)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between ${stateStyle} ${tokens.bgPanel}`}
                >
                  <span className="font-medium">{option}</span>
                  {icon}
                </button>
              );
            })}
          </div>
        </div>

        {showExplanation && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 bg-indigo-50 border border-indigo-100 p-5 rounded-xl mb-6">
            <h4 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
              <BrainCircuit size={18} /> 解説
            </h4>
            <p className="text-indigo-800 leading-relaxed text-sm md:text-base">
              {question.explanation}
            </p>
          </div>
        )}

        <div className="flex justify-end h-12">
          {selectedOption !== null && (
            <button
              onClick={nextQuestion}
              className={`${tokens.primary} px-6 py-2 rounded-xl font-medium flex items-center gap-2 shadow-lg animate-in fade-in`}
            >
              {currentIndex < questions.length - 1 ? '次の問題へ' : '結果を見る'}
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Results View
  return (
    <div className="flex flex-col items-center justify-center py-10 animate-in zoom-in-95 duration-500">
      <div className="relative mb-8">
        <svg className="w-40 h-40 transform -rotate-90">
          <circle
            className="text-slate-100"
            strokeWidth="12"
            stroke="currentColor"
            fill="transparent"
            r="70"
            cx="80"
            cy="80"
          />
          <circle
            className={score === questions.length ? "text-yellow-400" : "text-indigo-600"}
            strokeWidth="12"
            strokeDasharray={440}
            strokeDashoffset={440 - (440 * score) / questions.length}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r="70"
            cx="80"
            cy="80"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-slate-900">{Math.round((score / questions.length) * 100)}%</span>
          <span className="text-xs text-slate-500 uppercase tracking-wide">正解率</span>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-slate-900 mb-2">
        {score === questions.length ? '完璧です！素晴らしい！🎉' : 'お疲れ様でした！'}
      </h2>
      <p className="text-slate-500 mb-8">
        {questions.length}問中 {score}問正解しました
      </p>

      <div className="flex gap-4">
        <button
          onClick={() => setViewState('setup')}
          className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
        >
          他のトピック
        </button>
        <button
          onClick={() => startQuiz(topic)}
          className={`${tokens.primary} px-6 py-3 rounded-xl font-medium flex items-center gap-2 shadow-lg`}
        >
          <RefreshCcw size={18} />
          もう一度挑戦
        </button>
      </div>
    </div>
  );
};