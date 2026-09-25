import { Component, Input, ViewChild, ElementRef, AfterViewInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportService } from '../../services/report.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-overview-report',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './overview-report.component.html',
  styleUrls: ['./overview-report.component.scss']
})
export class OverviewReportComponent implements AfterViewInit, OnChanges {
  @Input() data: any = null;
  @ViewChild('solarChart') solarChart!: ElementRef;
  @ViewChild('ledChart') ledChart!: ElementRef;

  solarChartInstance: Chart | null = null;
  ledChartInstance: Chart | null = null;

  constructor(private reportService: ReportService) {}

  ngAfterViewInit() {
    this.renderCharts();
  }

  ngOnChanges() {
    if (this.data) {
      setTimeout(() => this.renderCharts(), 100);
    }
  }

  renderCharts() {
    if (!this.data) return;

    if (this.solarChart && (this.data.solar || this.data.bertam || this.data.uc100)) {
      const dataSource = this.data.solar || this.data.bertam || this.data.uc100;
      if (dataSource.historicalData) {
        if (this.solarChartInstance) this.solarChartInstance.destroy();
        const ctx = this.solarChart.nativeElement.getContext('2d');
        const labels = dataSource.historicalData.map((d: any) => d.date);
        const values = dataSource.historicalData.map((d: any) => d.energyGeneratedKWh);

        this.solarChartInstance = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels.length ? labels : ['No Data'],
            datasets: [{
              label: 'Green Energy Generated (kWh)',
              data: values.length ? values : [0],
              backgroundColor: '#10b981'
            }]
          },
          options: { responsive: true, maintainAspectRatio: false, animation: false }
        });
      }
    }

    if (this.ledChart && this.data.led?.historicalData) {
      if (this.ledChartInstance) this.ledChartInstance.destroy();
      const ctx = this.ledChart.nativeElement.getContext('2d');
      const labels = this.data.led.historicalData.map((d: any) => d.date);
      const values = this.data.led.historicalData.map((d: any) => d.powerConsumptionKWh);

      this.ledChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: labels.length ? labels : ['No Data'],
          datasets: [{
            label: 'Power Consumption (kWh)',
            data: values.length ? values : [0],
            backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899']
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, animation: false }
      });
    }
  }

  async downloadPdf() {
    if (!this.data) return;
    const filename = `Device_Overview_Report_${this.data.project.name}_${this.data.timeRange.range}.pdf`;
    await this.reportService.generatePdf('pdf-report-container', filename);
  }
}
