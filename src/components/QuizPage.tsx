import { useState } from 'react';
import type { StudyItem } from '../types';
import { BrainCircuit, Check, X, RotateCcw } from 'lucide-react';

interface Props {
  items: StudyItem[];
  isDark: boolean;
}

type KanjiQuestionType = 'reading' | 'meaning';

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

export const QuizPage: React.FC<Props> = ({ items, isDark: _isDark }) => {
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [quizItems, setQuizItems] = useState<StudyItem[]>([]);
  const [questionOptions, setQuestionOptions] = useState<string[][]>([]);
  const [selectedCategory, setSelectedCategory] = useState<StudyItem['type'] | null>(null);
  const [selectedKanjiQuestionType, setSelectedKanjiQuestionType] = useState<KanjiQuestionType>('meaning');
  const [activeQuestionType, setActiveQuestionType] = useState<KanjiQuestionType>('meaning');

  const categoryItems = selectedCategory ? items.filter((item) => item.type === selectedCategory) : [];
  const quizPool = selectedCategory === 'kanji' && selectedKanjiQuestionType === 'reading'
    ? categoryItems.filter((item) => getKanjiReading(item))
    : categoryItems;
  const availableReadings = [...new Set(categoryItems.flatMap(getKanjiReadings))];
  const canStartQuiz = Boolean(selectedCategory) && quizPool.length >= 4 && (
    selectedCategory !== 'kanji' || selectedKanjiQuestionType !== 'reading' || availableReadings.length >= 2
  );

  const startQuiz = () => {
    if (!selectedCategory || !canStartQuiz) {
      return;
    }

    const questionType = selectedCategory === 'kanji' ? selectedKanjiQuestionType : 'meaning';
    const shuffled = [...quizPool].sort(() => 0.5 - Math.random()).slice(0, 5);
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
  };

  const currentItem = quizItems[currentQuestionIndex];
  const options = questionOptions[currentQuestionIndex] ?? [];
  const correctAnswer = currentItem
    ? activeQuestionType === 'reading' ? getKanjiReading(currentItem) : currentItem.meaning
    : '';

  const handleSelectAnswer = (ans: string) => {
    if (isAnswered || !currentItem) return;
    setSelectedAnswer(ans);
    setIsAnswered(true);

    if (ans === correctAnswer) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNextQuestion = () => {
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
          <p>Select a study category to start a five-question quiz.</p>
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
                  onClick={() => setSelectedCategory(category.type as StudyItem['type'])}
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
            Start {selectedCategory ? `${selectedCategory} ` : ''}Quiz
          </button>
        </div>
      </div>
    );
  }

  if (currentQuestionIndex >= quizItems.length) {
    return (
      <div className="quiz-shell">
        <div className="quiz-intro-card">
          <h2>Kuis Selesai! 🎉</h2>
          <p className="quiz-score">{score} / {quizItems.length}</p>
          <p>Skor akhir: {Math.round((score / quizItems.length) * 100)}%</p>
          <button type="button" className="quiz-reset-button" onClick={startQuiz}>
            <RotateCcw size={16} /> Coba Kuis Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-shell">
      <div className="quiz-panel">
        <div className="quiz-topbar">
          <span>Soal {currentQuestionIndex + 1} dari {quizItems.length}</span>
          <span>{activeQuestionType === 'reading' ? 'Kanji Reading' : currentItem?.type === 'kanji' ? 'Kanji Meaning' : currentItem?.type}</span>
        </div>

        <div className="quiz-question">
          <h3 className="quiz-japanese">{currentItem?.japanese}</h3>
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
                <span>{option}</span>
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
            </p>
            <div className="quiz-example-box">
              <strong>Example Sentence / Usage</strong>
              {currentItem?.exampleJp ? (
                <>
                  <p>{currentItem.exampleJp}</p>
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