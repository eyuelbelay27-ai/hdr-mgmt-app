"use client";

import { addisToday } from "@/lib/ethiopian";
import { ecShort, gcShort, money, type CbPeriodData, type CbSettings } from "@/lib/cashbook";

// jsPDF ships with the app (public/pricing-assets) and loads on first use.
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
const safe = (s: string) => String(s ?? "").replace(/−/g, "-").replace(/[^\x00-\xFF–—‘’“”…]/g, "?");

/** Cash Book statement on A4: summary boxes, the ledger table, bank totals and signature lines. */
export async function downloadCashBookPdf(p: CbPeriodData, from: string, to: string, s: CbSettings): Promise<void> {
  await loadJsPdf();
  const png = await logoDataUrl();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = new window.jspdf!.jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 14, CR = [196, 22, 67], INK = [23, 18, 26], GR = [94, 85, 96], GREEN = [22, 122, 80];
  const tx = (t: string, x: number, y: number, o?: object) => doc.text(safe(t), x, y, o);

  const header = () => {
    if (png) doc.addImage(png, "PNG", M, 11, 16, 15.7);
    doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(13); tx(s.company, M + 20, 17);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GR); doc.text(doc.splitTextToSize(safe(s.address), 95), M + 20, 22);
    doc.setTextColor(...CR); doc.setFont("helvetica", "bold"); doc.setFontSize(16); tx("CASH BOOK", W - M, 17, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...GR);
    tx(`${gcShort(from)} – ${gcShort(to)} (GC)`, W - M, 22, { align: "right" });
    tx(`${ecShort(from)} – ${ecShort(to)} (EC)`, W - M, 26, { align: "right" });
    doc.setDrawColor(...CR); doc.setLineWidth(0.8); doc.line(M, 30, W - M, 30);
  };
  header();

  const boxes: [string, number, number[]][] = [["Opening balance", p.open, INK], ["Total cash in", p.tin, GREEN], ["Total cash out", p.tout, CR], ["Closing balance", p.close, INK]];
  const bw = (W - 2 * M - 9) / 4;
  boxes.forEach(([l, v, c], i) => {
    const x = M + i * (bw + 3);
    doc.setFillColor(247, 241, 242); doc.roundedRect(x, 34, bw, 15, 2, 2, "F");
    doc.setFontSize(7); doc.setTextColor(...GR); doc.setFont("helvetica", "normal"); tx(l.toUpperCase(), x + 3, 39.5);
    doc.setFontSize(11); doc.setTextColor(...c); doc.setFont("helvetica", "bold"); tx((v < 0 ? "-" : "") + money(v), x + 3, 46);
  });

  // ledger table
  const cols = [
    { h: "Date (GC/EC)", w: 22 }, { h: "Ref", w: 16 }, { h: "Description", w: 0 }, { h: "Bank / Category", w: 34 },
    { h: "Cash In", w: 22, r: true }, { h: "Cash Out", w: 22, r: true }, { h: "Balance", w: 24, r: true },
  ];
  cols[2].w = W - 2 * M - cols.reduce((a, c) => a + c.w, 0);
  const xs: number[] = [];
  cols.reduce((x, c) => { xs.push(x); return x + c.w; }, M);
  let y = 54;
  const head = () => {
    doc.setFillColor(...CR); doc.rect(M, y, W - 2 * M, 7, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
    cols.forEach((c, i) => tx(c.h, c.r ? xs[i] + c.w - 1.8 : xs[i] + 1.8, y + 4.7, c.r ? { align: "right" } : undefined));
    y += 7;
  };
  const bal = (v: number) => (v < 0 ? "-" : "") + money(v);
  type Cell = string | string[];
  const row = (cells: Cell[], opt: { fill?: number[]; bold?: boolean } = {}) => {
    const wrapped = cells.map((c, i) => (Array.isArray(c) ? c : (doc.splitTextToSize(safe(c), cols[i].w - 3.6) as string[]).slice(0, 3)));
    const h = Math.max(...wrapped.map((l) => l.length)) * 3.4 + 3;
    if (y + h > 270) { doc.addPage(); header(); y = 36; head(); }
    if (opt.fill) { doc.setFillColor(...opt.fill); doc.rect(M, y, W - 2 * M, h, "F"); }
    doc.setFont("helvetica", opt.bold ? "bold" : "normal"); doc.setFontSize(8);
    wrapped.forEach((lines, i) => {
      const c = cols[i];
      lines.forEach((ln, j) => {
        doc.setTextColor(...(i === 0 && j === 1 ? GR : INK));
        doc.text(safe(ln), c.r ? xs[i] + c.w - 1.8 : xs[i] + 1.8, y + 4.2 + j * 3.4, c.r ? { align: "right" } : undefined);
      });
    });
    doc.setDrawColor(236, 228, 230); doc.setLineWidth(0.2); doc.line(M, y + h, W - M, y + h);
    y += h;
  };
  head();
  row([[gcShort(from), ecShort(from)], "", "Opening balance", "", "", "", bal(p.open)], { bold: true });
  p.rows.forEach((e, i) =>
    row(
      [[gcShort(e.date), ecShort(e.date)], e.ref ?? "", e.description, [e.bank, e.category].filter(Boolean).join(" · "), e.type === "in" ? money(e.amount) : "", e.type === "out" ? money(e.amount) : "", bal(e.bal)],
      i % 2 ? { fill: [251, 247, 248] } : {},
    ),
  );
  doc.setDrawColor(...CR); doc.setLineWidth(0.5); doc.line(M, y, W - M, y);
  row(["Totals", "", "", "", money(p.tin), money(p.tout), bal(p.close)], { fill: [247, 241, 242], bold: true });

  // bank summary
  const banks = Object.entries(p.byBank);
  if (banks.length) {
    y += 8;
    if (y + 10 + banks.length * 6 > 270) { doc.addPage(); header(); y = 40; }
    const bx = [M, M + 50, M + 75], bwid = 100;
    doc.setFillColor(138, 15, 48); doc.rect(M, y, bwid, 6.5, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
    tx("Bank", bx[0] + 1.8, y + 4.4); tx("Cash In", bx[1] + 23, y + 4.4, { align: "right" }); tx("Cash Out", bx[2] + 23, y + 4.4, { align: "right" });
    y += 6.5;
    doc.setFont("helvetica", "normal"); doc.setTextColor(...INK);
    for (const [b, v] of banks) {
      tx(doc.splitTextToSize(safe(b), 46)[0], bx[0] + 1.8, y + 4.2);
      tx(v.in ? money(v.in) : "", bx[1] + 23, y + 4.2, { align: "right" });
      tx(v.out ? money(v.out) : "", bx[2] + 23, y + 4.2, { align: "right" });
      doc.setDrawColor(236, 228, 230); doc.line(M, y + 6, M + bwid, y + 6);
      y += 6;
    }
  }

  // signatures
  if (y > 255) { doc.addPage(); header(); y = 45; }
  y = Math.max(y + 16, 258);
  const cw = (W - 2 * M - 16) / 3;
  ["Prepared by" + (s.preparedBy ? `: ${s.preparedBy}` : ""), "Checked by", "Approved by"].forEach((t, i) => {
    const x = M + i * (cw + 8);
    doc.setDrawColor(...INK); doc.setLineWidth(0.3); doc.line(x, y, x + cw, y);
    doc.setFontSize(8); doc.setTextColor(...GR); doc.setFont("helvetica", "normal"); tx(t, x, y + 4.5); tx("Signature & date", x, y + 8.5);
  });

  const today = addisToday();
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(...GR);
    tx(`Generated ${gcShort(today)} (${ecShort(today)} EC)`, M, 290); tx(`Page ${i} of ${n}`, W - M, 290, { align: "right" });
  }
  doc.save(`Hadar-Cash-Book_${from}_to_${to}.pdf`);
}

/** All entries as a spreadsheet file. */
export function downloadCashBookCsv(rows: { date: string; type: "in" | "out"; amount: number; description: string; bank: string; category: string | null; ref: string | null; createdBy: string }[]) {
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [["Date (GC)", "Date (EC)", "Type", "Amount", "Description", "Bank", "Category", "Ref", "Recorded by"].join(",")].concat(
    rows.map((e) => [e.date, ecShort(e.date), e.type === "in" ? "Cash In" : "Cash Out", e.amount, e.description, e.bank, e.category, e.ref, e.createdBy].map(q).join(",")),
  );
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Hadar-Cash-Book-backup_${addisToday()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
