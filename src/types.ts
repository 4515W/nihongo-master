export type ItemType = 'kanji' | 'kotoba' | 'bunpou';
export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export type MasteryStatus = 'new' | 'learning' | 'mastered';

export interface ConjugationRules {
  verbs?: string;
  nouns?: string;
  adjectives?: string;
}

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
  nuance?: string;
  conjugationRules?: ConjugationRules;
  exampleJp?: string;
  exampleMeaning?: string;
  exampleId?: string;
  relatedWords?: string[];
  masteryStreak?: number;
  masteryStatus?: MasteryStatus;
  isMastered: boolean;
  createdAt?: string;
}