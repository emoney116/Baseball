import { NextResponse } from "next/server";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { WorkerMessageHandler } from "pdfjs-dist/legacy/build/pdf.worker.mjs";

export const runtime = "nodejs";

const pdfGlobal = globalThis as typeof globalThis & {
  pdfjsWorker?: { WorkerMessageHandler: typeof WorkerMessageHandler };
};
pdfGlobal.pdfjsWorker ??= { WorkerMessageHandler };

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Upload a PDF file." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const documentOptions = {
    data: bytes,
    disableFontFace: true,
    disableWorker: true,
  } as unknown as Parameters<typeof getDocument>[0];
  const loadingTask = getDocument(documentOptions);
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const strings = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean);
    pages.push(strings.join("\n"));
  }

  const text = pages.join("\n");
  if (!text.trim()) {
    return NextResponse.json(
      {
        text: "",
        warnings: ["No usable PDF text layer was found. OCR fallback is not enabled for this pass; export CSV or upload a text-based PDF."],
      },
      { status: 422 },
    );
  }

  return NextResponse.json({ text, warnings: [] });
}
