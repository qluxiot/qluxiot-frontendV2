import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  IonContent, IonRefresher, IonRefresherContent, ToastController
} from '@ionic/angular/standalone';
import { CustomHeaderComponent } from '../../components/custom-header/custom-header.component';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-uc100-monitoring',
  templateUrl: './monitoring.page.html',
  styleUrls: ['./monitoring.page.scss'],
  standalone: true,
  imports: [CustomHeaderComponent, IonContent, IonRefresher, IonRefresherContent, CommonModule, FormsModule],
})
export class Uc100MonitoringPage implements OnInit {
  devices: any[] = [];
  filteredDevices: any[] = [];
  searchQuery = '';
  isLoading = false;

  // Control panel state
  selectedDevice: any = null;
  dimValue = 100;
  isSendingCommand = false;
  showControlPanel = false;

  // Multi-select & Timer Modal
  selectedDevEuis: Set<string> = new Set();
  showTimerModal = false;
  isSendingTimer = false;
  
  // JKR Spec defaults
  timer1Hours = 4;
  timer2Hours = 2;
  timer3Hours = 6;
  timer1Dim = 100;
  timer2Dim = 60;
  timer3Dim = 40;

  readonly API = `${environment.apiUrl}/api/uc100`;

  constructor(private http: HttpClient, private toastCtrl: ToastController, private authService: AuthService) { }

  ngOnInit() { this.fetchData(); }
  ionViewWillEnter() { this.fetchData(); }

  fetchData(event?: any) {
    this.isLoading = true;
    let url = `${this.API}/devices`;
    const user = this.authService.getCurrentUser();
    const targetProjectId = this.authService.isSuperAdmin() ? null : user?.projectId;
    if (targetProjectId) url += `?projectId=${targetProjectId}`;

    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        this.devices = data;
        this.applyFilter();
        // If a device was selected, refresh its data too
        if (this.selectedDevice) {
          const updated = data.find(d => d.dev_eui === this.selectedDevice.dev_eui);
          if (updated) this.selectedDevice = updated;
        }
        setTimeout(() => { this.isLoading = false; if (event) event.target.complete(); }, 600);
      },
      error: () => { this.isLoading = false; if (event) event.target.complete(); }
    });
  }

  applyFilter() {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredDevices = q
      ? this.devices.filter(d => d.name?.toLowerCase().includes(q) || d.dev_eui?.toLowerCase().includes(q))
      : [...this.devices];
  }

  openControlPanel(device: any) {
    this.selectedDevice = device;
    this.dimValue = device.brightness_setting ?? 100;
    this.showControlPanel = true;
  }

  closeControlPanel() {
    this.showControlPanel = false;
    this.selectedDevice = null;
  }

  async sendAction(action: 'ON' | 'OFF' | 'DIM' | 'SET_TIMERS', options?: any) {
    if (!this.selectedDevice || this.isSendingCommand) return;
    this.isSendingCommand = true;

    const body: any = { action, ...options };
    this.http.post(`${this.API}/devices/${this.selectedDevice.dev_eui}/action`, body).subscribe({
      next: async () => {
        this.isSendingCommand = false;
        const toast = await this.toastCtrl.create({
          message: `✅ Command "${action}" sent successfully to ${this.selectedDevice.name || this.selectedDevice.dev_eui}`,
          duration: 3000, color: 'success', position: 'bottom'
        });
        toast.present();
        setTimeout(() => this.fetchData(), 2000); // Refresh after 2s to see result
      },
      error: async (err) => {
        this.isSendingCommand = false;
        const toast = await this.toastCtrl.create({
          message: `❌ Failed to send command: ${err.error?.message || err.message || 'Unknown error'}`,
          duration: 4000, color: 'danger', position: 'bottom'
        });
        toast.present();
      }
    });
  }

  turnOn() { this.sendAction('ON'); }
  turnOff() { this.sendAction('OFF'); }
  applyDim() { this.sendAction('DIM', { power: this.dimValue }); }

  // ── Multi-select checkbox logic ─────────────────────────────────────────────

  get allPageSelected(): boolean {
    return this.filteredDevices.length > 0 && this.filteredDevices.every(d => this.selectedDevEuis.has(d.dev_eui));
  }

  toggleSelect(devEui: string, event: Event) {
    event.stopPropagation(); // prevent opening control panel
    if (this.selectedDevEuis.has(devEui)) {
      this.selectedDevEuis.delete(devEui);
    } else {
      this.selectedDevEuis.add(devEui);
    }
    this.selectedDevEuis = new Set(this.selectedDevEuis);
  }

  toggleSelectAll() {
    if (this.allPageSelected) {
      this.filteredDevices.forEach(d => this.selectedDevEuis.delete(d.dev_eui));
    } else {
      this.filteredDevices.forEach(d => this.selectedDevEuis.add(d.dev_eui));
    }
    this.selectedDevEuis = new Set(this.selectedDevEuis);
  }

  clearSelection() {
    this.selectedDevEuis = new Set();
  }

  // ── Timer & Dimming Modal ───────────────────────────────────────────────────

  openTimerModal() {
    if (this.selectedDevEuis.size === 0) return;
    // Reset to JKR defaults every time modal opens
    this.timer1Hours = 4;
    this.timer2Hours = 2;
    this.timer3Hours = 6;
    this.timer1Dim = 100;
    this.timer2Dim = 60;
    this.timer3Dim = 40;
    this.showTimerModal = true;
  }

  closeTimerModal() {
    this.showTimerModal = false;
  }

  async applyTimersToSelected() {
    if (this.selectedDevEuis.size === 0 || this.isSendingTimer) return;
    this.isSendingTimer = true;

    const body = {
      action: 'SET_TIMERS',
      timer1: this.timer1Hours * 3600,
      timer2: this.timer2Hours * 3600,
      timer3: this.timer3Hours * 3600,
      timer1Dim: this.timer1Dim,
      timer2Dim: this.timer2Dim,
      timer3Dim: this.timer3Dim,
    };

    const devEuiList = Array.from(this.selectedDevEuis);
    let successCount = 0;
    let failCount = 0;

    for (const devEui of devEuiList) {
      try {
        await this.http.post(`${this.API}/devices/${devEui}/action`, body).toPromise();
        successCount++;
      } catch {
        failCount++;
      }
    }

    this.isSendingTimer = false;
    this.showTimerModal = false;
    this.clearSelection();

    const toast = await this.toastCtrl.create({
      message: failCount === 0
        ? `✅ Timer & Dimming applied to ${successCount} device(s) successfully!`
        : `⚠️ Applied to ${successCount} device(s). ${failCount} failed.`,
      color: failCount === 0 ? 'success' : 'warning',
      duration: 4000,
      position: 'bottom',
    });
    toast.present();
    setTimeout(() => this.fetchData(), 2000);
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
