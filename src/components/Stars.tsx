import type { CSSProperties } from 'react'
import type { Stars as StarCount } from '../types'
import { useT } from '../lib/i18n'

export const STAR_TIP =
  'M12 2.4l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.05 1.1-6.5-4.7-4.6 6.5-.95z'

interface Props {
  count: StarCount
  size?: 'large' | 'pip'
}

export function Stars({ count, size = 'large' }: Props) {
  const t = useT()
  return (
    <div
      className="stars"
      data-size={size}
      role="img"
      aria-label={t('starsOf', { a: count, b: 3 })}
    >
      {[0, 1, 2].map((index) => (
        <svg
          key={index}
          className="star"
          data-earned={index < count}
          style={{ '--i': index } as CSSProperties}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d={STAR_TIP} />
        </svg>
      ))}
    </div>
  )
}
