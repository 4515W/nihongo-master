export type ProfileRole = 'admin' | 'user';
export type QuestionExamType = 'JLPT_N5' | 'JLPT_N4' | 'SSW_KAIGO' | 'SSW_FOOD_SERVICE';
export type QuestionSection = 'goi' | 'bunpou' | 'dokkai' | 'choukai';
export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export interface Profile {
  id: string;
  email: string;
  role: ProfileRole;
  full_name?: string | null;
  created_at?: string;
}

export interface KanjiItem {
  id: string;
  kanji: string;
  onyomi?: string | null;
  kunyomi?: string | null;
  meaning: string;
  jlpt_level: JLPTLevel;
  stroke_count?: number | null;
  created_at?: string;
}

export interface KotobaItem {
  id: string;
  word: string;
  reading?: string | null;
  meaning: string;
  jlpt_level: JLPTLevel;
  part_of_speech?: string | null;
  example_sentence?: string | null;
  example_meaning?: string | null;
  related_words?: string[] | null;
  created_at?: string;
}

export interface BunpouItem {
  id: string;
  title: string;
  structure: string;
  meaning: string;
  jlpt_level: JLPTLevel;
  example_sentence?: string | null;
  created_at?: string;
}

export interface Question {
  id: string;
  exam_type: QuestionExamType;
  section: QuestionSection;
  question_text: string;
  options: string[];
  correct_answer: number;
  explanation?: string | null;
  audio_url?: string | null;
  created_at?: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'> & { created_at?: string };
        Update: Partial<Omit<Profile, 'created_at'>> & { created_at?: string };
      };
      kanji: {
        Row: KanjiItem;
        Insert: Omit<KanjiItem, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<KanjiItem, 'id' | 'created_at'>> & { id?: string; created_at?: string };
      };
      kotoba: {
        Row: KotobaItem;
        Insert: Omit<KotobaItem, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<KotobaItem, 'id' | 'created_at'>> & { id?: string; created_at?: string };
      };
      bunpou: {
        Row: BunpouItem;
        Insert: Omit<BunpouItem, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<BunpouItem, 'id' | 'created_at'>> & { id?: string; created_at?: string };
      };
      questions: {
        Row: Question;
        Insert: Omit<Question, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Question, 'id' | 'created_at'>> & { id?: string; created_at?: string };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      profile_role: ProfileRole;
      question_exam_type: QuestionExamType;
      question_section: QuestionSection;
    };
  };
};
