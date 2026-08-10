import { NextResponse } from "next/server";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { WorkerMessageHandler } from "pdfjs-dist/legacy/build/pdf.worker.mjs";
import { parseMaxPrepsPdfText } from "../../../lib/rosterImport";

export const runtime = "nodejs";
export const maxDuration = 20;

type ParseStage = "UPLOAD" | "PDF_TEXT_EXTRACTION" | "MAXPREPS_PARSE" | "VALIDATION";

const MAX_PDF_BYTES = 8 * 1024 * 1024;

const pdfGlobal = globalThis as typeof globalThis & {
  pdfjsWorker?: { WorkerMessageHandler: typeof WorkerMessageHandler };
};
pdfGlobal.pdfjsWorker ??= { WorkerMessageHandler };

export async function POST(request: Request) {
  let stage: ParseStage = "UPLOAD";
  let fileName = "unknown";
  let fileType = "unknown";
  let fileSize = 0;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const sourceId = stringFormValue(formData.get("sourceId")) ?? crypto.randomUUID();
    const fallbackSeasonName = stringFormValue(formData.get("fallbackSeasonName"));

    if (!isUploadedFile(file)) {
      return parseFailure({
        fileName,
        stage,
        code: "NO_FILE",
        message: "Upload a PDF file.",
        status: 400,
      });
    }

    fileName = file.name || fileName;
    fileType = file.type || "application/octet-stream";
    fileSize = file.size;
    logPdfImport("received", { fileName, fileType, fileSize, stage });

    if (!fileName.toLowerCase().endsWith(".pdf") && fileType !== "application/pdf") {
      return parseFailure({
        fileName,
        stage,
        code: "UNSUPPORTED_FILE_TYPE",
        message: "This importer accepts PDF files only.",
        status: 400,
      });
    }

    if (fileSize > MAX_PDF_BYTES) {
      return parseFailure({
        fileName,
        stage,
        code: "PDF_TOO_LARGE",
        message: "This PDF is too large to import. MaxPreps roster PDFs should be under 8 MB.",
        status: 413,
      });
    }

    stage = "PDF_TEXT_EXTRACTION";
    const text = await extractPdfText(file);
    logPdfImport("text-extracted", { fileName, fileType, fileSize, stage, textLength: text.length });

    if (!text.trim()) {
      return parseFailure({
        fileName,
        stage,
        code: "SCANNED_OR_EMPTY_PDF",
        message: "This PDF appears to be scanned or image-based and does not contain a usable text layer.",
        status: 422,
      });
    }

    stage = "MAXPREPS_PARSE";
    const parsed = parseMaxPrepsPdfText(text, { sourceId, fileName, fallbackSeasonName });
    logPdfImport("roster-parsed", {
      fileName,
      fileType,
      fileSize,
      stage,
      textLength: text.length,
      playerCount: parsed.rows.length,
      staffCount: parsed.staff.length,
    });

    if (parsed.rows.length === 0) {
      return parseFailure({
        fileName,
        stage,
        code: "NO_ROSTER_ROWS",
        message: "The PDF text was readable, but no MaxPreps roster rows were detected.",
        status: 422,
        warnings: parsed.parseWarnings,
      });
    }

    stage = "VALIDATION";
    return NextResponse.json({
      ok: true,
      fileName,
      fileType: "pdf",
      fileSize,
      players: parsed.rows,
      staff: parsed.staff,
      detectedSchool: parsed.detectedSchoolName,
      detectedTeam: parsed.detectedTeamName,
      detectedSeason: parsed.detectedSeasonName,
      warnings: parsed.parseWarnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to parse the uploaded PDF.";
    logPdfImport("failed", { fileName, fileType, fileSize, stage, message });
    return parseFailure({
      fileName,
      stage,
      code: stage === "PDF_TEXT_EXTRACTION" ? "PDF_TEXT_EXTRACTION_FAILED" : "PDF_PARSE_FAILED",
      message,
      status: 500,
    });
  }
}

async function extractPdfText(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const documentOptions = {
    data: bytes,
    disableFontFace: true,
    disableWorker: true,
  } as unknown as Parameters<typeof getDocument>[0];
  const loadingTask = getDocument(documentOptions);
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const strings = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .filter(Boolean);
      pages.push(strings.join("\n"));
    }
  } finally {
    await loadingTask.destroy();
  }

  return pages.join("\n");
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  const maybeFile = value as Partial<File> | null;
  return Boolean(
    maybeFile &&
      typeof maybeFile === "object" &&
      "arrayBuffer" in maybeFile &&
      typeof maybeFile.arrayBuffer === "function" &&
      "size" in maybeFile,
  );
}

function stringFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseFailure(input: {
  fileName: string;
  stage: ParseStage;
  code: string;
  message: string;
  status: number;
  warnings?: string[];
}) {
  return NextResponse.json(
    {
      ok: false,
      fileName: input.fileName,
      stage: input.stage,
      code: input.code,
      message: input.message,
      warnings: input.warnings ?? [],
    },
    { status: input.status },
  );
}

function logPdfImport(event: string, details: Record<string, unknown>) {
  console.info("[roster-pdf-import]", { event, ...details });
}
