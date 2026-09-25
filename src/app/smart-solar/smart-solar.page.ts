import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { CustomHeaderComponent } from '../components/custom-header/custom-header.component';

@Component({
  selector: 'app-smart-solar',
  templateUrl: './smart-solar.page.html',
  styleUrls: ['./smart-solar.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, CustomHeaderComponent]
})
export class SmartSolarPage {}