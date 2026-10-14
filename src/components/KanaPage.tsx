import React, { useState } from 'react';
import { Volume2 } from 'lucide-react';

interface KanaItem {
  kana: string;
  romaji: string;
  type: 'main' | 'dakuon' | 'yoon';
}

// Data Hiragana
const HIRAGANA_DATA: KanaItem[] = [
  // Goyūon (Dasar)
  { kana: 'あ', romaji: 'a', type: 'main' },
  { kana: 'い', romaji: 'i', type: 'main' },
  { kana: 'う', romaji: 'u', type: 'main' },
  { kana: 'え', romaji: 'e', type: 'main' },
  { kana: 'お', romaji: 'o', type: 'main' },
  { kana: 'か', romaji: 'ka', type: 'main' },
  { kana: 'き', romaji: 'ki', type: 'main' },
  { kana: 'く', romaji: 'ku', type: 'main' },
  { kana: 'け', romaji: 'ke', type: 'main' },
  { kana: 'こ', romaji: 'ko', type: 'main' },
  { kana: 'さ', romaji: 'sa', type: 'main' },
  { kana: 'し', romaji: 'shi', type: 'main' },
  { kana: 'す', romaji: 'su', type: 'main' },
  { kana: 'せ', romaji: 'se', type: 'main' },
  { kana: 'そ', romaji: 'so', type: 'main' },
  { kana: 'た', romaji: 'ta', type: 'main' },
  { kana: 'ち', romaji: 'chi', type: 'main' },
  { kana: 'つ', romaji: 'tsu', type: 'main' },
  { kana: 'て', romaji: 'te', type: 'main' },
  { kana: 'と', romaji: 'to', type: 'main' },
  { kana: 'な', romaji: 'na', type: 'main' },
  { kana: 'に', romaji: 'ni', type: 'main' },
  { kana: 'ぬ', romaji: 'nu', type: 'main' },
  { kana: 'ね', romaji: 'ne', type: 'main' },
  { kana: 'の', romaji: 'no', type: 'main' },
  { kana: 'は', romaji: 'ha', type: 'main' },
  { kana: 'ひ', romaji: 'hi', type: 'main' },
  { kana: 'ふ', romaji: 'fu', type: 'main' },
  { kana: 'へ', romaji: 'he', type: 'main' },
  { kana: 'ほ', romaji: 'ho', type: 'main' },
  { kana: 'ま', romaji: 'ma', type: 'main' },
  { kana: 'み', romaji: 'mi', type: 'main' },
  { kana: 'む', romaji: 'mu', type: 'main' },
  { kana: 'め', romaji: 'me', type: 'main' },
  { kana: 'も', romaji: 'mo', type: 'main' },
  { kana: 'や', romaji: 'ya', type: 'main' },
  { kana: 'ゆ', romaji: 'yu', type: 'main' },
  { kana: 'よ', romaji: 'yo', type: 'main' },
  { kana: 'ら', romaji: 'ra', type: 'main' },
  { kana: 'り', romaji: 'ri', type: 'main' },
  { kana: 'る', romaji: 'ru', type: 'main' },
  { kana: 'れ', romaji: 're', type: 'main' },
  { kana: 'ろ', romaji: 'ro', type: 'main' },
  { kana: 'わ', romaji: 'wa', type: 'main' },
  { kana: 'を', romaji: 'wo', type: 'main' },
  { kana: 'ん', romaji: 'n', type: 'main' },

  // Dakuon / Handakuon (Tenten / Maru)
  { kana: 'が', romaji: 'ga', type: 'dakuon' },
  { kana: 'ぎ', romaji: 'gi', type: 'dakuon' },
  { kana: 'ぐ', romaji: 'gu', type: 'dakuon' },
  { kana: 'げ', romaji: 'ge', type: 'dakuon' },
  { kana: 'ご', romaji: 'go', type: 'dakuon' },
  { kana: 'ざ', romaji: 'za', type: 'dakuon' },
  { kana: 'じ', romaji: 'ji', type: 'dakuon' },
  { kana: 'ず', romaji: 'zu', type: 'dakuon' },
  { kana: 'ぜ', romaji: 'ze', type: 'dakuon' },
  { kana: 'ぞ', romaji: 'zo', type: 'dakuon' },
  { kana: 'だ', romaji: 'da', type: 'dakuon' },
  { kana: 'ぢ', romaji: 'ji', type: 'dakuon' },
  { kana: 'づ', romaji: 'zu', type: 'dakuon' },
  { kana: 'で', romaji: 'de', type: 'dakuon' },
  { kana: 'ど', romaji: 'do', type: 'dakuon' },
  { kana: 'ば', romaji: 'ba', type: 'dakuon' },
  { kana: 'び', romaji: 'bi', type: 'dakuon' },
  { kana: 'ぶ', romaji: 'bu', type: 'dakuon' },
  { kana: 'べ', romaji: 'be', type: 'dakuon' },
  { kana: 'ぼ', romaji: 'bo', type: 'dakuon' },
  { kana: 'ぱ', romaji: 'pa', type: 'dakuon' },
  { kana: 'ぴ', romaji: 'pi', type: 'dakuon' },
  { kana: 'ぷ', romaji: 'pu', type: 'dakuon' },
  { kana: 'ぺ', romaji: 'pe', type: 'dakuon' },
  { kana: 'ぽ', romaji: 'po', type: 'dakuon' },

  // Yōon (Kombinasi)
  { kana: 'きゃ', romaji: 'kya', type: 'yoon' },
  { kana: 'きゅ', romaji: 'kyu', type: 'yoon' },
  { kana: 'きょ', romaji: 'kyo', type: 'yoon' },
  { kana: 'しゃ', romaji: 'sha', type: 'yoon' },
  { kana: 'しゅ', romaji: 'shu', type: 'yoon' },
  { kana: 'しょ', romaji: 'sho', type: 'yoon' },
  { kana: 'ちゃ', romaji: 'cha', type: 'yoon' },
  { kana: 'ちゅ', romaji: 'chu', type: 'yoon' },
  { kana: 'ちょ', romaji: 'cho', type: 'yoon' },
  { kana: 'にゃ', romaji: 'nya', type: 'yoon' },
  { kana: 'にゅ', romaji: 'nyu', type: 'yoon' },
  { kana: 'にょ', romaji: 'nyo', type: 'yoon' },
  { kana: 'ひゃ', romaji: 'hya', type: 'yoon' },
  { kana: 'ひゅ', romaji: 'hyu', type: 'yoon' },
  { kana: 'ひょ', romaji: 'hyo', type: 'yoon' },
  { kana: 'みゃ', romaji: 'mya', type: 'yoon' },
  { kana: 'みゅ', romaji: 'myu', type: 'yoon' },
  { kana: 'みょ', romaji: 'myo', type: 'yoon' },
  { kana: 'りゃ', romaji: 'rya', type: 'yoon' },
  { kana: 'りゅ', romaji: 'ryu', type: 'yoon' },
  { kana: 'りょ', romaji: 'ryo', type: 'yoon' }
];

