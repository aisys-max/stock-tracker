'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, TrendingUp, TrendingDown, RefreshCw, Calculator, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ExchangeRate {
    pair: string;
    code: string;
    rate: number;
    previousRate?: number;
    flag: string;
    name: string;
}

const MAJOR_CURRENCIES = [
    { code: 'KRW', name: '한국 원', flag: '🇰🇷' },
    { code: 'USD', name: '미국 달러', flag: '🇺🇸' },
    { code: 'EUR', name: '유로', flag: '🇪🇺' },
    { code: 'JPY', name: '일본 엔', flag: '🇯🇵' },
    { code: 'CNY', name: '중국 위안', flag: '🇨🇳' },
    { code: 'GBP', name: '영국 파운드', flag: '🇬🇧' },
];

export default function ExchangePage() {
    const [baseCurrency, setBaseCurrency] = useState('USD');
    const [rates, setRates] = useState<ExchangeRate[]>([]);
    const [loading, setLoading] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [calculatorAmount, setCalculatorAmount] = useState('1000');
    const [calculatorFrom, setCalculatorFrom] = useState('USD');
    const [calculatorTo, setCalculatorTo] = useState('KRW');
    const router = useRouter();

    useEffect(() => {
        fetchExchangeRates();
    }, [baseCurrency]);

    const fetchExchangeRates = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/exchange?base=${baseCurrency}`);
            const data = await response.json();

            if (data.conversion_rates) {
                const ratesList: ExchangeRate[] = MAJOR_CURRENCIES
                    .filter(curr => curr.code !== baseCurrency)
                    .map(curr => {
                        const currency = MAJOR_CURRENCIES.find(c => c.code === curr.code);
                        return {
                            pair: `${baseCurrency}/${curr.code}`,
                            code: curr.code,
                            rate: data.conversion_rates[curr.code],
                            flag: currency?.flag || '🌐',
                            name: currency?.name || curr.code,
                        };
                    });

                setRates(ratesList);
                setLastUpdate(new Date());
            }
        } catch (error) {
            console.error('Error fetching exchange rates:', error);
            alert('환율 정보를 가져오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const calculateExchange = () => {
        const amount = parseFloat(calculatorAmount);
        if (isNaN(amount)) return '0.00';

        // 같은 통화면 그대로 반환
        if (calculatorFrom === calculatorTo) {
            return amount.toFixed(2);
        }

        // baseCurrency를 포함한 rates 배열 생성
        const allRates = [
            { code: baseCurrency, rate: 1 },
            ...rates
        ];

        if (calculatorFrom === baseCurrency) {
            const toRate = allRates.find(r => r.code === calculatorTo);
            return toRate ? (amount * toRate.rate).toFixed(2) : '0.00';
        } else if (calculatorTo === baseCurrency) {
            const fromRate = allRates.find(r => r.code === calculatorFrom);
            return fromRate ? (amount / fromRate.rate).toFixed(2) : '0.00';
        } else {
            // 두 통화 모두 base가 아닌 경우
            const fromRate = allRates.find(r => r.code === calculatorFrom);
            const toRate = allRates.find(r => r.code === calculatorTo);
            if (fromRate && toRate) {
                return ((amount / fromRate.rate) * toRate.rate).toFixed(2);
            }
            return '0.00';
        }
    };

    const formatRate = (rate: number, code: string) => {
        if (code === 'JPY' || code === 'KRW') {
            return rate.toFixed(2);
        }
        return rate.toFixed(4);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
            <div className="max-w-6xl mx-auto">
                {/* 헤더 */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition"
                    >
                        <ArrowLeft size={20} />
                        주가 트래커로 돌아가기
                    </button>
                    <div className="flex items-center gap-3 mb-2">
                        <ArrowLeftRight className="text-blue-400" size={32} />
                        <h1 className="text-4xl font-bold text-white">환율 트래커</h1>
                    </div>
                    <p className="text-gray-400">실시간 환율 정보</p>
                </div>

                {/* 기준 통화 선택 */}
                <div className="mb-6 bg-slate-800 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                        기준 통화
                    </label>
                    <div className="flex gap-2 flex-wrap">
                        {MAJOR_CURRENCIES.map((curr) => (
                            <button
                                key={curr.code}
                                onClick={() => setBaseCurrency(curr.code)}
                                className={`px-4 py-2 rounded-lg transition ${baseCurrency === curr.code
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                                    }`}
                            >
                                {curr.flag} {curr.code}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 환율 목록 */}
                    <div className="lg:col-span-2">
                        <div className="bg-slate-800 rounded-lg p-6 shadow-xl">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold text-white">환율 현황</h2>
                                <div className="flex items-center gap-3">
                                    {lastUpdate && (
                                        <span className="text-xs text-gray-500">
                                            {lastUpdate.toLocaleTimeString('ko-KR', {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    )}
                                    <button
                                        onClick={fetchExchangeRates}
                                        disabled={loading}
                                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition disabled:opacity-50"
                                        title="새로고침"
                                    >
                                        <RefreshCw
                                            size={16}
                                            className={`text-gray-400 ${loading ? 'animate-spin' : ''}`}
                                        />
                                    </button>
                                </div>
                            </div>

                            {loading && rates.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    <p className="mt-4 text-gray-400">환율 정보를 불러오는 중...</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {rates.map((rate) => (
                                        <div
                                            key={rate.pair}
                                            className="bg-slate-700 p-4 rounded-lg hover:bg-slate-600 transition"
                                        >
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-2xl">{rate.flag}</span>
                                                        <div>
                                                            <p className="font-bold text-white">{rate.pair}</p>
                                                            <p className="text-xs text-gray-400">{rate.name}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-2xl font-bold text-white">
                                                        {formatRate(rate.rate, rate.code)}
                                                    </p>
                                                    <p className="text-xs text-gray-400">
                                                        1 {baseCurrency} = {formatRate(rate.rate, rate.code)} {rate.code}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 환율 계산기 */}
                    <div className="lg:col-span-1">
                        <div className="bg-slate-800 rounded-lg p-6 shadow-xl sticky top-4">
                            <div className="flex items-center gap-2 mb-4">
                                <Calculator className="text-blue-400" size={24} />
                                <h2 className="text-xl font-bold text-white">환율 계산기</h2>
                            </div>

                            <div className="space-y-4">
                                {/* From */}
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">보낼 금액</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={calculatorAmount}
                                            onChange={(e) => setCalculatorAmount(e.target.value)}
                                            className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="금액"
                                        />
                                        <select
                                            value={calculatorFrom}
                                            onChange={(e) => setCalculatorFrom(e.target.value)}
                                            className="px-3 py-2 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {MAJOR_CURRENCIES.map((curr) => (
                                                <option key={curr.code} value={curr.code}>
                                                    {curr.code}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Arrow */}
                                <div className="flex justify-center">
                                    <button
                                        onClick={() => {
                                            const temp = calculatorFrom;
                                            setCalculatorFrom(calculatorTo);
                                            setCalculatorTo(temp);
                                        }}
                                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded-full transition"
                                    >
                                        <ArrowLeftRight className="text-blue-400" size={20} />
                                    </button>
                                </div>

                                {/* To */}
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">받을 금액</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg font-bold text-xl">
                                            {calculateExchange()}
                                        </div>
                                        <select
                                            value={calculatorTo}
                                            onChange={(e) => setCalculatorTo(e.target.value)}
                                            className="px-3 py-2 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {MAJOR_CURRENCIES.map((curr) => (
                                                <option key={curr.code} value={curr.code}>
                                                    {curr.code}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* 정보 */}
                                <div className="mt-4 p-4 bg-slate-700 rounded-lg">
                                    <p className="text-xs text-gray-400 text-center">
                                        실시간 환율이 적용됩니다.<br />
                                        실제 환전 시 수수료가 추가될 수 있습니다.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 주요 환율 정보 */}
                        <div className="bg-slate-800 rounded-lg p-6 shadow-xl mt-6">
                            <h3 className="text-lg font-bold text-white mb-3">📊 주요 환율</h3>
                            <div className="space-y-2 text-sm">
                                {baseCurrency === 'USD' && (
                                    <div className="flex justify-between text-gray-300">
                                        <span>🇺🇸 USD/KRW</span>
                                        <span className="font-mono">
                                            {rates.find(r => r.code === 'KRW')?.rate.toFixed(2) || 'N/A'}
                                        </span>
                                    </div>
                                )}
                                {baseCurrency === 'KRW' && (
                                    <div className="flex justify-between text-gray-300">
                                        <span>🇰🇷 KRW/USD</span>
                                        <span className="font-mono">
                                            {rates.find(r => r.code === 'USD')?.rate.toFixed(4) || 'N/A'}
                                        </span>
                                    </div>
                                )}
                                {baseCurrency === 'USD' && (
                                    <div className="flex justify-between text-gray-300">
                                        <span>🇪🇺 EUR/USD</span>
                                        <span className="font-mono">
                                            {rates.find(r => r.code === 'EUR')?.rate.toFixed(4) || 'N/A'}
                                        </span>
                                    </div>
                                )}
                                {baseCurrency === 'JPY' && (
                                    <div className="flex justify-between text-gray-300">
                                        <span>🇯🇵 JPY/KRW</span>
                                        <span className="font-mono">
                                            {rates.find(r => r.code === 'KRW')?.rate.toFixed(2) || 'N/A'}
                                        </span>
                                    </div>
                                )}
                                <div className="pt-2 border-t border-slate-700 text-xs text-gray-500">
                                    기준 통화: {baseCurrency}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 안내 */}
                <div className="mt-8 bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-200">
                        💡 <strong>팁:</strong> 환율은 5-10분마다 자동 업데이트되며, 새로고침 버튼으로 즉시 최신 정보를 확인할 수 있습니다.
                    </p>
                </div>
            </div>
        </div>
    );
}