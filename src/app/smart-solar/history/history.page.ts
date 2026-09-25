import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  IonContent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline, flashOutline, batteryHalfOutline, bulbOutline, thermometerOutline, calendarOutline, wifiOutline } from 'ionicons/icons';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartConfiguration, ChartOptions, ChartType } from 'chart.js';
import { CustomHeaderComponent } from '../../components/custom-header/custom-header.component';
import { environment } from '../../../environments/environment';
import { format, parseISO, subDays, addDays } from 'date-fns';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-history',
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

  // Solar Chart Data
  public solarChartData: ChartConfiguration['data'] = { datasets: [], labels: [] };
  // Battery Chart Data
  public batteryChartData: ChartConfiguration['data'] = { datasets: [], labels: [] };
  // Load Chart Data
  public loadChartData: ChartConfiguration['data'] = { datasets: [], labels: [] };
  // Temperature Chart Data
  public tempChartData: ChartConfiguration['data'] = { datasets: [], labels: [] };

  constructor(private http: HttpClient, private authService: AuthService) {
    addIcons({ chevronBackOutline, chevronForwardOutline, flashOutline, batteryHalfOutline, bulbOutline, thermometerOutline, calendarOutline, wifiOutline });
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
    let url = `${environment.apiUrl}/api/solar/solar-monitoring`;
    
    const projectId = this.isSuperAdmin ? this.selectedProjectId : user?.projectId;
    if (projectId) {
      url += `?projectId=${projectId}`;
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
        if (this.devices.length > 0 && !this.selectedDevice) {
          this.selectDevice(this.devices[0]);
        }
      },
      error: (err) => console.error('Error fetching devices', err)
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

    let targetSerial = this.selectedDevice.serial;
    if (this.selectedDevice.isClone && this.selectedDevice.real_serial) {
       targetSerial = this.selectedDevice.real_serial;
    }

    this.http.get<any[]>(`${environment.apiUrl}/api/solar/devices/${targetSerial}/history/${this.selectedDate}`).subscribe({
      next: (data) => {
        this.processChartData(data);
      },
      error: (err) => console.error('Error fetching history', err)
    });
  }

  guessMaxWattage(power: number): number {
    const standards = [30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300];
    for (const std of standards) {
      if (power <= std + 5) {
        return std;
      }
    }
    return Math.ceil(power / 50) * 50;
  }

  getDeviceMaxWattage(device: any, currentPower: number): number {
    if (!device || !device.serial) return 30; 
    const key = `qlux_max_wattage_${device.serial}`;
    let storedMax = parseInt(localStorage.getItem(key) || '0', 10);
    let currentCapacity = this.guessMaxWattage(currentPower);
    if (currentCapacity > storedMax) {
      storedMax = currentCapacity;
      localStorage.setItem(key, storedMax.toString());
    }
    return storedMax > 0 ? storedMax : 30;
  }

  getBrightnessPercentage(ledPower: number): number {
    if (ledPower == null || ledPower <= 0) return 0;
    const maxWattage = this.getDeviceMaxWattage(this.selectedDevice, ledPower);
    const percent = Math.round((ledPower / maxWattage) * 100);
    if (percent >= 94) return 100;
    return percent > 100 ? 100 : percent;
  }

  processChartData(data: any[]) {
    // Filter out stale data logged by the cron job when the device is offline.
    // When offline, Nengjia returns an old 'timestamp'. We only want data actually recorded on selectedDate.
    let validData = data;
    if (data && data.length > 0) {
      validData = data.filter(d => {
        if (!d.timestamp) return false;
        // Nengjia timestamp is a unix epoch in ms
        const tsNumber = Number(d.timestamp);
        if (isNaN(tsNumber)) return false;
        const recordDateStr = format(new Date(tsNumber), 'yyyy-MM-dd');
        return recordDateStr === this.selectedDate;
      });
      
      // Also filter out duplicate timestamps in case the cron job ran multiple times for the same data point
      const seenTimestamps = new Set();
      validData = validData.filter(d => {
        if (seenTimestamps.has(d.timestamp)) return false;
        seenTimestamps.add(d.timestamp);
        return true;
      });
    }

    if (!validData || validData.length === 0) {
      this.solarChartData = { labels: [], datasets: [] };
      this.batteryChartData = { labels: [], datasets: [] };
      this.loadChartData = { labels: [], datasets: [] };
      this.tempChartData = { labels: [], datasets: [] };
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

    const sVol = fullDayBuckets.map(b => extractAvg(b.items, 'solar_panel_voltage'));
    const sCur = fullDayBuckets.map(b => extractAvg(b.items, 'solar_panel_circuit'));
    const sPow = fullDayBuckets.map(b => extractAvg(b.items, 'solar_panel_power'));

    const bVol = fullDayBuckets.map(b => extractAvg(b.items, 'battery_voltage'));
    const bCur = fullDayBuckets.map(b => extractAvg(b.items, 'battery_circuit'));
    const bPow = fullDayBuckets.map(b => extractAvg(b.items, 'battery_power'));
    const bPer = fullDayBuckets.map(b => extractAvg(b.items, 'battery_percent'));

    const lVol = fullDayBuckets.map(b => extractAvg(b.items, 'led_voltage'));
    const lCur = fullDayBuckets.map(b => extractAvg(b.items, 'led_circuit'));
    const lPowAvg = fullDayBuckets.map(b => extractAvg(b.items, 'led_power'));
    const lBright = lPowAvg.map(p => p !== null ? this.getBrightnessPercentage(p) : null);

    const tInn = fullDayBuckets.map(b => extractAvg(b.items, 'inner_temperature'));
    const tOut = fullDayBuckets.map(b => extractAvg(b.items, 'outer_temperature'));

    // Solar
    this.solarChartData = {
      labels,
      datasets: [
        { data: sVol as number[], label: 'Voltage (V)', borderColor: '#3b82f6', backgroundColor: '#3b82f6', spanGaps: true },
        { data: sCur as number[], label: 'Current (mA)', borderColor: '#06b6d4', backgroundColor: '#06b6d4', spanGaps: true },
        { data: sPow as number[], label: 'Solar PV (W)', borderColor: '#ef4444', backgroundColor: '#ef4444', spanGaps: true }
      ]
    };

    // Battery
    this.batteryChartData = {
      labels,
      datasets: [
        { data: bVol as number[], label: 'Voltage (V)', borderColor: '#3b82f6', backgroundColor: '#3b82f6', spanGaps: true },
        { data: bCur as number[], label: 'Current (mA)', borderColor: '#06b6d4', backgroundColor: '#06b6d4', spanGaps: true },
        { data: bPer as number[], label: 'Battery Percentage (%)', borderColor: '#22c55e', backgroundColor: '#22c55e', spanGaps: true }
      ]
    };

    // Load (LED)
    this.loadChartData = {
      labels,
      datasets: [
        { data: lVol as number[], label: 'Voltage (V)', borderColor: '#3b82f6', backgroundColor: '#3b82f6', spanGaps: true },
        { data: lCur as number[], label: 'Current (mA)', borderColor: '#06b6d4', backgroundColor: '#06b6d4', spanGaps: true },
        { data: lBright as number[], label: 'Brightness (%)', borderColor: '#ef4444', backgroundColor: '#ef4444', spanGaps: true }
      ]
    };

    // Temperature
    this.tempChartData = {
      labels,
      datasets: [
        { data: tInn as number[], label: 'Equipment (°C)', borderColor: '#3b82f6', backgroundColor: '#3b82f6', spanGaps: true },
        { data: tOut as number[], label: 'Environment (°C)', borderColor: '#06b6d4', backgroundColor: '#06b6d4', spanGaps: true }
      ]
    };
  }
}
