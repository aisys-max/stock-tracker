'use client';

import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, TrendingDown, X, Plus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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

interface ApiKeys {
  alphaVantage: string;
  finnhub: string;
}

export default function StockTracker() {
  const [watchlist, setWatchlist] = useState<StockInfo[]>([]);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [selectedStock, setSelectedStock] = useState<StockInfo | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [showApiInput, setShowApiInput] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('stockWatchlist');
    if (saved) setWatchlist(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('stockWatchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  const saveApiKeys = () => {
    setShowApiInput(false);
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

  const fetchKoreanStockYahoo = async (symbol: string) => {
    const formattedSymbol = formatKoreanSymbol(symbol);

    try {
      // 우리의 API Route를 통해 호출 (CORS 문제 해결)
      const quoteRes = await fetch(
        `/api/stock?symbol=${formattedSymbol}`
      );
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
          market: '한국'
        };

        setSelectedStock(stockInfo);

        // 차트 데이터 생성
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
        alert('주식 데이터를 찾을 수 없습니다. 티커 심볼을 확인해주세요.\n한국 주식은 005930.KS 형식으로 입력해주세요.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('데이터를 가져오는 중 오류가 발생했습니다: ' + (error as Error).message);
    }
  };

  const fetchUSStock = async (symbol: string) => {
    try {
      console.log('Fetching US stock:', symbol);
      // Yahoo Finance를 사용 (API Route 통해서)
      const quoteRes = await fetch(
        `/api/stock?symbol=${symbol}`
      );
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
          symbol: symbol.toUpperCase(),
          price: currentPrice,
          change: change,
          changePercent: `${changePercent}%`,
          high: meta.regularMarketDayHigh || currentPrice,
          low: meta.regularMarketDayLow || currentPrice,
          volume: meta.regularMarketVolume?.toString() || 'N/A',
          market: '미국'
        };

        setSelectedStock(stockInfo);

        // 차트 데이터 생성
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
    setChartData([]); // 차트 데이터 초기화
    setSelectedStock(null); // 선택된 주식 초기화

    if (isKoreanStock(symbol)) {
      await fetchKoreanStockYahoo(symbol);
    } else {
      await fetchUSStock(symbol);
    }

    setLoading(false);
  };

  const addToWatchlist = () => {
    if (selectedStock && !watchlist.find(s => s.symbol === selectedStock.symbol)) {
      setWatchlist([...watchlist, selectedStock]);
    }
  };

  const removeFromWatchlist = (symbol: string) => {
    setWatchlist(watchlist.filter(s => s.symbol !== symbol));
  };

  const handleSearch = () => {
    const trimmedSymbol = searchSymbol.trim().toUpperCase();
    if (trimmedSymbol) {
      setSearchSymbol(''); // 검색창 초기화
      fetchStockData(trimmedSymbol);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  if (showApiInput) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">환영합니다! 🎉</h2>

          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
            <p className="text-sm text-green-700 font-semibold mb-2">
              ✅ 완전 무료! API 키 불필요
            </p>
            <p className="text-xs text-green-600">
              • 미국 주식 (AAPL, INTC, MSFT 등) 무제한 조회<br />
              • 한국 주식 (005930.KS 삼성전자 등) 무제한 조회<br />
              • Yahoo Finance 사용 - 안정적이고 빠름
            </p>
          </div>

          <button
            onClick={saveApiKeys}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            시작하기 →
          </button>

          <p className="text-xs text-gray-500 mt-4 text-center">
            모든 데이터는 브라우저에만 저장됩니다
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">📈 글로벌 주가 트래커</h1>
          <p className="text-gray-400">미국 + 한국 주식 실시간 정보 (무료, 무제한)</p>
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
              <h2 className="text-xl font-bold text-white mb-4">관심 종목</h2>
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