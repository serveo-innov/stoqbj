<?php

use App\Jobs\CheckDormantProductsJob;
use App\Jobs\CheckStockAlertsJob;
use App\Jobs\CheckSubscriptionsJob;
use App\Jobs\GenerateDailyReportJob;
use App\Jobs\ProcessCreditRemindersJob;
use App\Models\StationeryShop;
use Illuminate\Support\Facades\Schedule;

/*
|--------------------------------------------------------------------------
| Scheduler Stock.one
|--------------------------------------------------------------------------
*/

// ── Rapport quotidien : 23h59 (heure locale Cotonou UTC+1 = 22h59 UTC)
Schedule::call(function () {
    $shops = StationeryShop::whereIn('status', ['active', 'trial'])->get();
    foreach ($shops as $shop) {
        GenerateDailyReportJob::dispatch($shop->id, now()->toDateString())
            ->onQueue('reports');
    }
})->dailyAt('22:59')->name('daily-reports')->withoutOverlapping();

// ── Relances crédits : tous les matins à 8h
Schedule::call(function () {
    ProcessCreditRemindersJob::dispatch()->onQueue('notifications');
})->dailyAt('07:00')->name('credit-reminders')->withoutOverlapping();

// ── Vérification abonnements : tous les jours à 6h
Schedule::call(function () {
    CheckSubscriptionsJob::dispatch()->onQueue('default');
})->dailyAt('06:00')->name('check-subscriptions')->withoutOverlapping();

// ── Alertes stock : toutes les 4 heures
Schedule::call(function () {
    CheckStockAlertsJob::dispatch()->onQueue('default');
})->everyFourHours()->name('check-stock-alerts')->withoutOverlapping();

// ── Produits dormants : tous les lundis à 9h
Schedule::call(function () {
    CheckDormantProductsJob::dispatch()->onQueue('default');
})->weekly()->mondays()->at('09:00')->name('check-dormant-products')->withoutOverlapping();
