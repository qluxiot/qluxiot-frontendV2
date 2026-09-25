import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  IonContent, IonRefresher, IonRefresherContent, ToastController, IonCheckbox, ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { refreshOutline, sunnyOutline, alertCircleOutline, batteryHalfOutline, syncOutline, bulbOutline, wifiOutline, flashOutline, businessOutline } from 'ionicons/icons';
import { CustomHeaderComponent } from '../../components/custom-header/custom-header.component';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-solar-monitoring',
  templateUrl: './monitoring.page.html',
  styleUrls: ['./monitoring.page.scss'],
  standalone: true,
  imports: [CustomHeaderComponent, IonContent, IonRefresher, IonRefresherContent, IonCheckbox, CommonModule, FormsModule]
})
export class SolarMonitoringPage implements OnInit {
  monitoringData: any[] = [];
  projects: any[] = [];
  selectedProjectId: number | null = null;
  bulkActionProgress: { action: string; total: number; current: number; errors: string[]; status: string } | null = null;

  get isAdmin(): boolean { return this.authService.isAdmin(); }
  get isSuperAdmin(): boolean { return this.authService.isSuperAdmin(); }
  
  get isMbsAdmin(): boolean {
    return this.authService.isMbsAdmin;
  }

  hasCloneMapping(serial: string): boolean {
    return !!this.authService.MBS_CLONE_MAPPING[serial];
  }

