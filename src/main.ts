import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { provideHttpClient, withInterceptors, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

// Functional HTTP interceptor — attaches JWT token and handles 401 responses
const authInterceptorFn: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: any) => {
      if (error.status === 401) {
        // Token expired or invalid — clear session and redirect to login
        ['token', 'username', 'role', 'permissions', 'projectId', 'projectName']
          .forEach(k => localStorage.removeItem(k));
        
        // Force immediate redirection to login page
        router.navigate(['/login'], { replaceUrl: true }).then(success => {
          if (!success) {
            window.location.href = '/login';
          }
        });
      }
      return throwError(() => error);
    }),
  );
};

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    // Register JWT auth interceptor globally — attaches token to every API request
    provideHttpClient(withInterceptors([authInterceptorFn])),
  ],
});

