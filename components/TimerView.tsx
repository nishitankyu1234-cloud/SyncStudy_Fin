import React, { useState, useEffect, useRef } from 'react';
import { APP_THEME } from '../constants';
import { Play, Pause, RotateCcw, Coffee, Brain } from 'lucide-react';

export const TimerView: React.FC = () => {
  const { tokens } = APP_THEME;
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const timerRef = useRef<number | null>(null);

  const FOCUS_TIME = 25 * 60;
  const BREAK_TIME = 5 * 60;

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      // Optional: Play sound here
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(mode === 'focus' ? FOCUS_TIME : BREAK_TIME);
  };

  const switchMode = (newMode: 'focus' | 'break') => {
    setMode(newMode);
    setIsActive(false);
    setTimeLeft(newMode === 'focus' ? FOCUS_TIME : BREAK_TIME);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = mode === 'focus' 
    ? 1 - timeLeft / FOCUS_TIME 
    : 1 - timeLeft / BREAK_TIME;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in duration-500">
      
      {/* Mode Switcher */}
      <div className="flex p-1 bg-slate-200/50 rounded-2xl mb-12">
        <button
          onClick={() => switchMode('focus')}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-semibold transition-all ${
            mode === 'focus' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Brain size={16} /> 集中モード
        </button>
        <button
          onClick={() => switchMode('break')}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-semibold transition-all ${
            mode === 'break' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Coffee size={16} /> 休憩モード
        </button>
      </div>

      {/* Timer Display */}
      <div className="relative mb-12 group">
        <div className={`absolute -inset-4 rounded-full blur-2xl opacity-20 transition-colors duration-1000 ${
           mode === 'focus' ? 'bg-indigo-500' : 'bg-green-500'
        }`}></div>
        
        <div className="relative w-72 h-72 md:w-80 md:h-80 bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-slate-50">
          <svg className="absolute inset-0 w-full h-full -rotate-90 p-2">
             <circle
               className="text-slate-100"
               strokeWidth="8"
               stroke="currentColor"
               fill="transparent"
               r="48%"
               cx="50%"
               cy="50%"
             />
             <circle
               className={`transition-all duration-1000 ${mode === 'focus' ? 'text-indigo-600' : 'text-green-500'}`}
               strokeWidth="8"
               strokeDasharray={880}
               strokeDashoffset={880 * (1 - progress)}
               strokeLinecap="round"
               stroke="currentColor"
               fill="transparent"
               r="48%"
               cx="50%"
               cy="50%"
               style={{ transition: 'stroke-dashoffset 1s linear' }}
             />
          </svg>
          
          <div className="text-center z-10">
             <div className="text-7xl font-bold text-slate-900 tabular-nums tracking-tighter">
               {formatTime(timeLeft)}
             </div>
             <div className="text-slate-400 font-medium mt-2">
               {isActive ? (mode === 'focus' ? 'Focusing...' : 'Relaxing...') : 'Ready?'}
             </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6">
        <button
          onClick={resetTimer}
          className="p-4 rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
        >
          <RotateCcw size={24} />
        </button>

        <button
          onClick={toggleTimer}
          className={`w-20 h-20 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all hover:scale-105 active:scale-95 ${
             mode === 'focus' ? 'bg-slate-900 hover:bg-slate-800' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isActive ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
        </button>
      </div>
    </div>
  );
};