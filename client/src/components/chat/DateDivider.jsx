export default function DateDivider({ label }) {
  return (
    <div className="wa-day-separator" role="separator" aria-label={label}>
      <div className="wa-day-pill">{label}</div>
    </div>
  );
}
