import { useState } from 'react';
import type { StudyItem } from '../types';
import { BrainCircuit, Check, X, RotateCcw, Volume2, ArrowLeft } from 'lucide-react';
import { recordQuizAttempt } from '../lib/progress';
import { FuriganaText } from './FuriganaText';
import { speakJapanese } from '../lib/audio';

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
  const [selectedKanjiQuestionType, setSelectedKanjiQuestionType] = useState<KanjiQuestionType>('meaning');
  const [activeQuestionType, setActiveQuestionType] = useState<KanjiQuestionType>('meaning');
  const [reviewItems, setReviewItems] = useState<QuizReview[]>([]);
  const [masteryPoints, setMasteryPoints] = useState(0);
  const [isSavingAttempt, setIsSavingAttempt] = useState(false);
  const [progressError, setProgressError] = useState('');

  const categoryItems = selectedCategory ? items.filter((item) => item.type === selectedCategory) : [];
  const quizPool = dailyReviewItems.length ? dailyReviewItems : selectedCategory === 'kanji' && selectedKanjiQuestionType === 'reading'
    ? categoryItems.filter((item) => getKanjiReading(item))
    : categoryItems;
  const availableReadings = [...new Set(categoryItems.flatMap(getKanjiReadings))];
  const canStartQuiz = dailyReviewItems.length > 0
    ? true
    : Boolean(selectedCategory) && quizPool.length >= 4 && (
    selectedCategory !== 'kanji' || selectedKanjiQuestionType !== 'reading' || availableReadings.length >= 2
  );

  const startQuiz = () => {
    if ((!selectedCategory && !dailyReviewItems.length) || !canStartQuiz) {
      return;
    }

    const questionType = dailyReviewItems.length ? 'meaning' : selectedCategory === 'kanji' ? selectedKanjiQuestionType : 'meaning';
    const randomized = [...quizPool].sort(() => 0.5 - Math.random());
    const target = targetedItemId ? randomized.find((item) => item.id === targetedItemId && (!targetedItemType || item.type === targetedItemType)) : undefined;
    const shuffled = [
      ...(target ? [target] : []),
      ...randomized.filter((item) => item.id !== target?.id),
    ].slice(0, 5);
    const generatedOptions = shuffled.map((question) => {
      const correctAnswer = questionType === 'reading' ? getKanjiReading(question) : question.meaning;
      const answerPool = questionType === 'reading'
        ? availableReadings
        : [...new Set((dailyReviewItems.length ? items : quizPool).map((item) => item.meaning))];
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
    setProgressError('');
  };

  const currentItem = quizItems[currentQuestionIndex];
  const options = questionOptions[currentQuestionIndex] ?? [];
  const correctAnswer = currentItem
    ? activeQuestionType === 'reading' ? getKanjiReading(currentItem) : currentItem.meaning
    : '';

  const getOptionSubtext = (option: string) => {
    const sourceItems = dailyReviewItems.length ? dailyReviewItems : selectedCategory ? items.filter((item) => item.type === selectedCategory) : [];
    const matchingItem = activeQuestionType === 'reading'
      ? sourceItems.find((item) => getKanjiReadings(item).includes(option))
      : sourceItems.find((item) => item.meaning === option);
    if (!matchingItem) return '';
    return activeQuestionType === 'reading'
      ? `${matchingItem.japanese} (${matchingItem.meaning})`
      : `${matchingItem.japanese} (${matchingItem.reading})`;
  };

  const handleSelectAnswer = async (ans: string) => {
    if (isAnswered || !currentItem) return;
    const isCorrect = ans === correctAnswer;
    setSelectedAnswer(ans);
    setIsAnswered(true);
    if (isCorrect) setScore((prev) => prev + 1);
    setReviewItems((current) => [...current, { item: currentItem, answer: correctAnswer, selectedAnswer: ans, isCorrect }]);
    setProgressError('');
    setIsSavingAttempt(true);
    try {
      const progress = await recordQuizAttempt(currentItem, isCorrect, ans, correctAnswer, activeQuestionType);
      if (progress) {
        onMasteryUpdate?.(currentItem.type, currentItem.id, progress);
        if (progress.newlyMastered) setMasteryPoints((points) => points + 1);
        onQuizAttempt?.();
      }
    } catch (error) {
      console.error('Quiz Save Error:', error);
      setProgressError(error instanceof Error ? error.message : 'Could not save quiz progress.');
    } finally {
      setIsSavingAttempt(false);
    }
  };

  const handleNextQuestion = () => {
    setProgressError('');
    if (currentQuestionIndex < quizItems.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
    } else {
      setCurrentQuestionIndex(quizItems.length);
    }
  };

  if (!quizStarted) {
    return (
      <div className="quiz-shell">
        <div className="quiz-intro-card">
          <div className="quiz-icon">
            <BrainCircuit size={32} />
          </div>
          <h2>Choose a Quiz Category</h2>
          <p>{dailyReviewItems.length ? `${dailyReviewItems.length} unmastered items selected for review.` : 'Select a study category to start a five-question quiz.'}</p>
          <div className="quiz-mode-grid">
            {[
              { type: 'kanji', label: 'Kanji', symbol: '漢' },
              { type: 'kotoba', label: 'Kotoba', symbol: '語' },
              { type: 'bunpou', label: 'Bunpou', symbol: '文' },
            ].map((category) => {
              const count = items.filter((item) => item.type === category.type).length;
              return (
                <button
                  key={category.type}
                  type="button"
                  className={`quiz-mode-button ${selectedCategory === category.type ? 'selected' : ''}`}
                  aria-pressed={selectedCategory === category.type}
                  onClick={() => {
                    onSelectCategory?.();
                    setSelectedCategory(category.type as StudyItem['type']);
                  }}
                >
                  <span className="text-2xl" aria-hidden="true">{category.symbol}</span>
                  <span>{category.label}</span>
                  <span className="quiz-helper">{count} items</span>
                </button>
              );
            })}
          </div>
          {selectedCategory && categoryItems.length < 4 && (
            <p className="quiz-helper">Add at least four {selectedCategory} items to start a quiz.</p>
          )}
          {selectedCategory === 'kanji' && (
            <div className="quiz-type-grid" aria-label="Kanji question type">
              {[
                { type: 'reading' as const, label: 'Kanji Reading', detail: 'Choose the Hiragana reading' },
                { type: 'meaning' as const, label: 'Kanji Meaning', detail: 'Choose the translation' },
              ].map((questionType) => (
                <button
                  key={questionType.type}
                  type="button"
                  className={`quiz-mode-button ${selectedKanjiQuestionType === questionType.type ? 'selected' : ''}`}
                  aria-pressed={selectedKanjiQuestionType === questionType.type}
                  onClick={() => setSelectedKanjiQuestionType(questionType.type)}
                >
                  <span>{questionType.label}</span>
                  <span className="quiz-helper">{questionType.detail}</span>
                </button>
              ))}
            </div>
          )}
          {selectedCategory === 'kanji' && selectedKanjiQuestionType === 'reading' && availableReadings.length < 2 && (
            <p className="quiz-helper">Add at least two distinct Kanji readings to use reading mode.</p>
          )}
          <button type="button" className="quiz-start-button" onClick={startQuiz} disabled={!canStartQuiz}>
            {dailyReviewItems.length ? 'Start Daily Review' : `Start ${selectedCategory ? `${selectedCategory} ` : ''}Quiz`}
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
              <button type="button" className="quiz-example-audio" aria-label="Play example sentence" onClick={() => speakJapanese(currentItem?.exampleJp || currentItem?.japanese || '')}><Volume2 size={16} /></button>
              {currentItem?.exampleJp ? (
                <>
                  <p><FuriganaText text={currentItem.exampleJp} word={currentItem.type === 'kotoba' ? currentItem.japanese : undefined} reading={currentItem.type === 'kotoba' ? currentItem.reading : undefined} /></p>
                  {currentItem.exampleMeaning && <p>{currentItem.exampleMeaning}</p>}
                </>
              ) : currentItem?.structure ? (
                <p>{currentItem.structure}</p>
              ) : (
                <p>No example sentence available for this item.</p>
              )}
            </div>
            <button type="button" className="quiz-button primary" onClick={handleNextQuestion}>
              {currentQuestionIndex < quizItems.length - 1 ? 'Next Question' : 'View Results'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};