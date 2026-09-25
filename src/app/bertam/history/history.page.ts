import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import { CustomHeaderComponent } from '../../components/custom-header/custom-header.component';
import { environment } from '../../../environments/environment';
import { Chart, registerables } from 'chart.js';
import { format, subDays, addDays } from 'date-fns';

Chart.register(...registerables);

@Component({
  selector: 'app-bertam-history',
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
  standalone: true,
  imports: [CustomHeaderComponent, IonContent, CommonModule, FormsModule],
})
export class BertamHistoryPage implements OnInit {
  @ViewChild('telemetryChart') telemetryChartRef!: ElementRef;

  devices: any[] = [];
  filteredDevices: any[] = [];
  selectedSite: string = 'All';
  selectedDevEui: string | null = null;
  selectedDate: string = format(new Date(), 'yyyy-MM-dd');
  historyData: any[] = [];
  chartInstance: Chart | null = null;

  readonly API = `${environment.apiUrl}/api/bertam`;

  constructor(private http: HttpClient, private toastCtrl: ToastController) {}

  ngOnInit() {
    this.loadDevices();
  }

  loadDevices() {
    this.http.get<any[]>(`${this.API}/devices`).subscribe({
      next: (data) => {
        this.devices = data;
        this.applySiteFilter();
      },
      error: (err) => console.error('Failed to load Bertam devices', err),
    });
  }

  applySiteFilter() {
    if (this.selectedSite === 'All') {
      this.filteredDevices = [...this.devices];
    } else {
      this.filteredDevices = this.devices.filter(d => (d.site_name || 'Site 2') === this.selectedSite);
    }
    
    // Auto-select first device in the new list if current is not in the list
    if (this.filteredDevices.length > 0) {
      const exists = this.filteredDevices.find(d => d.dev_eui === this.selectedDevEui);
      if (!exists) {
        this.selectedDevEui = this.filteredDevices[0].dev_eui;
        this.loadHistory();
      }
    } else {
      this.selectedDevEui = null;
      this.historyData = [];
      this.renderChart();
    }
  }

  onFilterChange() {
    if (this.selectedDevEui) {
      this.loadHistory();
    }
  }

  previousDate() {
    if (!this.selectedDate) return;
    const current = new Date(this.selectedDate);
    this.selectedDate = format(subDays(current, 1), 'yyyy-MM-dd');
    this.onFilterChange();
  }

  nextDate() {
    if (!this.selectedDate) return;
    const current = new Date(this.selectedDate);
    this.selectedDate = format(addDays(current, 1), 'yyyy-MM-dd');
    this.onFilterChange();
  }

  loadHistory() {
    if (!this.selectedDevEui) return;
    let url = `${this.API}/history/${this.selectedDevEui}`;
    if (this.selectedDate) {
      url += `?date=${this.selectedDate}`;
    }

    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        this.historyData = data;
        this.renderChart();
      },
      error: (err) => console.error('Failed to load history', err),
    });
  }

  renderChart() {
    if (!this.telemetryChartRef) return;
    if (this.chartInstance) this.chartInstance.destroy();

    const labels = this.historyData.map((d) => this.formatTimestamp(d.timestamp));
    const batteryData = this.historyData.map((d) => d.battery_percent == null ? null : Number(d.battery_percent)) as any;
    const solarVoltsData = this.historyData.map((d) => d.solar_panel_voltage == null ? null : Number(d.solar_panel_voltage)) as any;
    const consumptionData = this.historyData.map((d) => d.consumption == null ? null : Number(d.consumption)) as any;
    const brightnessData = this.historyData.map((d) => {
      if (d.brightness_code == null) return null; // Return null so Chart.js can span gaps
      const code = Number(d.brightness_code);
      if (code === 58368 || code === 100) return 100;
      if (code === 48128 || code === 60) return 60;
      if (code === 43008 || code === 40) return 40;
      if (code === 0) return 0;
      return null;
    }) as any;

    this.chartInstance = new Chart(this.telemetryChartRef.nativeElement.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Battery %',
            data: batteryData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.08)',
            tension: 0.4,
            yAxisID: 'y',
            fill: true,
            spanGaps: true,
          },
          {
            label: 'Brightness %',
            data: brightnessData,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245,158,11,0.08)',
            tension: 0.4,
            yAxisID: 'y',
            fill: false,
            borderDash: [5, 3],
            spanGaps: true,
          },
          {
            label: 'Solar (V)',
            data: solarVoltsData,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99,102,241,0.06)',
            tension: 0.4,
            yAxisID: 'y1',
            fill: false,
            spanGaps: true,
          },
          {
            label: 'Consumption (W)',
            data: consumptionData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.06)',
            tension: 0.4,
            yAxisID: 'y1',
            fill: false,
            spanGaps: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top' },
        },
        scales: {
          y: {
            type: 'linear', display: true, position: 'left',
            max: 100, min: 0,
            title: { display: true, text: 'Battery / Brightness (%)' },
          },
          y1: {
            type: 'linear', display: true, position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Solar (V) / Consumption (W)' },
          },
        },
      },
    });
  }

  /** Treat bare datetime strings (no tz) as Malaysia time (+08:00) */
  formatTimestamp(ts: string | null): string {
    if (!ts) return '--';
    let s = ts.trim().replace(' ', 'T');
    // If there's no timezone info ('Z' or '+'), assume it's local Malaysia time
    if (!s.endsWith('Z') && !s.includes('+') && !s.match(/[+-]\d\d:\d\d$/)) {
      s += '+08:00';
    }
    const d = new Date(s);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString('en-MY', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    });
  }
}
