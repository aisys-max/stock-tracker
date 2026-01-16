'use client';

import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, TrendingDown, X, Plus, LogOut, User, RefreshCw, ArrowLeftRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import Link from 'next/link';

interface StockInfo {
  symbol: string;
  price: number;
  change: number;
  changePercent: string;
  high: number;
  low: number;
  volume: string;
  market: string;
}

interface ChartDataPoint {
  date: string;
  price: number;
}

export default function StockTracker() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const [watchlist, setWatchlist] = useState<StockInfo[]>([]);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [selectedStock, setSelectedStock] = useState<StockInfo | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadWatchlist(session.user.id);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // 워치리스트 자동 업데이트 (5분마다)
  useEffect(() => {
    if (!user || watchlist.length === 0) return;

    const updateWatchlistPrices = async () => {
      console.log('Updating watchlist prices...');
      const updatedWatchlist = await Promise.all(
        watchlist.map(async (stock) => {
          try {
            const response = await fetch(`/api/stock?symbol=${stock.symbol}`);
            const data = await response.json();

            if (data.chart?.result?.[0]) {
              const result = data.chart.result[0];
              const meta = result.meta;
              const currentPrice = meta.regularMarketPrice;
              const previousClose = meta.chartPreviousClose || meta.previousClose;
              const change = currentPrice - previousClose;
              const changePercent = ((change / previousClose) * 100).toFixed(2);

              return {
                ...stock,
                price: currentPrice,
                change: change,
                changePercent: `${changePercent}%`,
                high: meta.regularMarketDayHigh || currentPrice,
                low: meta.regularMarketDayLow || currentPrice,
                volume: meta.regularMarketVolume?.toString() || stock.volume,
              };
            }
            return stock;
          } catch (error) {
            console.error(`Error updating ${stock.symbol}:`, error);
            return stock;
          }
        })
      );

      setWatchlist(updatedWatchlist);
      await saveWatchlistToSupabase(updatedWatchlist);
    };

    // 즉시 한 번 실행
    updateWatchlistPrices();

    // 5분마다 자동 업데이트
    const interval = setInterval(updateWatchlistPrices, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, watchlist.length]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
    if (session?.user) {
      loadWatchlist(session.user.id);
    }
  };

  const loadWatchlist = async (userId: string) => {
    const { data, error } = await supabase
      .from('watchlists')
      .select('stocks')
      .eq('user_id', userId)
      .single();

    if (data && data.stocks) {
      setWatchlist(data.stocks);
    }
  };

  const saveWatchlistToSupabase = async (newWatchlist: StockInfo[]) => {
    if (!user) return;

    console.log('Saving watchlist for user:', user.id);
    console.log('Watchlist data:', newWatchlist);

    const { data, error } = await supabase
      .from('watchlists')
      .upsert({
        user_id: user.id,
        stocks: newWatchlist,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Error saving watchlist:', error);
      alert(`워치리스트 저장 실패: ${error.message}`);
    } else {
      console.log('Watchlist saved successfully:', data);
    }
  };

  const handleResetPasswordRequest = async () => {
    if (!email) {
      alert('이메일을 입력해주세요');
      return;
    }

    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      alert('비밀번호 재설정 이메일을 발송했습니다. 이메일을 확인해주세요.');
      setShowResetPassword(false);
    } catch (error: any) {
      alert(`오류: ${error.message}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        console.log('Login successful:', data);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}`,
          }
        });
        if (error) throw error;
        console.log('Signup response:', data);

        if (data.user?.identities?.length === 0) {
          alert('이미 가입된 이메일입니다. 로그인해주세요.');
        } else {
          alert('회원가입 완료! 이메일 확인이 필요없다면 바로 로그인하세요.\n(개발 모드에서는 이메일 확인 생략 가능)');
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      alert(`오류: ${error.message || error.error_description || '알 수 없는 오류'}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setWatchlist([]);
  };

  const isKoreanStock = (symbol: string) => {
    return symbol.endsWith('.KS') || symbol.endsWith('.KQ') || /^\d{6}$/.test(symbol);
  };

  const formatKoreanSymbol = (symbol: string) => {
    if (/^\d{6}$/.test(symbol)) {
      return `${symbol}.KS`;
    }
    return symbol;
  };

  const fetchStockYahoo = async (symbol: string) => {
    const formattedSymbol = isKoreanStock(symbol) ? formatKoreanSymbol(symbol) : symbol;

    try {
      const quoteRes = await fetch(`/api/stock?symbol=${formattedSymbol}`);
      const data = await quoteRes.json();
      console.log('Yahoo Finance response:', data);

      if (data.chart && data.chart.result && data.chart.result[0]) {
        const result = data.chart.result[0];
        const meta = result.meta;
        const quote = result.indicators.quote[0];
        const timestamps = result.timestamp;

        const currentPrice = meta.regularMarketPrice;
        const previousClose = meta.chartPreviousClose || meta.previousClose;
        const change = currentPrice - previousClose;
        const changePercent = ((change / previousClose) * 100).toFixed(2);

        const stockInfo: StockInfo = {
          symbol: formattedSymbol,
          price: currentPrice,
          change: change,
          changePercent: `${changePercent}%`,
          high: meta.regularMarketDayHigh || currentPrice,
          low: meta.regularMarketDayLow || currentPrice,
          volume: meta.regularMarketVolume?.toString() || 'N/A',
          market: isKoreanStock(symbol) ? '한국' : '미국'
        };

        setSelectedStock(stockInfo);

        if (timestamps && quote.close) {
          const formattedData: ChartDataPoint[] = timestamps.map((timestamp: number, index: number) => {
            const date = new Date(timestamp * 1000);
            return {
              date: `${date.getMonth() + 1}/${date.getDate()}`,
              price: quote.close[index]
            };
          }).filter((item: ChartDataPoint) => item.price !== null);

          setChartData(formattedData);
        }
      } else {
        alert('주식 데이터를 찾을 수 없습니다. 티커 심볼을 확인해주세요.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('데이터를 가져오는 중 오류가 발생했습니다: ' + (error as Error).message);
    }
  };

  const fetchStockData = async (symbol: string) => {
    setLoading(true);
    setChartData([]);
    setSelectedStock(null);

    await fetchStockYahoo(symbol);

    setLoading(false);
  };

  const addToWatchlist = async () => {
    if (selectedStock && !watchlist.find(s => s.symbol === selectedStock.symbol)) {
      const newWatchlist = [...watchlist, selectedStock];
      setWatchlist(newWatchlist);
      setLastUpdate(new Date());
      await saveWatchlistToSupabase(newWatchlist);
    }
  };

  const refreshWatchlist = async () => {
    if (watchlist.length === 0 || isRefreshing) return;

    setIsRefreshing(true);
    console.log('Manual refresh triggered...');

    try {
      const updatedWatchlist = await Promise.all(
        watchlist.map(async (stock) => {
          try {
            const response = await fetch(`/api/stock?symbol=${stock.symbol}`);
            const data = await response.json();

            if (data.chart?.result?.[0]) {
              const result = data.chart.result[0];
              const meta = result.meta;
              const currentPrice = meta.regularMarketPrice;
              const previousClose = meta.chartPreviousClose || meta.previousClose;
              const change = currentPrice - previousClose;
              const changePercent = ((change / previousClose) * 100).toFixed(2);

              return {
                ...stock,
                price: currentPrice,
                change: change,
                changePercent: `${changePercent}%`,
                high: meta.regularMarketDayHigh || currentPrice,
                low: meta.regularMarketDayLow || currentPrice,
                volume: meta.regularMarketVolume?.toString() || stock.volume,
              };
            }
            return stock;
          } catch (error) {
            console.error(`Error updating ${stock.symbol}:`, error);
            return stock;
          }
        })
      );

      setWatchlist(updatedWatchlist);
      setLastUpdate(new Date());
      await saveWatchlistToSupabase(updatedWatchlist);
    } catch (error) {
      console.error('Error refreshing watchlist:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const removeFromWatchlist = async (symbol: string) => {
    const newWatchlist = watchlist.filter(s => s.symbol !== symbol);
    setWatchlist(newWatchlist);
    await saveWatchlistToSupabase(newWatchlist);
  };

  const handleSearch = () => {
    const trimmedSymbol = searchSymbol.trim().toUpperCase();
    if (trimmedSymbol) {
      setSearchSymbol('');
      fetchStockData(trimmedSymbol);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  if (!user) {
    if (showResetPassword) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
            <h2 className="text-3xl font-bold text-gray-800 mb-2 text-center">
              🔑 비밀번호 찾기
            </h2>
            <p className="text-gray-600 mb-6 text-center text-sm">
              가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다
            </p>

            <div className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일"
                onKeyPress={(e) => e.key === 'Enter' && handleResetPasswordRequest()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleResetPasswordRequest}
                disabled={authLoading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50"
              >
                {authLoading ? '전송 중...' : '재설정 이메일 보내기'}
              </button>
              <button
                onClick={() => setShowResetPassword(false)}
                className="w-full text-gray-600 py-2 hover:text-gray-800"
              >
                ← 로그인으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <h2 className="text-3xl font-bold text-gray-800 mb-2 text-center">
            📈 주가 트래커
          </h2>
          <p className="text-gray-600 mb-6 text-center text-sm">
            로그인하고 나만의 관심 종목을 관리하세요
          </p>

          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 rounded-lg transition ${isLogin ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
            >
              로그인
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 rounded-lg transition ${!isLogin ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
            >
              회원가입
            </button>
          </div>

          <div className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              onKeyPress={(e) => e.key === 'Enter' && handleAuth(e as any)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAuth}
              disabled={authLoading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50"
            >
              {authLoading ? '처리중...' : isLogin ? '로그인' : '회원가입'}
            </button>

            {isLogin && (
              <button
                onClick={() => setShowResetPassword(true)}
                className="w-full text-sm text-gray-600 hover:text-blue-600 mt-2"
              >
                비밀번호를 잊으셨나요?
              </button>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center mb-4">
              ✅ 무료, 무제한 주가 조회<br />
              ✅ 미국 + 한국 주식 지원<br />
              ✅ 클라우드 동기화
            </p>
            <p className="text-xs text-gray-400 text-center">
              💡 로그인 문제가 있나요?<br />
              Supabase에서 "Enable email confirmations"을 OFF하거나<br />
              관리자에게 문의하세요
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-4xl font-bold text-white">📈 글로벌 주가 트래커</h1>
              <Link
                href="/exchange"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
              >
                <ArrowLeftRight size={18} />
                환율 보기
              </Link>
            </div>
            <p className="text-gray-400">미국 + 한국 주식 실시간 정보</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-white">
              <User size={20} />
              <span className="text-sm">{user.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition"
            >
              <LogOut size={18} />
              로그아웃
            </button>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchSymbol}
                onChange={(e) => setSearchSymbol(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="미국: AAPL, INTC | 한국: 005930.KS (삼성전자), 000660.KS (SK하이닉스)"
                className="w-full pl-10 pr-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? '로딩...' : '검색'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 팁: 삼성전자는 005930 또는 005930.KS로 검색하세요
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-slate-800 rounded-lg p-6 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">관심 종목</h2>
                <div className="flex items-center gap-3">
                  {lastUpdate && (
                    <span className="text-xs text-gray-500">
                      {lastUpdate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <button
                    onClick={refreshWatchlist}
                    disabled={isRefreshing || watchlist.length === 0}
                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title="새로고침"
                  >
                    <RefreshCw
                      size={16}
                      className={`text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`}
                    />
                  </button>
                </div>
              </div>
              {watchlist.length === 0 ? (
                <p className="text-gray-400 text-sm">관심 종목을 추가해보세요</p>
              ) : (
                <div className="space-y-3">
                  {watchlist.map((stock) => (
                    <div
                      key={stock.symbol}
                      className={`bg-slate-700 p-4 rounded-lg cursor-pointer hover:bg-slate-600 transition ${selectedStock?.symbol === stock.symbol ? 'ring-2 ring-blue-500' : ''
                        }`}
                      onClick={() => {
                        console.log('Clicking watchlist item:', stock.symbol);
                        fetchStockData(stock.symbol);
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-bold text-white">{stock.symbol}</span>
                          <span className="text-xs text-gray-400 ml-2">{stock.market}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromWatchlist(stock.symbol);
                          }}
                          className="text-gray-400 hover:text-red-400"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-2xl font-bold text-white">
                          {stock.market === '한국' ? '₩' : '$'}{stock.price?.toFixed(2)}
                        </span>
                        <span className={`flex items-center text-sm ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                          {stock.change >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                          {stock.changePercent}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            {selectedStock ? (
              <div className="space-y-6">
                <div className="bg-slate-800 rounded-lg p-6 shadow-xl">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-3xl font-bold text-white">{selectedStock.symbol}</h2>
                      <p className="text-gray-400">{selectedStock.market} 주식</p>
                    </div>
                    <button
                      onClick={addToWatchlist}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      <Plus size={20} />
                      관심 추가
                    </button>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-end gap-3 mb-2">
                      <span className="text-5xl font-bold text-white">
                        {selectedStock.market === '한국' ? '₩' : '$'}{selectedStock.price?.toFixed(2)}
                      </span>
                      <span className={`flex items-center text-xl mb-2 ${selectedStock.change >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                        {selectedStock.change >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                        {selectedStock.change?.toFixed(2)} ({selectedStock.changePercent})
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm">고가</p>
                      <p className="text-white font-bold">
                        {selectedStock.market === '한국' ? '₩' : '$'}{selectedStock.high?.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">저가</p>
                      <p className="text-white font-bold">
                        {selectedStock.market === '한국' ? '₩' : '$'}{selectedStock.low?.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">거래량</p>
                      <p className="text-white font-bold">{selectedStock.volume}</p>
                    </div>
                  </div>
                </div>

                {chartData.length > 0 && (
                  <div className="bg-slate-800 rounded-lg p-6 shadow-xl">
                    <h3 className="text-xl font-bold text-white mb-4">30일 가격 추이</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <XAxis dataKey="date" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" domain={['auto', 'auto']} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#fff'
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="price"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-800 rounded-lg p-12 shadow-xl text-center">
                <Search className="mx-auto mb-4 text-gray-600" size={48} />
                <p className="text-gray-400 text-lg">티커 심볼을 검색하여 주가 정보를 확인하세요</p>
                <div className="mt-4 text-sm text-gray-500 space-y-1">
                  <p>🇺🇸 미국: AAPL, INTC, MSFT, GOOGL</p>
                  <p>🇰🇷 한국: 005930.KS (삼성전자), 000660.KS (SK하이닉스)</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}