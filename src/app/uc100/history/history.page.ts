import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular/standalone';
import { CustomHeaderComponent } from '../../components/custom-header/custom-header.component';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-uc100-history',
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
  standalone: true,
  imports: [CustomHeaderComponent, IonContent, IonRefresher, IonRefresherContent, CommonModule, FormsModule],
})
export class Uc100HistoryPage implements OnInit {
  @ViewChild('telemetryChart') telemetryChartRef!: ElementRef;

  devices: any[] = [];
  selectedDevEui = '';
  selectedDate = new Date().toISOString().split('T')[0]; // Today
  historyRecords: any[] = [];
  chartInstance: Chart | null = null;
  isLoading = false;
  isLoadingHistory = false;

  readonly API = `${environment.apiUrl}/api/uc100`;

  constructor(private http: HttpClient, private authService: AuthService) {}

  ngOnInit() { this.fetchDevices(); }
  ionViewWillEnter() { this.fetchDevices(); }

  fetchDevices() {
    this.isLoading = true;
    let url = `${this.API}/devices`;
    const user = this.authService.getCurrentUser();
    const targetProjectId = this.authService.isSuperAdmin() ? null : user?.projectId;
    if (targetProjectId) url += `?projectId=${targetProjectId}`;

    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        this.devices = data;
        if (data.length > 0 && !this.selectedDevEui) {
          this.selectedDevEui = data[0].dev_eui;
          this.fetchHistory();
        }
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; }
    });
  }

  fetchHistory() {
    if (!this.selectedDevEui) return;
    this.isLoadingHistory = true;
    this.http.get<any[]>(`${this.API}/history/${this.selectedDevEui}?date=${this.selectedDate}`).subscribe({
      next: (data) => {
        // The API returns ASC (oldest first).
        // Table should show newest first, so we reverse the array for the table.
        this.historyRecords = [...data].reverse(); 
        this.isLoadingHistory = false;
        setTimeout(() => this.renderChart(data), 100); // Pass ASC data to chart
      },
      error: () => { this.isLoadingHistory = false; }
    });
  }

  previousDate() {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() - 1);
    this.selectedDate = d.toISOString().split('T')[0];
    this.fetchHistory();
  }

  nextDate() {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() + 1);
    this.selectedDate = d.toISOString().split('T')[0];
    this.fetchHistory();
  }

  renderChart(ascData: any[]) {
    if (!this.telemetryChartRef) return;
    if (this.chartInstance) this.chartInstance.destroy();

    // Chart needs oldest to newest (left to right), so use the raw ASC data directly.
    const chartData = ascData;

    const labels = chartData.map((d) => this.formatTimestamp(d.timestamp));
    const batteryData = chartData.map((d) => d.battery_percent == null ? null : Number(d.battery_percent)) as any;
    const solarVoltsData = chartData.map((d) => d.solar_panel_voltage == null ? null : Number(d.solar_panel_voltage)) as any;
    const consumptionData = chartData.map((d) => d.consumption == null ? null : Number(d.consumption)) as any;
    
    // For brightness, if LED is OFF, the physical output is 0% even if the setting says 100%
    const brightnessData = chartData.map((d) => {
      if (d.led_status === 0 || d.led_status === '0') return 0;
      return d.brightness_actual != null ? Number(d.brightness_actual) : (d.brightness_setting == null ? null : Number(d.brightness_setting));
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
            title: { display: true, text: 'Solar (V)' },
          },
        },
      },
    });
  }

  getDeviceName(devEui: string): string {
    return this.devices.find(d => d.dev_eui === devEui)?.name || devEui;
  }

  formatTimestamp(ts: string | null): string {
    if (!ts) return '--';
    let s = ts.trim().replace(' ', 'T');
    if (!s.endsWith('Z') && !s.includes('+') && !s.match(/[+-]\d\d:\d\d$/)) s += '+08:00';
    const d = new Date(s);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString('en-MY', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  }
}
