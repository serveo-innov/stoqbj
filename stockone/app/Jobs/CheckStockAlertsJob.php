<?php

namespace App\Jobs;

use App\Models\Alert;
use App\Models\ProductUnit;
use App\Models\StationeryShop;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CheckStockAlertsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries   = 2;
    public int $timeout = 60;

    public function __construct(public readonly ?int $shopId = null) {}

    public function handle(): void
    {
        $shops = $this->shopId
            ? StationeryShop::where('id', $this->shopId)->get()
            : StationeryShop::whereIn('status', ['active', 'trial'])->get();

        foreach ($shops as $shop) {
            $this->processShop($shop);
        }
    }

    private function processShop(StationeryShop $shop): void
    {
        $units = ProductUnit::whereHas('product', fn($q) =>
            $q->where('shop_id', $shop->id)->where('is_active', true)
        )
        ->with('product')
        ->get()->filter(fn($u) => $u->stock_qty <= $u->stock_alert_threshold)->values();

        foreach ($units as $unit) {
            $type = $unit->stock_qty <= 0
                ? 'stock_out'
                : ($unit->stock_qty <= ($unit->stock_alert_threshold / 2) ? 'stock_critical' : 'stock_low');

            // Éviter les doublons sur 24h
            $exists = Alert::where('shop_id', $shop->id)
                ->where('product_unit_id', $unit->id)
                ->where('type', $type)
                ->where('created_at', '>=', now()->subHours(24))
                ->exists();

            if ($exists) continue;

            Alert::create([
                'shop_id'         => $shop->id,
                'product_unit_id' => $unit->id,
                'type'            => $type,
                'triggered_at'    => now(),
                'meta'            => [
                    'product_name' => $unit->product->name,
                    'unit_label'   => $unit->label,
                    'stock_qty'    => $unit->stock_qty,
                    'threshold'    => $unit->stock_alert_threshold,
                ],
            ]);
        }

        if ($units->count() > 0) {
            Log::info("CheckStockAlerts — Boutique {$shop->id} : {$units->count()} unités en alerte.");
        }
    }

    public function failed(\Throwable $e): void
    {
        Log::error("Job CheckStockAlerts échoué : {$e->getMessage()}");
    }
}
