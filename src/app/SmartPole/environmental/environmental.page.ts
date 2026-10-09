import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  thermometerOutline, waterOutline, leafOutline, cloudOutline,
  eyeOutline, flashOutline, wifiOutline, locationOutline,
  checkmarkCircle, alertCircle, warningOutline
} from 'ionicons/icons';
import { CustomHeaderComponent } from '../../components/custom-header/custom-header.component';

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
      name: 'Smart Pole SP-001',
      location: 'Jalan Utama, Labuan',
      isOnline: true,
      lastUpdated: '2 seconds ago',
      readings: [
        { label: 'Temperature', value: 32.4, unit: '°C', icon: 'thermometer-outline', iconColor: '#ef4444', bgColor: 'rgba(239,68,68,0.1)', status: 'warning', description: 'Slightly above comfortable range' },
        { label: 'Humidity', value: 78, unit: '%', icon: 'water-outline', iconColor: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)', status: 'good', description: 'Within normal range' },
        { label: 'PM2.5', value: 18.2, unit: 'µg/m³', icon: 'cloud-outline', iconColor: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)', status: 'good', description: 'Air quality is acceptable' },
        { label: 'PM10', value: 35.6, unit: 'µg/m³', icon: 'cloud-outline', iconColor: '#8b5cf6', bgColor: 'rgba(139,92,246,0.1)', status: 'good', description: 'Well within WHO guidelines' },
        { label: 'CO₂', value: 420, unit: 'ppm', icon: 'leaf-outline', iconColor: '#10b981', bgColor: 'rgba(16,185,129,0.1)', status: 'good', description: 'Normal atmospheric level' },
        { label: 'Noise Level', value: 62, unit: 'dB', icon: 'flash-outline', iconColor: '#f97316', bgColor: 'rgba(249,115,22,0.1)', status: 'warning', description: 'Moderate traffic noise' },
        { label: 'UV Index', value: 5.2, unit: 'UVI', icon: 'eye-outline', iconColor: '#eab308', bgColor: 'rgba(234,179,8,0.1)', status: 'warning', description: 'Moderate UV exposure' },
        { label: 'Wind Speed', value: 12.4, unit: 'km/h', icon: 'wifi-outline', iconColor: '#06b6d4', bgColor: 'rgba(6,182,212,0.1)', status: 'good', description: 'Light breeze conditions' },
      ]
    },
    {
      id: 2,
      name: 'Smart Pole SP-002',
      location: 'Persiaran Perdana, Labuan',
      isOnline: true,
      lastUpdated: '5 seconds ago',
      readings: [
        { label: 'Temperature', value: 34.8, unit: '°C', icon: 'thermometer-outline', iconColor: '#ef4444', bgColor: 'rgba(239,68,68,0.1)', status: 'danger', description: 'High temperature alert' },
        { label: 'Humidity', value: 85, unit: '%', icon: 'water-outline', iconColor: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)', status: 'warning', description: 'High humidity level' },
        { label: 'PM2.5', value: 55.1, unit: 'µg/m³', icon: 'cloud-outline', iconColor: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)', status: 'danger', description: 'Unhealthy for sensitive groups' },
        { label: 'PM10', value: 89.3, unit: 'µg/m³', icon: 'cloud-outline', iconColor: '#8b5cf6', bgColor: 'rgba(139,92,246,0.1)', status: 'warning', description: 'Approaching WHO guideline limit' },
        { label: 'CO₂', value: 510, unit: 'ppm', icon: 'leaf-outline', iconColor: '#10b981', bgColor: 'rgba(16,185,129,0.1)', status: 'warning', description: 'Slightly elevated near traffic' },
        { label: 'Noise Level', value: 75, unit: 'dB', icon: 'flash-outline', iconColor: '#f97316', bgColor: 'rgba(249,115,22,0.1)', status: 'danger', description: 'Heavy traffic area, loud' },
        { label: 'UV Index', value: 8.7, unit: 'UVI', icon: 'eye-outline', iconColor: '#eab308', bgColor: 'rgba(234,179,8,0.1)', status: 'danger', description: 'Very high UV — protection needed' },
        { label: 'Wind Speed', value: 5.1, unit: 'km/h', icon: 'wifi-outline', iconColor: '#06b6d4', bgColor: 'rgba(6,182,212,0.1)', status: 'good', description: 'Calm, low dispersion of pollutants' },
      ]
    },
    {
      id: 3,
      name: 'Smart Pole SP-003',
      location: 'Jalan OKK Awang Besar, Labuan',
      isOnline: false,
      lastUpdated: '2 hours ago',
      readings: [
        { label: 'Temperature', value: 0, unit: '°C', icon: 'thermometer-outline', iconColor: '#94a3b8', bgColor: 'rgba(148,163,184,0.1)', status: 'good', description: 'No data — device offline' },
        { label: 'Humidity', value: 0, unit: '%', icon: 'water-outline', iconColor: '#94a3b8', bgColor: 'rgba(148,163,184,0.1)', status: 'good', description: 'No data — device offline' },
        { label: 'PM2.5', value: 0, unit: 'µg/m³', icon: 'cloud-outline', iconColor: '#94a3b8', bgColor: 'rgba(148,163,184,0.1)', status: 'good', description: 'No data — device offline' },
        { label: 'PM10', value: 0, unit: 'µg/m³', icon: 'cloud-outline', iconColor: '#94a3b8', bgColor: 'rgba(148,163,184,0.1)', status: 'good', description: 'No data — device offline' },
        { label: 'CO₂', value: 0, unit: 'ppm', icon: 'leaf-outline', iconColor: '#94a3b8', bgColor: 'rgba(148,163,184,0.1)', status: 'good', description: 'No data — device offline' },
        { label: 'Noise Level', value: 0, unit: 'dB', icon: 'flash-outline', iconColor: '#94a3b8', bgColor: 'rgba(249,115,22,0.1)', status: 'good', description: 'No data — device offline' },
        { label: 'UV Index', value: 0, unit: 'UVI', icon: 'eye-outline', iconColor: '#94a3b8', bgColor: 'rgba(234,179,8,0.1)', status: 'good', description: 'No data — device offline' },
        { label: 'Wind Speed', value: 0, unit: 'km/h', icon: 'wifi-outline', iconColor: '#94a3b8', bgColor: 'rgba(6,182,212,0.1)', status: 'good', description: 'No data — device offline' },
      ]
    },
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
    if (!this.selectedPole.isOnline) return { label: 'No Data', color: '#94a3b8', value: 0 };
    if (pm25 <= 12) return { label: 'Good', color: '#10b981', value: Math.round(pm25 * 4) };
    if (pm25 <= 35.4) return { label: 'Moderate', color: '#f59e0b', value: Math.round(pm25 * 2.2) };
    if (pm25 <= 55.4) return { label: 'Unhealthy (Sensitive)', color: '#f97316', value: Math.round(pm25 * 1.5) };
    return { label: 'Unhealthy', color: '#ef4444', value: Math.round(pm25 * 1.2) };
  }

  constructor() {
    addIcons({
      thermometerOutline, waterOutline, leafOutline, cloudOutline,
      eyeOutline, flashOutline, wifiOutline, locationOutline,
      checkmarkCircle, alertCircle, warningOutline
    });
  }

  ngOnInit() {
    // Simulate live data updates every 5 seconds
    this.refreshInterval = setInterval(() => {
      this.simulateLiveUpdate();
    }, 5000);
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

  private simulateLiveUpdate() {
    this.poles.forEach(pole => {
      if (!pole.isOnline) return;
      pole.lastUpdated = 'just now';
      pole.readings.forEach(r => {
        // tiny fluctuation for simulation
        const delta = (Math.random() - 0.5) * 0.4;
        r.value = Math.max(0, parseFloat((r.value + delta).toFixed(1)));
      });
    });
  }
}
