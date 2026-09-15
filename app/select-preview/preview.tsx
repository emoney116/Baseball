"use client";

import { useRef, useState } from "react";
import { ClubhouseMultiSelect, ClubhouseSearchSelect, ClubhouseSelect } from "../components/ClubhouseSelect";

const options = [
  { value: "disabled", label: "Unavailable player", disabled: true },
  ...Array.from({ length: 40 }, (_, index) => ({ value: String(index), label: `Player ${index + 1}`, description: index === 3 ? "A long description that must remain readable inside the options list on a narrow phone" : undefined })),
];

export function SelectPreview() {
  const [value, setValue] = useState("3");
  const [values, setValues] = useState<string[]>(["1", "3"]);
  const dialog = useRef<HTMLDialogElement>(null);
  return <main style={{ padding: 24, maxWidth: 680 }}>
    <h1>Selector QA</h1>
    <button type="button">Outside target</button>
    <div style={{ overflow: "hidden", height: 220 }}>
      <ClubhouseSearchSelect label="Search player" value={value} onChange={setValue} options={options} />
      <ClubhouseMultiSelect label="Players" values={values} onApply={setValues} options={options} searchable />
      <output aria-label="Applied players">{values.join(",") || "All"}</output>
    </div>
    <button type="button" onClick={() => dialog.current?.showModal()}>Open dialog</button>
    <dialog ref={dialog} style={{ transform: "translateY(-10px)", width: 300, padding: 20, background: "var(--surface)", color: "var(--text)" }}>
      <ClubhouseSelect label="Dialog player" value={value} onChange={setValue} options={options} />
      <button type="button" onClick={() => dialog.current?.close()}>Close dialog</button>
    </dialog>
    <div style={{ position: "fixed", bottom: 20, right: 20, width: 180 }}>
      <ClubhouseSelect label="Bottom edge" value={value} onChange={setValue} options={options} mobilePresentation="popover" />
    </div>
  </main>;
}
