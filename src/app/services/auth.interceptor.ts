import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

/**
 * AuthInterceptor automatically attaches the JWT Bearer token to every
 * outgoing HTTP request. If the server responds with 401 Unauthorized,
 * it logs the user out and redirects to the login page.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private router: Router) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = localStorage.getItem('token');

    // Clone the request and attach the Authorization header if a token exists
    let authReq = req;
    if (token) {
      authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      });
    }

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // If the server returns 401 (Unauthorized), the token is invalid or expired
        if (error.status === 401) {
          // Clear stored auth data and send user back to login
          localStorage.removeItem('token');
          localStorage.removeItem('username');
          localStorage.removeItem('role');
          localStorage.removeItem('permissions');
          localStorage.removeItem('projectId');
          localStorage.removeItem('projectName');
          this.router.navigate(['/login']);
        }
        return throwError(() => error);
      }),
    );
  }
}
