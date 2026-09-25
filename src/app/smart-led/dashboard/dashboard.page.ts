import { Component, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  IonContent, ToastController, AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { bulbOutline, powerOutline, alertCircleOutline, statsChartOutline, pulseOutline, wifiOutline, flashOutline, leafOutline, cashOutline } from 'ionicons/icons';
import { Chart, registerables } from 'chart.js';
import { CustomHeaderComponent } from '../../components/custom-header/custom-header.component';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { ReportService } from '../../services/report.service';
import { OverviewReportComponent } from '../../components/overview-report/overview-report.component';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { format, parseISO, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfWeek, endOfWeek } from 'date-fns';

Chart.register(...registerables);

@Component({
  selector: 'app-led-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [
    CustomHeaderComponent,
    IonContent,
    CommonModule,
    FormsModule,
    OverviewReportComponent
  ]
})
export class DashboardPage implements OnInit, AfterViewInit {
  @ViewChild('statusChart') statusChart!: ElementRef;
  @ViewChild('brightnessChart') brightnessChart!: ElementRef;
  @ViewChild('historicalChart') historicalChart!: ElementRef;
  @ViewChild(OverviewReportComponent) reportComponent!: OverviewReportComponent;
  @ViewChild('map') mapContainer!: ElementRef;

  reportData: any = null;
  isGeneratingReport = false;

  summary = { totalDevices: 0, onlineDevices: 0, activeLights: 0, totalPowerConsumption: 0, estimatedCostRM: 0, energySavedKWh: 0, costSavedRM: 0, co2PreventedKg: 0 };
  devices: any[] = [];
  projects: any[] = [];
  selectedProjectId: number | null = null;
  selectedTimeFilter: 'week' | 'month' | 'year' | 'all' = 'all';

  selectedYear: number = new Date().getFullYear();
  selectedMonth: string = format(new Date(), 'yyyy-MM');
  selectedWeek: string = this.getCurrentWeekString();

  statusChartInstance: Chart | null = null;
  brightnessChartInstance: Chart | null = null;
  historicalChartInstance: Chart | null = null;
  map: L.Map | null = null;
  markers: L.Marker[] = [];

