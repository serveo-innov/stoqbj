<?php

use App\Http\Controllers\Api\AlertController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\CreditController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\ShopController;
use App\Http\Controllers\Api\ShopSettingsController;
use App\Http\Controllers\Api\StockController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    Route::get('/health', fn () => response()->json([
        'status'  => 'ok',
        'app'     => config('app.name'),
        'version' => '1.0.0',
        'time'    => now()->toISOString(),
    ]));

    // Webhook Kkiapay — public, verifie via signature x-kkiapay-secret (pas de Sanctum),
    // throttle applique en filet de securite supplementaire contre le flood.
    Route::post('/webhooks/kkiapay', [SubscriptionController::class, 'webhook'])
        ->middleware('throttle:30,1');

    // Auth public avec rate limiting
    Route::prefix('auth')->middleware('rate.login')->group(function () {
        Route::post('/login', [AuthController::class, 'login']);
        Route::post('/forgot-password', [PasswordResetController::class, 'forgotPassword']);
        Route::post('/reset-password',  [PasswordResetController::class, 'resetPassword']);
    });

    // Auto-inscription boutique — throttle dedie plus strict (creation de compte,
    // plus sensible aux abus qu'une simple tentative de connexion).
    Route::post('/auth/register-shop', [AuthController::class, 'registerShop'])
        ->middleware('throttle:5,1');

    Route::middleware(['auth:sanctum', 'tenant'])->group(function () {

        Route::prefix('auth')->group(function () {
            Route::post('/logout',  [AuthController::class, 'logout']);
            Route::get('/me',       [AuthController::class, 'me']);
            Route::post('/refresh', [AuthController::class, 'refresh']);
        });

        // ── Super Admin uniquement ──
        Route::middleware('role:super_admin')->prefix('admin')->group(function () {
            Route::get('stats',                  [ShopController::class, 'platformStats']);
            Route::get('shops',                  [ShopController::class, 'index']);
            Route::post('shops',                 [ShopController::class, 'store']);
            Route::get('shops/{id}',             [ShopController::class, 'show']);
            Route::put('shops/{id}',             [ShopController::class, 'update']);
            Route::post('shops/{id}/activate',   [ShopController::class, 'activate']);
            Route::post('shops/{id}/suspend',    [ShopController::class, 'suspend']);
            Route::post('shops/{id}/reactivate', [ShopController::class, 'reactivate']);
            Route::get('shops/{id}/payments',    [ShopController::class, 'paymentHistory']);
        });

        // ── Admin Shop + Super Admin ──
        Route::middleware('role:super_admin,admin_shop')->group(function () {
            Route::get('users',                [UserController::class, 'index']);
            Route::post('users',               [UserController::class, 'store']);
            Route::get('users/{id}',           [UserController::class, 'show']);
            Route::put('users/{id}',           [UserController::class, 'update']);
            Route::delete('users/{id}',        [UserController::class, 'destroy']);
            Route::post('users/{id}/password', [UserController::class, 'changePassword']);
            Route::post('users/{id}/toggle',   [UserController::class, 'toggle']);

            // Paramètres de sa propre boutique (self-service)
            Route::get('settings',             [ShopSettingsController::class, 'show']);
            Route::put('settings',             [ShopSettingsController::class, 'update']);

            // Abonnement self-service via Kkiapay
            Route::get('subscription',                    [SubscriptionController::class, 'status']);
            Route::post('subscription/kkiapay/initiate',  [SubscriptionController::class, 'initiate']);
            Route::post('subscription/kkiapay/confirm',   [SubscriptionController::class, 'confirm']);
        });

        Route::post('users/me/password', [UserController::class, 'changeOwnPassword']);

        // ── Gérant + Admin Shop + Super Admin ──
        Route::middleware('role:super_admin,admin_shop,gerant')->group(function () {
            Route::apiResource('categories', CategoryController::class);
            // suppliers : lecture (index/show) déplacée vers "Tous les rôles"
            // ci-dessous — nécessaire pour le formulaire "Entrée de stock"
            // du caissier (choix du fournisseur), mutations restent gerant+.
            Route::post('suppliers',               [SupplierController::class, 'store']);
            Route::put('suppliers/{id}',           [SupplierController::class, 'update']);
            Route::delete('suppliers/{id}',        [SupplierController::class, 'destroy']);
            // products : lecture (index/show) déplacée vers "Tous les rôles"
            // ci-dessous — le caissier doit pouvoir consulter le catalogue
            // pour vendre, seules les mutations restent réservées gerant+.
            Route::post('products',                [ProductController::class, 'store']);
            Route::put('products/{id}',            [ProductController::class, 'update']);
            Route::delete('products/{id}',         [ProductController::class, 'destroy']);
            Route::put('products/{id}/units/{unitId}/price', [ProductController::class, 'updatePrice']);
            Route::post('stock/adjustment',  [StockController::class, 'adjustment']);

            Route::post('credits/{id}/doubtful', [CreditController::class, 'markDoubtful']);
            Route::post('credits/{id}/extend',   [CreditController::class, 'extend']);
            Route::get('credits/debtors',        [CreditController::class, 'debtors']);

            Route::get('reports/dashboard',     [ReportController::class, 'dashboard']);
            Route::get('reports/period',        [ReportController::class, 'period']);
            Route::get('reports/daily',         [ReportController::class, 'daily']);
            Route::get('reports/daily/history', [ReportController::class, 'dailyHistory']);
            Route::get('reports/stock',         [ReportController::class, 'stock']);

            // Alertes & IA prix
            Route::post('alerts/read-all',                       [AlertController::class, 'markAllRead']);
            Route::get('alerts/price-suggestions',               [AlertController::class, 'priceSuggestions']);
            Route::post('alerts/price-suggestions/{id}/accept',  [AlertController::class, 'acceptSuggestion']);
            Route::post('alerts/price-suggestions/{id}/reject',  [AlertController::class, 'rejectSuggestion']);

            // Exports
            Route::get('exports/sales',            [ExportController::class, 'sales']);
            Route::get('exports/sales/details',    [ExportController::class, 'salesDetails']);
            Route::get('exports/stock',            [ExportController::class, 'stock']);
            Route::get('exports/credits',          [ExportController::class, 'credits']);
            Route::get('exports/stock/movements',  [ExportController::class, 'stockMovements']);
        });

        // ── Tous les rôles ──
        Route::get('suppliers',             [SupplierController::class, 'index']);
        Route::get('suppliers/{id}',        [SupplierController::class, 'show']);
        Route::get('products',              [ProductController::class, 'index']);
        Route::get('products/{id}',         [ProductController::class, 'show']);

        Route::post('stock/entry',          [StockController::class, 'entry']);
        Route::get('stock/movements',       [StockController::class, 'movements']);
        Route::get('stock/alerts',          [StockController::class, 'alerts']);

        Route::apiResource('clients', ClientController::class)->except(['destroy']);

        Route::get('sales/summary/today',   [SaleController::class, 'todaySummary']);
        Route::post('sales/{id}/hold',      [SaleController::class, 'hold']);
        Route::post('sales/{id}/cancel',    [SaleController::class, 'cancel']);
        Route::apiResource('sales', SaleController::class)->only(['index', 'store', 'show']);

        Route::get('credits',               [CreditController::class, 'index']);
        Route::get('credits/{id}',          [CreditController::class, 'show']);
        Route::post('credits/{id}/payments',[CreditController::class, 'addPayment']);

        // Facturation PDF
        Route::get('invoices/{saleId}/a4',      [InvoiceController::class, 'invoiceA4']);
        Route::get('invoices/{saleId}/ticket',  [InvoiceController::class, 'ticket80mm']);
        Route::get('invoices/{saleId}/preview', [InvoiceController::class, 'preview']);
        Route::get('invoices/report/daily',     [InvoiceController::class, 'dailyReportPdf']);

        // Alertes
        Route::get('alerts',              [AlertController::class, 'index']);
        Route::post('alerts/{id}/read',   [AlertController::class, 'markRead']);
    });
});
