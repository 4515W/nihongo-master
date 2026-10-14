export type ProfileRole = 'admin' | 'user';
export type QuestionExamType = 'JLPT_N5' | 'JLPT_N4' | 'SSW_KAIGO' | 'SSW_FOOD_SERVICE';
export type QuestionSection = 'goi' | 'bunpou' | 'dokkai' | 'choukai';
export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export type StudyItemType = 'kanji' | 'kotoba' | 'bunpou';

export interface Profile extends Record<string, unknown> {
  id: string;
  email: string;
  role: ProfileRole;
  full_name?: string | null;
  created_at?: string;
}

export interface KanjiItem extends Record<string, unknown> {
  id: string;
  kanji: string;
  onyomi?: string | null;
  kunyomi?: string | null;
  meaning: string;
  jlpt_level: JLPTLevel;
  stroke_count?: number | null;
  example_sentence?: string | null;
  example_meaning?: string | null;
  created_at?: string;
}

export interface KotobaItem extends Record<string, unknown> {
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

export interface BunpouItem extends Record<string, unknown> {
  id: string;
  title: string;
  reading: string;
  structure: string;
  meaning: string;
  jlpt_level: JLPTLevel;
  example_sentence?: string | null;
  example_meaning?: string | null;
  nuance?: string | null;
  nuance_usage?: string | null;
  conjugation_rules?: Record<string, string> | null;
  created_at?: string;
}

export interface Question extends Record<string, unknown> {
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

export interface UserItemProgress extends Record<string, unknown> {
  user_id: string;
  item_type: StudyItemType;
  item_id: string;
  streak_count: number;
  is_mastered: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserQuizHistory extends Record<string, unknown> {
  id: string;
  user_id: string;
  quiz_type: string;
  score: number;
  total_questions: number;
  points_earned: number;
  completed_at: string;
  item_type?: StudyItemType | null;
  item_id?: string | null;
  question_type?: 'reading' | 'meaning' | null;
  selected_answer?: string | null;
  correct_answer?: string | null;
  is_correct?: boolean | null;
  created_at?: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'> & { created_at?: string };
        Update: Partial<Omit<Profile, 'created_at'>> & { created_at?: string };
        Relationships: [];
      };
      kanji: {
        Row: KanjiItem;
        Insert: Omit<KanjiItem, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<KanjiItem, 'id' | 'created_at'>> & { id?: string; created_at?: string };
        Relationships: [];
      };
      kotoba: {
        Row: KotobaItem;
        Insert: Omit<KotobaItem, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<KotobaItem, 'id' | 'created_at'>> & { id?: string; created_at?: string };
        Relationships: [];
      };
      bunpou: {
        Row: BunpouItem;
        Insert: Omit<BunpouItem, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<BunpouItem, 'id' | 'created_at'>> & { id?: string; created_at?: string };
        Relationships: [];
      };
      questions: {
        Row: Question;
        Insert: Omit<Question, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Question, 'id' | 'created_at'>> & { id?: string; created_at?: string };
        Relationships: [];
      };
      user_item_progress: {
        Row: UserItemProgress;
        Insert: Omit<UserItemProgress, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string };
        Update: Partial<Omit<UserItemProgress, 'user_id' | 'item_type' | 'item_id'>> & { updated_at?: string };
        Relationships: [];
      };
      user_quiz_history: {
        Row: UserQuizHistory;
        Insert: Omit<UserQuizHistory, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<UserQuizHistory, 'id' | 'user_id' | 'item_type' | 'item_id'>> & { created_at?: string };
        Relationships: [];
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