// Data Katakana
const KATAKANA_DATA: KanaItem[] = [
  // Goyūon
  { kana: 'ア', romaji: 'a', type: 'main' },
  { kana: 'イ', romaji: 'i', type: 'main' },
  { kana: 'ウ', romaji: 'u', type: 'main' },
  { kana: 'エ', romaji: 'e', type: 'main' },
  { kana: 'オ', romaji: 'o', type: 'main' },
  { kana: 'カ', romaji: 'ka', type: 'main' },
  { kana: 'キ', romaji: 'ki', type: 'main' },
  { kana: 'ク', romaji: 'ku', type: 'main' },
  { kana: 'ケ', romaji: 'ke', type: 'main' },
  { kana: 'コ', romaji: 'ko', type: 'main' },
  { kana: 'サ', romaji: 'sa', type: 'main' },
  { kana: 'シ', romaji: 'shi', type: 'main' },
  { kana: 'ス', romaji: 'su', type: 'main' },
  { kana: 'セ', romaji: 'se', type: 'main' },
  { kana: 'ソ', romaji: 'so', type: 'main' },
  { kana: 'タ', romaji: 'ta', type: 'main' },
  { kana: 'チ', romaji: 'chi', type: 'main' },
  { kana: 'ツ', romaji: 'tsu', type: 'main' },
  { kana: 'テ', romaji: 'te', type: 'main' },
  { kana: 'ト', romaji: 'to', type: 'main' },
  { kana: 'ナ', romaji: 'na', type: 'main' },
  { kana: 'ニ', romaji: 'ni', type: 'main' },
  { kana: 'ヌ', romaji: 'nu', type: 'main' },
  { kana: 'ネ', romaji: 'ne', type: 'main' },
  { kana: 'ノ', romaji: 'no', type: 'main' },
  { kana: 'ハ', romaji: 'ha', type: 'main' },
  { kana: 'ヒ', romaji: 'hi', type: 'main' },
  { kana: 'フ', romaji: 'fu', type: 'main' },
  { kana: 'ヘ', romaji: 'he', type: 'main' },
  { kana: 'ホ', romaji: 'ho', type: 'main' },
  { kana: 'マ', romaji: 'ma', type: 'main' },
  { kana: 'ミ', romaji: 'mi', type: 'main' },
  { kana: 'ム', romaji: 'mu', type: 'main' },
  { kana: 'メ', romaji: 'me', type: 'main' },
  { kana: 'モ', romaji: 'mo', type: 'main' },
  { kana: 'ヤ', romaji: 'ya', type: 'main' },
  { kana: 'ユ', romaji: 'yu', type: 'main' },
  { kana: 'ヨ', romaji: 'yo', type: 'main' },
  { kana: 'ラ', romaji: 'ra', type: 'main' },
  { kana: 'リ', romaji: 'ri', type: 'main' },
  { kana: 'ル', romaji: 'ru', type: 'main' },
  { kana: 'レ', romaji: 're', type: 'main' },
  { kana: 'ロ', romaji: 'ro', type: 'main' },
  { kana: 'ワ', romaji: 'wa', type: 'main' },
  { kana: 'ヲ', romaji: 'wo', type: 'main' },
  { kana: 'ン', romaji: 'n', type: 'main' },

  // Dakuon
  { kana: 'ガ', romaji: 'ga', type: 'dakuon' },
  { kana: 'ギ', romaji: 'gi', type: 'dakuon' },
  { kana: 'グ', romaji: 'gu', type: 'dakuon' },
  { kana: 'ゲ', romaji: 'ge', type: 'dakuon' },
  { kana: 'ゴ', romaji: 'go', type: 'dakuon' },
  { kana: 'ザ', romaji: 'za', type: 'dakuon' },
  { kana: 'ジ', romaji: 'ji', type: 'dakuon' },
  { kana: 'ズ', romaji: 'zu', type: 'dakuon' },
  { kana: 'ゼ', romaji: 'ze', type: 'dakuon' },
  { kana: 'ゾ', romaji: 'zo', type: 'dakuon' },
  { kana: 'ダ', romaji: 'da', type: 'dakuon' },
  { kana: 'ヂ', romaji: 'ji', type: 'dakuon' },
  { kana: 'ヅ', romaji: 'zu', type: 'dakuon' },
  { kana: 'デ', romaji: 'de', type: 'dakuon' },
  { kana: 'ド', romaji: 'do', type: 'dakuon' },
  { kana: 'バ', romaji: 'ba', type: 'dakuon' },
  { kana: 'ビ', romaji: 'bi', type: 'dakuon' },
  { kana: 'ブ', romaji: 'bu', type: 'dakuon' },
  { kana: 'ベ', romaji: 'be', type: 'dakuon' },
  { kana: 'ボ', romaji: 'bo', type: 'dakuon' },
  { kana: 'パ', romaji: 'pa', type: 'dakuon' },
  { kana: 'ピ', romaji: 'pi', type: 'dakuon' },
  { kana: 'プ', romaji: 'pu', type: 'dakuon' },
  { kana: 'ペ', romaji: 'pe', type: 'dakuon' },
  { kana: 'ポ', romaji: 'po', type: 'dakuon' },

  // Yōon
  { kana: 'キャ', romaji: 'kya', type: 'yoon' },
  { kana: 'キュ', romaji: 'kyu', type: 'yoon' },
  { kana: 'キョ', romaji: 'kyo', type: 'yoon' },
  { kana: 'シャ', romaji: 'sha', type: 'yoon' },
  { kana: 'シュ', romaji: 'shu', type: 'yoon' },
  { kana: 'ショ', romaji: 'sho', type: 'yoon' },
  { kana: 'チャ', romaji: 'cha', type: 'yoon' },
  { kana: 'チュ', romaji: 'chu', type: 'yoon' },
  { kana: 'チョ', romaji: 'cho', type: 'yoon' },
  { kana: 'ニャ', romaji: 'nya', type: 'yoon' },
  { kana: 'ニュ', romaji: 'nyu', type: 'yoon' },
  { kana: 'ニョ', romaji: 'nyo', type: 'yoon' },
  { kana: 'ヒャ', romaji: 'hya', type: 'yoon' },
  { kana: 'ヒュ', romaji: 'hyu', type: 'yoon' },
  { kana: 'ヒョ', romaji: 'hyo', type: 'yoon' },
  { kana: 'ミャ', romaji: 'mya', type: 'yoon' },
  { kana: 'ミュ', romaji: 'myu', type: 'yoon' },
  { kana: 'ミョ', romaji: 'myo', type: 'yoon' },
  { kana: 'リャ', romaji: 'rya', type: 'yoon' },
  { kana: 'リュ', romaji: 'ryu', type: 'yoon' },
  { kana: 'リョ', romaji: 'ryo', type: 'yoon' }
];

