import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonApp,
  IonSplitPane,
  IonMenu,
  IonContent,
  IonList,
  IonItem,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonMenuToggle,
  IonAccordionGroup,
  IonAccordion
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { homeOutline, logOutOutline, personCircleOutline, cubeOutline, bulbOutline, flashOutline, settingsOutline, buildOutline, peopleOutline, addOutline, alertOutline, notificationsOutline, locationOutline } from 'ionicons/icons';
import { Observable } from 'rxjs';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    IonApp,
    IonSplitPane,
    IonMenu,
    IonContent,
    IonList,
    IonItem,
    IonIcon,
    IonLabel,
    IonRouterOutlet,
    IonMenuToggle,
    IonAccordionGroup,
    IonAccordion
  ]
})
export class AppComponent implements OnInit {
  isLoggedIn$!: Observable<boolean>;
  username$!: Observable<string | null>;
  name$!: Observable<string | null>;
  welcomeText: string = 'Good Morning';

  get isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  get isJkrLabuanAdmin(): boolean {
    const username = this.authService.getUsername();
    const name = localStorage.getItem('name');
    
    const isMatch = 
      (username && username.toLowerCase().trim() === 'jkrlabuan') || 
      (name && name.toLowerCase().trim() === 'jkr labuan admin');
      
    return !!isMatch;
  }

  get isMbsAdmin(): boolean {
    return this.authService.isMbsAdmin;
  }

  get isJkrShAdmin(): boolean {
    return this.authService.isJkrShAdmin;
  }

  get isBertamEnabled(): boolean {
    // Enabled only for super admin (projectId === null) or user whose name is 'MBSP' (case-insensitive)
    const currentUser = this.authService.getCurrentUser();
    const currentName = localStorage.getItem('name');
    return currentUser.projectId === null || currentName?.toUpperCase() === 'MBSP';
  }

  public appPages = [
    { title: 'Home', url: '/home', icon: 'home-outline' }
  ];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    addIcons({
      homeOutline,
      logOutOutline,
      personCircleOutline,
      cubeOutline,
      bulbOutline,
      flashOutline,
      settingsOutline,
      buildOutline,
      peopleOutline,
      addOutline,
      alertOutline,
      notificationsOutline,
      locationOutline
    });
  }

  ngOnInit() {
    this.isLoggedIn$ = this.authService.isLoggedInStream;
    this.username$ = this.authService.usernameStream;
    this.name$ = this.authService.nameStream;

    // Set greeting based on time of day
    const hour = new Date().getHours();
    if (hour < 12) {
      this.welcomeText = 'Good Morning';
    } else if (hour < 18) {
      this.welcomeText = 'Good Afternoon';
    } else {
      this.welcomeText = 'Good Evening';
    }
  }

  hasPermission(permission: string): boolean {
    return this.authService.hasPermission(permission);
  }

  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some(p => this.authService.hasPermission(p));
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
