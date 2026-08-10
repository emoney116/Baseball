import { NextResponse } from "next/server";
import { parseMaxPrepsPdfText } from "../../../lib/rosterImport";

export const runtime = "nodejs";
export const maxDuration = 20;

type ParseStage = "UPLOAD" | "PDF_TEXT_EXTRACTION" | "MAXPREPS_PARSE" | "VALIDATION";

const MAX_PDF_BYTES = 8 * 1024 * 1024;

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfWorkerModule = typeof import("pdfjs-dist/legacy/build/pdf.worker.mjs");

let pdfJsModulePromise: Promise<PdfJsModule> | undefined;
let pdfWorkerModulePromise: Promise<PdfWorkerModule> | undefined;

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
  const { getDocument } = await loadPdfJs();
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

async function loadPdfJs() {
  ensurePdfServerGlobals();
  pdfJsModulePromise ??= import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfWorkerModulePromise ??= import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const [pdfJsModule, workerModule] = await Promise.all([pdfJsModulePromise, pdfWorkerModulePromise]);
  const pdfGlobal = globalThis as typeof globalThis & {
    pdfjsWorker?: { WorkerMessageHandler: PdfWorkerModule["WorkerMessageHandler"] };
  };
  pdfGlobal.pdfjsWorker ??= { WorkerMessageHandler: workerModule.WorkerMessageHandler };
  return pdfJsModule;
}

function ensurePdfServerGlobals() {
  const pdfGlobal = globalThis as typeof globalThis & {
    DOMMatrix?: typeof DOMMatrix;
    Path2D?: typeof Path2D;
  };

  pdfGlobal.DOMMatrix ??= ServerDOMMatrix as unknown as typeof DOMMatrix;
  pdfGlobal.Path2D ??= ServerPath2D as unknown as typeof Path2D;
}

class ServerDOMMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  constructor(init?: number[] | DOMMatrix | ServerDOMMatrix) {
    if (Array.isArray(init)) {
      this.a = init[0] ?? 1;
      this.b = init[1] ?? 0;
      this.c = init[2] ?? 0;
      this.d = init[3] ?? 1;
      this.e = init[4] ?? 0;
      this.f = init[5] ?? 0;
    } else if (init) {
      this.a = init.a;
      this.b = init.b;
      this.c = init.c;
      this.d = init.d;
      this.e = init.e;
      this.f = init.f;
    }
  }

  get m11() { return this.a; }
  set m11(value: number) { this.a = value; }
  get m12() { return this.b; }
  set m12(value: number) { this.b = value; }
  get m21() { return this.c; }
  set m21(value: number) { this.c = value; }
  get m22() { return this.d; }
  set m22(value: number) { this.d = value; }
  get m41() { return this.e; }
  set m41(value: number) { this.e = value; }
  get m42() { return this.f; }
  set m42(value: number) { this.f = value; }

  multiplySelf(other?: number[] | DOMMatrix | ServerDOMMatrix) {
    const matrix = new ServerDOMMatrix(other);
    return this.set(
      this.a * matrix.a + this.c * matrix.b,
      this.b * matrix.a + this.d * matrix.b,
      this.a * matrix.c + this.c * matrix.d,
      this.b * matrix.c + this.d * matrix.d,
      this.a * matrix.e + this.c * matrix.f + this.e,
      this.b * matrix.e + this.d * matrix.f + this.f,
    );
  }

  preMultiplySelf(other?: number[] | DOMMatrix | ServerDOMMatrix) {
    const matrix = new ServerDOMMatrix(other);
    return this.set(
      matrix.a * this.a + matrix.c * this.b,
      matrix.b * this.a + matrix.d * this.b,
      matrix.a * this.c + matrix.c * this.d,
      matrix.b * this.c + matrix.d * this.d,
      matrix.a * this.e + matrix.c * this.f + matrix.e,
      matrix.b * this.e + matrix.d * this.f + matrix.f,
    );
  }

  translate(x = 0, y = 0) {
    return new ServerDOMMatrix(this).translateSelf(x, y);
  }

  translateSelf(x = 0, y = 0) {
    return this.multiplySelf([1, 0, 0, 1, x, y]);
  }

  scale(scaleX = 1, scaleY = scaleX) {
    return new ServerDOMMatrix(this).scaleSelf(scaleX, scaleY);
  }

  scaleSelf(scaleX = 1, scaleY = scaleX) {
    return this.multiplySelf([scaleX, 0, 0, scaleY, 0, 0]);
  }

  invertSelf() {
    const determinant = this.a * this.d - this.b * this.c || 1;
    return this.set(
      this.d / determinant,
      -this.b / determinant,
      -this.c / determinant,
      this.a / determinant,
      (this.c * this.f - this.d * this.e) / determinant,
      (this.b * this.e - this.a * this.f) / determinant,
    );
  }

  private set(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
    return this;
  }
}

class ServerPath2D {
  addPath() {
    return undefined;
  }
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
