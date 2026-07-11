import rateLeft from './assets/rate-left.png';
import rateRight from './assets/rate-right.png';
import './HeroRating.css';

export const HERO_TOP_RATING_THRESHOLD = 8.1;

export function isTopHeroRating(rating?: number): rating is number {
  return rating != null && rating >= HERO_TOP_RATING_THRESHOLD;
}

interface HeroRatingProps {
  rating: number;
}

export function HeroRating({ rating }: HeroRatingProps) {
  const formatted = rating.toFixed(1);

  if (!isTopHeroRating(rating)) {
    return <>{formatted}</>;
  }

  return (
    <span className="hero-rating hero-rating--top">
      <img
        src={rateLeft}
        alt=""
        aria-hidden="true"
        className="hero-rating__laurel hero-rating__laurel--left"
      />
      <span className="hero-rating__value">{formatted}</span>
      <img
        src={rateRight}
        alt=""
        aria-hidden="true"
        className="hero-rating__laurel hero-rating__laurel--right"
      />
    </span>
  );
}
