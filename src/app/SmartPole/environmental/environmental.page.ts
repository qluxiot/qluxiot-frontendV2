import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  thermometerOutline, waterOutline, leafOutline, cloudOutline,
  eyeOutline, flashOutline, wifiOutline, locationOutline,
  checkmarkCircle, alertCircle, warningOutline
} from 'ionicons/icons';
import { CustomHeaderComponent } from '../../components/custom-header/custom-header.component';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

export interface SensorReading {
  label: string;
  value: number;
  unit: string;
  icon: string;
  iconColor: string;
  bgColor: string;
  status: 'good' | 'warning' | 'danger';
  description: string;
}

export interface SmartPole {
  id: number;
  name: string;
  location: string;
  projectId?: number | null;
  projectName?: string;
  isOnline: boolean;
  lastUpdated: string;
  readings: SensorReading[];
}

@Component({
  selector: 'app-environmental',
  templateUrl: './environmental.page.html',
  styleUrls: ['./environmental.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonIcon,
    CustomHeaderComponent
  ]
})
export class EnvironmentalPage implements OnInit, OnDestroy {

  projects: any[] = [];
  selectedProjectId: number | null = null;

  selectedPoleId: number = 1;
  private refreshInterval: any;
  historyData: any[] = [];
  selectedHistoryMetric: 'temperature' | 'humidity' | 'pm25' | 'pm10' | 'noise' = 'temperature';

  allPoles: SmartPole[] = [
    {
      id: 1,
      name: 'Qlux Smart Pole SP-001',
      location: 'Qlux Smart Pole SP-001',
      projectId: null,
      projectName: 'Qlux Device',
      isOnline: true,
      lastUpdated: 'just now',
      readings: [
        { label: 'Temperature', value: 0, unit: '°C', icon: 'thermometer-outline', iconColor: '#ef4444', bgColor: 'rgba(239,68,68,0.1)', status: 'good', description: 'Live ambient air temperature' },
        { label: 'Humidity', value: 0, unit: '%', icon: 'water-outline', iconColor: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)', status: 'good', description: 'Relative ambient humidity' },
        { label: 'PM2.5', value: 0, unit: 'µg/m³', icon: 'cloud-outline', iconColor: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)', status: 'good', description: 'Fine particulate matter PM2.5' },
        { label: 'PM10', value: 0, unit: 'µg/m³', icon: 'cloud-outline', iconColor: '#8b5cf6', bgColor: 'rgba(139,92,246,0.1)', status: 'good', description: 'Inhalable particulate matter PM10' },
        { label: 'CO₂', value: 0, unit: 'ppm', icon: 'leaf-outline', iconColor: '#10b981', bgColor: 'rgba(16,185,129,0.1)', status: 'good', description: 'Carbon dioxide concentration' },
        { label: 'Noise Level', value: 0, unit: 'dB', icon: 'flash-outline', iconColor: '#f97316', bgColor: 'rgba(249,115,22,0.1)', status: 'good', description: 'Ambient noise sound level' },
        { label: 'Pressure', value: 0, unit: 'kPa', icon: 'eye-outline', iconColor: '#eab308', bgColor: 'rgba(234,179,8,0.1)', status: 'good', description: 'Barometric air pressure' },
        { label: 'Wind Speed', value: 0, unit: 'm/s', icon: 'wifi-outline', iconColor: '#06b6d4', bgColor: 'rgba(6,182,212,0.1)', status: 'good', description: 'Ultrasonic wind velocity' },
      ]
    }
  ];

  get isSuperAdmin(): boolean {
    const user = this.authService.getCurrentUser();
    const role = user?.role?.toLowerCase().replace(/\s/g, '');
    return this.authService.isSuperAdmin() || role === 'superadmin';
  }

