"use client";

import { addisToday } from "@/lib/ethiopian";
import { ethStr, gregStr, money, type plData } from "@/lib/pnl";

type PlData = ReturnType<typeof plData>;
// jsPDF ships with the app (public/pricing-assets) and loads on first use.
type JsPdfDoc = {
  [k: string]: (...a: never[]) => unknown;
};
declare global {
  interface Window {
    jspdf?: { jsPDF: new (o: { unit: string; format: string }) => JsPdfDoc };
  }
}

const ADDR = "Hayahulet, Bata Complex Building, 2nd Floor, Addis Ababa";
const TEL = "Tel: 0947431247 / 0993649461";
const COMPANY = "HADAR TRADING PLC";

function loadJsPdf(): Promise<void> {
  if (window.jspdf) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/pricing-assets/jspdf.umd.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("jsPDF did not load"));
    document.head.appendChild(s);
  });
}

async function logoDataUrl(): Promise<string | null> {
  try {
    const blob = await (await fetch("/brand/hadar-mark.png")).blob();
    return await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => res(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const safe = (s: string) => String(s).replace(/−/g, "-").replace(/[^\x00-\xFF–—‘’“”…]/g, "?");
const amt = (v: number) => (v < 0 ? "-" : "") + money(v);

/** Profit & Loss statement on A4, like the original ledger app's PDF. */
export async function downloadPlPdf(d: PlData): Promise<void> {
  await loadJsPdf();
  const png = await logoDataUrl();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = new window.jspdf!.jsPDF({ unit: "mm", format: "a4" });
  const L = 18, R = 192, CR = [196, 22, 67], INK = [29, 21, 24], MU = [118, 105, 109];
  let y = 16;
  const tx = (t: string, x: number, yy: number, o?: object) => doc.text(safe(t), x, yy, o);
  const need = (h: number) => { if (y + h > 280) { doc.addPage(); y = 20; } };
  const today = addisToday();

  if (png) doc.addImage(png, "PNG", L, y, 18, 17.7);
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...CR); tx(COMPANY, L + 23, y + 6.5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...MU); tx(ADDR, L + 23, y + 11.5); tx(TEL, L + 23, y + 16);
  y += 22; doc.setDrawColor(...CR); doc.setLineWidth(0.8); doc.line(L, y, R, y); y += 10;
  doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(16); tx("Profit & Loss Statement", L, y); y += 6.5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...MU);
  tx(`Period: ${d.label.t} (${d.label.s})`, L, y); y += 5;
  tx(`Prepared: ${ethStr(today)} (${gregStr(today)})   |   Amounts in ETB`, L, y); y += 10;

  const section = (title: string, s: PlData["inc"]) => {
    need(16); doc.setFillColor(...CR); doc.rect(L, y - 5, R - L, 7.5, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(10); tx(title.toUpperCase(), L + 3, y); y += 8.5;
    if (!s.rows.length) { doc.setTextColor(...MU); doc.setFont("helvetica", "italic"); doc.setFontSize(9); tx("Nothing recorded", L + 3, y); y += 7; }
    for (const r of s.rows) {
      need(14); doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
      tx(r.name, L + 1, y); tx(amt(r.total), R - 1, y, { align: "right" }); y += 5.5;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
      for (const e of r.entries) {
        need(6); doc.setTextColor(...MU); tx(ethStr(e.date), L + 4, y); tx(gregStr(e.date), L + 30, y);
        const lines: string[] = doc.splitTextToSize(safe(e.note + (e.ref ? " | " + e.ref : "")), R - L - 82);
        doc.setTextColor(...INK); doc.text(lines[0] + (lines.length > 1 ? "..." : ""), L + 53, y);
        doc.setTextColor(...MU); tx(amt(e.v), R - 1, y, { align: "right" }); y += 4.6;
      }
      doc.setDrawColor(236, 226, 229); doc.setLineWidth(0.2); doc.line(L, y - 1.5, R, y - 1.5); y += 4;
    }
    need(10); doc.setFillColor(252, 235, 240); doc.rect(L, y - 4.8, R - L, 7, "F");
    doc.setTextColor(...CR); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    tx("Total " + title.toLowerCase(), L + 3, y); tx(amt(s.tot), R - 1, y, { align: "right" }); y += 13;
  };
  section("Income", d.inc);
  section("Expenses", d.exp);
  need(16); doc.setFillColor(...CR); doc.roundedRect(L, y - 6, R - L, 12, 2, 2, "F"); doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); tx(d.net >= 0 ? "NET PROFIT" : "NET LOSS", L + 4, y + 1.5);
  doc.setFontSize(14); tx("ETB " + amt(d.net), R - 4, y + 1.5, { align: "right" });

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setDrawColor(...CR); doc.setLineWidth(0.4); doc.line(L, 286, R, 286);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MU);
    tx(`Hadar Trading PLC  |  Profit & Loss Statement  |  ${d.label.t}`, L, 290.5); tx(`Page ${i} of ${n}`, R, 290.5, { align: "right" });
  }
  doc.save(`Hadar-PL-${d.label.t.replace(/\s+/g, "-")}.pdf`);
}
