import type { Decision } from "@/lib/types";
import { poTotal } from "@/lib/types";
import { getAgent } from "@/lib/agents";

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * A real, downloadable PDF for one decision — not a mockup of one.
 *
 * Everything on the page is read straight off the `Decision` that was already written to
 * the log: the same PO, the same six check verdicts, the same card. There's nothing here
 * a viewer couldn't get by reading the provenance panel — this just makes it something you
 * can hand to someone who wasn't looking at the screen.
 *
 * jsPDF is loaded on demand rather than imported at the top — it's a ~120KB dependency
 * that only the person who clicks "Download PDF" should ever pay for.
 */
export async function generateReceipt(decision: Decision) {
  const { jsPDF } = await import("jspdf");
  const { po, checks, outcome, card, ruleVersion, createdAt, id } = decision;
  const agent = getAgent(decision.agent);
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 54;
  const pageWidth = doc.internal.pageSize.getWidth();
  const right = pageWidth - margin;
  let y = 64;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Mandate — Purchase Receipt", margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(`Decision ${id}`, right, y - 20, { align: "right" });
  doc.text(new Date(createdAt).toLocaleString(), right, y - 6, { align: "right" });
  doc.setTextColor(0, 0, 0);

  y += 18;
  doc.setDrawColor(225, 225, 230);
  doc.line(margin, y, right, y);

  y += 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(po.poNumber, margin, y);
  doc.text(dollars(poTotal(po)), right, y, { align: "right" });

  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 95);
  doc.text(`${po.quantity} x ${po.sku} from ${po.vendor}  ·  ${po.costCentre}`, margin, y);
  y += 14;
  doc.text(`Requested by ${agent.name}, ${agent.role.toLowerCase()} (${agent.id})`, margin, y);
  doc.setTextColor(0, 0, 0);

  y += 26;
  const statusLabel =
    outcome === "approved" ? "APPROVED — CARD ISSUED" : outcome === "held" ? "HELD FOR APPROVAL" : "REFUSED";
  const statusColor: [number, number, number] =
    outcome === "approved" ? [15, 157, 88] : outcome === "held" ? [183, 121, 31] : [224, 25, 63];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...statusColor);
  doc.text(statusLabel, margin, y);
  doc.setTextColor(0, 0, 0);

  if (card) {
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(
      `Card ....${card.last4}  ·  limit ${dollars(card.limitCents)}  ·  expires ${card.expiresAt.slice(0, 10)}`,
      margin,
      y
    );
    if (card.rainSettlement) {
      y += 14;
      doc.text(
        `Rain sandbox settlement: ${card.rainSettlement.transactionId}  ·  ${card.rainSettlement.merchantName}`,
        margin,
        y
      );
    }
  }

  y += 28;
  doc.setFillColor(244, 244, 247);
  doc.rect(margin, y, right - margin, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`CHECKS AGAINST POLICY V${ruleVersion}`, margin + 8, y + 15);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  for (const c of checks) {
    y += 20;
    if (y > 720) {
      doc.addPage();
      y = 64;
    }
    const mark = c.skipped ? "-" : c.passed ? "PASS" : "FAIL";
    const markColor: [number, number, number] = c.skipped
      ? [150, 150, 150]
      : c.passed
        ? [15, 157, 88]
        : [224, 25, 63];
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...markColor);
    doc.text(mark, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(c.label, margin + 42, y);
    doc.setTextColor(120, 120, 125);
    const reasonLines = doc.splitTextToSize(c.reason, right - margin - 42);
    doc.text(reasonLines[0], margin + 42, y + 12);
    if (reasonLines[0] !== c.reason) y += 12;
    doc.setTextColor(0, 0, 0);
  }

  y += 34;
  if (y > 700) {
    doc.addPage();
    y = 64;
  }
  doc.setDrawColor(210, 210, 215);
  doc.line(margin, y, right, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 135);
  doc.text(
    "Auto-generated from the append-only decision log. Not a legal invoice — a record of why this purchase was allowed to happen.",
    margin,
    y
  );

  doc.save(`mandate-receipt-${po.poNumber}.pdf`);
}
