import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const base = searchParams.get('base') || 'USD';

    const apiKey = process.env.NEXT_PUBLIC_EXCHANGE_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            { error: 'API key not configured' },
            { status: 500 }
        );
    }

    try {
        const response = await fetch(
            `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${base}`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Exchange API error: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        return NextResponse.json(
            { error: 'Failed to fetch exchange rates' },
            { status: 500 }
        );
    }
}