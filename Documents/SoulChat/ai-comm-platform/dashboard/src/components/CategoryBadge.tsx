import { cn } from '../lib/utils';

export type BrainCategory = 'product' | 'policy' | 'faq' | 'script' | 'general';

interface CategoryConfig {
  label: string;
  emoji: string;
  bg: string;
  text: string;
}

const CATEGORY_CONFIG: Record<BrainCategory, CategoryConfig> = {
  product: { label: 'מוצר', emoji: '🛍️', bg: 'bg-blue-50', text: 'text-blue-700' },
  policy: { label: 'מדיניות', emoji: '📋', bg: 'bg-amber-50', text: 'text-amber-700' },
  faq: { label: 'שאלות נפוצות', emoji: '❓', bg: 'bg-green-50', text: 'text-green-700' },
  script: { label: 'תסריט', emoji: '📝', bg: 'bg-purple-50', text: 'text-purple-700' },
  general: { label: 'כללי', emoji: '📌', bg: 'bg-gray-100', text: 'text-gray-600' },
};

export function CategoryBadge({
  category,
  size = 'sm',
}: {
  category: string;
  size?: 'sm' | 'md';
}) {
  const config = CATEGORY_CONFIG[category as BrainCategory] ?? CATEGORY_CONFIG.general;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded font-medium',
        config.bg,
        config.text,
        size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1',
      )}
    >
      <span>{config.emoji}</span>
      {config.label}
    </span>
  );
}

/** Utility: get the Hebrew label for a category */
export function getCategoryLabel(category: string): string {
  return (CATEGORY_CONFIG[category as BrainCategory] ?? CATEGORY_CONFIG.general).label;
}
