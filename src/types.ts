export type ItemType = 'kanji' | 'kotoba' | 'bunpou';
export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export interface StudyItem {
  id: string;
  type: ItemType;
  japanese: string;
  reading: string;
  meaning: string;
  jlptLevel: JLPTLevel;
  structure?: string;
  exampleJp?: string;
  exampleId?: string;
  isMastered: boolean;
  createdAt?: string;
}