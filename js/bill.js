const STORE = {
  name: "Gifty Hamper",
  address: "49/1/19, 4th Cross Magadi main road, Bengaluru, Karnataka, 560091",
  phone: "+91 94485 88793",
  email: "Info@giftyhamper.com",
  logo: "assets/gifty-hampers-landscape.png"
};

const money = (value) => "INR " + new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0
}).format(Number(value) || 0);

function escapeText(value) {
  return String(value ?? "").replace(/[&<>"]/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"
  }[char]));
}

function formatBillDate(value) {
  let date = value;
  if (value?.toDate) date = value.toDate();
  if (!(date instanceof Date)) date = new Date(date || Date.now());

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date) + " IST";
}

function getJsPdf() {
  if (!window.jspdf?.jsPDF) {
    throw new Error("PDF generator is still loading. Please try again.");
  }
  return window.jspdf.jsPDF;
}

async function imageToDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to load store logo.");
  const blob = await response.blob();

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function generateBillPdf(sale) {
  const jsPDF = getJsPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageWidth = 210;
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  try {
    const logo = await imageToDataUrl(new URL(STORE.logo, window.location.href).href);
    doc.addImage(logo, "PNG", margin, y, 46, 18);
  } catch (error) {
    console.warn("Bill logo could not be loaded:", error);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(STORE.name, margin, y + 10);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(STORE.address, margin, y + 24);
  doc.text(STORE.phone + "  |  " + STORE.email, margin, y + 29);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text("SALES INVOICE", pageWidth - margin, y + 6, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Bill No: " + (sale.orderId || sale.id || "GH-SALE"), pageWidth - margin, y + 13, { align: "right" });
  doc.text("Date: " + formatBillDate(sale.createdAt), pageWidth - margin, y + 18, { align: "right" });
  doc.text("Seller: " + (sale.sellerEmail || "—"), pageWidth - margin, y + 23, { align: "right" });

  y += 39;
  doc.setDrawColor(225, 215, 222);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Bill details", margin, y);
  y += 7;

  const items = Array.isArray(sale.items) ? sale.items : [];
  const columns = [
    { x: margin, width: 74, title: "Product" },
    { x: margin + 74, width: 24, title: "Qty" },
    { x: margin + 98, width: 32, title: "Unit price" },
    { x: margin + 130, width: 48, title: "Amount" }
  ];

  doc.setFillColor(247, 243, 246);
  doc.rect(margin, y - 5, contentWidth, 9, "F");
  doc.setFontSize(8);
  columns.forEach(column => doc.text(column.title, column.x + 2, y));

  y += 8;
  doc.setFont("helvetica", "normal");

  for (const item of items) {
    const name = String(item.productName || item.productId || "Product");
    const wrapped = doc.splitTextToSize(name, columns[0].width - 4);
    const rowHeight = Math.max(7, wrapped.length * 4.5);

    if (y + rowHeight > 270) {
      doc.addPage();
      y = 20;
    }

    doc.text(wrapped, columns[0].x + 2, y);
    doc.text(String(item.quantity || 0), columns[1].x + 2, y);
    doc.text(money(item.unitPrice), columns[2].x + 2, y);
    doc.text(money(item.lineTotal), columns[3].x + 2, y);

    y += rowHeight;
    doc.setDrawColor(240, 233, 237);
    doc.line(margin, y - 2, pageWidth - margin, y - 2);
    y += 3;
  }

  y += 6;
  const totalQuantity = Number(sale.totalQuantity) || items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const total = Number(sale.total) || items.reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Total items", pageWidth - margin - 55, y);
  doc.text(String(totalQuantity), pageWidth - margin, y, { align: "right" });
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Grand Total", pageWidth - margin - 55, y);
  doc.text(money(total), pageWidth - margin, y, { align: "right" });

  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Thank you for choosing Gifty Hamper.", margin, y);
  doc.text("This bill is generated electronically from the Gifty Hamper sales system.", margin, y + 5);

  const blob = doc.output("blob");
  return {
    blob,
    filename: (sale.orderId || sale.id || "gifty-hamper-bill") + ".pdf"
  };
}

export async function showBillPdf(sale) {
  const result = await generateBillPdf(sale);
  const url = URL.createObjectURL(result.blob);

  const old = document.querySelector(".bill-modal");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.className = "bill-modal";
  modal.innerHTML = `
    <div class="bill-modal-backdrop" data-close-bill></div>
    <section class="bill-modal-card" role="dialog" aria-modal="true" aria-label="Sales bill">
      <header class="bill-modal-head">
        <div>
          <p class="eyebrow">Generated bill</p>
          <h2>${escapeText(result.filename)}</h2>
        </div>
        <button class="bill-close" type="button" data-close-bill aria-label="Close">×</button>
      </header>
      <iframe class="bill-preview" title="Generated sales bill" src="${url}"></iframe>
      <footer class="bill-modal-actions">
        <button class="admin-secondary" type="button" data-close-bill>Close</button>
        <button class="admin-secondary" type="button" data-print-bill>Print PDF</button>
        <a class="admin-primary bill-download" href="${url}" download="${escapeText(result.filename)}">Download PDF</a>
      </footer>
    </section>
  `;

  document.body.appendChild(modal);

  const close = () => {
    modal.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  modal.querySelectorAll("[data-close-bill]").forEach(button => {
    button.addEventListener("click", close);
  });

  modal.querySelector("[data-print-bill]").addEventListener("click", () => {
    const frame = modal.querySelector(".bill-preview");
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  });
}