  constructor(
    private http: HttpClient,
    private toastController: ToastController,
    private modalCtrl: ModalController,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ refreshOutline, sunnyOutline, alertCircleOutline, batteryHalfOutline, syncOutline, bulbOutline, wifiOutline, flashOutline, businessOutline });
  }

  ngOnInit() {
    if (this.isSuperAdmin) {
      this.http.get<any[]>(`${environment.apiUrl}/api/projects`).subscribe({
        next: (data) => { this.projects = data; }
      });
    }
    this.fetchData();
  }

  ionViewWillEnter() {
    this.fetchData();
  }

  fetchData(event?: any) {
    const user = this.authService.getCurrentUser();
    // Super Admins can filter by selected project, normal users are always scoped to their project
    const projectId = this.isSuperAdmin ? this.selectedProjectId : user.projectId;
    const query = projectId ? `?projectId=${projectId}` : '';
    this.http.get<any[]>(`${environment.apiUrl}/api/solar/solar-monitoring${query}`).subscribe({
      next: (data) => {
        let finalData = [...data];
        
        // Inject clone devices for MBS Admin
        if (this.isMbsAdmin) {
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
          // Append clones to final data
          finalData = [...finalData, ...clones];
        }

        this.monitoringData = finalData;
        this.filterDevices();
        if (event) event.target.complete();
      },
      error: (err) => {
        console.error('Error fetching solar monitoring', err);
        if (event) event.target.complete();
      }
    });
  }

  onProjectFilterChange() {
    this.fetchData();
  }

  getOnlineStatus(device: any): string {
    if (device.is_online === 1) return 'Online';
    if (device.is_online === 0) return 'Offline';
    if (device.status === 'Faulty') return 'Fault';
    return 'Offline';
  }

  getOnlineColor(device: any): string {
    const s = this.getOnlineStatus(device);
    if (s === 'Online') return 'success';
    if (s === 'Fault') return 'danger';
    return 'medium';
  }

  guessMaxWattage(power: number): number {
    // Standard solar street light wattages
    const standards = [30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300];
    for (const std of standards) {
      // Allow a +5W variance (e.g. 48W or 52W maps to 50W)
      if (power <= std + 5) {
        return std;
      }
    }
    return Math.ceil(power / 50) * 50;
  }

  getDeviceMaxWattage(device: any, currentPower: number): number {
    if (!device.serial) return 30; // Fallback
    
    const key = `qlux_max_wattage_${device.serial}`;
    let storedMax = parseInt(localStorage.getItem(key) || '0', 10);
    
    // Guess the capacity based on current power
    let currentCapacity = this.guessMaxWattage(currentPower);
    
    // If the currently observed power requires a larger capacity than what we stored, update it!
    // This allows the system to permanently learn that a device is 50W or 100W once it sees it at 100%.
    if (currentCapacity > storedMax) {
      storedMax = currentCapacity;
      localStorage.setItem(key, storedMax.toString());
    }
    
    return storedMax > 0 ? storedMax : 30;
  }

  getBrightnessPercentage(device: any): number {
    const ledPower = device.led_power;
    if (ledPower == null || ledPower <= 0) return 0;
    
    // Get the highest known capacity for this specific device
    const maxWattage = this.getDeviceMaxWattage(device, ledPower);
    
    const percent = Math.round((ledPower / maxWattage) * 100);
    
    // If the power draw is close to the max capacity (e.g. 48W on a 50W lamp), it is essentially 100% brightness.
    if (percent >= 94) return 100;
    
    return percent > 100 ? 100 : percent;
  }

  filterDevices() {
    if (!this.searchTerm) {
      this.filteredData = [...this.monitoringData];
    } else {
      const lower = this.searchTerm.toLowerCase();
      
      // First find which serials match
      const matchingSerials = new Set<string>();
      this.monitoringData.forEach(d => {
        if ((d.serial && d.serial.toLowerCase().includes(lower)) ||
            (d.name && d.name.toLowerCase().includes(lower))) {
           matchingSerials.add(d.real_serial || d.serial);
        }
      });
      
      // Then include all devices whose real_serial is in the matching set so pairs stay together
      this.filteredData = this.monitoringData.filter(d => 
        matchingSerials.has(d.real_serial || d.serial)
      );
    }
    this.currentPage = 1;
    this.calculateTotalPages();
  }

  calculateTotalPages() {
    this.totalPages = Math.ceil(this.filteredData.length / this.pageSize) || 1;
  }

  get paginatedData() {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredData.slice(startIndex, startIndex + Number(this.pageSize));
  }

  changePageSize(event: any) {
    this.pageSize = event.target.value;
    this.currentPage = 1;
    this.calculateTotalPages();
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  syncingDevices = new Set<string>();

  async showToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({
      message,
      color,
      duration: 3000,
      position: 'top',
    });
    await toast.present();
  }

  syncDevice(device: any) {
    if (!device.serial) return;

    this.syncingDevices.add(device.serial);

    this.http.post<any>(`${environment.apiUrl}/api/solar/devices/${device.serial}/sync`, {}).subscribe({
      next: (updatedDevice) => {
        // Update the specific original device in the array without reloading everything
        const index = this.monitoringData.findIndex(d => d.serial === device.serial && !d.isClone);
        if (index !== -1) {
          this.monitoringData[index] = { ...this.monitoringData[index], ...updatedDevice };
        }
        
        // Also update the clone if one exists so it shares the real-time values
        const cloneIndex = this.monitoringData.findIndex(d => d.real_serial === device.serial && d.isClone);
        if (cloneIndex !== -1) {
          const originalCloneConfig = this.authService.MBS_CLONE_MAPPING[device.serial];
          this.monitoringData[cloneIndex] = { 
            ...this.monitoringData[cloneIndex], 
            ...updatedDevice,
            name: originalCloneConfig.name,
            serial: originalCloneConfig.serial,
            isClone: true,
            real_serial: device.serial
          };
        }
        this.syncingDevices.delete(device.serial);
        this.showToast(`${device.name || device.serial} synced successfully`, 'success');
      },
      error: (err) => {
        console.error(`Error syncing device ${device.serial}`, err);
        this.syncingDevices.delete(device.serial);
        this.showToast(`Failed to sync ${device.name || device.serial}. Please try again later.`, 'danger');
      }
    });
  }

  // --- Quick Actions ---
  executingActions = new Set<string>();

  async executeAction(device: any, action: string, power?: number) {
    if (!device.serial) return;

    // If DIM action and no power provided, prompt user for brightness level
    if (action === 'DIM' && power === undefined) {
      const alertCtrl = (await import('@ionic/angular/standalone')).AlertController;
      const alert = new alertCtrl();
      const alertInstance = await alert.create({
        header: 'Set Brightness',
        message: 'Enter brightness level (1-100%)',
        inputs: [
          {
            name: 'brightness',
            type: 'number',
            min: 1,
            max: 100,
            value: 50,
            placeholder: 'Brightness %'
          }
        ],
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Apply',
            handler: (data) => {
              const val = parseInt(data.brightness, 10);
              if (val >= 1 && val <= 100) {
                this.executeAction(device, 'DIM', val);
              } else {
                this.showToast('Please enter a valid percentage between 1 and 100', 'warning');
              }
            }
          }
        ]
      });
      await alertInstance.present();
      return;
    }

    // Create a unique key for the button spinner (e.g. "serial-ON", "serial-DIM")
    const actionKey = `${device.serial}-${action}`;
    this.executingActions.add(actionKey);
    this.executingActions = new Set(this.executingActions); // Trigger UI update

    this.http.post<any>(`${environment.apiUrl}/api/solar/devices/${device.serial}/execute-action`, { action, power }).subscribe({
      next: () => {
        this.executingActions.delete(actionKey);
        this.executingActions = new Set(this.executingActions); // Trigger UI update
        this.cdr.detectChanges(); // Force Angular change detection
        const msg = power ? `Set to ${power}%` : `Turned ${action}`;
        this.showToast(`${device.name || device.serial} ${msg} successfully. Syncing status...`, 'success');

        // Fetch true state from device
        this.syncDevice(device);
      },
      error: (err) => {
        console.error(`Error executing ${action} on ${device.serial}`, err);
        this.executingActions.delete(actionKey);
        this.executingActions = new Set(this.executingActions); // Trigger UI update
        this.cdr.detectChanges(); // Force Angular change detection
        this.showToast(`Failed to execute ${action} on ${device.name || device.serial}.`, 'danger');
      }
    });
  }

  filteredData: any[] = [];
  searchTerm: string = '';
  currentPage: number = 1;
  pageSize: number = 5;
  totalPages: number = 1;

  selectedDevices: Set<string> = new Set<string>();

  isAllSelected(): boolean {
    const activeDevices = this.filteredData.filter(d => d.device_type !== 'Gateway');
    if (activeDevices.length === 0) return false;
    return activeDevices.every(d => this.selectedDevices.has(d.serial));
  }

  toggleAll(event: any) {
    const isChecked = event.detail.checked;
    const activeDevices = this.filteredData.filter(d => d.device_type !== 'Gateway');
    if (isChecked) {
      activeDevices.forEach(d => this.selectedDevices.add(d.serial));
    } else {
      this.selectedDevices.clear();
    }
  }

  toggleSelection(device: any) {
    if (this.selectedDevices.has(device.serial)) {
      this.selectedDevices.delete(device.serial);
    } else {
      this.selectedDevices.add(device.serial);
    }
  }



  // --- Bulk Testing with Batching ---
  async promptBulkDim() {
    const alertCtrl = (await import('@ionic/angular/standalone')).AlertController;
    const alert = new alertCtrl();
    const alertInstance = await alert.create({
      header: 'Bulk Set Brightness',
      message: `Enter brightness level (1-100%) for ${this.selectedDevices.size} devices`,
      inputs: [
        { name: 'brightness', type: 'number', min: 1, max: 100, value: 50, placeholder: 'Brightness %' }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Apply',
          handler: (data) => {
            const val = parseInt(data.brightness, 10);
            if (val >= 1 && val <= 100) {
              this.executeBulkAction('DIM', val);
            } else {
              this.showToast('Please enter a valid percentage between 1 and 100', 'warning');
            }
          }
        }
      ]
    });
    await alertInstance.present();
  }

  async executeBulkAction(action: string, power?: number) {
    if (this.selectedDevices.size === 0) return;

    this.bulkActionProgress = {
      action: power ? `DIM (${power}%)` : action,
      total: this.selectedDevices.size,
      current: 0,
      errors: [],
      status: 'Starting...'
    };

    const serials = Array.from(this.selectedDevices);
    for (const serial of serials) {
      this.bulkActionProgress.status = `Testing device ${serial}...`;

      try {
        await this.http.post<any>(`${environment.apiUrl}/api/solar/devices/${serial}/execute-action`, { action, power }).toPromise();
      } catch (err: any) {
        this.bulkActionProgress.errors.push(`${serial}: Failed`);
      }

      this.bulkActionProgress.current++;
      // Rate Limiting Delay (300ms)
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    this.bulkActionProgress.status = 'Completed!';
    this.selectedDevices.clear();
    this.fetchData();
  }

  async executeBulkSync() {
    if (this.selectedDevices.size === 0) return;

    this.bulkActionProgress = {
      action: 'SYNC',
      total: this.selectedDevices.size,
      current: 0,
      errors: [],
      status: 'Starting...'
    };

    const serials = Array.from(this.selectedDevices);
    for (const serial of serials) {
      this.bulkActionProgress.status = `Syncing device ${serial}...`;

      try {
        await this.http.post<any>(`${environment.apiUrl}/api/solar/devices/${serial}/sync`, {}).toPromise();
      } catch (err: any) {
        this.bulkActionProgress.errors.push(`${serial}: Failed`);
      }

      this.bulkActionProgress.current++;
      // Rate Limiting Delay (300ms)
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    this.bulkActionProgress.status = 'Completed!';
    this.selectedDevices.clear();
    this.fetchData();
  }

  closeBulkProgress() {
    this.bulkActionProgress = null;
  }

  // --- Schedule Modals ---
  async openManageSchedulesModal() {
    const { ManageSchedulesModalComponent } = await import('../../components/manage-schedules-modal/manage-schedules-modal.component');
    const modal = await this.modalCtrl.create({
      component: ManageSchedulesModalComponent,
      componentProps: { moduleType: 'solar' }
    });
    await modal.present();
  }

  async openAssignScheduleModal() {
    if (this.selectedDevices.size === 0) return;

    // 1. Fetch available schedules
    this.http.get<any[]>(`${environment.apiUrl}/api/solar/schedules`).subscribe({
      next: async (schedules) => {
        if (schedules.length === 0) {
          this.showToast('No schedules available. Please create one first.', 'warning');
          return;
        }

        // 2. Build radio inputs for AlertController
        const inputs = schedules.map(s => ({
          type: 'radio' as const,
          label: s.name,
          value: s.id
        }));

        // Option to clear schedule
        inputs.push({
          type: 'radio' as const,
          label: 'None (Clear Schedule)',
          value: null as any
        });

        // 3. Show Alert Controller
        const alertCtrl = (await import('@ionic/angular/standalone')).AlertController;
        const alert = new alertCtrl();
        const alertInstance = await alert.create({
          header: `Assign to ${this.selectedDevices.size} devices`,
          inputs: inputs,
          buttons: [
            { text: 'Cancel', role: 'cancel' },
            {
              text: 'Assign',
              handler: (profileId) => {
                if (profileId === undefined) return false;

                // Map any clone serials back to their real serials so the API call succeeds
                const realSerials = Array.from(this.selectedDevices).map(s => {
                    for (const [real, clone] of Object.entries(this.authService.MBS_CLONE_MAPPING)) {
                        if (clone.serial === s) return real;
                    }
                    return s;
                });
                const uniqueRealSerials = Array.from(new Set(realSerials));

                // 4. Send Bulk Assign API Call
                this.http.post(`${environment.apiUrl}/api/solar/schedules/bulk-assign`, {
                  profileId: profileId,
                  deviceSerials: uniqueRealSerials
                }).subscribe({
                  next: () => {
                    this.showToast('Schedule successfully assigned to selected devices!', 'success');
                    this.selectedDevices.clear();
                    this.fetchData(); // refresh the table
                  },
                  error: () => this.showToast('Failed to assign schedule', 'danger')
                });
                return true;
              }
            }
          ]
        });
        await alertInstance.present();
      },
      error: () => this.showToast('Failed to load schedules', 'danger')
    });
  }
}
