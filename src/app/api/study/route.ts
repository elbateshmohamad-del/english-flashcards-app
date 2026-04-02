import { NextResponse } from 'next/server';
import { initializeDatabase, getTodayStudyPlan } from '@/lib/db';

export async function GET() {
  try {
    await initializeDatabase();
    const plan = await getTodayStudyPlan();
    return NextResponse.json(plan);
  } catch (error) {
    console.error('Study plan error:', error);
    return NextResponse.json({ error: 'Failed to get study plan' }, { status: 500 });
  }
}
