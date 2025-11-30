import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { provideRouter, TitleStrategy } from '@angular/router';
import { routes } from './app.routes';
import { TranslatedTitleStrategy } from './strategies/translated-title.strategy';
import { PlatformLocation } from '@angular/common';


export function HttpLoaderFactory(http: HttpClient, platformLocation: PlatformLocation) {

  return new TranslateHttpLoader(http, `${platformLocation.getBaseHrefFromDOM()}assets/i18n/`, '.json');
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    importProvidersFrom(
        TranslateModule.forRoot({
            loader: {
                provide: TranslateLoader,
                useFactory: HttpLoaderFactory,
                deps: [HttpClient, PlatformLocation]
            }
        })
    ),
    {
        provide: TitleStrategy,
        useClass: TranslatedTitleStrategy
    }
  ],
};