export const KanaPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'hiragana' | 'katakana'>('hiragana');
  const [filterType, setFilterType] = useState<'all' | 'main' | 'dakuon' | 'yoon'>('all');

  const currentDataset = activeTab === 'hiragana' ? HIRAGANA_DATA : KATAKANA_DATA;

  const filteredData = currentDataset.filter(item => {
    if (filterType === 'all') return true;
    return item.type === filterType;
  });

  const playAudio = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header & Main Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kana Board</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Pelajari karakter dasar Hiragana dan Katakana Jepang
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('hiragana')}
            className={`flex-1 sm:flex-initial px-6 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'hiragana'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            あ Hiragana
          </button>
          <button
            onClick={() => setActiveTab('katakana')}
            className={`flex-1 sm:flex-initial px-6 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'katakana'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            ア Katakana
          </button>
        </div>
      </div>

      {/* Sub Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            filterType === 'all'
              ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          Semua ({currentDataset.length})
        </button>
        <button
          onClick={() => setFilterType('main')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            filterType === 'main'
              ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          Goyūon (Utama)
        </button>
        <button
          onClick={() => setFilterType('dakuon')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            filterType === 'dakuon'
              ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          Dakuon (濁音)
        </button>
        <button
          onClick={() => setFilterType('yoon')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            filterType === 'yoon'
              ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          Yōon (拗音)
        </button>
      </div>

      {/* Grid Items */}
      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-3">
        {filteredData.map((item, idx) => (
          <div
            key={`${item.kana}-${idx}`}
            onClick={() => playAudio(item.kana)}
            className="group relative bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-750 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 shadow-sm hover:shadow active:scale-95"
          >
            <span className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {item.kana}
            </span>
            <span className="text-[12px] font-medium text-gray-400 dark:text-gray-500 group-hover:text-blue-500 mt-1">
              {item.romaji}
            </span>

            {/* Audio Icon Indicator */}
            <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Volume2 className="w-3 h-3 text-blue-500" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};