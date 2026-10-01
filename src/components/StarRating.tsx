import { Star } from 'lucide-react';
import { MAX_SKILL } from '@/lib/skill';

interface StarRatingProps {
  value: number;
  /** Omit for a read-only display. */
  onChange?: (value: number) => void;
  size?: 'xs' | 'sm' | 'md';
}

const SIZE_CLASS = { xs: 'w-3 h-3', sm: 'w-3.5 h-3.5', md: 'w-5 h-5' };

export function StarRating({ value, onChange, size = 'sm' }: StarRatingProps) {
  const iconClass = SIZE_CLASS[size];
  const stars = Array.from({ length: MAX_SKILL }, (_, i) => i + 1);

  if (!onChange) {
    return (
      <span className="inline-flex items-center shrink-0" title={`Skill ${value}/${MAX_SKILL}`} aria-label={`Skill ${value} of ${MAX_SKILL}`}>
        {stars.map(n => (
          <Star
            key={n}
            className={`${iconClass} ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
          />
        ))}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center shrink-0" role="radiogroup" aria-label="Skill level">
      {stars.map(n => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
          aria-label={`${n} star${n !== 1 ? 's' : ''}`}
          title={`Set skill to ${n}`}
          onClick={(e) => { e.stopPropagation(); onChange(n); }}
          className="p-0.5 rounded hover:scale-110 transition-transform"
        >
          <Star
            className={`${iconClass} ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600 hover:text-amber-300'}`}
          />
        </button>
      ))}
    </span>
  );
}
