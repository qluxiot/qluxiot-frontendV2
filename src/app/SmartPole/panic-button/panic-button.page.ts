import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircle, checkmarkCircle, locationOutline, timeOutline,
  batteryFullOutline, batteryHalfOutline, batteryDeadOutline,
  wifiOutline, shieldCheckmarkOutline, notificationsOutline,
  hardwareChipOutline, videocamOutline, callOutline
} from 'ionicons/icons';
import { CustomHeaderComponent } from '../../components/custom-header/custom-header.component';
import { environment } from '../../../environments/environment';

export interface PanicButtonDevice {
  id: number;
  name: string;
  poleId: string;
  serialNumber?: string;
  ipAddress?: string;
  macAddress?: string;
  location: string;
  status: 'standby' | 'active' | 'offline';
  isOnline: boolean;
  battery: number;
  lastPressed: string;
  pressedBy: string | null;
  responseTime: string | null;
  incidentCount: number;
  lastChecked: string;
  signalStrength: number;
  rtspUrl?: string;
  webrtcUrl?: string;
}

@Component({
  selector: 'app-panic-button',
  templateUrl: './panic-button.page.html',
  styleUrls: ['./panic-button.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonIcon,
    CustomHeaderComponent
  ]
})
export class PanicButtonPage implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private checkInterval: any;
  selectedFilter: 'all' | 'active' | 'standby' | 'offline' = 'all';

  // Real Hardware device connected via Localhost Gateway
  devices: PanicButtonDevice[] = [
    {
      id: 1,
      name: 'Panic Button PB-01',
      poleId: 'SP-001',
      serialNumber: '202217230199222',
      ipAddress: '192.168.155.241',
      macAddress: 'b0:a8:79:7a:ba:98',
      location: 'Smart Pole 01 (Bertam / Local Lab)',
      status: 'standby',
      isOnline: true,
      battery: 100,
      lastPressed: 'Never',
      pressedBy: null,
      responseTime: null,
      incidentCount: 0,
      lastChecked: 'Just now',
      signalStrength: 5,
      rtspUrl: 'rtsp://192.168.155.241:554',
      webrtcUrl: 'http://localhost:8889/panic_button/'
    }
  ];

  get filteredDevices(): PanicButtonDevice[] {
    if (this.selectedFilter === 'all') return this.devices;
    return this.devices.filter(d => d.status === this.selectedFilter);
  }

  get totalDevices() { return this.devices.length; }
  get activeAlerts() { return this.devices.filter(d => d.status === 'active').length; }
  get standbyCount() { return this.devices.filter(d => d.status === 'standby').length; }
  get offlineCount() { return this.devices.filter(d => d.status === 'offline').length; }

  getStatusColor(status: PanicButtonDevice['status']): string {
    const map: Record<string, string> = {
      active: '#ef4444', standby: '#10b981', offline: '#94a3b8'
    };
    return map[status] || '#94a3b8';
  }

  getStatusLabel(status: PanicButtonDevice['status']): string {
    const map: Record<string, string> = {
      active: 'ALERT ACTIVE', standby: 'Standby', offline: 'Offline'
    };
    return map[status] || 'Unknown';
  }

  getBatteryIcon(level: number): string {
    if (level > 60) return 'battery-full-outline';
    if (level > 25) return 'battery-half-outline';
    return 'battery-dead-outline';
  }

  constructor() {
    addIcons({
      alertCircle, checkmarkCircle, locationOutline, timeOutline,
      batteryFullOutline, batteryHalfOutline, batteryDeadOutline,
      wifiOutline, shieldCheckmarkOutline, notificationsOutline,
      hardwareChipOutline, videocamOutline, callOutline
    });
  }

  ngOnInit() {
    this.fetchDevices();
    // Poll real-time status every 1 second from backend localhost
    this.checkInterval = setInterval(() => this.fetchDevices(), 1000);
  }

  ngOnDestroy() {
    if (this.checkInterval) clearInterval(this.checkInterval);
  }

  public fetchDevices() {
    this.http.get<PanicButtonDevice[]>(`${environment.apiUrl}/api/panic-button/devices`).subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.devices = [...data];
          this.cdr.detectChanges();
        }
      },
      error: () => {
        // preserve current state on temporary network lapse
      }
    });
  }

  public triggerManualAlarm(device: PanicButtonDevice) {
    this.http.post<PanicButtonDevice>(`${environment.apiUrl}/api/panic-button/trigger`, {
      pressedBy: 'Web Console Operator (Manual Test)'
    }).subscribe({
      next: (updated) => {
        if (updated) {
          this.devices = [updated];
          this.cdr.detectChanges();
        }
      }
    });
  }

  public dismissAlarm(device: PanicButtonDevice) {
    this.http.post<PanicButtonDevice>(`${environment.apiUrl}/api/panic-button/dismiss`, {
      operatorName: 'Control Center Operator'
    }).subscribe({
      next: (updated) => {
        if (updated) {
          this.devices = [updated];
          this.cdr.detectChanges();
        }
      }
    });
  }
}