  getCurrentWeekString() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNumber = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return `${d.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
  }

  getDateFromISOWeek(weekStr: string) {
    const [y, w] = weekStr.split('-W');
    const simple = new Date(Number(y), 0, 1 + (Number(w) - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4)
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return ISOweekStart;
  }

  getDateRange(): { startDate: string | null, endDate: string | null } {
    if (this.selectedTimeFilter === 'all') return { startDate: null, endDate: null };
    let start: Date | null = null;
    let end: Date | null = null;
    try {
      if (this.selectedTimeFilter === 'year' && this.selectedYear) {
        const d = new Date(this.selectedYear, 0, 1);
        start = startOfYear(d);
        end = endOfYear(d);
      } else if (this.selectedTimeFilter === 'month' && this.selectedMonth) {
        const d = parseISO(`${this.selectedMonth}-01`);
        start = startOfMonth(d);
        end = endOfMonth(d);
      } else if (this.selectedTimeFilter === 'week' && this.selectedWeek) {
        const d = this.getDateFromISOWeek(this.selectedWeek);
        start = startOfWeek(d, { weekStartsOn: 1 });
        end = endOfWeek(d, { weekStartsOn: 1 });
      }
    } catch (e) { console.error(e); }

    if (start && end) {
      return { startDate: format(start, 'yyyy-MM-dd'), endDate: format(end, 'yyyy-MM-dd') };
    }
    return { startDate: null, endDate: null };
  }

  get isSuperAdmin(): boolean {
    const user = this.authService.getCurrentUser();
    const role = user?.role?.toLowerCase().replace(/\s/g, '');
    return this.authService.isSuperAdmin() || role === 'superadmin';
  }

  constructor(
    private http: HttpClient, 
    private authService: AuthService,
    private toastController: ToastController,
    private alertController: AlertController,
    private reportService: ReportService
  ) {
    addIcons({ bulbOutline, powerOutline, alertCircleOutline, statsChartOutline, pulseOutline, wifiOutline, flashOutline, leafOutline, cashOutline });
  }

  ngOnInit() {
    this.loadProjects();
    this.fetchSummary();
    this.fetchDevices();
  }

  ionViewWillEnter() {
    this.fetchSummary();
    this.fetchDevices();
    this.fetchHistoricalData();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.initMap();
      this.renderCharts();
      this.fetchHistoricalData();
    }, 200);
  }

  loadProjects() {
    if (this.isSuperAdmin) {
      this.http.get<any[]>(`${environment.apiUrl}/api/projects`).subscribe({
        next: (data) => { this.projects = data; },
        error: (err) => console.error('Error loading projects', err)
      });
    }
  }

  onFilterChange() {
    this.fetchSummary();
    this.fetchDevices();
    this.fetchHistoricalData();
  }

  fetchSummary() {
    const user = this.authService.getCurrentUser();
    let url = `${environment.apiUrl}/api/led/dashboard/summary`;
    const targetProjectId = this.isSuperAdmin ? this.selectedProjectId : user?.projectId;
    
    const params = new URLSearchParams();
    if (targetProjectId) params.append('projectId', targetProjectId.toString());
    
    const { startDate, endDate } = this.getDateRange();
    if (startDate && endDate) {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    }
    if (params.toString()) url += `?${params.toString()}`;

    this.http.get<any>(url).subscribe({
      next: (data) => {
        this.summary = data;
      },
      error: (err) => console.error('Error fetching LED dashboard summary:', err)
    });
  }

  fetchHistoricalData() {
    const user = this.authService.getCurrentUser();
    let url = `${environment.apiUrl}/api/led/dashboard/graph`;
    const targetProjectId = this.isSuperAdmin ? this.selectedProjectId : user?.projectId;
    
    const params = new URLSearchParams();
    if (targetProjectId) params.append('projectId', targetProjectId.toString());
    
    const { startDate, endDate } = this.getDateRange();
    if (startDate && endDate) {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    }
    if (params.toString()) url += `?${params.toString()}`;

    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        this.renderHistoricalChart(data);
      },
      error: (err) => console.error('Error fetching LED historical data:', err)
    });
  }

  async resetDashboardStats() {
    const alert = await this.alertController.create({
      header: 'Confirm Reset',
      message: 'Are you sure you want to completely reset all historical statistics for this view? This action cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Reset',
          role: 'destructive',
          handler: () => {
            const user = this.authService.getCurrentUser();
            const targetProjectId = this.isSuperAdmin ? this.selectedProjectId : user?.projectId;
            let url = `${environment.apiUrl}/api/led/dashboard/reset-stats`;
            if (targetProjectId) {
              url += `?projectId=${targetProjectId}`;
            }

            this.http.delete(url).subscribe({
              next: async () => {
                const toast = await this.toastController.create({
                  message: 'Stats successfully reset.',
                  color: 'success',
                  duration: 3000
                });
                await toast.present();
                this.fetchSummary();
                this.fetchHistoricalData();
              },
              error: async (err) => {
                console.error('Failed to reset stats', err);
                const toast = await this.toastController.create({
                  message: 'Failed to reset stats.',
                  color: 'danger',
                  duration: 3000
                });
                await toast.present();
              }
            });
          }
        }
      ]
    });
    await alert.present();
  }

  async generateOverviewReport() {
    const user = this.authService.getCurrentUser();
    const targetProjectId = this.isSuperAdmin ? this.selectedProjectId : user?.projectId;
    if (!targetProjectId) {
      const toast = await this.toastController.create({ message: 'Please select a project first.', color: 'warning', duration: 3000 });
      return toast.present();
    }
    if (this.selectedTimeFilter === 'all') {
      const toast = await this.toastController.create({ message: 'Please select a specific time range (Yearly, Monthly, Weekly) for the report.', color: 'warning', duration: 3000 });
      return toast.present();
    }

    this.isGeneratingReport = true;
    const { startDate, endDate } = this.getDateRange();
    try {
      this.reportService.getOverviewReport(targetProjectId, this.selectedTimeFilter, 'led', startDate || undefined, endDate || undefined).subscribe({
        next: (data) => {
          this.reportData = data;
          setTimeout(async () => {
            if (this.reportComponent) {
              await this.reportComponent.downloadPdf();
              const toast = await this.toastController.create({ message: 'Report downloaded successfully!', color: 'success', duration: 3000 });
              toast.present();
            }
            this.isGeneratingReport = false;
            setTimeout(() => this.reportData = null, 1000);
          }, 1500);
        },
        error: async (err) => {
          console.error(err);
          this.isGeneratingReport = false;
          const toast = await this.toastController.create({ message: 'Failed to generate report.', color: 'danger', duration: 3000 });
          toast.present();
        }
      });
    } catch (e) {
      this.isGeneratingReport = false;
    }
  }

  fetchDevices() {
    const user = this.authService.getCurrentUser();
    let url = `${environment.apiUrl}/api/led/devices`;
    const targetProjectId = this.isSuperAdmin ? this.selectedProjectId : user?.projectId;
    if (targetProjectId) {
      url += `?projectId=${targetProjectId}`;
    }

    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        this.devices = data;
        if (this.statusChart) this.renderCharts();
        this.updateMapMarkers();
      },
      error: (err) => console.error('Error fetching LED devices for chart:', err)
    });
  }

  initMap() {
    if (!this.mapContainer || this.map) return;
    this.map = L.map(this.mapContainer.nativeElement).setView([3.1390, 101.6869], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    const defaultIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
    L.Marker.prototype.options.icon = defaultIcon;

    this.updateMapMarkers();
  }

  updateMapMarkers() {
    if (!this.map) return;

    this.markers.forEach(m => m.remove());
    this.markers = [];

    let validDevices = 0;
    const bounds = L.latLngBounds([]);

    const gatewayIcon = L.divIcon({
      className: 'custom-gateway-marker',
      html: `<div style="background-color: #8b5cf6; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: bold;">G</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14]
    });

    this.devices.forEach(d => {
      const lat = Number(d.latitude);
      const lng = Number(d.longitude);
      if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
        const markerOptions = d.device_type === 'Gateway' ? { icon: gatewayIcon } : {};
        const marker = L.marker([lat, lng], markerOptions).addTo(this.map!);

        let powerDisp = d.device_type === 'Gateway' ? '--' : (d.active_power ?? '--');

        marker.bindPopup(`
          <div style="font-family: sans-serif;">
            <b style="font-size: 14px;">${d.name || d.serial}</b><br/><br/>
            <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
               <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${d.is_online ? '#10b981' : '#ef4444'};"></span>
               <span>${d.is_online ? 'Online' : 'Offline'}</span>
            </div>
            <div>💡 Brightness: <b>${d.device_type === 'Gateway' ? '--' : (d.brightness ?? '--')}%</b></div>
          </div>
        `);
        this.markers.push(marker);
        bounds.extend([d.latitude, d.longitude]);
        validDevices++;
      }
    });

    if (validDevices > 0) {
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }

  renderCharts() {
    if (!this.statusChart || !this.brightnessChart) return;
    if (this.statusChartInstance) this.statusChartInstance.destroy();
    if (this.brightnessChartInstance) this.brightnessChartInstance.destroy();

    const barCtx1 = this.brightnessChart.nativeElement.getContext('2d');

    const ledDevices = [...this.devices].filter(d => d.device_type !== 'Gateway');

    // Sort devices by brightness percent (lowest first) and take top 15
    const brightDevices = ledDevices.filter(d => d.brightness !== null).sort((a, b) => (a.brightness || 0) - (b.brightness || 0)).slice(0, 15);
    const brightLabels = brightDevices.map(d => d.name || d.serial);
    const brightPercents = brightDevices.map(d => d.brightness || 0);

    this.brightnessChartInstance = new Chart(barCtx1, {
      type: 'bar',
      data: {
        labels: brightLabels.length > 0 ? brightLabels : ['No Data'],
        datasets: [{
          label: 'Light Brightness (%)',
          data: brightPercents.length > 0 ? brightPercents : [0],
          backgroundColor: '#3b82f6',
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 100 }
        }
      }
    });

    const statusCtx = this.statusChart.nativeElement.getContext('2d');

    // Calculate Online vs Offline
    const onlineCount = ledDevices.filter(d => d.is_online).length;
    const offlineCount = ledDevices.length - onlineCount;

    this.statusChartInstance = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: ['Online', 'Offline'],
        datasets: [{
          data: [onlineCount, offlineCount],
          backgroundColor: ['#10b981', '#ef4444'],
          borderWidth: 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }

  renderHistoricalChart(data: any[]) {
    if (!this.historicalChart) return;
    if (this.historicalChartInstance) this.historicalChartInstance.destroy();

    const ctx = this.historicalChart.nativeElement.getContext('2d');
    const labels = data.map(d => d.date);
    const powerData = data.map(d => d.powerConsumptionKWh);

    this.historicalChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length > 0 ? labels : ['No Data'],
        datasets: [{
          label: 'Power Consumption (kWh)',
          data: powerData.length > 0 ? powerData : [0],
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }
}
