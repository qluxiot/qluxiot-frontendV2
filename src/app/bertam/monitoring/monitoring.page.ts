import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  IonContent,
  IonRefresher,
  IonRefresherContent,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  refreshOutline,
  sunnyOutline,
  alertCircleOutline,
  batteryHalfOutline,
  flashOutline,
} from 'ionicons/icons';
import { CustomHeaderComponent } from '../../components/custom-header/custom-header.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-bertam-monitoring',
  templateUrl: './monitoring.page.html',
  styleUrls: ['./monitoring.page.scss'],
  standalone: true,
  imports: [
    CustomHeaderComponent,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    CommonModule,
    FormsModule,
  ],
})
export class BertamMonitoringPage implements OnInit {
  devices: any[] = [];
  filteredDevices: any[] = [];
  selectedSite: string = 'All';
  searchQuery: string = '';
  readonly API = `${environment.apiUrl}/api/bertam`;

  isLoading: boolean = false;

  constructor(private http: HttpClient, private toastCtrl: ToastController) {
    addIcons({
      refreshOutline,
      sunnyOutline,
      alertCircleOutline,
      batteryHalfOutline,
      flashOutline,
    });
  }

  ngOnInit() {
    this.fetchData();
  }

  ionViewWillEnter() {
    this.fetchData();
  }

  fetchData(event?: any) {
    this.isLoading = true;
    this.http.get<any[]>(`${this.API}/devices`).subscribe({
      next: (data) => {
        this.devices = data;
        this.applyFilter();
        
        // Artificial delay so the user sees the "Fetching from cloud" spinner 
        // since the MQTT database pull is near-instant.
        setTimeout(() => {
          this.isLoading = false;
          if (event) event.target.complete();
        }, 800);
      },
      error: (err) => {
        console.error('Failed to load Bertam devices', err);
        this.isLoading = false;
        if (event) event.target.complete();
      },
    });
  }

  applyFilter() {
    let filtered = this.devices;

    if (this.selectedSite !== 'All') {
      filtered = filtered.filter(d => (d.site_name || 'Site 2') === this.selectedSite);
    }

    if (this.searchQuery && this.searchQuery.trim() !== '') {
      const q = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(d => 
        (d.name?.toLowerCase().includes(q) || d.dev_eui?.toLowerCase().includes(q))
      );
    }

    this.filteredDevices = filtered;
  }

  getBrightnessLabel(code: number): string {
    const map: Record<number, string> = { 58368: '100%', 48128: '60%', 43008: '40%' };
    return map[code] ?? (code != null ? `${code}` : '--');
  }

  /** Treat bare datetime strings (no tz) as Malaysia time (+08:00) to avoid +8h display shift */
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
