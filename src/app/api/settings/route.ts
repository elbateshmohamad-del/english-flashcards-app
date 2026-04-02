import { NextRequest, NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    
    if (!key) {
      return NextResponse.json({ error: 'key required' }, { status: 400 });
    }
    
    const value = getSetting(key);
    return NextResponse.json({ key, value });
  } catch (error) {
    console.error('Settings error:', error);
    return NextResponse.json({ error: 'Failed to get setting' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { key, value } = await request.json();
    
    if (!key || value === undefined) {
      return NextResponse.json({ error: 'key and value required' }, { status: 400 });
    }
    
    setSetting(key, value);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings error:', error);
    return NextResponse.json({ error: 'Failed to save setting' }, { status: 500 });
  }
}
