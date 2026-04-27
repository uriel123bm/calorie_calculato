import type { ChangeEvent } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function RecipeNameInput({ value, onChange }: Props) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value);
  return (
    <section className="section recipe-name">
      <h2>שם המתכון</h2>
      <input
        type="text"
        placeholder="לדוגמה: עוגת שוקולד שלי"
        value={value}
        onChange={handle}
        aria-label="שם המתכון"
      />
    </section>
  );
}
