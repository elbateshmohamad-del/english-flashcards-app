import { NextRequest, NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const { word, japanese } = await request.json();
    
    const apiKey = await getSetting('gemini_api_key');
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini APIキーが設定されていません。設定画面からAPIキーを登録してください。' }, { status: 400 });
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const prompt = `あなたは英語学習アシスタントです。以下の英単語を使った、自然な日本語の短文を1つだけ生成してください。

英単語: ${word}
意味: ${japanese}

ルール:
- 日本語の短文のみを出力してください（英語は含めないでください）
- この単語の意味が伝わる、日常的で自然な文章にしてください
- 15〜30文字程度の文にしてください
- 前置きや説明は不要です。文章のみを出力してください`;
    
    const result = await model.generateContent(prompt);
    const generatedSentence = result.response.text().trim();
    
    return NextResponse.json({ 
      sentence: generatedSentence,
      targetWord: word,
      targetMeaning: japanese
    });
  } catch (error) {
    console.error('AI generation error:', error);
    return NextResponse.json({ error: 'AI文章生成に失敗しました' }, { status: 500 });
  }
}
