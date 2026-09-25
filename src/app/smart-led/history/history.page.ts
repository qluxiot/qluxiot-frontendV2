import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  IonContent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline, flashOutline, batteryHalfOutline, bulbOutline, thermometerOutline, calendarOutline, wifiOutline, hardwareChipOutline } from 'ionicons/icons';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartConfiguration, ChartOptions, ChartType } from 'chart.js';
import { CustomHeaderComponent } from '../../components/custom-header/custom-header.component';
import { environment } from '../../../environments/environment';
import { format, parseISO, subDays, addDays } from 'date-fns';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-led-history',
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
  standalone: true,
  imports: [CustomHeaderComponent, IonContent, CommonModule, FormsModule, BaseChartDirective],
  providers: [provideCharts(withDefaultRegisterables())]
})
export class HistoryPage implements OnInit {
  devices: any[] = [];
  selectedDevice: any = null;
  selectedDateIso: string = new Date().toISOString();
  selectedDate: string = format(new Date(), 'yyyy-MM-dd');
  selectedInterval: string = '30';

  projects: any[] = [];
  selectedProjectId: number | null = null;
  
  get isAdmin(): boolean { return this.authService.isAdmin(); }
  get isSuperAdmin(): boolean { return this.authService.isSuperAdmin(); }

  // Chart Properties
  public lineChartType: ChartType = 'line';
  public chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    elements: {
      line: { tension: 0.4, borderWidth: 2 },
      point: { radius: 2, hitRadius: 10, hoverRadius: 4 }
    },
    scales: {
      x: { grid: { display: false } },
      y: { border: { display: false }, grid: { color: '#f1f5f9' }, beginAtZero: true }
    },
    plugins: {
      legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 6 } }
    }
  };

  // Electrical Chart Data
  public electricalChartData: ChartConfiguration['data'] = { datasets: [], labels: [] };
  // Brightness Chart Data
  public brightnessChartData: ChartConfiguration['data'] = { datasets: [], labels: [] };

  constructor(private http: HttpClient, private authService: AuthService) {
    addIcons({ chevronBackOutline, chevronForwardOutline, flashOutline, batteryHalfOutline, bulbOutline, thermometerOutline, calendarOutline, wifiOutline, hardwareChipOutline });
  }

  ngOnInit() {
    this.fetchDevices();
    if (this.isSuperAdmin) {
      this.http.get<any[]>(`${environment.apiUrl}/api/projects`).subscribe({
        next: (data) => { this.projects = data; }
      });
    }
  }

  onProjectFilterChange() {
    this.selectedDevice = null;
    this.fetchDevices();
  }

  ionViewWillEnter() {
    this.fetchDevices();
    if (this.selectedDevice) {
      this.fetchHistory();
    }
  }

  fetchDevices() {
    const user = this.authService.getCurrentUser();
    let url = `${environment.apiUrl}/api/led/devices`;
    
    const projectId = this.isSuperAdmin ? this.selectedProjectId : user?.projectId;
    if (projectId) {
      url += `?projectId=${projectId}`;
    }

    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        this.devices = data;
        if (this.devices.length > 0 && !this.selectedDevice) {
          this.selectDevice(this.devices[0]);
        }
      },
      error: (err) => console.error('Error fetching LED devices for history', err)
    });
  }

  selectDevice(device: any) {
    this.selectedDevice = device;
    this.fetchHistory();
  }

  prevDate() {
    const d = parseISO(this.selectedDate);
    this.selectedDate = format(subDays(d, 1), 'yyyy-MM-dd');
    this.selectedDateIso = subDays(d, 1).toISOString();
    this.fetchHistory();
  }

  nextDate() {
    const d = parseISO(this.selectedDate);
    this.selectedDate = format(addDays(d, 1), 'yyyy-MM-dd');
    this.selectedDateIso = addDays(d, 1).toISOString();
    this.fetchHistory();
  }

  onDateChange() {
    if (this.selectedDateIso) {
      this.selectedDate = format(parseISO(this.selectedDateIso), 'yyyy-MM-dd');
      this.fetchHistory();
    }
  }

  fetchHistory() {
    if (!this.selectedDevice) return;

    this.http.get<any[]>(`${environment.apiUrl}/api/led/devices/${this.selectedDevice.serial}/history/${this.selectedDate}`).subscribe({
      next: (data) => {
        this.processChartData(data);
      },
      error: (err) => console.error('Error fetching LED history', err)
    });
  }

  processChartData(data: any[]) {
    // Filter out duplicate timestamps in case the cron job ran multiple times for the same data point
    let validData = data;
    if (data && data.length > 0) {
      const seenTimestamps = new Set();
      validData = data.filter(d => {
        if (!d.timestamp) return false;
        
        // Stale data filtering for offline devices
        const tsNumber = Number(d.timestamp);
        if (isNaN(tsNumber)) return false;
        const recordDateStr = format(new Date(tsNumber), 'yyyy-MM-dd');
        if (recordDateStr !== this.selectedDate) return false;

        // Duplicate timestamp filtering
        if (seenTimestamps.has(d.timestamp)) return false;
        seenTimestamps.add(d.timestamp);
        return true;
      });
    }

    if (!validData || validData.length === 0) {
      this.electricalChartData = { labels: [], datasets: [] };
      this.brightnessChartData = { labels: [], datasets: [] };
      return;
    }

    // Determine the number of buckets and interval in minutes
    const intervalMinutes = this.selectedInterval === '60' ? 60 : 30;
    const totalBuckets = 24 * 60 / intervalMinutes;
    
    // Create an array of full day buckets
    const fullDayBuckets: { label: string; items: any[] }[] = [];
    for (let i = 0; i < totalBuckets; i++) {
      const totalMins = i * intervalMinutes;
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      const label = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      fullDayBuckets.push({ label, items: [] });
    }

    // Group the data into the buckets
    validData.forEach(d => {
      // Parse the datetime to get the bucket
      const date = parseISO(d.created_datetime);
      const h = date.getHours();
      const m = date.getMinutes();
      
      let bucketIndex;
      if (intervalMinutes === 60) {
        bucketIndex = h;
      } else {
        // 30 minute buckets
        bucketIndex = h * 2 + (m >= 30 ? 1 : 0);
      }
      
      if (bucketIndex >= 0 && bucketIndex < totalBuckets) {
        fullDayBuckets[bucketIndex].items.push(d);
      }
    });

    // Process each bucket (average if there are items, otherwise null)
    const labels = fullDayBuckets.map(b => b.label);
    
    const extractAvg = (bucketItems: any[], field: string) => {
      if (bucketItems.length === 0) return null;
      return bucketItems.reduce((sum, item) => sum + Number(item[field] || 0), 0) / bucketItems.length;
    };

    const voltageData = fullDayBuckets.map(b => extractAvg(b.items, 'voltage'));
    const currentData = fullDayBuckets.map(b => {
      const avg = extractAvg(b.items, 'current');
      return avg !== null ? avg : null; // Current is already in Amps
    });
    const powerData = fullDayBuckets.map(b => extractAvg(b.items, 'active_power'));

    const b1Data = fullDayBuckets.map(b => extractAvg(b.items, 'brightness'));
    const b2Data = fullDayBuckets.map(b => extractAvg(b.items, 'brightness2'));

    // Electrical
    this.electricalChartData = {
      labels,
      datasets: [
        { data: voltageData as number[], label: 'Voltage (V)', borderColor: '#3b82f6', backgroundColor: '#3b82f6', spanGaps: true },
        { data: currentData as number[], label: 'Current (A)', borderColor: '#06b6d4', backgroundColor: '#06b6d4', spanGaps: true },
        { data: powerData as number[], label: 'Power (W)', borderColor: '#ef4444', backgroundColor: '#ef4444', spanGaps: true }
      ]
    };

    // Brightness
    this.brightnessChartData = {
      labels,
      datasets: [
        { data: b1Data as number[], label: 'Brightness 1 (%)', borderColor: '#f59e0b', backgroundColor: '#f59e0b', spanGaps: true },
        { data: b2Data as number[], label: 'Brightness 2 (%)', borderColor: '#10b981', backgroundColor: '#10b981', spanGaps: true }
      ]
    };
  }
}
