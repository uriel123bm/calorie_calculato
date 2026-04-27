import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * Render a DOM node into a multi-page PDF.
 *
 * Hebrew/RTL fonts are notoriously hard to embed in jsPDF; rasterizing the
 * already-rendered DOM with html2canvas sidesteps this and yields perfect
 * Hebrew rendering exactly as it appears on screen.
 */
export async function exportNodeToPdf(
  node: HTMLElement,
  filename: string
): Promise<void> {
  const canvas = await html2canvas(node, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;

  const pxPerMm = canvas.width / usableWidth;
  const usableHeightPx = (pageHeight - margin * 2) * pxPerMm;

  let renderedPx = 0;
  let pageIndex = 0;

  while (renderedPx < canvas.height) {
    const sliceHeightPx = Math.min(usableHeightPx, canvas.height - renderedPx);

    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeightPx;
    const ctx = sliceCanvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to acquire 2D context for PDF slicing");
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    ctx.drawImage(
      canvas,
      0,
      renderedPx,
      canvas.width,
      sliceHeightPx,
      0,
      0,
      canvas.width,
      sliceHeightPx
    );

    const sliceData = sliceCanvas.toDataURL("image/png");
    const sliceHeightMm = sliceHeightPx / pxPerMm;

    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(
      sliceData,
      "PNG",
      margin,
      margin,
      usableWidth,
      sliceHeightMm,
      undefined,
      "FAST"
    );

    renderedPx += sliceHeightPx;
    pageIndex += 1;
  }

  // Fallback to original full-image embed when slicing produced nothing.
  if (pageIndex === 0) {
    pdf.addImage(imgData, "PNG", margin, margin, usableWidth, usableWidth);
  }

  pdf.save(filename);
}
