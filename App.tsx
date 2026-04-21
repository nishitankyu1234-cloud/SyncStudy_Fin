import React, { useState, useEffect, useMemo } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ChatView } from './components/ChatView';
import { TestView } from './components/TestView';
import { ProfileView } from './components/ProfileView';
import { ViewState, UserProfile, ChatMessage, TestResult } from './types';

function App() {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [initialChatContext, setInitialChatContext] = useState<string | null>(null);
  
  // User Profile State
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('syncstudy_profile');
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentSchoolYear = currentMonth >= 4 ? currentYear : currentYear - 1;

    let profile: UserProfile;
    if (saved) {
      profile = JSON.parse(saved);
      // 年度更新の判定 (4月以降かつ、最後に更新した年度より現在の年度が進んでいる場合)
      if (profile.grade && profile.lastUpdatedYear !== undefined && profile.lastUpdatedYear < currentSchoolYear) {
        const diff = currentSchoolYear - profile.lastUpdatedYear;
        profile.grade = Math.min(profile.grade + diff, 4); // 4は卒業扱い
        profile.lastUpdatedYear = currentSchoolYear;
      }
    } else {
      profile = { 
        name: '学生', 
        targetUniversity: '', 
        grade: 1, 
        lastUpdatedYear: currentSchoolYear 
      };
    }
    return profile;
  });

  // Chat History State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('syncstudy_chat_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Test History State
  const [testHistory, setTestHistory] = useState<TestResult[]>(() => {
    const saved = localStorage.getItem('syncstudy_test_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Total Study Minutes (Persistent)
  const [totalStudyMinutes, setTotalStudyMinutes] = useState<number>(() => {
    const saved = localStorage.getItem('syncstudy_total_minutes');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Timer for tracking active study
  useEffect(() => {
    let interval: number;
    // Track time only when in learning views
    if (currentView === 'chat' || currentView === 'test') {
      interval = window.setInterval(() => {
        setTotalStudyMinutes(prev => {
          const newVal = prev + 1;
          localStorage.setItem('syncstudy_total_minutes', newVal.toString());
          return newVal;
        });
      }, 60000); // Increment every 1 minute
    }
    return () => clearInterval(interval);
  }, [currentView]);

  // Calculated Stats
  const stats = useMemo(() => {
    // 1. Total Correct Answers
    const totalCorrect = testHistory.reduce((sum, res) => sum + res.score, 0);

    // 2. Consecutive Days Calculation
    const dates = testHistory.map(h => h.date).sort();
    const uniqueDates = Array.from(new Set(dates));
    
    let streak = 0;
    const today = new Date().toLocaleDateString('ja-JP');
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('ja-JP');

    if (uniqueDates.includes(today) || uniqueDates.includes(yesterday)) {
      // Start counting from the most recent date
      let checkDate = uniqueDates.includes(today) ? new Date() : new Date(Date.now() - 86400000);
      
      while (uniqueDates.includes(checkDate.toLocaleDateString('ja-JP'))) {
        streak++;
        checkDate = new Date(checkDate.getTime() - 86400000);
      }
    }

    return {
      totalCorrect,
      streak,
      studyTime: totalStudyMinutes
    };
  }, [testHistory, totalStudyMinutes]);

  // Save to LocalStorage effects
  useEffect(() => {
    localStorage.setItem('syncstudy_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  useEffect(() => {
    if (chatMessages.length > 0) {
      localStorage.setItem('syncstudy_chat_history', JSON.stringify(chatMessages));
    }
  }, [chatMessages]);

  useEffect(() => {
    localStorage.setItem('syncstudy_test_history', JSON.stringify(testHistory));
  }, [testHistory]);

  const handleUpdateProfile = (profile: UserProfile) => {
    setUserProfile(profile);
  };

  const handleNavigate = (view: ViewState) => {
    setCurrentView(view);
    if (view !== 'chat') {
      setInitialChatContext(null);
    }
  };

  const handleSubjectSelect = (subject: string) => {
    setInitialChatContext(subject);
    setCurrentView('chat');
  };

  const handleAddTestResult = (result: TestResult) => {
    setTestHistory(prev => [result, ...prev]);
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard 
            onNavigate={handleNavigate} 
            onSelectSubject={handleSubjectSelect} 
            userProfile={userProfile} 
            stats={stats}
          />
        );
      case 'chat':
        return (
          <ChatView 
            initialContext={initialChatContext} 
            userProfile={userProfile}
            messages={chatMessages}
            setMessages={setChatMessages}
          />
        );
      case 'test':
        return (
          <TestView 
            userProfile={userProfile} 
            history={testHistory}
            onSaveResult={handleAddTestResult}
          />
        );
      case 'profile':
        return (
          <ProfileView 
            profile={userProfile} 
            onUpdateProfile={handleUpdateProfile} 
          />
        );
      default:
        return (
          <Dashboard 
            onNavigate={handleNavigate} 
            onSelectSubject={handleSubjectSelect} 
            userProfile={userProfile} 
            stats={stats}
          />
        );
    }
  };

  return (
    <Layout currentView={currentView} onNavigate={handleNavigate}>
      {renderView()}
    </Layout>
  );
}

export default App;