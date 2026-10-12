export function pdfFilename(contentDisposition: string | undefined, staffId: number): string {
  const name = contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1]?.trim();
  return name || `staff-${staffId}.pdf`;
}
