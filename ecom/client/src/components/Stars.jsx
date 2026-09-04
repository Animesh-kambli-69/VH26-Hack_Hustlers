export default function Stars({ rating = 0 }) {
  const full = Math.round(rating);
  const empty = Math.max(0, 5 - full);
  return (
    <span className="stars" aria-label={`Rated ${rating} out of 5`}>
      {'★'.repeat(full)}
      <span className="stars-empty">{'★'.repeat(empty)}</span>
    </span>
  );
}