  get poles(): SmartPole[] {
    const user = this.authService.getCurrentUser();
    const targetProjectId = this.isSuperAdmin ? this.selectedProjectId : user?.projectId;

    // Super Admin with "All Projects"
    if (this.isSuperAdmin && targetProjectId === null) {
      return this.allPoles;
    }

    // If logged in as Qlux Device Admin (or project name is strictly Qlux Device), show Qlux devices
    if (this.authService.isQluxDeviceAdmin || user?.projectName?.toLowerCase().trim() === 'qlux device') {
      return this.allPoles.filter(p => p.projectName === 'Qlux Device' || !p.projectId);
    }

    // When a specific project is selected (Super Admin) or user belongs to a specific project
    if (targetProjectId !== null && targetProjectId !== undefined) {
      const proj = this.projects.find(p => p.id === targetProjectId);
      const projName = (proj ? proj.name : (user?.projectName || '')).toLowerCase().trim();

      return this.allPoles.filter(p => {
        if (p.projectId !== undefined && p.projectId !== null) {
          return Number(p.projectId) === Number(targetProjectId);
        }
        if (p.projectName && projName) {
          return p.projectName.toLowerCase().trim() === projName;
        }
        return false;
      });
    }

    return [];
  }

  get selectedPole(): SmartPole | null {
    if (this.poles.length === 0) return null;
    return this.poles.find(p => p.id === this.selectedPoleId) || this.poles[0];
  }

  get totalPoles(): number { return this.poles.length; }
  get onlinePoles(): number { return this.poles.filter(p => p.isOnline).length; }
  get offlinePoles(): number { return this.poles.filter(p => !p.isOnline).length; }
  get alertCount(): number {
    if (!this.selectedPole) return 0;
    return this.selectedPole.readings?.filter(r => r.status === 'danger' || r.status === 'warning').length || 0;
  }

