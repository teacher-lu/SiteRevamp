'use client';

import React, { useState, useRef, useEffect } from 'react';

// --- 一键复制组件 ---
const CopyBlock = ({ number, title, subtitle, copyText, isDark, hideCopy }: { number?: number, title: string, subtitle?: React.ReactNode, copyText?: string, isDark: boolean, hideCopy?: boolean }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(copyText || title);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex items-start justify-between border p-5 rounded-xl transition-colors group ${isDark ? 'bg-[#12121a] border-white/5 hover:border-indigo-500/50' : 'bg-white border-slate-200 hover:border-indigo-300 shadow-sm'}`}>
      <div className="flex gap-4 items-start w-full pr-4">
        {number && (
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 ${isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
            {number}
          </div>
        )}
        <div className="flex-1">
          <div className={`text-base font-medium ${subtitle ? 'mb-3' : ''} ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>{title}</div>
          {subtitle && <div className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{subtitle}</div>}
        </div>
      </div>
      
      {!hideCopy && (
        <button onClick={handleCopy} className={`flex items-center gap-1 transition-colors shrink-0 ml-2 mt-1 ${isDark ? 'text-gray-500 hover:text-indigo-400' : 'text-slate-400 hover:text-indigo-600'}`}>
          {copied ? (
             <span className="text-emerald-500 text-xs font-bold flex items-center gap-1">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg> 已复制
             </span>
          ) : (
             <>
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
               <span className="text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">复制</span>
             </>
          )}
        </button>
      )}
    </div>
  );
};

