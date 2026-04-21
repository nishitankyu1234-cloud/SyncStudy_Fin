import React from 'react';
import { APP_THEME } from '../constants';
import { ViewState } from '../types';
import { 
  LayoutDashboard, 
  MessageSquareText, 
  FileCheck, // Changed icon for Test
  User, // New icon for Profile
  GraduationCap
} from 'lucide-react';

interface LayoutProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentView, onNavigate, children }) => {
  const { tokens } = APP_THEME;

  const navItems = [
    { id: 'dashboard', label: 'ホーム', icon: LayoutDashboard },
    { id: 'chat', label: 'AI先生', icon: MessageSquareText },
    { id: 'test', label: '小テスト', icon: FileCheck },
    { id: 'profile', label: '設定・目標', icon: User },
  ] as const;

  return (
    <div className={`min-h-screen ${tokens.bgApp} ${tokens.textMain} ${tokens.font} flex flex-col md:flex-row`}>
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col w-64 ${tokens.bgPanel} border-r ${tokens.border.split(' ')[0]} border-slate-200 p-6 fixed h-full z-10`}>
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="p-2 bg-slate-900 rounded-xl text-white">
            <GraduationCap size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">SyncStudy</h1>
        </div>
        
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? `${tokens.primary} shadow-md` 
                    : `text-slate-500 hover:bg-slate-100 hover:text-slate-900`
                }`}
              >
                <Icon size={20} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-900'} />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-slate-900 rounded-lg text-white">
            <GraduationCap size={20} />
          </div>
          <span className="font-bold text-lg">SyncStudy</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 ${tokens.bgPanel} border-t border-slate-200 flex justify-around p-3 z-20 pb-safe`}>
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                isActive ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};