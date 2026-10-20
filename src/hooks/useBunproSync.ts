import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { JLPTLevel } from '../types/database';

interface UseBunproSyncOptions {
  setIsSyncing: (value: boolean) => void;
  setErrorMessage: (value: string) => void;
  setMessage: (value: string) => void;
  setUploadProgress: (value: string) => void;
  onSyncComplete: () => void;
}

export function useBunproSync({
  setIsSyncing,
  setErrorMessage,
  setMessage,
  setUploadProgress,
  onSyncComplete,
}: UseBunproSyncOptions) {
  return useCallback(async (input: string) => {
    const targets: string[] = [];
    for (const entry of input.split(',').map((value) => value.trim()).filter(Boolean)) {
      const range = /^(\d+)\s*-\s*(\d+)$/.exec(entry);
      if (!range) {
        targets.push(entry);
        continue;
      }

      const start = Number(range[1]);
      const end = Number(range[2]);
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start) {
        setErrorMessage(`Invalid Bunpro ID range: ${entry}.`);
        return;
      }
      for (let id = start; id <= end; id += 1) targets.push(String(id));
    }
    if (targets.length === 0) {
      setErrorMessage('Enter a Bunpro ID, comma-separated IDs, or a numeric range.');
      return;
    }

    const bunproApiToken = import.meta.env.VITE_BUNPRO_API_TOKEN?.trim();
    if (!bunproApiToken) {
      setErrorMessage('BUNPRO_API_TOKEN is not configured.');
      return;
    }

    setIsSyncing(true);
    setErrorMessage('');
    setMessage('');
    setUploadProgress('Fetching Bunpro grammar points...');

    try {
      type BunproIncludedQuestion = {
        type?: string;
        content?: string;
        translation?: string;
        attributes?: {
          content?: string;
          translation?: string;
          sentence?: string;
        };
      };
      type BunproGrammarPointResponse = {
        data?: {
          jlpt?: string | number;
          jlpt_level?: string | number;
          attributes?: {
            title?: string;
            reading?: string;
            yomikata?: string;
            kana?: string;
            furigana?: string;
            structure?: string;
            structure_summary?: string;
            formatted_structure?: string;
            casual_structure?: string;
            polite_structure?: string;
            meaning?: string;
            level?: string | number;
            jlpt?: string | number;
            jlpt_level?: string | number;
            example_sentence?: string;
            example_meaning?: string;
            nuance?: string;
            caution?: string;
            nuance_translation?: string;
            nuance_usage?: string;
            part_of_speech_translation?: string;
            word_type_translation?: string;
            conjugation_rules?: Record<string, string> | null;
          };
        };
        included?: BunproIncludedQuestion[];
      };

      const cleanHtml = (value: string | undefined) => (value ?? '')
        .replace(/\\u003C/gi, '<')
        .replace(/\\u003E/gi, '>')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]*>?/gm, '')
        .replace(/\s+/g, ' ')
        .trim();
      let syncedCount = 0;
      for (const [index, targetSlug] of targets.entries()) {
        setUploadProgress(`Syncing ${index + 1}/${targets.length}...`);
        const response = await fetch(
          `/bunpro-api/api/frontend/reviewables/grammar_point/${encodeURIComponent(targetSlug)}`,
          {
            headers: {
              Authorization: `Token token=${bunproApiToken}`,
            },
          },
        );
        if (!response.ok) {
          throw new Error(`Bunpro request failed for "${targetSlug}" (${response.status}).`);
        }

        const result = await response.json() as BunproGrammarPointResponse;
        const itemData = result.data;
        const attributes = itemData?.attributes;
        if (!attributes) {
          throw new Error(`Bunpro returned an invalid response for "${targetSlug}".`);
        }

        const included = result.included ?? [];
        const example = included.find((item) => item.type === 'sentence')
          ?? included.find((item) => item.type === 'study_question');
        const casualStructure = cleanHtml(attributes.casual_structure);
        const politeStructure = cleanHtml(attributes.polite_structure);
        const rawStructure = [
          casualStructure,
          politeStructure,
        ].filter(Boolean).join('\n')
          || cleanHtml(attributes.structure || attributes.structure_summary || attributes.formatted_structure);
        const jlptNumber = String(attributes.level ?? '').replace(/^JLPT/i, '').replace(/^N/i, '');
        const jlptLevel = (
          ['1', '2', '3', '4', '5'].includes(jlptNumber) ? `N${jlptNumber}` : 'N5'
        ) as JLPTLevel;
        const nuance = [
          cleanHtml(attributes.part_of_speech_translation),
          cleanHtml(attributes.word_type_translation),
        ].filter(Boolean).join(' • ');
        const exampleSentence = cleanHtml(example?.content ?? example?.attributes?.content ?? example?.attributes?.sentence)
          .replace(/___/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        const payload = [{
          title: cleanHtml(attributes.title),
          reading: cleanHtml(attributes.reading || attributes.yomikata || attributes.kana || attributes.furigana),
          structure: cleanHtml(attributes.caution || '') || rawStructure,
          meaning: cleanHtml(attributes.meaning),
          jlpt_level: jlptLevel,
          example_sentence: exampleSentence,
          example_meaning: cleanHtml(example?.translation ?? example?.attributes?.translation),
          nuance,
          nuance_usage: cleanHtml(attributes.nuance_translation),
          conjugation_rules: rawStructure ? { rule: rawStructure } : {},
        }];

        const { error } = await supabase.from('bunpou').upsert(payload);
        if (error) throw new Error(`Failed to sync "${targetSlug}": ${error.message}`);
        syncedCount += payload.length;
      }

      setUploadProgress('Sync complete.');
      setMessage(`${syncedCount} grammar points synced from Bunpro.`);
      onSyncComplete();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to sync Bunpro grammar points.');
      setUploadProgress('');
    } finally {
      setIsSyncing(false);
    }
  }, [onSyncComplete, setErrorMessage, setIsSyncing, setMessage, setUploadProgress]);
}