  private calcSubAqi(c: number, breakpoints: [number, number, number, number][]): number {
    for (const [cLow, cHigh, iLow, iHigh] of breakpoints) {
      if (c <= cHigh) {
        return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (c - cLow) + iLow);
      }
    }
    return 500;
  }

  get aqiLevel(): { label: string; color: string; value: number } {
    if (!this.selectedPole) return { label: 'N/A', color: '#94a3b8', value: 0 };
    if (!this.selectedPole.isOnline) return { label: 'Offline', color: '#94a3b8', value: 0 };

    const pm25 = this.selectedPole.readings?.find(r => r.label === 'PM2.5')?.value ?? 0;
    const pm10 = this.selectedPole.readings?.find(r => r.label === 'PM10')?.value ?? 0;

    const aqi25 = this.calcSubAqi(pm25, [
      [0, 12.0, 0, 50],
      [12.1, 35.4, 51, 100],
      [35.5, 55.4, 101, 150],
      [55.5, 150.4, 151, 200],
      [150.5, 250.4, 201, 300],
      [250.5, 500.4, 301, 500],
    ]);
    const aqi10 = this.calcSubAqi(pm10, [
      [0, 54, 0, 50],
      [55, 154, 51, 100],
      [155, 254, 101, 150],
      [255, 354, 151, 200],
      [355, 424, 201, 300],
      [425, 604, 301, 500],
    ]);

    const value = Math.max(aqi25, aqi10);
    if (value <= 50) return { label: 'Good', color: '#10b981', value };
    if (value <= 100) return { label: 'Moderate', color: '#f59e0b', value };
    if (value <= 150) return { label: 'Unhealthy (Sensitive)', color: '#f97316', value };
    if (value <= 200) return { label: 'Unhealthy', color: '#ef4444', value };
    return { label: 'Very Unhealthy', color: '#991b1b', value };
  }

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    addIcons({
      thermometerOutline, waterOutline, leafOutline, cloudOutline,
      eyeOutline, flashOutline, wifiOutline, locationOutline,
      checkmarkCircle, alertCircle, warningOutline
    });
  }

  ngOnInit() {
    this.loadProjects();
    this.fetchLiveTelemetry();
    this.fetchHistory();
    // Poll live backend endpoint every 2 seconds
    this.refreshInterval = setInterval(() => {
      this.fetchLiveTelemetry();
    }, 2000);
  }

  loadProjects() {
    if (this.isSuperAdmin) {
      this.http.get<any[]>(`${environment.apiUrl}/api/projects`).subscribe({
        next: (data) => { this.projects = data; },
        error: (err) => console.error('Error loading projects', err)
      });
    }
  }

  onProjectFilterChange() {
    if (this.poles.length > 0 && !this.poles.some(p => p.id === this.selectedPoleId)) {
      this.selectedPoleId = this.poles[0].id;
    }
  }

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  selectPole(id: number) {
    this.selectedPoleId = id;
  }

  getStatusClass(status: 'good' | 'warning' | 'danger'): string {
    return {
      good: 'status-good',
      warning: 'status-warning',
      danger: 'status-danger'
    }[status];
  }

  getStatusBadgeText(status: 'good' | 'warning' | 'danger'): string {
    return { good: 'Normal', warning: 'Warning', danger: 'Alert' }[status];
  }

  fetchHistory() {
    this.http.get<any[]>(`${environment.apiUrl}/api/environmental/history?limit=48`).subscribe({
      next: (data) => {
        this.historyData = data || [];
      },
      error: (err) => console.error('Error loading environmental history', err)
    });
  }

  get historyPoints(): { x: number; y: number; value: number }[] {
    if (this.historyData.length === 0) return [];
    const vals = this.historyData.map(d => Number(d[this.selectedHistoryMetric] ?? 0));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const width = 600;
    const height = 140;
    const pad = 20;

    return vals.map((v, i) => {
      const x = vals.length === 1 ? width / 2 : (i / (vals.length - 1)) * (width - pad * 2) + pad;
      const y = height - pad - ((v - min) / range) * (height - pad * 2);
      return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), value: Number(v.toFixed(2)) };
    });
  }

  get historyPolyline(): string {
    if (this.historyPoints.length < 2) return '';
    return this.historyPoints.map(p => `${p.x},${p.y}`).join(' ');
  }

  get historyUnit(): string {
    const units: Record<string, string> = {
      temperature: '°C',
      humidity: '%',
      pm25: 'µg/m³',
      pm10: 'µg/m³',
      noise: 'dB'
    };
    return units[this.selectedHistoryMetric] || '';
  }

  private fetchLiveTelemetry() {
    this.http.get<any>(`${environment.apiUrl}/api/environmental/live`).subscribe({
      next: (data) => {
        if (!data) return;
        // Always update the base hardware pole in allPoles
        const hardwarePole = this.allPoles.find(p => p.id === 1);
        if (!hardwarePole) return;

        hardwarePole.isOnline = data.isOnline;
        hardwarePole.lastUpdated = 'just now';

        // Update each sensor metric
        this.updateReading(hardwarePole, 'Temperature', data.temperature, '°C', data.temperature > 35 ? 'danger' : data.temperature > 31 ? 'warning' : 'good');
        this.updateReading(hardwarePole, 'Humidity', data.humidity, '%', data.humidity > 80 ? 'warning' : 'good');
        this.updateReading(hardwarePole, 'PM2.5', data.pm25, 'µg/m³', data.pm25 > 55 ? 'danger' : data.pm25 > 35 ? 'warning' : 'good');
        this.updateReading(hardwarePole, 'PM10', data.pm10, 'µg/m³', data.pm10 > 100 ? 'danger' : data.pm10 > 50 ? 'warning' : 'good');
        this.updateReading(hardwarePole, 'CO₂', data.co2 || 415, 'ppm', (data.co2 || 415) > 1000 ? 'warning' : 'good');
        this.updateReading(hardwarePole, 'Noise Level', data.noise, 'dB', data.noise > 75 ? 'danger' : data.noise > 65 ? 'warning' : 'good');
        this.updateReading(hardwarePole, 'Pressure', data.pressure, 'kPa', 'good');
        this.updateReading(hardwarePole, 'Wind Speed', data.windSpeed, 'm/s', data.windSpeed > 10 ? 'warning' : 'good');
      },
      error: () => {
        const hardwarePole = this.allPoles.find(p => p.id === 1);
        if (hardwarePole) {
          hardwarePole.isOnline = false;
          hardwarePole.lastUpdated = 'offline';
        }
      }
    });
  }

  private updateReading(pole: SmartPole, label: string, value: number, unit: string, status: 'good' | 'warning' | 'danger') {
    const reading = pole.readings.find(r => r.label === label);
    if (reading) {
      reading.value = value;
      reading.unit = unit;
      reading.status = status;
    }
  }
}
