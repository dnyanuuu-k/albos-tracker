import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export type ExportFormat = 'csv' | 'excel' | 'json' | 'pdf';
export type ColumnDef = {
  key: string;
  label: string;
  format?: (value: any) => string;
};

/**
 * Convert data to CSV format
 */
export function exportToCSV(
  data: any[],
  columns: ColumnDef[],
  filename: string = 'export'
): void {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  // Create CSV header
  const headers = columns.map(col => col.label);
  const csvRows = [headers.join(',')];

  // Add data rows
  for (const row of data) {
    const values = columns.map(col => {
      const value = row[col.key];
      const formatted = col.format ? col.format(value) : value;
      // Escape quotes and wrap in quotes if contains comma
      const strValue = String(formatted ?? '');
      if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
        return `"${strValue.replace(/"/g, '""')}"`;
      }
      return strValue;
    });
    csvRows.push(values.join(','));
  }

  // Create blob and download
  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Convert data to Excel format
 */
export function exportToExcel(
  data: any[],
  columns: ColumnDef[],
  filename: string = 'export',
  sheetName: string = 'Sheet1'
): void {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  // Create worksheet with headers and data
  const headers = columns.map(col => col.label);
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      return col.format ? col.format(value) : value;
    })
  );

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Auto-size columns
  const colWidths = headers.map((header, i) => {
    const maxWidth = Math.max(
      header.length,
      ...rows.map(row => String(row[i] ?? '').length)
    );
    return { wch: Math.min(maxWidth + 2, 50) };
  });
  worksheet['!cols'] = colWidths;

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Download
  XLSX.writeFile(workbook, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

/**
 * Convert data to JSON format
 */
export function exportToJSON(
  data: any[],
  filename: string = 'export'
): void {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Convert data to PDF format
 */
export function exportToPDF(
  data: any[],
  columns: ColumnDef[],
  filename: string = 'export',
  title: string = 'Report'
): void {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  const doc = new jsPDF();

  // Add title
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), 'PPP')}`, 14, 30);

  // Prepare table data
  const headers = columns.map(col => col.label);
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      return col.format ? col.format(value) : String(value ?? '');
    })
  );

  // Add table
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 40,
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // Download
  doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

/**
 * Generate PDF report with multiple sections
 */
export function generatePDFReport(
  report: {
    title: string;
    subtitle?: string;
    sections: Array<{
      title: string;
      data: any[];
      columns: ColumnDef[];
      chart?: string; // Base64 encoded chart image
    }>;
  },
  filename: string = 'report'
): void {
  const doc = new jsPDF();
  let yPosition = 20;

  // Add title
  doc.setFontSize(20);
  doc.text(report.title, 14, yPosition);
  yPosition += 10;

  // Add subtitle
  if (report.subtitle) {
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(report.subtitle, 14, yPosition);
    yPosition += 8;
    doc.setTextColor(0);
  }

  // Add date
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${format(new Date(), 'PPP p')}`, 14, yPosition);
  doc.setTextColor(0);
  yPosition += 15;

  // Add each section
  for (const section of report.sections) {
    // Add page break if needed
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    // Add section title
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(section.title, 14, yPosition);
    yPosition += 8;
    doc.setFont(undefined, 'normal');

    // Add chart if exists
    if (section.chart) {
      const imgWidth = 180;
      const imgHeight = 100;
      doc.addImage(section.chart, 'PNG', 14, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 10;
    }

    // Add table
    if (section.data.length > 0) {
      const headers = section.columns.map(col => col.label);
      const rows = section.data.map(row =>
        section.columns.map(col => {
          const value = row[col.key];
          return col.format ? col.format(value) : String(value ?? '');
        })
      );

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: yPosition,
        styles: {
          fontSize: 8,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        didDrawPage: (data) => {
          yPosition = data.cursor.y + 10;
        },
      });
    } else {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('No data available', 14, yPosition);
      doc.setTextColor(0);
      yPosition += 10;
    }
  }

  // Add page numbers
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
  }

  // Download
  doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

/**
 * Generic export function that routes to specific format
 */
export function exportData(
  data: any[],
  columns: ColumnDef[],
  format: ExportFormat,
  filename: string = 'export',
  options?: {
    title?: string;
    sheetName?: string;
  }
): void {
  switch (format) {
    case 'csv':
      exportToCSV(data, columns, filename);
      break;
    case 'excel':
      exportToExcel(data, columns, filename, options?.sheetName);
      break;
    case 'json':
      exportToJSON(data, filename);
      break;
    case 'pdf':
      exportToPDF(data, columns, filename, options?.title || 'Report');
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Format common values for export
 */
export const formatters = {
  date: (value: Date | string | null | undefined) => {
    if (!value) return '';
    return format(new Date(value), 'yyyy-MM-dd');
  },
  dateTime: (value: Date | string | null | undefined) => {
    if (!value) return '';
    return format(new Date(value), 'yyyy-MM-dd HH:mm');
  },
  currency: (value: number | null | undefined) => {
    if (value === null || value === undefined) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  },
  percentage: (value: number | null | undefined) => {
    if (value === null || value === undefined) return '';
    return `${value.toFixed(1)}%`;
  },
  number: (value: number | null | undefined, decimals: number = 2) => {
    if (value === null || value === undefined) return '';
    return value.toFixed(decimals);
  },
  boolean: (value: boolean | null | undefined) => {
    if (value === null || value === undefined) return '';
    return value ? 'Yes' : 'No';
  },
  array: (value: any[] | null | undefined, separator: string = ', ') => {
    if (!value || value.length === 0) return '';
    return value.join(separator);
  },
};
