import { NextRequest, NextResponse } from 'next/server';
import { getVocabularyList } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || undefined;
    const type = searchParams.get('type') || undefined;
    
    const result = await getVocabularyList(page, limit, search, type);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Vocabulary list error:', error);
    return NextResponse.json({ error: 'Failed to get vocabulary' }, { status: 500 });
  }
}
