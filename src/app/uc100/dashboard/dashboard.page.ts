import { Component, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import { Chart, registerables } from 'chart.js';
import { CustomHeaderComponent } from '../../components/custom-header/custom-header.component';
import { OverviewReportComponent } from '../../components/overview-report/overview-report.component';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { ReportService } from '../../services/report.service';
import * as L from 'leaflet';

Chart.register(...registerables);

@Component({
  selector: 'app-uc100-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [CustomHeaderComponent, OverviewReportComponent, IonContent, CommonModule, FormsModule],
})
export class Uc100DashboardPage implements OnInit, AfterViewInit {
  @ViewChild('batteryChart') batteryChartRef!: ElementRef;
  @ViewChild('historicalChart') historicalChartRef!: ElementRef;
  @ViewChild('energyChart') energyChartRef!: ElementRef;
  @ViewChild('map') mapContainer!: ElementRef;
  @ViewChild(OverviewReportComponent) reportComponent!: OverviewReportComponent;

  summary: any = {
    total: 0, online: 0, offline: 0, lowBattery: 0, lighting: 0,
    totalEnergyKWh: 0, totalMoneySavedRM: 0, totalCo2PreventedKg: 0
  };
  devices: any[] = [];
  projects: any[] = [];
  selectedProjectId: number | null = null;
  batteryChartInstance: Chart | null = null;
  historicalChartInstance: Chart | null = null;
  energyChartInstance: Chart | null = null;
  map: L.Map | null = null;
  markers: L.Marker[] = [];
  isLoading = false;

  // Report & Time Filter fields
  selectedTimeFilter: string = 'all';
  selectedYear: number = new Date().getFullYear();
  selectedMonth: string = new Date().toISOString().slice(0, 7);
  selectedWeek: string = (() => {
    const d = new Date();
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + yearStart.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
  })();
  isGeneratingReport = false;
  reportData: any = null;

  get isSuperAdmin(): boolean { return this.authService.isSuperAdmin(); }

  readonly API = `${environment.apiUrl}/api/uc100`;

  constructor(
    private http: HttpClient,
    private toastCtrl: ToastController,
    private authService: AuthService,
    private reportService: ReportService
  ) {}

  ngOnInit() { this.loadProjects(); this.fetchData(); }
  ionViewWillEnter() { this.fetchData(); }

  ngAfterViewInit() {
    setTimeout(() => { this.initMap(); }, 300);
  }

  loadProjects() {
    if (this.isSuperAdmin) {
      this.http.get<any[]>(`${this.API}/projects`).subscribe({
        next: (data) => { this.projects = data; },
        error: (err) => console.error('Failed to load projects', err),
      });
    }
  }

  fetchData() {
    this.isLoading = true;
    let url = `${this.API}/devices`;
    const user = this.authService.getCurrentUser();
    const targetProjectId = this.isSuperAdmin ? this.selectedProjectId : user?.projectId;
    if (targetProjectId) url += `?projectId=${targetProjectId}`;

    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        this.devices = data;
        this.calculateSummary();
        this.renderBatteryChart();
        this.renderEnergyChart();
        this.updateMapMarkers();
        this.fetchDashboardData();
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; },
    });
  }

  fetchDashboardData() {
    const { startDate, endDate } = this.getDateRange();
    let query = '';
    const params: string[] = [];
    const user = this.authService.getCurrentUser();
    const targetProjectId = this.isSuperAdmin ? this.selectedProjectId : user?.projectId;
    if (targetProjectId) params.push(`projectId=${targetProjectId}`);
    if (startDate && endDate) { params.push(`startDate=${startDate}`); params.push(`endDate=${endDate}`); }
    if (params.length) query = '?' + params.join('&');

    this.http.get<any>(`${this.API}/dashboard/summary${query}`).subscribe({
      next: (data) => { this.summary = { ...this.summary, ...data }; },
      error: (err) => console.error('Failed to load UC100 summary', err),
    });

    this.http.get<any>(`${this.API}/dashboard/graph${query}`).subscribe({
      next: (data) => { this.renderHistoricalChart(data); },
      error: (err) => console.error('Failed to load UC100 graph data', err),
    });
  }

  onProjectChange() { this.fetchData(); }

  applyFilter() { this.fetchData(); }

  calculateSummary() {
    const total = this.devices.length;
    const online = this.devices.filter(d => d.is_online === 1).length;
    const offline = total - online;
    const lowBattery = this.devices.filter(d => Number(d.battery_percent) <= 20).length;
    const lighting = this.devices.filter(d => Number(d.led_status) > 0).length;
    this.summary = { ...this.summary, total, online, offline, lowBattery, lighting };
  }

  initMap() {
    if (!this.mapContainer || this.map) return;
    this.map = L.map(this.mapContainer.nativeElement).setView([3.1390, 101.6869], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    const icon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
    });
    L.Marker.prototype.options.icon = icon;
    this.updateMapMarkers();
  }

  updateMapMarkers() {
    if (!this.map) return;
    this.markers.forEach(m => m.remove());
    this.markers = [];
    
    let validDevices = 0;
    const bounds = L.latLngBounds([]);

    this.devices.forEach(d => {
      const lat = Number(d.latitude);
      const lng = Number(d.longitude);
      if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
        const marker = L.marker([lat, lng]).addTo(this.map!);
        marker.bindPopup(`
          <b>${d.name || d.dev_eui}</b><br/>
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${d.is_online ? '#10b981' : '#ef4444'}"></span>
          ${d.is_online ? 'Online' : 'Offline'}<br/>
          🔋 Battery: <b>${d.battery_percent ?? '--'}%</b><br/>
          💡 LED: <b>${Number(d.led_status) > 0 ? 'ON' : 'OFF'}</b>
        `);
        this.markers.push(marker);
        bounds.extend([lat, lng]);
        validDevices++;
      }
    });

    if (validDevices > 0) {
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }

  renderBatteryChart() {
    if (!this.batteryChartRef) return;
    if (this.batteryChartInstance) this.batteryChartInstance.destroy();

    const sorted = [...this.devices]
      .filter(d => d.battery_percent != null)
      .sort((a, b) => Number(a.battery_percent) - Number(b.battery_percent))
      .slice(0, 15);

    this.batteryChartInstance = new Chart(this.batteryChartRef.nativeElement.getContext('2d'), {
      type: 'bar',
      data: {
        labels: sorted.map(d => d.name || d.dev_eui),
        datasets: [{
          label: 'Battery %',
          data: sorted.map(d => Number(d.battery_percent)),
          backgroundColor: sorted.map(d =>
            Number(d.battery_percent) < 20 ? '#eb445a' : Number(d.battery_percent) < 50 ? '#ffc409' : '#2dd36f'
          ),
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, max: 100 } },
      },
    });
  }

  renderEnergyChart() {
    if (!this.energyChartRef) return;
    if (this.energyChartInstance) this.energyChartInstance.destroy();

    const sorted = [...this.devices]
      .filter(d => d.solar_panel_voltage != null)
      .sort((a, b) => Number(b.solar_panel_voltage) - Number(a.solar_panel_voltage))
      .slice(0, 15);

    this.energyChartInstance = new Chart(this.energyChartRef.nativeElement.getContext('2d'), {
      type: 'bar',
      data: {
        labels: sorted.map(d => d.name || d.dev_eui),
        datasets: [{
          label: 'Solar Panel Voltage (V)',
          data: sorted.map(d => Number(d.solar_panel_voltage)),
          backgroundColor: '#ffd534',
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } },
      },
    });
  }

  renderHistoricalChart(graphData: any) {
    if (!this.historicalChartRef || !graphData) return;
    if (this.historicalChartInstance) this.historicalChartInstance.destroy();

    this.historicalChartInstance = new Chart(this.historicalChartRef.nativeElement.getContext('2d'), {
      type: 'line',
      data: {
        ...graphData,
        datasets: graphData.datasets.map((ds: any) => ({ ...ds, fill: true, tension: 0.4 }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } },
      },
    });
  }

  // ── Date Range Logic ──────────────────────────────────────────────────────

  getDateRange(): { startDate: string | null, endDate: string | null } {
    if (this.selectedTimeFilter === 'all') return { startDate: null, endDate: null };
    let startDate = new Date();
    let endDate = new Date();

    if (this.selectedTimeFilter === 'year') {
      startDate = new Date(this.selectedYear, 0, 1);
      endDate = new Date(this.selectedYear, 11, 31, 23, 59, 59);
    } else if (this.selectedTimeFilter === 'month') {
      const [year, month] = this.selectedMonth.split('-');
      startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
    } else if (this.selectedTimeFilter === 'week') {
      const [year, weekStr] = this.selectedWeek.split('-W');
      const week = parseInt(weekStr);
      startDate = new Date(parseInt(year), 0, 1 + (week - 1) * 7);
      const day = startDate.getDay();
      startDate.setDate(startDate.getDate() - day + (day === 0 ? -6 : 1));
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    }

    const pad = (n: number) => n.toString().padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return { startDate: fmt(startDate), endDate: fmt(endDate) };
  }

  // ── Report Generation ─────────────────────────────────────────────────────

  async generateOverviewReport() {
    if (this.selectedTimeFilter === 'all') {
      const toast = await this.toastCtrl.create({ message: 'Please select a specific time range (Yearly, Monthly, Weekly) for the report.', color: 'warning', duration: 3000 });
      return toast.present();
    }

    this.isGeneratingReport = true;
    const { startDate, endDate } = this.getDateRange();

    const user = this.authService.getCurrentUser();
    const targetProjectId = this.isSuperAdmin ? this.selectedProjectId : user?.projectId;

    this.reportService.getOverviewReport(
      targetProjectId || 0,
      this.selectedTimeFilter,
      'uc100',
      startDate || undefined,
      endDate || undefined,
    ).subscribe({
      next: (data) => {
        this.reportData = data;
        setTimeout(async () => {
          if (this.reportComponent) {
            await this.reportComponent.downloadPdf();
            const toast = await this.toastCtrl.create({ message: 'Report downloaded successfully!', color: 'success', duration: 3000 });
            toast.present();
          }
          this.isGeneratingReport = false;
          setTimeout(() => this.reportData = null, 1000);
        }, 1500);
      },
      error: async () => {
        this.isGeneratingReport = false;
        const toast = await this.toastCtrl.create({ message: 'Failed to generate report.', color: 'danger', duration: 3000 });
        toast.present();
      }
    });
  }
}
