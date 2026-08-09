import type { Decision } from "@/lib/types";
import { poTotal } from "@/lib/types";
import { getAgent } from "@/lib/agents";

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

type RGB = [number, number, number];
const INK: RGB = [28, 31, 42];
const MUTED: RGB = [104, 109, 123];
const EDGE: RGB = [228, 229, 235];
const RAIN: RGB = [222, 61, 119];
const PASS: RGB = [17, 132, 77];
const HOLD: RGB = [165, 101, 18];
const FAIL: RGB = [199, 48, 70];

function outcomeCopy(decision: Decision) {
  if (decision.outcome === "approved") {
    return {
      title: "Order receipt",
      status: "ORDER APPROVED",
      color: PASS,
      message: "Payment authority was issued only for this verified order.",
      filename: `mandate-order-${decision.po.poNumber}.pdf`,
    };
  }
  if (decision.outcome === "held") {
    return {
      title: "Approval brief",
      status: "AWAITING APPROVAL",
      color: HOLD,
      message: "No payment authority or card was issued. This order needs a person with more authority.",
      filename: `mandate-approval-${decision.po.poNumber}.pdf`,
    };
  }
  return {
    title: "Decision record",
    status: "ORDER STOPPED",
    color: FAIL,
    message: "No payment authority or card was issued. The request did not satisfy the mandate.",
    filename: `mandate-decision-${decision.po.poNumber}.pdf`,
  };
}

function line(doc: import("jspdf").jsPDF, x1: number, y: number, x2: number) {
  doc.setDrawColor(...EDGE);
  doc.line(x1, y, x2, y);
}

function label(doc: import("jspdf").jsPDF, text: string, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(text.toUpperCase(), x, y);
}

/**
 * Download the customer-facing document for a decision.
 *
 * Approved orders receive a compact receipt. Held or refused orders receive a decision
 * record instead: calling either one an invoice would imply that money moved when the
 * whole point of Mandate is that it did not. Raw database IDs, per-check internals, and
 * card lifecycle variables remain in the Proof view rather than cluttering this document.
 */
export async function generateReceipt(decision: Decision) {
  const { jsPDF } = await import("jspdf");
  const { po, checks, card, ruleVersion, createdAt } = decision;
  const agent = getAgent(decision.agent);
  const copy = outcomeCopy(decision);
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 54;
  const right = doc.internal.pageSize.getWidth() - margin;
  const width = right - margin;
  let y = 58;

  // Brand header
  doc.setFillColor(...RAIN);
  doc.roundedRect(margin, y - 15, 24, 24, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("M", margin + 7, y + 1);
  doc.setTextColor(...INK);
  doc.setFontSize(14);
  doc.text("Mandate", margin + 33, y + 1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("safe autonomous spending", margin + 33, y + 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...copy.color);
  doc.text(copy.status, right, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(new Date(createdAt).toLocaleDateString(undefined, DATE_OPTIONS), right, y + 14, { align: "right" });

  y += 48;
  line(doc, margin, y, right);
  y += 38;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(25);
  doc.setTextColor(...INK);
  doc.text(copy.title, margin, y);
  doc.setFontSize(22);
  doc.text(dollars(poTotal(po)), right, y, { align: "right" });
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...MUTED);
  const messageLines = doc.splitTextToSize(copy.message, width);
  doc.text(messageLines, margin, y);
  y += messageLines.length * 13 + 26;

  // Order summary
  doc.setFillColor(249, 249, 251);
  doc.roundedRect(margin, y, width, 104, 8, 8, "F");
  label(doc, "Order reference", margin + 16, y + 22);
  label(doc, "Cost centre", margin + width * 0.54, y + 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(po.poNumber, margin + 16, y + 39);
  doc.text(po.costCentre, margin + width * 0.54, y + 39);
  line(doc, margin + 16, y + 52, right - 16);
  label(doc, "Item", margin + 16, y + 70);
  label(doc, "Quantity", margin + width * 0.54, y + 70);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  doc.text(po.sku, margin + 16, y + 87);
  doc.text(`${po.quantity} x ${dollars(po.unitPrice)}`, margin + width * 0.54, y + 87);
  y += 132;

  label(doc, "Supplier", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(po.vendor, margin, y + 17);
  label(doc, "Handled by", margin + width * 0.54, y);
  doc.text(agent.name, margin + width * 0.54, y + 17);
  y += 46;
  line(doc, margin, y, right);
  y += 28;

  if (decision.outcome === "approved") {
    label(doc, "Payment authority", margin, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...PASS);
    doc.text(card ? `Rain sandbox card ending ${card.last4}` : "Order approved", margin, y + 17);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    const settlement = card?.rainSettlement ? "Rain sandbox settlement recorded." : "Sandbox settlement is not recorded for this order.";
    doc.text(settlement, margin, y + 33);
    y += 61;
    line(doc, margin, y, right);
    y += 27;
    label(doc, "Mandate check", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    const passed = checks.filter((check) => check.passed && !check.skipped).length;
    const checked = checks.filter((check) => !check.skipped).length;
    doc.text(`${passed} of ${checked} policy checks passed under policy v${ruleVersion}.`, margin, y + 17);
  } else {
    label(doc, decision.outcome === "held" ? "Why approval is needed" : "Why the request stopped", margin, y);
    const blockers = checks.filter((check) => !check.skipped && (!check.passed || check.escalates));
    y += 18;
    for (const blocker of blockers.slice(0, 3)) {
      doc.setFillColor(...copy.color);
      doc.circle(margin + 4, y - 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      doc.text(blocker.label, margin + 15, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...MUTED);
      const reason = doc.splitTextToSize(blocker.reason, width - 15);
      doc.text(reason, margin + 15, y + 13);
      y += 24 + reason.length * 11;
    }
  }

  const footerY = 735;
  line(doc, margin, footerY, right);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(
    decision.outcome === "approved"
      ? "Rain sandbox document. This is not a legal invoice and no real money moved."
      : "Decision record from Mandate. No payment instrument was created.",
    margin,
    footerY + 15
  );

  doc.save(copy.filename);
}