export default function OptimizePage() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [currentView, setCurrentView] = useState<'home' | 'reports'>('home');
  
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userCredits, setUserCredits] = useState(3);
  
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [historyReports, setHistoryReports] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const [printingReport, setPrintingReport] = useState<any>(null);
  const [confirmModalData, setConfirmModalData] = useState<{ isOpen: boolean; url: string; keyword: string; pageType: string } | null>(null);

  const [url, setUrl] = useState('');
  const [keyword, setKeyword] = useState('');
  const [pageType, setPageType] = useState('首页');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNavDropdownOpen, setIsNavDropdownOpen] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navDropdownRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [report, setReport] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const loadingRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const loadingStepsText = ['安全抓取公开页面', '提取页面结构与内容', '分析 Google 与 AI 可见性', '生成优先优化建议'];
  const pageTypeOptions = ['自动识别', '博客文章', '电商集合页', '产品页', '服务页', '首页'];

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  useEffect(() => {
    const handleAfterPrint = () => setPrintingReport(null);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem('siterevamp_token');
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchUserProfile(token);
    }
  }, [token]);

  const fetchUserProfile = async (jwtToken: string) => {
    try {
      const res = await fetch('/api/me', {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUserEmail(data.email);
        setUserCredits(data.credits);
      } else {
        localStorage.removeItem('siterevamp_token');
        setToken(null);
      }
    } catch {
      localStorage.removeItem('siterevamp_token');
      setToken(null);
    }
  };

  const fetchHistoryReports = async () => {
    if (!token) return;
    setIsHistoryLoading(true);
    try {
      const res = await fetch('/api/reports', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryReports(data.reports || []);
      }
    } catch (err) {
      console.error("获取历史报告失败", err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (currentView === 'reports' && token) {
      fetchHistoryReports();
    }
  }, [currentView, token]);

  const handleAuthSubmit = async () => {
    setAuthError('');
    const endpoint = authMode === 'login' ? 'login' : 'register';
    try {
      const res = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || '操作失败');
      
      localStorage.setItem('siterevamp_token', data.access_token);
      setToken(data.access_token);
      setUserCredits(data.credits);
      setUserEmail(authEmail);
      setIsAuthModalOpen(false);
      setAuthEmail('');
      setAuthPassword('');
    } catch (err: any) {
      setAuthError(err.message || '网络请求错误');
    }
  };

  const handleStartNewAnalysis = () => {
    setCurrentView('home');
    setReport(null);
    setUrl('');
    setKeyword('');
    setErrorMsg('');
    setIsLoading(false);
    setLoadingStep(0);
  };

  const handleLogout = () => {
    localStorage.removeItem('siterevamp_token');
    setToken(null);
    handleStartNewAnalysis();
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsDropdownOpen(false);
      if (navDropdownRef.current && !navDropdownRef.current.contains(event.target as Node)) setIsNavDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAnalyze = async (targetUrl?: string, targetKeyword?: string, targetPageType?: string) => {
    const useUrl = targetUrl || url;
    const useKeyword = targetKeyword || keyword;
    const usePageType = targetPageType || pageType;

    if (!useUrl || !useKeyword) { setErrorMsg("请先填写 URL 和目标关键词"); return; }
    
    if (!token) {
      setAuthMode('register');
      setIsAuthModalOpen(true);
      return;
    }

    if (userCredits <= 0) {
      setErrorMsg("您的积分已用完，请充值后继续");
      showToast("积分不足，请先充值");
      return;
    }

    setErrorMsg(''); setIsLoading(true); setLoadingStep(0); setReport(null);
    const interval = setInterval(() => setLoadingStep(prev => (prev < 3 ? prev + 1 : prev)), 1200);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ url: useUrl, keyword: useKeyword, page_type: usePageType })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || '分析失败');
      
      setUserCredits(data.remaining_credits);

      setTimeout(() => {
        setReport(data.report);
        setIsLoading(false);
        clearInterval(interval);
        showToast("已成功重新分析页面并生成新报告！");
      }, 4800);
    } catch (error: any) {
      clearInterval(interval);
      setErrorMsg(error.message || "分析失败，请稍后重试");
      setIsLoading(false);
    }
  };

  const handlePrint = () => window.print();

  return (
    <>
      {/* 专用打印容器（加入 pt-10 确保顶部有舒适的边距） */}
      {printingReport && (
        <div className="hidden print:block w-full bg-white text-slate-900 pt-10 pb-20">
          <div className="border-b-2 border-slate-900 pb-4 mb-6">
            <h1 className="text-3xl font-black mb-1">SiteRevamp 页面优化诊断报告</h1>
            <div className="text-sm font-medium text-slate-600">
              目标网址: {printingReport.target_url} &nbsp;&nbsp;|&nbsp;&nbsp; 关键词: {printingReport.keyword} &nbsp;&nbsp;|&nbsp;&nbsp; 类型: {printingReport.page_type || '首页'}
            </div>
          </div>

          <div className="flex items-center gap-8 mb-8 break-inside-avoid">
            <div className="w-24 h-24 rounded-full border-8 border-indigo-100 flex items-center justify-center text-4xl font-black text-slate-900 shrink-0">
              {printingReport.report_data?.scores?.overall}
            </div>
            <div>
              <h2 className="text-2xl font-extrabold mb-2">整体优化评分</h2>
              <p className="text-slate-700 text-sm leading-relaxed mb-3">{printingReport.report_data?.summary}</p>
              <div className="flex flex-wrap gap-2">
                {printingReport.report_data?.good_points?.map((p:string, i:number) => (
                  <span key={i} className="px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full text-xs font-bold border border-emerald-200">✓ {p}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-10 text-sm break-inside-avoid">
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="font-bold">Google 排名优化度：</span> <span className="font-black text-blue-600 text-lg">{printingReport.report_data?.scores?.google}%</span>
            </div>
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="font-bold">AI 可见优化度：</span> <span className="font-black text-purple-600 text-lg">{printingReport.report_data?.scores?.ai}%</span>
            </div>
          </div>

          <div className="mb-10">
            <h3 className="text-xl font-bold mb-4 border-b pb-2">⚡ 优先优化行动</h3>
            <div className="space-y-4">
              {printingReport.report_data?.priority_actions?.map((action:any, i:number) => (
                <div key={i} className="p-4 border border-slate-200 rounded-lg break-inside-avoid">
                  <div className="font-bold text-base mb-1">{i+1}. {action.title} <span className="ml-2 text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">{action.category}</span></div>
                  <div className="text-sm text-slate-600 mb-3">{action.description}</div>
                  <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded grid grid-cols-2 gap-2">
                    <div><b className="text-emerald-700">Google 收益:</b> {action.google_benefit}</div>
                    <div><b className="text-purple-700">AI 收益:</b> {action.ai_benefit}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-10">
            <div className="break-inside-avoid">
              <h3 className="text-lg font-bold mb-3 text-blue-600 border-b pb-2">Title 标签建议</h3>
              <ul className="list-disc pl-5 text-sm space-y-2 text-slate-700">{printingReport.report_data?.title_suggestions?.map((s:string, i:number)=><li key={i}>{s}</li>)}</ul>
            </div>
            <div className="break-inside-avoid">
              <h3 className="text-lg font-bold mb-3 text-purple-600 border-b pb-2">Meta 描述建议</h3>
              <ul className="list-disc pl-5 text-sm space-y-2 text-slate-700">{printingReport.report_data?.meta_suggestions?.map((s:string, i:number)=><li key={i}>{s}</li>)}</ul>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-10">
            <div className="break-inside-avoid">
              <h3 className="text-lg font-bold mb-3 text-blue-600 border-b pb-2">H1 建议</h3>
              <ul className="list-disc pl-5 text-sm space-y-2 text-slate-700">{printingReport.report_data?.h1_suggestions?.map((s:string, i:number)=><li key={i}>{s}</li>)}</ul>
            </div>
            <div className="break-inside-avoid">
              <h3 className="text-lg font-bold mb-3 text-blue-600 border-b pb-2">H2 结构建议</h3>
              <ul className="list-disc pl-5 text-sm space-y-2 text-slate-700">{printingReport.report_data?.h2_suggestions?.map((s:string, i:number)=><li key={i}>{s}</li>)}</ul>
            </div>
          </div>

          <div className="mb-10 break-inside-avoid">
            <h3 className="text-lg font-bold mb-3 text-purple-600 border-b pb-2">FAQ 建议</h3>
            <div className="space-y-3">
              {printingReport.report_data?.faq_suggestions?.map((faq:any, i:number) => (
                <div key={i} className="text-sm p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="font-bold text-slate-900 mb-1">Q: {faq.question}</div>
                  <div className="text-slate-600">A: {faq.answer}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-10">
            <div className="break-inside-avoid">
              <h3 className="text-lg font-bold mb-3 text-blue-600 border-b pb-2">内部链接建议</h3>
              <div className="space-y-3">
                {printingReport.report_data?.internal_links?.map((link:any, i:number) => (
                  <div key={i} className="text-sm p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="font-bold text-slate-900 mb-1">{link.target}</div>
                    <div className="text-slate-500 text-xs">锚文本: {link.anchor} | 位置: {link.position}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="break-inside-avoid">
              <h3 className="text-lg font-bold mb-3 text-emerald-600 border-b pb-2">外链机会 (PR/合作)</h3>
              <div className="space-y-3">
                {printingReport.report_data?.backlink_opportunities?.map((link:any, i:number) => (
                  <div key={i} className="text-sm p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="font-bold text-slate-900 mb-1">{link.type}</div>
                    <div className="text-slate-600 text-xs">{link.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 主应用界面 */}
      <div className={`min-h-screen font-sans relative flex flex-col pb-32 transition-colors duration-300 print:block ${isDarkMode ? 'bg-[#050505] text-gray-200' : 'bg-slate-50 text-slate-800'} ${printingReport ? 'print:hidden' : ''}`}>
        
        {toastMsg && (
          <div className="fixed bottom-8 right-8 z-[200] flex items-center gap-3 px-5 py-4 rounded-2xl bg-emerald-600 text-white font-bold shadow-2xl animate-fade-in border border-emerald-500/30">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
            <span>{toastMsg}</span>
          </div>
        )}

        {confirmModalData && confirmModalData.isOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
            <div className={`w-full max-w-[420px] rounded-[24px] p-8 relative shadow-2xl border ${isDarkMode ? 'bg-[#12121a] border-[#2e1f4f]' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl font-bold shrink-0">⚡</div>
                <h3 className={`text-xl font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>确认重新分析此页面？</h3>
              </div>
              <p className={`text-sm mb-6 leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                重新分析将再次抓取该页面并消耗 <span className="text-amber-500 font-bold">1 点积分</span>。当前剩余积分：<span className="text-indigo-400 font-bold">{userCredits}</span>
              </p>
              <div className={`p-4 rounded-xl mb-6 text-xs border truncate ${isDarkMode ? 'bg-[#0a0a0c] border-white/5 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                <div className="font-bold mb-1 truncate">URL: {confirmModalData.url}</div>
                <div className="text-indigo-400">关键词: {confirmModalData.keyword}</div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setConfirmModalData(null)} className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-colors ${isDarkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}>取消</button>
                <button onClick={() => {
                  const { url: u, keyword: k, pageType: p } = confirmModalData;
                  setConfirmModalData(null);
                  setUrl(u);
                  setKeyword(k);
                  setPageType(p);
                  setCurrentView('home');
                  handleAnalyze(u, k, p);
                }} className="flex-1 py-3 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all">确认重新分析</button>
              </div>
            </div>
          </div>
        )}

        {isAuthModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className={`w-full max-w-[420px] rounded-[24px] p-8 relative shadow-2xl ${isDarkMode ? 'bg-[#12121a] border border-[#2e1f4f]' : 'bg-white border border-slate-200'}`}>
              <button onClick={() => setIsAuthModalOpen(false)} className={`absolute top-5 right-5 p-1 rounded-full transition-colors ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              {authMode === 'login' ? (
                <>
                  <div className="text-blue-600 dark:text-blue-500 text-xs font-bold mb-2 tracking-wide">欢迎回来</div>
                  <h2 className={`text-2xl font-extrabold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>登录 SiteRevamp</h2>
                </>
              ) : (
                <>
                  <div className="text-blue-600 dark:text-blue-500 text-xs font-bold mb-2 tracking-wide">免费注册 · 无需信用卡</div>
                  <h2 className={`text-2xl font-extrabold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>免费注册，解锁完整优化报告</h2>
                </>
              )}
              <div className={`flex p-1 rounded-xl mb-6 border ${isDarkMode ? 'bg-[#0a0a0c] border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                <button onClick={() => setAuthMode('register')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${authMode === 'register' ? (isDarkMode ? 'bg-[#2e1f4f] text-white shadow-md' : 'bg-white text-slate-900 shadow-sm') : (isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-slate-500 hover:text-slate-700')}`}>注册</button>
                <button onClick={() => setAuthMode('login')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${authMode === 'login' ? (isDarkMode ? 'bg-[#2e1f4f] text-white shadow-md' : 'bg-white text-slate-900 shadow-sm') : (isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-slate-500 hover:text-slate-700')}`}>登录</button>
              </div>
              <div className="space-y-4 mb-6">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>邮箱</label>
                  <input type="email" placeholder="you@example.com" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className={`w-full p-3.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${isDarkMode ? 'bg-[#0a0a0c] border-white/10 text-white placeholder-gray-600' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>密码</label>
                  <input type="password" placeholder="至少 6 位字符" value={authPassword} onChange={e => setAuthPassword(e.target.value)} className={`w-full p-3.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${isDarkMode ? 'bg-[#0a0a0c] border-white/10 text-white placeholder-gray-600' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`} />
                </div>
              </div>
              {authError && <div className="text-red-400 text-xs mb-4 text-center font-bold">{authError}</div>}
              <button onClick={handleAuthSubmit} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]">
                {authMode === 'login' ? '登录' : '创建账户'}
              </button>
            </div>
          </div>
        )}

        {isDarkMode && <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none z-0 hide-on-print"></div>}
        
        {/* 导航栏 */}
        <header className={`w-full border-b backdrop-blur-md sticky top-0 z-50 transition-colors hide-on-print ${isDarkMode ? 'border-white/5 bg-[#050505]/80' : 'border-slate-200 bg-white/80'}`}>
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2.5 cursor-pointer" onClick={handleStartNewAnalysis}>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-base shadow-md">S</div>
                <div>
                  <div className={`text-xl font-bold leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>SiteRevamp</div>
                  <div className="text-[9px] font-bold text-gray-500 tracking-widest uppercase">Site Optimization Engine</div>
                </div>
              </div>

              <div className="relative hidden md:block" ref={navDropdownRef}>
                <button onClick={() => setIsNavDropdownOpen(!isNavDropdownOpen)} className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-gray-300 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100'}`}>
                  产品 <svg className={`w-3.5 h-3.5 transition-transform ${isNavDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                </button>

                {isNavDropdownOpen && (
                  <div className={`absolute top-full left-0 mt-2 w-72 rounded-2xl p-2 border shadow-2xl z-50 ${isDarkMode ? 'bg-[#12121a] border-[#2e1f4f]' : 'bg-white border-slate-200'}`}>
                    <div onClick={() => { handleStartNewAnalysis(); setIsNavDropdownOpen(false); }} className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                      <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">✨</div>
                      <div>
                        <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>页面优化</div>
                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>生成页面 SEO + AI 可见性优化报告</div>
                      </div>
                    </div>
                    <div onClick={() => { 
                      if(!token) { setIsAuthModalOpen(true); return; }
                      setCurrentView('reports'); 
                      setIsNavDropdownOpen(false); 
                    }} className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                      <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">📄</div>
                      <div>
                        <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>我的报告</div>
                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>查看过去生成过的页面优化报告</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'bg-white/10 text-yellow-400 hover:bg-white/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {isDarkMode ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                )}
              </button>

              {token ? (
                <>
                  <div className="text-right hidden md:block mr-2">
                    <div className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>{userEmail}</div>
                    <div className="text-xs text-indigo-500 font-bold">💎账户余量: {userCredits}积分</div>
                  </div>
                  <button onClick={handleLogout} className={`px-4 py-2 rounded-md border text-sm transition-colors ${isDarkMode ? 'border-white/10 text-white hover:bg-white/5' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}>
                    退出
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => {setAuthMode('login'); setIsAuthModalOpen(true);}} className={`text-sm font-bold px-3 py-2 transition-colors ${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>登录</button>
                  <button onClick={() => {setAuthMode('register'); setIsAuthModalOpen(true);}} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${isDarkMode ? 'bg-white text-black hover:bg-gray-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>开始使用</button>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center pt-16 md:pt-20 px-4 md:px-6 relative z-10 w-full max-w-7xl mx-auto print:block">
          
          {currentView === 'home' && (
            <>
              <div className="text-center mb-10 w-full hide-on-print">
                <div className={`inline-flex items-center justify-center gap-2 px-5 py-1.5 rounded-full border text-sm font-medium mb-4 transition-colors ${isDarkMode ? 'border-[#2e1f4f] bg-[#0d071d] text-[#d1d5db]' : 'border-indigo-200 bg-indigo-50 text-indigo-700'}`}>
                  <span className="text-yellow-400 text-xs">✨</span> Google SEO + AI 可见性引擎
                </div>
                <h1 className={`text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b mb-4 leading-[1.1] transition-colors ${isDarkMode ? 'from-white via-white to-[#6b7280]' : 'from-slate-900 via-slate-800 to-slate-500'}`}>
                  重塑页面的<br/>搜索引擎掌控力
                </h1>
                <p className={`text-sm md:text-base max-w-2xl mx-auto tracking-wide transition-colors ${isDarkMode ? 'text-[#9ca3af]' : 'text-slate-500'}`}>
                  输入目标页面与关键词，深度解析排名阻力，获取可直接执行的优化策略清单。
                </p>
              </div>

              <div className={`w-full flex flex-col md:flex-row rounded-2xl border shadow-2xl relative z-20 transition-colors hide-on-print ${isDarkMode ? 'border-[#2e1f4f] bg-[#000000]' : 'border-slate-200 bg-white'}`}>
                <div className={`flex-1 p-6 md:p-10 rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none ${isDarkMode ? 'bg-[#000000]' : 'bg-white'}`}>
                  <div className="space-y-5">
                    <div>
                      <label className={`block text-sm mb-2 ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>公开页面 URL</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg></span>
                        <input type="text" placeholder="https://yourbrand.com/" className={`w-full pl-11 p-3.5 border rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors ${isDarkMode ? 'bg-[#0a0a0c] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'}`} value={url} onChange={(e) => setUrl(e.target.value)} />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className={`block text-sm mb-2 ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>目标关键词</label>
                        <input type="text" placeholder="Target keywords" className={`w-full p-3.5 border rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors ${isDarkMode ? 'bg-[#0a0a0c] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'}`} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
                      </div>
                      
                      <div className="relative" ref={dropdownRef}>
                        <label className={`block text-sm mb-2 ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>页面类型</label>
                        <div className={`w-full p-3.5 border rounded-xl cursor-pointer flex justify-between items-center transition-colors ${isDarkMode ? 'bg-[#0a0a0c] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'} ${isDropdownOpen ? (isDarkMode ? 'ring-1 ring-indigo-500 border-indigo-500' : 'ring-1 ring-indigo-500 border-indigo-500') : ''}`} onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                          <span>{pageType}</span>
                          <svg className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                        {isDropdownOpen && (
                          <div className={`absolute top-full left-0 w-full mt-2 border rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar ${isDarkMode ? 'bg-[#1a1a1f] border-[#2e1f4f]' : 'bg-white border-slate-200'}`}>
                            {pageTypeOptions.map(opt => (
                              <div key={opt} className={`px-4 py-3 cursor-pointer text-sm transition-colors ${isDarkMode ? 'text-gray-300 hover:bg-indigo-600 hover:text-white' : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'}`} onClick={() => { setPageType(opt); setIsDropdownOpen(false); }}>
                                {opt}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {errorMsg && <div className="text-red-400 text-sm text-center font-medium bg-red-500/10 py-3 rounded-lg border border-red-500/20">{errorMsg}</div>}

                    <div className="mt-4">
                      <button 
                        onClick={() => handleAnalyze()} 
                        disabled={isLoading} 
                        className={`w-full font-bold py-4 rounded-xl flex justify-center items-center gap-2 outline-none transform-gpu transition-all duration-200 active:scale-[0.98] ${
                          isLoading 
                            ? (isDarkMode ? 'bg-[#1f2937] text-gray-400' : 'bg-slate-200 text-slate-500') 
                            : 'bg-[#5b21b6] text-white hover:bg-[#6d28d9] shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40'
                        }`}
                      >
                        {isLoading ? '正在深度解析...' : '获取优化建议'}
                      </button>
                      <p className={`text-center text-xs mt-3 font-medium tracking-wide ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>当前阶段：1 积分 = 1 页面优化报告</p>

                      {isLoading && (
                        <div ref={loadingRef} className={`mt-5 border rounded-xl p-5 ${isDarkMode ? 'bg-[#121216] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                          {loadingStepsText.map((text, idx) => (
                            <div key={idx} className="flex items-center gap-3 py-1.5">
                              {loadingStep > idx ? <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-[10px] font-bold">✓</div> : loadingStep === idx ? <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div> : <div className={`w-4 h-4 rounded-full border ${isDarkMode ? 'border-gray-700' : 'border-slate-300'}`}></div>}
                              <span className={`text-sm ${loadingStep === idx ? 'text-indigo-400' : loadingStep > idx ? (isDarkMode ? 'text-gray-400' : 'text-slate-400') : (isDarkMode ? 'text-gray-600' : 'text-slate-300')}`}>{text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className={`w-full md:w-[320px] p-6 md:p-8 border-t md:border-t-0 md:border-l flex flex-col justify-start rounded-b-2xl md:rounded-r-2xl md:rounded-bl-none transition-colors ${isDarkMode ? 'border-white/5 bg-[#000000]' : 'border-slate-200 bg-slate-50'}`}>
                   <h3 className={`text-sm font-semibold mb-6 tracking-wide ${isDarkMode ? 'text-gray-300' : 'text-slate-800'}`}>报告包含</h3>
                   <ul className="space-y-5">
                     {[
                       { title: '双维度评分', desc: 'Google 排名与 AI 引用准备度', icon: '◎', color: 'text-purple-500' },
                       { title: '优先行动矩阵', desc: '按实际影响力与 ROI 排序', icon: '⚡', color: 'text-yellow-500' },
                       { title: '开箱即用的文案', desc: '重构 Title、Meta、H1', icon: '✨', color: 'text-blue-400' },
                       { title: '隐蔽安全抓取', desc: '采用无头浏览器深度分析', icon: '🛡️', color: 'text-red-500' },
                     ].map((item, idx) => (
                       <li key={idx} className="flex gap-4">
                         <div className={`${item.color} text-lg mt-0.5`}>{item.icon}</div>
                         <div>
                           <h4 className={`text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-200' : 'text-slate-800'}`}>{item.title}</h4>
                           <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>{item.desc}</p>
                         </div>
                       </li>
                     ))}
                   </ul>
                </div>
              </div>

              {report && !isLoading && (
                <div ref={reportRef} className={`w-full mt-10 border rounded-[32px] p-6 md:p-10 shadow-2xl animate-fade-in relative z-10 transition-colors print-container break-inside-avoid ${isDarkMode ? 'bg-[#0a0a0c] border-[#2e1f4f]' : 'bg-white border-slate-200'}`}>
                  
                  <div className={`flex flex-col lg:flex-row gap-8 items-start mb-10 border-b pb-10 ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
                    <div className={`w-32 h-32 shrink-0 rounded-full border-8 flex items-center justify-center relative ${isDarkMode ? 'border-indigo-900/50 bg-[#050505]' : 'border-indigo-100 bg-white'}`}>
                      <span className={`text-5xl font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{report.scores.overall}</span>
                      <svg className="absolute top-0 left-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                         <circle cx="50" cy="50" r="46" fill="transparent" stroke="#4f46e5" strokeWidth="8" strokeDasharray={`${report.scores.overall * 2.89} 300`} strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="flex-1 w-full relative">
                      
                      <button onClick={handlePrint} className={`absolute top-0 right-0 hidden md:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors hide-on-print ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        打印本页报告
                      </button>

                      <div className="text-xs font-bold text-indigo-500 mb-2 tracking-widest uppercase">诊断摘要 · {pageType}</div>
                      <h2 className={`text-3xl font-extrabold mb-4 pr-32 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>整体优化评分：{report.scores.overall}/100</h2>
                      
                      <div className={`border p-5 rounded-xl mb-4 text-sm leading-relaxed ${isDarkMode ? 'border-rose-900/50 bg-rose-900/10 text-rose-200' : 'border-rose-100 bg-rose-50 text-rose-800'}`}>
                        {report.summary}
                      </div>
                      
                      <div className={`border p-6 rounded-xl flex flex-wrap gap-3 ${isDarkMode ? 'border-emerald-900/50 bg-emerald-900/10' : 'border-emerald-100 bg-emerald-50'}`}>
                        {report.good_points?.map((point: string, idx: number) => (
                          <div key={idx} className={`flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-full ${isDarkMode ? 'bg-emerald-900/30 text-emerald-300' : 'bg-white text-emerald-800 shadow-sm border border-emerald-200'}`}>
                            <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {point}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-10 border rounded-2xl p-8 mb-12 break-inside-avoid ${isDarkMode ? 'bg-[#12121a] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                    <div>
                      <div className={`flex justify-between font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}><span>Google 排名优化度</span><span className="text-xl text-blue-500">{report.scores.google}%</span></div>
                      <div className={`w-full rounded-full h-3 mb-3 ${isDarkMode ? 'bg-gray-800' : 'bg-slate-200'}`}><div className="bg-blue-500 h-3 rounded-full" style={{width: `${report.scores.google}%`}}></div></div>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>综合页面相关性、搜索结果呈现和排名基础的评估。</p>
                    </div>
                    <div>
                      <div className={`flex justify-between font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}><span>AI 可见优化度</span><span className="text-xl text-purple-500">{report.scores.ai}%</span></div>
                      <div className={`w-full rounded-full h-3 mb-3 ${isDarkMode ? 'bg-gray-800' : 'bg-slate-200'}`}><div className="bg-purple-500 h-3 rounded-full" style={{width: `${report.scores.ai}%`}}></div></div>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>综合内容清晰度、可引用性和 AI 搜索可见度的评估。</p>
                    </div>
                  </div>

                  <div className={`mb-12 border rounded-2xl p-6 md:p-8 ${isDarkMode ? 'bg-[#12121a] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex gap-2 items-center text-amber-500 font-bold mb-8"><svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"></path></svg> <span className={`text-2xl ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>优先优化行动</span></div>
                    <div className="space-y-6">
                      {report.priority_actions?.map((action: any, idx: number) => (
                        <div key={idx} className={`border rounded-xl p-6 relative break-inside-avoid ${isDarkMode ? 'border-white/10 bg-[#0a0a0c]' : 'border-slate-200 bg-white shadow-sm'}`}>
                          
                          {action.category && (
                          <div className={`absolute top-6 right-6 px-3 py-1 rounded-full text-xs font-bold tracking-wide ${isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-700'}`}>
                            {action.category}
                          </div>
                          )}
                          
                          <div className="flex gap-5 items-start mb-6 pr-24">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-900 text-white'}`}>{idx + 1}</div>
                            <div>
                               <div className={`font-bold text-lg mb-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{action.title}</div>
                               {action.description && <div className={`text-sm leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>{action.description}</div>}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-14">
                            <div className={`border text-xs p-4 rounded-lg flex items-start gap-2 ${isDarkMode ? 'border-emerald-900/50 bg-emerald-900/10 text-emerald-400' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                              <span className="font-bold shrink-0">Google:</span> <span>{action.google_benefit}</span>
                            </div>
                            <div className={`border text-xs p-4 rounded-lg flex items-start gap-2 ${isDarkMode ? 'border-purple-900/50 bg-purple-900/10 text-purple-400' : 'border-purple-200 bg-purple-50 text-purple-800'}`}>
                              <span className="font-bold shrink-0">AI:</span> <span>{action.ai_benefit}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    <div className={`border rounded-2xl p-6 break-inside-avoid ${isDarkMode ? 'border-white/5 bg-[#12121a]' : 'bg-slate-50 border-slate-200'}`}>
                      <h5 className="font-bold text-blue-500 mb-4">Title 标签建议</h5>
                      <div className="space-y-3">
                        {report.title_suggestions?.map((s: string, i: number) => <CopyBlock key={i} number={i+1} title={s} isDark={isDarkMode} />)}
                      </div>
                    </div>
                    <div className={`border rounded-2xl p-6 break-inside-avoid ${isDarkMode ? 'border-white/5 bg-[#12121a]' : 'bg-slate-50 border-slate-200'}`}>
                      <h5 className="font-bold text-purple-500 mb-4">Meta 描述建议</h5>
                      <div className="space-y-3">
                        {report.meta_suggestions?.map((s: string, i: number) => <CopyBlock key={i} number={i+1} title={s} isDark={isDarkMode} />)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className={`border rounded-2xl p-5 break-inside-avoid ${isDarkMode ? 'border-white/5 bg-[#0a0a0c]' : 'bg-slate-50 border-slate-200'}`}>
                      <h5 className="font-bold text-blue-500 mb-4">H1 建议</h5>
                      <div className="space-y-3">
                        {report.h1_suggestions?.map((s: string, i: number) => <CopyBlock key={i} number={i+1} title={s} isDark={isDarkMode} />)}
                      </div>
                    </div>
                    <div className={`border rounded-2xl p-5 break-inside-avoid ${isDarkMode ? 'border-white/5 bg-[#0a0a0c]' : 'bg-slate-50 border-slate-200'}`}>
                      <h5 className="font-bold text-blue-500 mb-4">H2 内容结构建议</h5>
                      <div className="space-y-3">
                        {report.h2_suggestions?.map((s: string, i: number) => <CopyBlock key={i} number={i+1} title={s} isDark={isDarkMode} />)}
                      </div>
                    </div>
                  </div>

                  <div className={`border rounded-2xl p-5 mb-8 break-inside-avoid ${isDarkMode ? 'border-white/5 bg-[#0a0a0c]' : 'bg-slate-50 border-slate-200'}`}>
                    <h5 className="font-bold text-purple-500 mb-4">FAQ 建议</h5>
                    <div className="space-y-3">
                      {report.faq_suggestions?.map((faq: any, i: number) => (
                        <CopyBlock key={i} title={`Q: ${faq.question}`} subtitle={`A: ${faq.answer}`} copyText={`Q: ${faq.question}\nA: ${faq.answer}`} isDark={isDarkMode} />
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className={`border rounded-2xl p-5 break-inside-avoid ${isDarkMode ? 'border-white/5 bg-[#0a0a0c]' : 'bg-slate-50 border-slate-200'}`}>
                      <h5 className="font-bold text-blue-500 mb-4">内部链接建议</h5>
                      <div className="space-y-3">
                        {report.internal_links?.map((link: any, i: number) => (
                          <CopyBlock key={i} title={link.target} subtitle={<div className="flex flex-col gap-1 mt-1"><div><span className="text-gray-500">锚文本:</span> {link.anchor}</div><div><span className="text-gray-500">位置:</span> {link.position}</div></div>} isDark={isDarkMode} hideCopy={true} />
                        ))}
                      </div>
                    </div>
                    <div className={`border rounded-2xl p-5 break-inside-avoid ${isDarkMode ? 'border-white/5 bg-[#0a0a0c]' : 'bg-slate-50 border-slate-200'}`}>
                      <h5 className="font-bold text-emerald-500 mb-4">外链机会 (PR/合作)</h5>
                      <div className="space-y-3">
                        {report.backlink_opportunities?.map((link: any, i: number) => (
                          <CopyBlock key={i} title={link.type} subtitle={link.description} isDark={isDarkMode} hideCopy={true} />
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </>
          )}

          {currentView === 'reports' && (
            <div className="w-full animate-fade-in">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className={`text-3xl font-extrabold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>我的页面优化报告</h1>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>查看过去生成的页面优化报告，继续导出报告或重新分析页面。</p>
                </div>
                <button onClick={handleStartNewAnalysis} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg> 生成优化报告
                </button>
              </div>

              {isHistoryLoading ? (
                <div className="text-center py-20 text-gray-400 font-medium">正在加载历史报告...</div>
              ) : historyReports.length === 0 ? (
                <div className={`text-center py-20 border rounded-3xl ${isDarkMode ? 'border-white/5 bg-[#12121a]' : 'border-slate-200 bg-white shadow-sm'}`}>
                  <p className={`text-base mb-4 font-medium ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>您还没有生成过任何优化报告</p>
                  <button onClick={handleStartNewAnalysis} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg">立即开始分析</button>
                </div>
              ) : (
                <div className="space-y-6">
                  {historyReports.map((item) => {
                    const data = item.report_data;
                    const isExpanded = report === data;

                    return (
                      <div key={item.id} className={`border rounded-[24px] p-6 md:p-8 transition-all ${isDarkMode ? 'bg-[#12121a] border-white/5 hover:border-indigo-500/50' : 'bg-white border-slate-200 shadow-sm hover:border-indigo-300'}`}>
                        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
                          
                          <div className="flex-1 min-w-0">
                            <a href={item.target_url} target="_blank" rel="noreferrer" className={`text-lg md:text-xl font-extrabold hover:underline block truncate mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {item.target_url}
                            </a>
                            
                            <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold">
                              <span className={`px-3.5 py-1.5 rounded-xl ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>
                                关键词: {item.keyword}
                              </span>
                              <span className={`px-3.5 py-1.5 rounded-xl ${isDarkMode ? 'bg-white/5 text-gray-300 border border-white/10' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                类型: {item.page_type || '首页'}
                              </span>
                              <span className={`px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 ${isDarkMode ? 'bg-white/5 text-gray-400 border border-white/10' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                <svg className="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                {item.created_at || '暂无数据'}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 shrink-0 w-full xl:w-auto justify-between xl:justify-end pt-4 xl:pt-0 border-t xl:border-t-0 border-white/5">
                            
                            <div className="flex items-center gap-2">
                              <div className={`text-center px-3 py-2 rounded-xl border ${isDarkMode ? 'bg-purple-900/10 border-purple-900/30' : 'bg-purple-50 border-purple-100'}`}>
                                <div className="text-[9px] text-purple-400 uppercase font-bold tracking-wider">评分</div>
                                <div className="text-sm font-black text-purple-500">{data?.scores?.overall || 0}/100</div>
                              </div>
                              <div className={`text-center px-3 py-2 rounded-xl border ${isDarkMode ? 'bg-blue-900/10 border-blue-900/30' : 'bg-blue-50 border-blue-100'}`}>
                                <div className="text-[9px] text-blue-400 uppercase font-bold tracking-wider">GOOGLE</div>
                                <div className="text-sm font-black text-blue-500">{data?.scores?.google || 0}/100</div>
                              </div>
                              <div className={`text-center px-3 py-2 rounded-xl border ${isDarkMode ? 'bg-purple-900/10 border-purple-900/30' : 'bg-purple-50 border-purple-100'}`}>
                                <div className="text-[9px] text-purple-400 uppercase font-bold tracking-wider">AI</div>
                                <div className="text-sm font-black text-purple-500">{data?.scores?.ai || 0}/100</div>
                              </div>
                              <div className={`text-center px-3 py-2 rounded-xl border ${isDarkMode ? 'bg-amber-900/10 border-amber-900/30' : 'bg-amber-50 border-amber-100'}`}>
                                <div className="text-[9px] text-amber-500 uppercase font-bold tracking-wider">已用积分</div>
                                <div className="text-sm font-black text-amber-500">1</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => {
                                  if (isExpanded) {
                                    setReport(null);
                                  } else {
                                    setReport(data);
                                    setPageType(item.page_type || '首页');
                                    setUrl(item.target_url);
                                    setKeyword(item.keyword);
                                  }
                                }}
                                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                                  isExpanded 
                                    ? 'bg-purple-600 text-white hover:bg-purple-500' 
                                    : (isDarkMode ? 'bg-white text-black hover:bg-gray-200' : 'bg-slate-900 text-white hover:bg-slate-800')
                                }`}
                              >
                                {isExpanded ? '收起报告' : '查看报告'}
                              </button>

                              <button 
                                onClick={() => setConfirmModalData({
                                  isOpen: true,
                                  url: item.target_url,
                                  keyword: item.keyword,
                                  pageType: item.page_type || '首页'
                                })}
                                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors ${isDarkMode ? 'border-indigo-500/30 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30' : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                                重新分析
                              </button>

                              <button 
                                onClick={() => {
                                  setPrintingReport(item);
                                  setTimeout(() => window.print(), 150);
                                }}
                                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors ${isDarkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                                导出报告
                              </button>
                            </div>

                          </div>
                        </div>

                        {isExpanded && (
                          <div className={`mt-8 pt-8 border-t animate-fade-in ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                            
                            <div className={`flex flex-col lg:flex-row gap-8 items-start mb-8 border-b pb-8 ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
                              <div className={`w-28 h-28 shrink-0 rounded-full border-8 flex items-center justify-center relative ${isDarkMode ? 'border-indigo-900/50 bg-[#050505]' : 'border-indigo-100 bg-white'}`}>
                                <span className={`text-4xl font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{data.scores.overall}</span>
                              </div>
                              <div className="flex-1">
                                <div className="text-xs font-bold text-indigo-500 mb-2 tracking-widest uppercase">诊断摘要 · {item.page_type || '首页'}</div>
                                <h3 className={`text-2xl font-extrabold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>整体优化评分：{data.scores.overall}/100</h3>
                                <div className={`border p-4 rounded-xl text-sm leading-relaxed ${isDarkMode ? 'border-rose-900/50 bg-rose-900/10 text-rose-200' : 'border-rose-100 bg-rose-50 text-rose-800'}`}>
                                  {data.summary}
                                </div>
                              </div>
                            </div>

                            <div className={`mb-8 border rounded-2xl p-6 ${isDarkMode ? 'bg-[#0a0a0c] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                              <h4 className={`text-lg font-bold mb-6 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                <span className="text-amber-500">⚡</span> 优先优化行动
                              </h4>
                              <div className="space-y-4">
                                {data.priority_actions?.map((action: any, i: number) => (
                                  <div key={i} className={`border rounded-xl p-5 ${isDarkMode ? 'border-white/10 bg-[#12121a]' : 'border-slate-200 bg-white'}`}>
                                    <div className="font-bold text-base mb-1">{i+1}. {action.title}</div>
                                    <div className={`text-sm mb-3 ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>{action.description}</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                      <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><b>Google 收益:</b> {action.google_benefit}</div>
                                      <div className="p-3 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20"><b>AI 收益:</b> {action.ai_benefit}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                              <div className={`border rounded-2xl p-5 ${isDarkMode ? 'border-white/5 bg-[#0a0a0c]' : 'bg-slate-50 border-slate-200'}`}>
                                <h5 className="font-bold text-blue-500 mb-4">Title 标签建议</h5>
                                <div className="space-y-3">
                                  {data.title_suggestions?.map((s: string, i: number) => <CopyBlock key={i} number={i+1} title={s} isDark={isDarkMode} />)}
                                </div>
                              </div>
                              <div className={`border rounded-2xl p-5 ${isDarkMode ? 'border-white/5 bg-[#0a0a0c]' : 'bg-slate-50 border-slate-200'}`}>
                                <h5 className="font-bold text-purple-500 mb-4">Meta 描述建议</h5>
                                <div className="space-y-3">
                                  {data.meta_suggestions?.map((s: string, i: number) => <CopyBlock key={i} number={i+1} title={s} isDark={isDarkMode} />)}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                              <div className={`border rounded-2xl p-5 ${isDarkMode ? 'border-white/5 bg-[#0a0a0c]' : 'bg-slate-50 border-slate-200'}`}>
                                <h5 className="font-bold text-blue-500 mb-4">H1 建议</h5>
                                <div className="space-y-3">
                                  {data.h1_suggestions?.map((s: string, i: number) => <CopyBlock key={i} number={i+1} title={s} isDark={isDarkMode} />)}
                                </div>
                              </div>
                              <div className={`border rounded-2xl p-5 ${isDarkMode ? 'border-white/5 bg-[#0a0a0c]' : 'bg-slate-50 border-slate-200'}`}>
                                <h5 className="font-bold text-blue-500 mb-4">H2 内容结构建议</h5>
                                <div className="space-y-3">
                                  {data.h2_suggestions?.map((s: string, i: number) => <CopyBlock key={i} number={i+1} title={s} isDark={isDarkMode} />)}
                                </div>
                              </div>
                            </div>

                            <div className={`border rounded-2xl p-5 mb-8 ${isDarkMode ? 'border-white/5 bg-[#0a0a0c]' : 'bg-slate-50 border-slate-200'}`}>
                              <h5 className="font-bold text-purple-500 mb-4">FAQ 建议</h5>
                              <div className="space-y-3">
                                {data.faq_suggestions?.map((faq: any, i: number) => (
                                  <CopyBlock key={i} title={`Q: ${faq.question}`} subtitle={`A: ${faq.answer}`} copyText={`Q: ${faq.question}\nA: ${faq.answer}`} isDark={isDarkMode} />
                                ))}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className={`border rounded-2xl p-5 ${isDarkMode ? 'border-white/5 bg-[#0a0a0c]' : 'bg-slate-50 border-slate-200'}`}>
                                <h5 className="font-bold text-blue-500 mb-4">内部链接建议</h5>
                                <div className="space-y-3">
                                  {data.internal_links?.map((link: any, i: number) => (
                                    <CopyBlock key={i} title={link.target} subtitle={<div className="flex flex-col gap-1 mt-1"><div><span className="text-gray-500">锚文本:</span> {link.anchor}</div><div><span className="text-gray-500">位置:</span> {link.position}</div></div>} isDark={isDarkMode} hideCopy={true} />
                                  ))}
                                </div>
                              </div>
                              <div className={`border rounded-2xl p-5 ${isDarkMode ? 'border-white/5 bg-[#0a0a0c]' : 'bg-slate-50 border-slate-200'}`}>
                                <h5 className="font-bold text-emerald-500 mb-4">外链机会 (PR/合作)</h5>
                                <div className="space-y-3">
                                  {data.backlink_opportunities?.map((link: any, i: number) => (
                                    <CopyBlock key={i} title={link.type} subtitle={link.description} isDark={isDarkMode} hideCopy={true} />
                                  ))}
                                </div>
                              </div>
                            </div>

                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #4f46e5; border-radius: 10px; }
        
        @media print {
          @page { margin: 20mm 20mm 20mm 20mm; }
          body, html { 
            height: auto !important; 
            overflow: visible !important; 
            display: block !important; 
            background: white !important; 
            color: black !important; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }
          .hide-on-print { display: none !important; }
          .print-container { 
            box-shadow: none !important; 
            border: none !important; 
            padding: 0 !important; 
            margin: 0 !important;
            background: white !important;
          }
          .break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}} />
    </>
  );
}