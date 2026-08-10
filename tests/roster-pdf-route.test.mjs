import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import net from "node:net";
import test from "node:test";

test("multipart MaxPreps PDF upload returns structured roster data", async () => {
  const port = await getOpenPort();
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(port)], {
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForServer(`http://127.0.0.1:${port}`, () => output);
    const form = new FormData();
    form.set("file", new File([createMaxPrepsFixturePdf()], "maxpreps-fixture.pdf", { type: "application/pdf" }));
    form.set("sourceId", "test-pdf-source");
    form.set("fallbackSeasonName", "Fall 2026");

    const response = await fetch(`http://127.0.0.1:${port}/api/roster/parse-pdf`, {
      method: "POST",
      body: form,
    });
    const payload = await response.json();

    assert.equal(response.ok, true, JSON.stringify(payload));
    assert.equal(payload.ok, true);
    assert.equal(payload.players.length, 20);
    assert.equal(payload.staff.length, 6);
    assert.equal(payload.detectedSchool, "Metrolina Christian Academy");
    assert.equal(payload.detectedTeam, "Metrolina Varsity");
    assert.equal(payload.detectedSeason, "2025-26");
    assert.equal(payload.players[0].firstName, "Player");
    assert.equal(payload.players[0].lastName, "One");
  } finally {
    server.kill();
    await once(server, "exit").catch(() => undefined);
  }
}, { timeout: 30000 });

async function getOpenPort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  server.close();
  await once(server, "close");
  return port;
}

async function waitForServer(baseUrl, getOutput) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.status < 500) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  throw new Error(`Next.js test server did not become ready at ${baseUrl}\n${getOutput()}`);
}

function createMaxPrepsFixturePdf() {
  const lines = [
    "Metrolina Christian Academy",
    "25-26",
    "Varsity",
    "Baseball",
    "Roster",
    "#",
    "Name",
    "Pos.",
    "Gr.",
    "Ht.",
    "Wt.",
    ...playerCells(),
    "Staff",
    "Position",
    "Eric Boston",
    "Head Coach",
    "Coach One",
    "Assistant Coach",
    "Coach Two",
    "Assistant Coach",
    "Coach Three",
    "Assistant Coach",
    "Coach Four",
    "Assistant Coach",
    "Coach Five",
    "Assistant Coach",
  ];
  const escapedLines = lines.flatMap((line) => [`(${escapePdfText(line)}) Tj`, "T*"]);
  const content = [
    "BT",
    "/F1 3 Tf",
    "44 780 Td",
    "4 TL",
    ...escapedLines,
    "ET",
  ].join("\n");
  return createSimplePdf(content);
}

function playerCells() {
  const names = [
    "Player One",
    "Player Two",
    "Player Three",
    "Player Four",
    "Player Five",
    "Player Six",
    "Player Seven",
    "Player Eight",
    "Player Nine",
    "Player Ten",
    "Player Eleven",
    "Player Twelve",
    "Player Thirteen",
    "Player Fourteen",
    "Player Fifteen",
    "Player Sixteen",
    "Player Seventeen",
    "Player Eighteen",
    "Player Nineteen",
    "Player Twenty",
  ];
  const grades = ["Sr.", "Jr.", "So.", "Fr."];
  return names.flatMap((name, index) => [
    String(index + 1),
    name,
    index % 4 === 0 ? "SS, RHP" : index % 4 === 1 ? "OF" : index % 4 === 2 ? "C, 1B" : "3B",
    grades[index % grades.length],
    `${5 + (index % 2)}'${8 + (index % 4)}"`,
    String(155 + index * 3),
  ]);
}

function createSimplePdf(content) {
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream\nendobj\n`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += object;
  }
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}

function escapePdfText(value) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
