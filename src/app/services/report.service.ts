import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

@Injectable({
  providedIn: 'root'
})
export class ReportService {

  constructor(private http: HttpClient) {}

  getOverviewReport(projectId: number, range: string, type?: string, startDate?: string, endDate?: string, site?: string) {
    let url = `${environment.apiUrl}/api/projects/${projectId}/overview-report?range=${range}`;
    if (type) url += `&type=${type}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    if (site && site !== 'All') url += `&site=${encodeURIComponent(site)}`;
    return this.http.get<any>(url);
  }

  async generatePdf(elementId: string, filename: string) {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error('Report template element not found');
    }
    
    // Temporarily make it visible for rendering
    const originalDisplay = element.style.display;
    element.style.display = 'block';
    
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(filename);
    } finally {
      element.style.display = originalDisplay;
    }
  }
}
