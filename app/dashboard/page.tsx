'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, RefreshCw, Sparkles } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface StockInfo {
    symbol: string;
    price: number;
    change: number;
    changePercent: string;
    market: string;
}

interface ChartDataPoint {
    date: string;
    price: number;
}

const EXCHANGE_PAIRS = [
    { from: 'USD', to: 'KRW', label: 'USD → KRW', symbol: '$→₩' },
    { from: 'USD', to: 'JPY', label: 'USD → JPY', symbol: '$→¥' },
    { from: 'EUR', to: 'KRW', label: 'EUR → KRW', symbol: '€→₩' },
];

export default function DashboardPage() {
    const [user, setUser] = useState<SupabaseUser | null>(null);
    const [watchlist, setWatchlist] = useState<StockInfo[]>([]);
    const [selectedPair, setSelectedPair] = useState(EXCHANGE_PAIRS[0]);
    const [exchangeRate, setExchangeRate] = useState<number>(0);
    const [exchangeChartData, setExchangeChartData] = useState<ChartDataPoint[]>([]);
    const [stockCharts, setStockCharts] = useState<{ [key: string]: ChartDataPoint[] }>({});
    const [loading, setLoading] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const router = useRouter();

    useEffect(() => {
        checkUser();
    }, []);

    useEffect(() => {
        if (user) {
            loadWatchlist();
        }
    }, [user]);

    useEffect(() => {
        if (selectedPair) {
            fetchExchangeData();
        }
    }, [selectedPair]);

    useEffect(() => {
        if (watchlist.length > 0) {
            fetchAllStockCharts();
        }
    }, [watchlist]);

    const checkUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
    };

    const loadWatchlist = async () => {
        if (!user) return;

        const { data, error } = await supabase
            .from('watchlists')
            .select('stocks')
            .eq('user_id', user.id)
            .single();

        if (data && data.stocks) {
            setWatchlist(data.stocks);
        }
    };

    const fetchExchangeData = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/exchange?base=${selectedPair.from}`);
            const data = await response.json();

            if (data.conversion_rates) {
                const rate = data.conversion_rates[selectedPair.to];
                setExchangeRate(rate);

                // 30일 차트 데이터 생성 (실제로는 historical API 필요)
                const chartData: ChartDataPoint[] = [];
                for (let i = 29; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    const randomVariation = 1 + (Math.random() - 0.5) * 0.06;
                    chartData.push({
                        date: `${date.getMonth() + 1}/${date.getDate()}`,
                        price: rate * randomVariation,
                    });
                }
                setExchangeChartData(chartData);
                setLastUpdate(new Date());
            }
        } catch (error) {
            console.error('Error fetching exchange data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAllStockCharts = async () => {
        const charts: { [key: string]: ChartDataPoint[] } = {};

        for (const stock of watchlist) {
            try {
                const response = await fetch(`/api/stock?symbol=${stock.symbol}`);
                const data = await response.json();

                if (data.chart?.result?.[0]) {
                    const result = data.chart.result[0];
                    const timestamps = result.timestamp;
                    const quote = result.indicators.quote[0];

                    if (timestamps && quote.close) {
                        const formattedData: ChartDataPoint[] = timestamps
                            .map((timestamp: number, index: number) => {
                                const date = new Date(timestamp * 1000);
                                return {
                                    date: `${date.getMonth() + 1}/${date.getDate()}`,
                                    price: quote.close[index]
                                };
                            })
                            .filter((item: ChartDataPoint) => item.price !== null);

                        charts[stock.symbol] = formattedData;
                    }
                }
            } catch (error) {
                console.error(`Error fetching chart for ${stock.symbol}:`, error);
            }
        }

        setStockCharts(charts);
    };

    const convertPrice = (price: number, fromMarket: string): { converted: number; symbol: string } => {
        if (fromMarket === '미국' && selectedPair.from === 'USD') {
            return { converted: price * exchangeRate, symbol: selectedPair.to };
        } else if (fromMarket === '한국' && selectedPair.to === 'KRW') {
            return { converted: price / exchangeRate, symbol: selectedPair.from };
        }
        return { converted: price, symbol: fromMarket === '미국' ? 'USD' : 'KRW' };
    };

    const formatCurrency = (value: number, market: string) => {
        if (market === '미국') return `$${value.toFixed(2)}`;
        if (market === '한국') return `₩${value.toFixed(0)}`;
        return value.toFixed(2);
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
                <div className="bg-slate-800 rounded-lg p-8 max-w-md w-full text-center">
                    <Sparkles className="mx-auto mb-4 text-blue-400" size={48} />
                    <h2 className="text-2xl font-bold text-white mb-4">로그인이 필요합니다</h2>
                    <p className="text-gray-400 mb-6">통합 대시보드는 로그인 후 이용 가능합니다</p>
                    <button
                        onClick={() => router.push('/')}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition"
                    >
                        로그인하러 가기
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
            <div className="max-w-7xl mx-auto">
                {/* 헤더 */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition"
                    >
                        <ArrowLeft size={20} />
                        뒤로 가기
                    </button>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                                <Sparkles className="text-white" size={28} />
                            </div>
                            <div>
                                <h1 className="text-4xl font-bold text-white">통합 투자 대시보드</h1>
                                <p className="text-gray-400">30일 추이를 한눈에</p>
                            </div>
                        </div>
                        <div className="text-right">
                            {lastUpdate && (
                                <div className="text-xs text-gray-500 mb-2">
                                    업데이트: {lastUpdate.toLocaleTimeString('ko-KR')}
                                </div>
                            )}
                            <button
                                onClick={() => {
                                    fetchExchangeData();
                                    fetchAllStockCharts();
                                }}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition disabled:opacity-50"
                            >
                                <RefreshCw size={16} className={`${loading ? 'animate-spin' : ''}`} />
                                <span className="text-sm text-gray-300">새로고침</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* 환율 선택 */}
                <div className="mb-6 flex gap-2">
                    {EXCHANGE_PAIRS.map((pair) => (
                        <button
                            key={`${pair.from}-${pair.to}`}
                            onClick={() => setSelectedPair(pair)}
                            className={`px-6 py-3 rounded-lg transition font-semibold ${selectedPair.from === pair.from && selectedPair.to === pair.to
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg'
                                    : 'bg-slate-800 text-gray-300 hover:bg-slate-700 border border-slate-700'
                                }`}
                        >
                            {pair.symbol} {pair.label}
                        </button>
                    ))}
                </div>

                {/* 차트 그리드 */}
                <div className="space-y-4">
                    {/* 환율 차트 */}
                    <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-1">{selectedPair.label}</h2>
                                <p className="text-blue-100 text-sm">30일 환율 추이</p>
                            </div>
                            <div className="text-right">
                                <div className="text-4xl font-bold text-white">
                                    {exchangeRate.toFixed(2)}
                                </div>
                                <div className="text-blue-200 text-sm">{selectedPair.to}</div>
                            </div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={exchangeChartData}>
                                    <XAxis
                                        dataKey="date"
                                        stroke="#93c5fd"
                                        tick={{ fill: '#93c5fd', fontSize: 12 }}
                                    />
                                    <YAxis
                                        stroke="#93c5fd"
                                        tick={{ fill: '#93c5fd', fontSize: 12 }}
                                        domain={['auto', 'auto']}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1e293b',
                                            border: 'none',
                                            borderRadius: '8px',
                                            color: '#fff'
                                        }}
                                        formatter={(value: number) => [value.toFixed(2), '환율']}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="price"
                                        stroke="#fff"
                                        strokeWidth={3}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 주식 차트들 */}
                    {watchlist.length === 0 ? (
                        <div className="bg-slate-800 rounded-xl p-12 text-center border border-slate-700">
                            <p className="text-gray-400 mb-4">관심 종목이 없습니다</p>
                            <button
                                onClick={() => router.push('/')}
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            >
                                종목 추가하기
                            </button>
                        </div>
                    ) : (
                        watchlist.map((stock) => {
                            const isPositive = stock.change >= 0;
                            const converted = convertPrice(stock.price, stock.market);
                            const chartData = stockCharts[stock.symbol] || [];

                            return (
                                <div
                                    key={stock.symbol}
                                    className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl p-6 shadow-xl border border-slate-600 hover:border-blue-500 transition"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h2 className="text-2xl font-bold text-white">{stock.symbol}</h2>
                                                <span className="text-xs px-3 py-1 bg-slate-600 text-gray-300 rounded-full">
                                                    {stock.market}
                                                </span>
                                            </div>
                                            <p className="text-gray-400 text-sm">30일 가격 추이</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center justify-end gap-2 mb-1">
                                                <div className="text-3xl font-bold text-white">
                                                    {formatCurrency(stock.price, stock.market)}
                                                </div>
                                                <div className={`flex items-center gap-1 text-lg font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'
                                                    }`}>
                                                    {isPositive ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                                                    {stock.changePercent}
                                                </div>
                                            </div>
                                            <div className="text-sm text-blue-300">
                                                ≈ {converted.symbol === 'USD' ? '$' :
                                                    converted.symbol === 'KRW' ? '₩' :
                                                        converted.symbol === 'JPY' ? '¥' : '€'}
                                                {converted.converted.toFixed(2)} {converted.symbol}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-900/50 rounded-lg p-4">
                                        {chartData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={200}>
                                                <LineChart data={chartData}>
                                                    <XAxis
                                                        dataKey="date"
                                                        stroke="#9ca3af"
                                                        tick={{ fill: '#9ca3af', fontSize: 12 }}
                                                    />
                                                    <YAxis
                                                        stroke="#9ca3af"
                                                        tick={{ fill: '#9ca3af', fontSize: 12 }}
                                                        domain={['auto', 'auto']}
                                                    />
                                                    <Tooltip
                                                        contentStyle={{
                                                            backgroundColor: '#1e293b',
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            color: '#fff'
                                                        }}
                                                        formatter={(value: number) => [
                                                            formatCurrency(value, stock.market),
                                                            '가격'
                                                        ]}
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="price"
                                                        stroke={isPositive ? '#4ade80' : '#f87171'}
                                                        strokeWidth={2}
                                                        dot={false}
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-[200px] flex items-center justify-center">
                                                <div className="text-center">
                                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                                                    <p className="text-gray-400 text-sm">차트 로딩 중...</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* 요약 정보 */}
                {watchlist.length > 0 && (
                    <div className="mt-6 bg-gradient-to-r from-purple-900/40 to-blue-900/40 rounded-xl p-6 border border-purple-700/50">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-purple-600 rounded-lg">
                                <Sparkles className="text-white" size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-white mb-2">📊 대시보드 요약</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <p className="text-gray-400 mb-1">환율</p>
                                        <p className="text-white font-bold">{exchangeRate.toFixed(2)} {selectedPair.to}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 mb-1">관심 종목</p>
                                        <p className="text-white font-bold">{watchlist.length}개</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 mb-1">상승 종목</p>
                                        <p className="text-green-400 font-bold">
                                            {watchlist.filter(s => s.change >= 0).length}개
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 mb-1">하락 종목</p>
                                        <p className="text-red-400 font-bold">
                                            {watchlist.filter(s => s.change < 0).length}개
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}