import { useState } from "react";
import { exportNodeToPdf } from "../utils/pdf";

interface Props {
  targetRef: React.RefObject<HTMLElement>;
  filename: string;
  disabled?: boolean;
}

export function PdfExportButton({ targetRef, filename, disabled }: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (!targetRef.current) return;
    setBusy(true);
    try {
      await exportNodeToPdf(targetRef.current, filename);
    } catch (err) {
      console.error("PDF export failed", err);
      alert("ייצוא ה-PDF נכשל. נסה שוב.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className="primary"
      onClick={handleClick}
      disabled={disabled || busy}
    >
      {busy ? "מייצא..." : "ייצוא ל-PDF"}
    </button>
  );
}
