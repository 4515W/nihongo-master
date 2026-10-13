export type ItemType = 'kanji' | 'kotoba' | 'bunpou';
export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export interface StudyItem {
  id: string;
  type: ItemType;
  japanese: string;
  reading: string;
  onyomi?: string;
  kunyomi?: string;
  meaning: string;
  jlptLevel: JLPTLevel;
  structure?: string;
  exampleJp?: string;
  exampleMeaning?: string;
  exampleId?: string;
  relatedWords?: string[];
  isMastered: boolean;
  createdAt?: string;
}