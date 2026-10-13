import { useEffect, useState } from 'react';
import type { StudyItem } from '../types';
import { BrainCircuit, Check, X, RotateCcw } from 'lucide-react';

interface Props {
  items: StudyItem[];
  isDark: boolean;
}

export const QuizPage: React.FC<Props> = ({ items, isDark: _isDark }) => {
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [quizItems, setQuizItems] = useState<StudyItem[]>([]);
  const [options, setOptions] = useState<string[]>([]);

  const startQuiz = () => {
    if (items.length < 4) {
      alert('Minimal harus ada 4 data untuk memulai kuis!');
      return;
    }

    const shuffled = [...items].sort(() => 0.5 - Math.random()).slice(0, 5);
    setQuizItems(shuffled);
    setQuizStarted(true);
    setCurrentQuestionIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
  };

  const currentItem = quizItems[currentQuestionIndex];

  const getOptions = () => {
    if (!currentItem) return [];
    const wrongOptions = items
      .filter((item) => item.id !== currentItem.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map((item) => item.meaning);

    return [...wrongOptions, currentItem.meaning].sort(() => 0.5 - Math.random());
  };

  useEffect(() => {
    if (currentItem) {
      setOptions(getOptions());
    }
  }, [currentQuestionIndex, quizStarted, currentItem, items]);

  const handleSelectAnswer = (ans: string) => {
    if (isAnswered || !currentItem) return;
    setSelectedAnswer(ans);
    setIsAnswered(true);

    if (ans === currentItem.meaning) {
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
          <h2>Kuis Bahasa Jepang</h2>
          <p>Uji pemahamanmu dengan 5 soal pilihan ganda acak dari bank data yang sudah kamu pelajari.</p>
          <button type="button" className="quiz-start-button" onClick={startQuiz}>
            Mulai Kuis Sekarang
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
          <span>{currentItem?.type}</span>
        </div>

        <div className="quiz-question">
          <h3 className="quiz-japanese">{currentItem?.japanese}</h3>
          <p className="quiz-reading">{currentItem?.reading}</p>
        </div>

        <div className="option-grid">
          {options.map((option, index) => {
            const isCorrect = option === currentItem?.meaning;
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
          <button type="button" className="quiz-button primary" onClick={handleNextQuestion}>
            {currentQuestionIndex < quizItems.length - 1 ? 'Soal Berikutnya' : 'Lihat Hasil'}
          </button>
        )}
      </div>
    </div>
  );
};