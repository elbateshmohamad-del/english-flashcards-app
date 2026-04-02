import { NextRequest, NextResponse } from 'next/server';
import { processReview, getChoiceOptions } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vocabId, responseTimeMs, isCorrect, mode } = body;
    
    if (!vocabId || responseTimeMs === undefined || isCorrect === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const result = processReview({
      vocabId,
      responseTimeMs,
      isCorrect,
      mode: mode || 'flashcard',
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Review error:', error);
    return NextResponse.json({ error: 'Failed to process review' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vocabId = parseInt(searchParams.get('vocabId') || '0');
    const vocabType = searchParams.get('type') || 'word';
    
    if (!vocabId) {
      return NextResponse.json({ error: 'vocabId required' }, { status: 400 });
    }
    
    const options = getChoiceOptions(vocabId, vocabType);
    return NextResponse.json({ options });
  } catch (error) {
    console.error('Choice options error:', error);
    return NextResponse.json({ error: 'Failed to get options' }, { status: 500 });
  }
}
