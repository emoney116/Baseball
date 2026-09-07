export function PracticeResultChoices<T extends string>({ options, value, onChange, className = "practice-hitting-result-grid" }: {
  options: ReadonlyArray<{ value: T; label: string; tone?: string }>;
  value?: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return <div className={className} role="group" aria-label="Result">
    {options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value}
      className={[value === option.value ? "active" : "", option.tone].filter(Boolean).join(" ")}
      onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}
