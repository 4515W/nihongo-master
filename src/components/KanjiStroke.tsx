import React, { useEffect, useRef } from 'react';
import HanziWriter from 'hanzi-writer';

interface Props {
  character: string; // Karakter Kanji, misal: '日'
  size?: number;
}

export const KanjiStroke: React.FC<Props> = ({ character, size = 150 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !character) return;

    // Bersihkan kontainer sebelum merender kanji baru
    containerRef.current.innerHTML = '';

    // Inisialisasi HanziWriter dengan target KanjiVG
    writerRef.current = HanziWriter.create(containerRef.current, character, {
      width: size,
      height: size,
      padding: 5,
      strokeColor: '#f43f5e', // Warna garis (Rose-500)
      radicalColor: '#fb7185',
      outlineColor: '#334155', // Warna bayangan outline
      showCharacter: true,
      showOutline: true,
      delayBetweenStrokes: 50, // Kecepatan animasi
    });

    // Jalankan animasi stroke order pertama kali
    writerRef.current.animateCharacter();
  }, [character, size]);

  const handleReplay = () => {
    if (writerRef.current) {
      writerRef.current.animateCharacter();
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div 
        ref={containerRef} 
        className="bg-slate-900 border border-slate-800 rounded-xl p-2 cursor-pointer shadow-inner"
        onClick={handleReplay}
        title="Klik untuk memutar ulang animasi stroke"
      />
      <button
        onClick={handleReplay}
        className="text-[11px] font-bold text-rose-500 hover:text-rose-400 flex items-center gap-1"
      >
        ▶ Putar Ulang Stroke Order
      </button>
    </div>
  );
};