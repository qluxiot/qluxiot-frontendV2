import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
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
    IonContent,
    IonIcon,
    CustomHeaderComponent
  ]
})
export class EnvironmentalPage implements OnInit, OnDestroy {

  selectedPoleId: number = 1;
  private refreshInterval: any;

  poles: SmartPole[] = [
    {
      id: 1,
      name: 'Smart Pole SP-001 (Live Gateway NJ-530)',
      location: 'Labuan Smart Pole Live Station',
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

  get selectedPole(): SmartPole {
    return this.poles.find(p => p.id === this.selectedPoleId) || this.poles[0];
  }

  get totalPoles(): number { return this.poles.length; }
  get onlinePoles(): number { return this.poles.filter(p => p.isOnline).length; }
  get offlinePoles(): number { return this.poles.filter(p => !p.isOnline).length; }
  get alertCount(): number {
    return this.selectedPole.readings.filter(r => r.status === 'danger' || r.status === 'warning').length;
  }

  get aqiLevel(): { label: string; color: string; value: number } {
    const pm25 = this.selectedPole.readings.find(r => r.label === 'PM2.5')?.value ?? 0;
    if (!this.selectedPole.isOnline) return { label: 'Offline', color: '#94a3b8', value: 0 };
    if (pm25 <= 12) return { label: 'Good', color: '#10b981', value: Math.round(pm25 * 4) };
    if (pm25 <= 35.4) return { label: 'Moderate', color: '#f59e0b', value: Math.round(pm25 * 2.2) };
    if (pm25 <= 55.4) return { label: 'Unhealthy (Sensitive)', color: '#f97316', value: Math.round(pm25 * 1.5) };
    return { label: 'Unhealthy', color: '#ef4444', value: Math.round(pm25 * 1.2) };
  }

  constructor(private http: HttpClient) {
    addIcons({
      thermometerOutline, waterOutline, leafOutline, cloudOutline,
      eyeOutline, flashOutline, wifiOutline, locationOutline,
      checkmarkCircle, alertCircle, warningOutline
    });
  }

  ngOnInit() {
    this.fetchLiveTelemetry();
    // Poll live backend endpoint every 2 seconds
    this.refreshInterval = setInterval(() => {
      this.fetchLiveTelemetry();
    }, 2000);
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

  private fetchLiveTelemetry() {
    this.http.get<any>(`${environment.apiUrl}/api/environmental/live`).subscribe({
      next: (data) => {
        if (!data) return;
        const pole = this.poles[0]; // SP-001 connected to live hardware
        pole.isOnline = data.isOnline;
        pole.lastUpdated = 'just now';

        // Update each sensor metric
        this.updateReading(pole, 'Temperature', data.temperature, '°C', data.temperature > 35 ? 'danger' : data.temperature > 31 ? 'warning' : 'good');
        this.updateReading(pole, 'Humidity', data.humidity, '%', data.humidity > 80 ? 'warning' : 'good');
        this.updateReading(pole, 'PM2.5', data.pm25, 'µg/m³', data.pm25 > 55 ? 'danger' : data.pm25 > 35 ? 'warning' : 'good');
        this.updateReading(pole, 'PM10', data.pm10, 'µg/m³', data.pm10 > 100 ? 'danger' : data.pm10 > 50 ? 'warning' : 'good');
        this.updateReading(pole, 'CO₂', data.co2 || 415, 'ppm', (data.co2 || 415) > 1000 ? 'warning' : 'good');
        this.updateReading(pole, 'Noise Level', data.noise, 'dB', data.noise > 75 ? 'danger' : data.noise > 65 ? 'warning' : 'good');
        this.updateReading(pole, 'Pressure', data.pressure, 'kPa', 'good');
        this.updateReading(pole, 'Wind Speed', data.windSpeed, 'm/s', data.windSpeed > 10 ? 'warning' : 'good');
      },
      error: () => {
        // If backend connection fails, mark live pole offline
        this.poles[0].isOnline = false;
        this.poles[0].lastUpdated = 'offline';
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
