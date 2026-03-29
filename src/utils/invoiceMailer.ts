import PDFDocument from "pdfkit";
import nodemailer from "nodemailer";
import https from "https";
import config from "../config/env";

export interface InvoiceMailInput {
  recipientEmail: string;
  recipientName?: string;
  recipientPhone?: string | null;
  gstNumber?: string | null;
  plan?: string | null;
  userId: number;
  orderId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentProvider: string;
  providerTransactionId?: string | null;
  paidAt?: Date | null;
}

const formatAmount = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "INR"} ${amount.toFixed(2)}`;
  }
};

// ─── PDF table helpers ──────────────────────────────────────────────────────

const BRAND   = "#f4a11a";
const ALT_ROW = "#fff7e8";
const BORDER  = "#e7d0a2";
const TEXT_DIM = "#5f5138";
const DARK_TEXT = "#1f1f1f";

// ── Linkus / Lease platform company details (seller side of invoice) ────────
const LINKUS_COMPANY_NAME = "Linkus Technologies Pvt. Ltd.";
const LINKUS_COMPANY_GST  = process.env.COMPANY_GST || "29AALCL1234A1ZK"; // replace with real GSTIN
const LINKUS_LOGO_URL = "https://linkus-bridge.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Flogo.34e6a895.png&w=96&q=75";
const LINKUS_LOGO_FALLBACK_URL = "https://linkus-bridge.com/_next/static/media/logo.34e6a895.png";

const downloadImageBuffer = (url: string): Promise<Buffer | null> => {
  return new Promise((resolve) => {
    https
      .get(url, (res) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          return resolve(null);
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", () => resolve(null));
  });
};

const downloadFirstAvailableImage = async (urls: string[]): Promise<Buffer | null> => {
  for (const url of urls) {
    const image = await downloadImageBuffer(url);
    if (image) return image;
  }
  return null;
};

/**
 * Draws a two-column data row.  Returns the y position after the row.
 */
const drawRow = (
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  col1W: number,
  col2W: number,
  rowH: number,
  label: string,
  value: string,
  shade = false,
): number => {
  const pad = 8;
  if (shade) {
    doc.rect(x, y, col1W + col2W, rowH).fill(ALT_ROW);
  }
  // borders
  doc.rect(x, y, col1W, rowH).stroke(BORDER);
  doc.rect(x + col1W, y, col2W, rowH).stroke(BORDER);
  // label
  doc
    .fillColor(TEXT_DIM)
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .text(label.toUpperCase(), x + pad, y + rowH / 2 - 6, {
      width: col1W - pad * 2,
      lineBreak: false,
    });
  // value
  doc
    .fillColor("#000")
    .font("Helvetica")
    .fontSize(10)
    .text(value, x + col1W + pad, y + rowH / 2 - 6, {
      width: col2W - pad * 2,
      lineBreak: false,
    });
  return y + rowH;
};

/**
 * Draws a full-width section header row.  Returns y after the row.
 */
const drawSectionHeader = (
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  tableW: number,
  label: string,
  rowH = 26,
): number => {
  doc.rect(x, y, tableW, rowH).fill(BRAND);
  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(10.5)
    .text(label, x + 10, y + rowH / 2 - 6, {
      width: tableW - 20,
      lineBreak: false,
    });
  doc.fillColor("#000").font("Helvetica");
  return y + rowH;
};

// ─── PDF generation ─────────────────────────────────────────────────────────

const generateInvoicePdfBuffer = (input: InvoiceMailInput): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    // Best-effort logo load from Linkus website; invoice still renders if unavailable.
    downloadFirstAvailableImage([LINKUS_LOGO_URL, LINKUS_LOGO_FALLBACK_URL]).then((logoBuffer) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const paidDate  = input.paidAt ? new Date(input.paidAt) : new Date();
    const invoiceId = `INV-${String(input.orderId).slice(-8)}-${input.userId}`;
    const dateStr   = paidDate.toISOString().slice(0, 10);

    const marginX  = 48;
    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const tableW   = doc.page.width - marginX * 2;

    const drawTinyLabel = (label: string, value: string, x: number, y: number, width: number) => {
      doc.fillColor(TEXT_DIM).font("Helvetica-Bold").fontSize(8.5).text(label, x, y, { width });
      doc.fillColor(DARK_TEXT).font("Helvetica").fontSize(10).text(value, x, y + 12, { width });
    };

    // Header badge like reference theme
    doc.roundedRect(marginX, 40, 180, 56, 20).fill(BRAND);
    doc.fillColor(DARK_TEXT).font("Helvetica-Bold").fontSize(22).text("INVOICE", marginX + 18, 58, { lineBreak: false });

    if (logoBuffer) {
      try {
        doc.image(logoBuffer, marginX + tableW - 98, 52, { fit: [88, 34], align: "right" });
      } catch {
        // Ignore invalid image data and continue rendering text-only header.
      }
    }

    doc.fillColor(DARK_TEXT).font("Helvetica-Bold").fontSize(14).text(LINKUS_COMPANY_NAME.toUpperCase(), marginX + 210, 92, {
      width: tableW - 210,
      align: "right",
      lineBreak: false,
    });

    drawTinyLabel("Invoice #", invoiceId, marginX + tableW - 130, 106, 130);
    drawTinyLabel("Date", dateStr, marginX + tableW - 130, 138, 130);

    // Bill to (left)
    doc.fillColor(DARK_TEXT).font("Helvetica-Bold").fontSize(11).text("Bill To", marginX, 116, { lineBreak: false });
    doc.fillColor(DARK_TEXT).font("Helvetica").fontSize(10)
      .text(input.recipientName || "Customer", marginX, 136)
      .text(input.recipientEmail, marginX, 151)
      .text(input.recipientPhone || "N/A", marginX, 166)
      .text(`GST: ${input.gstNumber || "N/A"}`, marginX, 181);

    // Seller block (right)
    doc.fillColor(TEXT_DIM).font("Helvetica-Bold").fontSize(9).text("Billed By", marginX + 220, 162);
    doc.fillColor(DARK_TEXT).font("Helvetica").fontSize(9.5)
      .text(LINKUS_COMPANY_NAME, marginX + 220, 176)
      .text(`GST: ${LINKUS_COMPANY_GST}`, marginX + 220, 190);

    // Itemized table (reference style)
    const tableX = marginX;
    let tableY = 230;
    const colNo = 40;
    const colItem = 245;
    const colPrice = 88;
    const colQty = 55;
    const colTotal = tableW - (colNo + colItem + colPrice + colQty);
    const headerH = 24;
    const rowH = 28;

    doc.rect(tableX, tableY, tableW, headerH).fill(BRAND);
    doc.fillColor(DARK_TEXT).font("Helvetica-Bold").fontSize(9.5)
      .text("No.", tableX + 8, tableY + 8, { width: colNo - 12, align: "left" })
      .text("Item", tableX + colNo + 8, tableY + 8, { width: colItem - 12, align: "left" })
      .text("Price", tableX + colNo + colItem + 4, tableY + 8, { width: colPrice - 8, align: "right" })
      .text("Qty", tableX + colNo + colItem + colPrice + 4, tableY + 8, { width: colQty - 8, align: "right" })
      .text("Total", tableX + colNo + colItem + colPrice + colQty + 4, tableY + 8, { width: colTotal - 8, align: "right" });

    tableY += headerH;
    doc.rect(tableX, tableY, tableW, rowH).fill(ALT_ROW);
    doc.rect(tableX, tableY, tableW, rowH).stroke(BORDER);

    const itemName = input.plan || "Service Payment";
    const amountText = formatAmount(input.amount, input.currency);
    doc.fillColor(DARK_TEXT).font("Helvetica").fontSize(9.5)
      .text("1", tableX + 8, tableY + 9, { width: colNo - 12, align: "left" })
      .text(itemName, tableX + colNo + 8, tableY + 9, { width: colItem - 12, align: "left" })
      .text(amountText, tableX + colNo + colItem + 4, tableY + 9, { width: colPrice - 8, align: "right" })
      .text("1", tableX + colNo + colItem + colPrice + 4, tableY + 9, { width: colQty - 8, align: "right" })
      .text(amountText, tableX + colNo + colItem + colPrice + colQty + 4, tableY + 9, { width: colTotal - 8, align: "right" });

    // Payment and transaction details block
    const detailsY = tableY + rowH + 24;
    doc.fillColor(DARK_TEXT).font("Helvetica-Bold").fontSize(10).text("Payment Info", tableX, detailsY);
    doc.fillColor(TEXT_DIM).font("Helvetica").fontSize(9)
      .text(`Method: ${input.paymentMethod.toUpperCase()}`, tableX, detailsY + 16)
      .text(`Provider: ${input.paymentProvider.toUpperCase()}`, tableX, detailsY + 30)
      .text(`Txn ID: ${input.providerTransactionId || "N/A"}`, tableX, detailsY + 44)
      .text(`Order ID: ${input.orderId}`, tableX, detailsY + 58)
      .text(`User ID: ${input.userId}`, tableX, detailsY + 72);

    // Totals box on right
    const totalsX = marginX + tableW - 190;
    const totalsY = detailsY + 8;
    const totalsW = 190;
    const tRow = 24;

    doc.rect(totalsX, totalsY, totalsW, tRow).fill("#fff3dd");
    doc.rect(totalsX, totalsY + tRow, totalsW, tRow).fill("#fff8ec");
    doc.rect(totalsX, totalsY + tRow * 2, totalsW, tRow + 2).fill("#efefef");
    doc.rect(totalsX, totalsY, totalsW, tRow * 3 + 2).stroke(BORDER);

    doc.fillColor(DARK_TEXT).font("Helvetica").fontSize(10)
      .text("Subtotal", totalsX + 10, totalsY + 7)
      .text("Taxes", totalsX + 10, totalsY + tRow + 7)
      .font("Helvetica-Bold")
      .text("TOTAL", totalsX + 10, totalsY + tRow * 2 + 7);

    doc.fillColor(DARK_TEXT).font("Helvetica").fontSize(10)
      .text(amountText, totalsX + 100, totalsY + 7, { width: 80, align: "right" })
      .text(formatAmount(0, input.currency), totalsX + 100, totalsY + tRow + 7, { width: 80, align: "right" })
      .font("Helvetica-Bold")
      .text(amountText, totalsX + 100, totalsY + tRow * 2 + 7, { width: 80, align: "right" });

    // Notes and signature line
    const notesY = totalsY + tRow * 3 + 26;
    doc.fillColor(TEXT_DIM).font("Helvetica-Bold").fontSize(9).text("Term & Condition", marginX, notesY);
    doc.fillColor(TEXT_DIM).font("Helvetica").fontSize(8.5).text(
      "This is a system-generated invoice. Amount shown is inclusive of applicable platform charges.",
      marginX,
      notesY + 12,
      { width: tableW - 210 }
    );

    const signX = marginX + tableW - 165;
    const signY = notesY + 32;
    doc.moveTo(signX, signY).lineTo(signX + 150, signY).stroke("#777777");
    doc.fillColor(TEXT_DIM).font("Helvetica").fontSize(8).text("Authorized Sign", signX + 64, signY + 4, { width: 84, align: "right" });

    // Bottom orange strip
    const footerH = 22;
    doc.rect(0, pageH - footerH, pageW, footerH).fill(BRAND);
    doc.fillColor(DARK_TEXT).font("Helvetica").fontSize(8.5).text(
      "support@linkus-bridge.com   |   www.linkus-bridge.com   |   +91-00000-00000",
      marginX,
      pageH - 15,
      { width: tableW, align: "center", lineBreak: false }
    );

    doc.end();
    }).catch(() => {
      // Fallback render path if logo download throws unexpectedly.
      const doc = new PDFDocument({ size: "A4", margin: 48 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc
        .font("Helvetica-Bold")
        .fontSize(20)
        .fillColor(DARK_TEXT)
        .text("INVOICE", 48, 58, { lineBreak: false });
      doc.end();
    });
  });
};

export const sendPaymentInvoiceEmail = async (
  input: InvoiceMailInput
): Promise<{ messageId?: string | null }> => {
  if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS || !config.SMTP_FROM) {
    throw new Error("SMTP configuration missing for invoice email");
  }

  const pdfBuffer = await generateInvoicePdfBuffer(input);
  const smtpPort = Number(config.SMTP_PORT || 587);

  const transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: config.SMTP_FROM,
    to: input.recipientEmail,
    subject: `Payment Invoice - Order ${input.orderId}`,
    text: "Your payment was successful. Please find your billing invoice attached.",
    attachments: [
      {
        filename: `invoice-${input.orderId}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  return { messageId: info?.messageId || null };
};
