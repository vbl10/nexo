import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { SalaComponent } from './pages/sala/sala.component';
import { SignupComponent } from './pages/signup/signup.component';
import { PainelComponent } from './pages/painel/painel.component';
import { ConfigSalaComponent } from './pages/config-sala/config-sala.component';

export const routes: Routes = [
    {
        title: "painel.titulo",
        path: "painel",
        component: PainelComponent
    },
    {
        title: "config-sala.titulo-configurar",
        path: "config-sala/:codigo",
        component: ConfigSalaComponent
    },
    {
        title: "config-sala.titulo-criar",
        path: "config-sala",
        component: ConfigSalaComponent
    },
    {
        title: "signup.titulo",
        path: "signup",
        component: SignupComponent
    },
    {
        title: "login.titulo",
        path: "login",
        component: LoginComponent,
    },
    {
        title: "sala.titulo",
        path: "sala/:codigo",
        component: SalaComponent
    },
    {
        path: "**",
        redirectTo: "painel"
    }
];
