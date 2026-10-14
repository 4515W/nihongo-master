import { useState } from 'react';
import type { StudyItem } from '../types';
import { BrainCircuit, Check, X, RotateCcw, Volume2, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { FuriganaText } from './FuriganaText';
import { speakJapanese } from '../lib/audio';

const quizLevels = ['ALL', 'N5', 'N4', 'N3', 'N2', 'N1'] as const;
const questionCounts = [5, 10, 15, 20] as const;

interface Props {
  items: StudyItem[];
  isDark: boolean;
  dailyReviewItems?: StudyItem[];
  targetedItemId?: string | null;
  targetedItemType?: StudyItem['type'] | null;
  onMasteryUpdate?: (type: StudyItem['type'], id: string, progress: { streakCount: number; isMastered: boolean; newlyMastered: boolean }) => void;
  onBackToDashboard?: () => void;
  onSelectCategory?: () => void;
  onQuizAttempt?: () => void;
}

type KanjiQuestionType = 'reading' | 'meaning';
type QuizReview = { item: StudyItem; answer: string; selectedAnswer: string; isCorrect: boolean };

const getKanjiReadings = (item: StudyItem) => {
  const readings = [item.kunyomi, item.onyomi]
    .filter((reading): reading is string => Boolean(reading))
    .flatMap((reading) => reading.split(/[、,，/／・;；\s]+/))
    .map((reading) => reading.replace(/[\u30a1-\u30f6]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) - 0x60),
    ).trim())
    .filter(Boolean);

  return [...new Set(readings)];
};

const getKanjiReading = (item: StudyItem) => getKanjiReadings(item)[0] ?? '';

