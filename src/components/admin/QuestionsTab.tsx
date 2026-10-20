import type { FormEvent } from 'react';
import {
  EntityManagementTab,
  type AdminEntityRow,
  type AdminFormValues,
  type EntityField,
} from './MasterDataTab';

interface QuestionsTabProps {
  rows: AdminEntityRow[];
  formValues: AdminFormValues;
  onFieldChange: (field: string, value: string) => void;
  onCreate: (event: FormEvent) => Promise<void>;
  onUpdate: (id: string) => Promise<void>;
  onEdit: (row: AdminEntityRow) => void;
  onReset: () => void;
  onDelete: (id: string) => Promise<void>;
}

export function QuestionsTab(props: QuestionsTabProps) {
  const {
    rows, formValues, onFieldChange, onCreate, onUpdate, onEdit, onReset, onDelete,
  } = props;
  const field = (label: string, name: string, options?: string[], type?: string): EntityField => {
    const rawValue = formValues[name];
    return {
      label,
      name,
      value: Array.isArray(rawValue) ? rawValue.join(', ') : rawValue ?? '',
      options,
      type,
      onChange: (value) => onFieldChange(name, value),
    };
  };
  const fields = [
    field('Exam Type', 'exam_type', ['JLPT_N5', 'JLPT_N4', 'SSW_KAIGO', 'SSW_FOOD_SERVICE']),
    field('Section', 'section', ['goi', 'bunpou', 'dokkai', 'choukai']),
    field('Question Text', 'question_text'),
    field('Option A', 'option_0'),
    field('Option B', 'option_1'),
    field('Option C', 'option_2'),
    field('Option D', 'option_3'),
    field('Correct Answer Index', 'correct_answer', undefined, 'number'),
    field('Explanation', 'explanation'),
  ];

  return (
    <EntityManagementTab
      rows={rows}
      kind="questions"
      title="Questions"
      fields={fields}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onEdit={onEdit}
      onReset={onReset}
      onDelete={onDelete}
    />
  );
}
