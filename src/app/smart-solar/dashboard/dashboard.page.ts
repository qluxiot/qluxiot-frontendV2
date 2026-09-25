import { Component, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  IonContent, ToastController, AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { batteryHalfOutline, powerOutline, alertCircleOutline, statsChartOutline, warningOutline, pulseOutline } from 'ionicons/icons';
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
  selector: 'app-solar-dashboard',
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
export class SolarDashboardPage implements OnInit, AfterViewInit {
  @ViewChild('batteryChart') batteryChart!: ElementRef;
  @ViewChild('energyChart') energyChart!: ElementRef;
  @ViewChild('historicalChart') historicalChart!: ElementRef;
  @ViewChild(OverviewReportComponent) reportComponent!: OverviewReportComponent;
  @ViewChild('map') mapContainer!: ElementRef;

  reportData: any = null;
  isGeneratingReport = false;

  summary: any = { total: 0, online: 0, offline: 0, lowBattery: 0, fault: 0, totalGreenEnergyKWh: 0, moneySavedRM: 0, co2PreventedKg: 0, weather: null };
  devices: any[] = [];
  projects: any[] = [];
  selectedProjectId: number | null = null;
  selectedTimeFilter: 'week' | 'month' | 'year' | 'all' = 'all';

  selectedYear: number = new Date().getFullYear();
  selectedMonth: string = format(new Date(), 'yyyy-MM');
  selectedWeek: string = this.getCurrentWeekString();

  pieChartInstance: Chart | null = null;
  barChartInstance: Chart | null = null;
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
    addIcons({ batteryHalfOutline, powerOutline, alertCircleOutline, statsChartOutline, warningOutline, pulseOutline });
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
    let url = `${environment.apiUrl}/api/solar/dashboard/summary`;
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
        let summaryData = { ...data };
        if (this.authService.isMbsAdmin) {
            const cloneCount = Object.keys(this.authService.MBS_CLONE_MAPPING).length;
            summaryData.total += cloneCount;
            if (summaryData.online > 0) summaryData.online += cloneCount;
            else if (summaryData.offline > 0) summaryData.offline += cloneCount;
        }
        this.summary = summaryData;
        if (this.batteryChart) this.renderCharts();
      },
      error: (err) => console.error('Error fetching solar dashboard summary:', err)
    });
  }

  fetchHistoricalData() {
    const user = this.authService.getCurrentUser();
    let url = `${environment.apiUrl}/api/solar/dashboard/graph`;
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
      error: (err) => console.error('Error fetching solar historical data:', err)
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
            let url = `${environment.apiUrl}/api/solar/dashboard/reset-stats`;
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
      this.reportService.getOverviewReport(targetProjectId, this.selectedTimeFilter, 'solar', startDate || undefined, endDate || undefined).subscribe({
        next: (data) => {
          this.reportData = data;
          setTimeout(async () => {
            if (this.reportComponent) {
              await this.reportComponent.downloadPdf();
              const toast = await this.toastController.create({ message: 'Report downloaded successfully!', color: 'success', duration: 3000 });
              toast.present();
            }
            this.isGeneratingReport = false;
            // We clear it out so it doesn't stay in memory, but give it a second just in case
            setTimeout(() => this.reportData = null, 1000);
          }, 1500); // Give chart.js time to render
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
    let url = `${environment.apiUrl}/api/solar/devices`;
    const targetProjectId = this.isSuperAdmin ? this.selectedProjectId : user?.projectId;
    if (targetProjectId) {
      url += `?projectId=${targetProjectId}`;
    }

    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        let finalData = [...data];
        
        if (this.authService.isMbsAdmin) {
          const clones: any[] = [];
          data.forEach(device => {
            if (device.serial && this.authService.MBS_CLONE_MAPPING[device.serial]) {
              const cloneConfig = this.authService.MBS_CLONE_MAPPING[device.serial];
              clones.push({
                ...device,
                name: cloneConfig.name,
                serial: cloneConfig.serial,
                isClone: true,
                real_serial: device.serial
              });
            }
          });
          finalData = [...finalData, ...clones];
        }

        this.devices = finalData;
        if (this.energyChart) this.renderCharts();
        this.updateMapMarkers();
      },
      error: (err) => console.error('Error fetching solar devices for chart:', err)
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

        let statusColor = d.is_online ? (d.battery_percent < 20 ? 'red' : 'green') : 'gray';

        marker.bindPopup(`
          <div style="font-family: sans-serif;">
            <b style="font-size: 14px;">${d.name || d.serial}</b><br/><br/>
            <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
               <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${d.is_online ? '#10b981' : '#ef4444'};"></span>
               <span>${d.is_online ? 'Online' : 'Offline'}</span>
            </div>
            <div>🔋 Battery: <b>${d.battery_percent ?? '--'}%</b></div>
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
    if (!this.batteryChart || !this.energyChart) return;
    if (this.pieChartInstance) this.pieChartInstance.destroy();
    if (this.barChartInstance) this.barChartInstance.destroy();

    const barCtx1 = this.batteryChart.nativeElement.getContext('2d');

    // Sort devices by battery percent (lowest first) and take top 15
    const batteryDevices = [...this.devices].filter(d => d.battery_percent !== null).sort((a, b) => (a.battery_percent || 0) - (b.battery_percent || 0)).slice(0, 15);
    const batLabels = batteryDevices.map(d => d.name || d.serial);
    const batPercents = batteryDevices.map(d => d.battery_percent || 0);

    this.pieChartInstance = new Chart(barCtx1, {
      type: 'bar',
      data: {
        labels: batLabels.length > 0 ? batLabels : ['No Data'],
        datasets: [{
          label: 'Battery Percentage (%)',
          data: batPercents.length > 0 ? batPercents : [0],
          backgroundColor: batPercents.map(p => p < 20 ? '#eb445a' : p < 50 ? '#ffc409' : '#2dd36f'),
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

    const barCtx = this.energyChart.nativeElement.getContext('2d');

    // Sort devices by solar power and take top 10
    const sortedDevices = [...this.devices].sort((a, b) => (b.solar_panel_power || 0) - (a.solar_panel_power || 0)).slice(0, 10);
    const labels = sortedDevices.map(d => d.name || d.serial);
    const powers = sortedDevices.map(d => d.solar_panel_power || 0);

    this.barChartInstance = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['No Data'],
        datasets: [{
          label: 'Live Solar Power (W)',
          data: powers.length > 0 ? powers : [0],
          backgroundColor: '#ffd534',
          borderRadius: 6,
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

  renderHistoricalChart(data: any[]) {
    if (!this.historicalChart) return;
    if (this.historicalChartInstance) this.historicalChartInstance.destroy();

    const ctx = this.historicalChart.nativeElement.getContext('2d');
    const labels = data.map(d => d.date);
    const energyData = data.map(d => d.energyGeneratedKWh);

    this.historicalChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length > 0 ? labels : ['No Data'],
        datasets: [{
          label: 'Green Energy (kWh)',
          data: energyData.length > 0 ? energyData : [0],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
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