export const QuizPage: React.FC<Props> = ({ items, isDark: _isDark, targetedItemId = null, targetedItemType = null, dailyReviewItems = [], onMasteryUpdate, onBackToDashboard, onSelectCategory, onQuizAttempt }) => {
  const targetedCategory = targetedItemType ?? items.find((item) => item.id === targetedItemId)?.type ?? null;
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [quizItems, setQuizItems] = useState<StudyItem[]>([]);
  const [questionOptions, setQuestionOptions] = useState<string[][]>([]);
  const [selectedCategory, setSelectedCategory] = useState<StudyItem['type'] | null>(targetedCategory);
  const [selectedLevel, setSelectedLevel] = useState<'ALL' | StudyItem['jlptLevel']>('ALL');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [selectedKanjiQuestionType, setSelectedKanjiQuestionType] = useState<KanjiQuestionType>('meaning');
  const [activeQuestionType, setActiveQuestionType] = useState<KanjiQuestionType>('meaning');
  const [reviewItems, setReviewItems] = useState<QuizReview[]>([]);
  const [masteryPoints, setMasteryPoints] = useState(0);
  const [isSavingAttempt, setIsSavingAttempt] = useState(false);
  const [hasSubmittedQuiz, setHasSubmittedQuiz] = useState(false);
  const [progressError, setProgressError] = useState('');

  const sourceItems = dailyReviewItems.length ? dailyReviewItems : items;
  const levelItems = selectedLevel === 'ALL' ? sourceItems : sourceItems.filter((item) => item.jlptLevel === selectedLevel);
  const categoryItems = selectedCategory ? levelItems.filter((item) => item.type === selectedCategory) : levelItems;
  const quizPool = selectedCategory === 'kanji' && selectedKanjiQuestionType === 'reading'
    ? categoryItems.filter((item) => getKanjiReading(item))
    : categoryItems;
  const availableReadings = [...new Set(categoryItems.flatMap(getKanjiReadings))];
  const minimumPoolSize = selectedCategory === 'kanji' && selectedKanjiQuestionType === 'reading' ? 2 : 4;
  const canStartQuiz = (Boolean(selectedCategory) || dailyReviewItems.length > 0)
    && quizPool.length >= questionCount
    && quizPool.length >= minimumPoolSize
    && (selectedCategory !== 'kanji' || selectedKanjiQuestionType !== 'reading' || availableReadings.length >= 2);

  const startQuiz = () => {
    if (!canStartQuiz) return;

    const questionType = selectedCategory === 'kanji' ? selectedKanjiQuestionType : 'meaning';
    const unmastered = quizPool.filter((item) => !item.isMastered).sort(() => 0.5 - Math.random());
    const mastered = quizPool.filter((item) => item.isMastered).sort(() => 0.5 - Math.random());
    const targetUnmasteredCount = Math.ceil(questionCount * 0.8);
    const selectedUnmastered = unmastered.slice(0, Math.min(targetUnmasteredCount, questionCount));
    const selectedMastered = mastered.slice(0, questionCount - selectedUnmastered.length);
    const selected = [...selectedUnmastered, ...selectedMastered];
    const remainingCount = questionCount - selected.length;
    if (remainingCount > 0) {
      selected.push(...unmastered.slice(selectedUnmastered.length, selectedUnmastered.length + remainingCount));
    }

    const randomizedSelection = selected.sort(() => 0.5 - Math.random());
    const target = targetedItemId
      ? quizPool.find((item) => item.id === targetedItemId && (!targetedItemType || item.type === targetedItemType))
      : undefined;
    const shuffled = target
      ? [target, ...randomizedSelection.filter((item) => item.id !== target.id || item.type !== target.type)].slice(0, questionCount)
      : randomizedSelection.slice(0, questionCount);
    const generatedOptions = shuffled.map((question) => {
      const correctAnswer = questionType === 'reading' ? getKanjiReading(question) : question.meaning;
      const answerPool = questionType === 'reading'
        ? availableReadings
        : [...new Set(quizPool.map((item) => item.meaning))];
      const wrongOptions = answerPool
        .filter((answer) => answer !== correctAnswer)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3)
      return [...wrongOptions, correctAnswer].sort(() => 0.5 - Math.random());
    });
    setQuizItems(shuffled);
    setQuestionOptions(generatedOptions);
    setActiveQuestionType(questionType);
    setQuizStarted(true);
    setCurrentQuestionIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setReviewItems([]);
    setMasteryPoints(0);
    setHasSubmittedQuiz(false);
    setProgressError('');
  };

  const currentItem = quizItems[currentQuestionIndex];
  const exampleSentence = currentItem?.exampleJp?.trim() ?? '';
  const exampleMeaning = currentItem?.exampleMeaning?.trim();
  const options = questionOptions[currentQuestionIndex] ?? [];
  const correctAnswer = currentItem
    ? activeQuestionType === 'reading' ? getKanjiReading(currentItem) : currentItem.meaning
    : '';
  const selectedCategoryLabel = selectedCategory === 'kanji'
    ? selectedKanjiQuestionType === 'reading' ? 'Kanji Reading' : 'Kanji Meaning'
    : selectedCategory === 'kotoba' ? 'Kotoba' : selectedCategory === 'bunpou' ? 'Bunpou' : dailyReviewItems.length ? 'All Review Items' : 'Choose a category';
  const selectedLevelLabel = selectedLevel === 'ALL' ? 'All JLPT' : `JLPT ${selectedLevel}`;

  const getOptionSubtext = (option: string) => {
    const matchingItem = activeQuestionType === 'reading'
      ? categoryItems.find((item) => getKanjiReadings(item).includes(option))
      : quizPool.find((item) => item.meaning === option);
    if (!matchingItem) return '';
    return activeQuestionType === 'reading'
      ? `${matchingItem.japanese} (${matchingItem.meaning})`
      : `${matchingItem.japanese} (${matchingItem.reading})`;
  };

  const handleSelectAnswer = (ans: string) => {
    if (isAnswered || !currentItem) return;
    const isCorrect = ans === correctAnswer;
    setSelectedAnswer(ans);
    setIsAnswered(true);
    if (isCorrect) setScore((prev) => prev + 1);
    setReviewItems((current) => [...current, { item: currentItem, answer: correctAnswer, selectedAnswer: ans, isCorrect }]);
    setProgressError('');
  };

  const submitQuiz = async () => {
    if (hasSubmittedQuiz || isSavingAttempt || !quizItems.length) return;

    setHasSubmittedQuiz(true);
    setIsSavingAttempt(true);
    setProgressError('');
    const correctReviews = reviewItems.filter((review) => review.isCorrect);
    const correctCount = correctReviews.length;
    const totalQuestions = quizItems.length;
    const calculatedScorePercentage = Math.round((correctCount / totalQuestions) * 100);
    const pointsEarned = correctCount * 10;
    const uniqueCorrectItems = [...new Map(
      correctReviews.map(({ item }) => [`${item.type}:${item.id}`, item]),
    ).values()];
    const uniqueMasteredWrongItems = [...new Map(
      reviewItems
        .filter((review) => !review.isCorrect && review.item.isMastered)
        .map(({ item }) => [`${item.type}:${item.id}`, item]),
    ).values()];
    const progressUpdates = [
      ...uniqueCorrectItems.map((item) => ({ item, isMastered: true })),
      ...uniqueMasteredWrongItems.map((item) => ({ item, isMastered: false })),
    ];
    setMasteryPoints(pointsEarned);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Sign in again before saving quiz results.');

      const quizType = dailyReviewItems.length
        ? 'daily_drill'
        : selectedCategory === 'kanji'
          ? `kanji_${activeQuestionType}`
          : selectedCategory ?? 'review';
      const [historyResult, progressResult] = await Promise.all([
        supabase.from('user_quiz_history').insert({
          user_id: user.id,
          quiz_type: quizType,
          score: calculatedScorePercentage,
          total_questions: totalQuestions,
          points_earned: pointsEarned,
          completed_at: new Date().toISOString(),
        }),
        progressUpdates.length
          ? supabase.from('user_item_progress').upsert(progressUpdates.map(({ item, isMastered }) => ({
            user_id: user.id,
            item_id: String(item.id),
            item_type: item.type.toLowerCase(),
            streak_count: isMastered ? Math.max(3, item.masteryStreak ?? 0) : 0,
            is_mastered: isMastered,
            updated_at: new Date().toISOString(),
          })), { onConflict: 'user_id,item_type,item_id' })
          : Promise.resolve({ error: null }),
      ]);

      if (!progressResult.error) {
        for (const { item, isMastered } of progressUpdates) {
          onMasteryUpdate?.(item.type, item.id, {
            streakCount: isMastered ? Math.max(3, item.masteryStreak ?? 0) : 0,
            isMastered,
            newlyMastered: isMastered && !item.isMastered,
          });
        }
      }
      if (!historyResult.error || !progressResult.error) onQuizAttempt?.();
      if (historyResult.error) throw historyResult.error;
      if (progressResult.error) throw progressResult.error;
    } catch (error) {
      console.error('Quiz Save Error:', error);
      setProgressError(error instanceof Error ? error.message : 'Could not save quiz results.');
    } finally {
      setIsSavingAttempt(false);
      setCurrentQuestionIndex(quizItems.length);
    }
  };

  const handleNextQuestion = () => {
    setProgressError('');
    if (currentQuestionIndex < quizItems.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
    } else {
      void submitQuiz();
    }
  };

  if (!quizStarted) {
    return (
      <div className="quiz-shell">
        <div className="quiz-intro-card">
          <div className="quiz-icon">
            <BrainCircuit size={32} />
          </div>
          <h2>Set Up Your Quiz</h2>
          <p>{dailyReviewItems.length ? `${dailyReviewItems.length} unmastered items are available for review.` : 'Choose a level, test type, and session length.'}</p>

          <section className="quiz-setup-section" aria-labelledby="quiz-level-heading">
            <h3 id="quiz-level-heading">1. JLPT Level</h3>
            <div className="quiz-level-grid" role="group" aria-label="JLPT level">
              {quizLevels.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`quiz-choice-button ${selectedLevel === level ? 'selected' : ''}`}
                  aria-pressed={selectedLevel === level}
                  onClick={() => setSelectedLevel(level)}
                >
                  {level === 'ALL' ? 'All' : level}
                </button>
              ))}
            </div>
          </section>

          <section className="quiz-setup-section" aria-labelledby="quiz-category-heading">
            <h3 id="quiz-category-heading">2. Quiz Category</h3>
            <div className="quiz-category-grid" role="group" aria-label="Quiz category">
              {dailyReviewItems.length > 0 && (
                <button
                  type="button"
                  className={`quiz-mode-button ${selectedCategory === null ? 'selected' : ''}`}
                  aria-pressed={selectedCategory === null}
                  onClick={() => {
                    if (!dailyReviewItems.length) onSelectCategory?.();
                    setSelectedCategory(null);
                  }}
                >
                  <span className="text-2xl" aria-hidden="true">混</span>
                  <span>All Review Items</span>
                </button>
              )}
              {[
                { type: 'kanji' as const, questionType: 'reading' as const, label: 'Kanji Reading', symbol: '漢' },
                { type: 'kanji' as const, questionType: 'meaning' as const, label: 'Kanji Meaning', symbol: '意' },
                { type: 'kotoba' as const, label: 'Kotoba', symbol: '語' },
                { type: 'bunpou' as const, label: 'Bunpou', symbol: '文' },
              ].map((category) => {
                const selected = selectedCategory === category.type
                  && (category.type !== 'kanji' || selectedKanjiQuestionType === category.questionType);
                return (
                  <button
                    key={category.label}
                    type="button"
                    className={`quiz-mode-button ${selected ? 'selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => {
                      if (!dailyReviewItems.length) onSelectCategory?.();
                      setSelectedCategory(category.type);
                      if (category.type === 'kanji') setSelectedKanjiQuestionType(category.questionType);
                    }}
                  >
                    <span className="text-2xl" aria-hidden="true">{category.symbol}</span>
                    <span>{category.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="quiz-setup-section" aria-labelledby="quiz-count-heading">
            <h3 id="quiz-count-heading">3. Question Count</h3>
            <div className="quiz-count-grid" role="group" aria-label="Questions per session">
              {questionCounts.map((count) => (
                <button
                  key={count}
                  type="button"
                  className={`quiz-choice-button ${questionCount === count ? 'selected' : ''}`}
                  aria-pressed={questionCount === count}
                  disabled={Boolean(selectedCategory) && quizPool.length < count}
                  onClick={() => setQuestionCount(count)}
                >
                  {count}
                </button>
              ))}
            </div>
          </section>

          {selectedCategory && quizPool.length < questionCount && (
            <p className="quiz-helper">Only {quizPool.length} matching questions are available. Choose a shorter session or broaden the level.</p>
          )}
          {selectedCategory === 'kanji' && selectedKanjiQuestionType === 'reading' && availableReadings.length < 2 && (
            <p className="quiz-helper">Add at least two distinct Kanji readings to use reading mode.</p>
          )}

          <p className="quiz-setup-summary" aria-live="polite">
            {selectedLevelLabel} <span aria-hidden="true">•</span> {selectedCategoryLabel} <span aria-hidden="true">•</span> {questionCount} Questions
          </p>
          <button type="button" className="quiz-start-button" onClick={startQuiz} disabled={!canStartQuiz}>
            {dailyReviewItems.length ? 'Start Daily Review' : 'Start Quiz'}
          </button>
        </div>
      </div>
    );
  }

  if (currentQuestionIndex >= quizItems.length) {
    const percentage = quizItems.length ? Math.round((score / quizItems.length) * 100) : 0;
    return (
      <div className="quiz-shell">
        <div className="quiz-result-card">
          <div className="quiz-result-heading">
            <div>
              <p className="quiz-helper">Quiz complete</p>
              <h2>Review your session</h2>
            </div>
            <span className={`quiz-result-badge ${percentage >= 80 ? 'high' : percentage >= 50 ? 'steady' : 'retry'}`}>
              {percentage >= 80 ? 'Excellent' : percentage >= 50 ? 'Good progress' : 'Keep practicing'}
            </span>
          </div>
          <div className="quiz-result-stats">
            <div><span className="quiz-score">{percentage}%</span><span>{score} / {quizItems.length} correct</span></div>
            <div><strong>{masteryPoints}</strong><span>Mastery points earned</span></div>
          </div>
          {progressError && <p className="quiz-helper" role="alert">{progressError}</p>}

          <section className="quiz-review-list">
            <h3>Question Review</h3>
            {reviewItems.map((review, index) => (
              <article key={`${review.item.type}-${review.item.id}-${index}`} className={`quiz-review-item ${review.isCorrect ? 'correct' : 'incorrect'}`}>
                <div className="quiz-review-prompt">
                  <span>{index + 1}. <FuriganaText text={review.item.japanese} /></span>
                  <span>{review.isCorrect ? 'Correct' : 'Review'}</span>
                </div>
                <p>Your answer: {review.selectedAnswer} {review.isCorrect ? '✓' : ''}</p>
                {!review.isCorrect && <p>Correct answer: {review.answer}</p>}
              </article>
            ))}
          </section>

          <div className="quiz-result-actions">
            <button type="button" className="quiz-button primary" onClick={startQuiz}><RotateCcw size={16} /> Try Quiz Again</button>
            <button type="button" className="quiz-button secondary" onClick={() => { setQuizStarted(false); setSelectedCategory(null); setSelectedAnswer(null); setIsAnswered(false); onSelectCategory?.(); }}>Select Another Quiz Category</button>
            <button type="button" className="quiz-button secondary" onClick={onBackToDashboard}><ArrowLeft size={16} /> Back to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-shell">
      <div className="quiz-panel">
        <div className="quiz-progress-track" aria-label={`Question ${currentQuestionIndex + 1} of ${quizItems.length}`}>
          <div className="quiz-progress-fill" style={{ width: `${((currentQuestionIndex + 1) / quizItems.length) * 100}%` }} />
        </div>
        <div className="quiz-topbar">
          <span>Soal {currentQuestionIndex + 1} dari {quizItems.length}</span>
          <span>{activeQuestionType === 'reading' ? 'Kanji Reading' : currentItem?.type === 'kanji' ? 'Kanji Meaning' : currentItem?.type}</span>
        </div>

        <div className="quiz-question">
          <h3 className="quiz-japanese"><FuriganaText text={currentItem?.japanese ?? ''} /></h3>
          <p className="quiz-reading">{activeQuestionType === 'reading' ? 'Choose the correct Hiragana reading.' : currentItem?.reading}</p>
        </div>

        <div className="option-grid">
          {options.map((option, index) => {
            const isCorrect = option === correctAnswer;
            const isSelected = option === selectedAnswer;

            let optionClassName = 'quiz-option';
            if (isAnswered && isCorrect) optionClassName += ' correct';
            if (isAnswered && isSelected && !isCorrect) optionClassName += ' wrong';

            return (
              <button
                key={`${option}-${index}`}
                type="button"
                className={optionClassName}
                disabled={isAnswered}
                onClick={() => handleSelectAnswer(option)}
              >
                <span className="quiz-option-copy">
                  <span>{option}</span>
                  {isAnswered && getOptionSubtext(option) && <small>{getOptionSubtext(option)}</small>}
                </span>
                {isAnswered && isCorrect && <Check size={16} />}
                {isAnswered && isSelected && !isCorrect && <X size={16} />}
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <>
            <p className={`quiz-answer-feedback ${selectedAnswer === correctAnswer ? 'correct' : 'incorrect'}`} role="status">
              {selectedAnswer === correctAnswer ? 'Correct answer.' : `Not quite. The answer is ${correctAnswer}.`}
              {isSavingAttempt && <span className="ml-2">Saving progress…</span>}
            </p>
            {progressError && <p className="quiz-helper" role="alert">{progressError}</p>}
            <div className="quiz-example-box">
              <strong>Example Sentence / Usage</strong>
              <button type="button" className="quiz-example-audio" aria-label="Play example sentence" onClick={() => speakJapanese(exampleSentence || currentItem?.japanese || '')}><Volume2 size={16} /></button>
              {exampleSentence ? (
                <>
                  <p><FuriganaText text={exampleSentence} word={currentItem?.type === 'kotoba' ? currentItem.japanese : undefined} reading={currentItem?.type === 'kotoba' ? currentItem.reading : undefined} /></p>
                  {exampleMeaning && <p>{exampleMeaning}</p>}
                </>
              ) : (
                <p>No example sentence available for this item.</p>
              )}
            </div>
            <button type="button" className="quiz-button primary" onClick={handleNextQuestion} disabled={isSavingAttempt}>
              {isSavingAttempt ? 'Saving Results...' : currentQuestionIndex < quizItems.length - 1 ? 'Next Question' : 'View Results'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};