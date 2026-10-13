import type { StudyItem } from '../types';
import { supabase } from './supabase';

export interface QuizProgressResult {
  streakCount: number;
  isMastered: boolean;
  newlyMastered: boolean;
}

export async function recordQuizAttempt(item: StudyItem, isCorrect: boolean, selectedAnswer: string, correctAnswer: string, questionType: 'reading' | 'meaning'): Promise<QuizProgressResult | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { error: historyError } = await supabase
    .from('user_quiz_history')
    .insert({
      user_id: user.id,
      item_type: item.type,
      item_id: item.id,
      question_type: questionType,
      selected_answer: selectedAnswer,
      correct_answer: correctAnswer,
      is_correct: isCorrect,
    });
  if (historyError) throw historyError;

  const { data: previous, error: readError } = await supabase
    .from('user_item_progress')
    .select('streak_count, is_mastered')
    .eq('user_id', user.id)
    .eq('item_type', item.type)
    .eq('item_id', item.id)
    .maybeSingle();

  if (readError) throw readError;

  const streakCount = isCorrect ? (previous?.streak_count ?? 0) + 1 : 0;
  const isMastered = Boolean(previous?.is_mastered) || streakCount >= 3;
  const newlyMastered = isMastered && !previous?.is_mastered;

  const { error: writeError } = await supabase
    .from('user_item_progress')
    .upsert({
      user_id: user.id,
      item_type: item.type,
      item_id: item.id,
      streak_count: streakCount,
      is_mastered: isMastered,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,item_type,item_id' });

  if (writeError) throw writeError;
  return { streakCount, isMastered, newlyMastered };
}