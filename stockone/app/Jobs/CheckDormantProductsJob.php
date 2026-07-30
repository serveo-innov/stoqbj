<?php

namespace App\Jobs;

use App\Models\Alert;
use App\Models\PriceSuggestion;
use App\Models\ProductUnit;
use App\Models\StationeryShop;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class CheckDormantProductsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries   = 2;
    public int $timeout = 180;

    // Seuils de dormance en jours
    const THRESHOLDS = [30, 45, 60, 90, 120];

    // Taux de réduction suggérés par seuil
    const REDUCTION_RATES = [
        30  => 0.05,  // -5%
        45  => 0.08,  // -8%
        60  => 0.10,  // -10%
        90  => 0.15,  // -15%
        120 => 0.20,  // -20%
    ];

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
        ->whereNotNull('last_sold_at')
        ->with('product')
        ->get()->filter(fn($u) => $u->stock_qty > 0)->values();

        $processed = 0;

        foreach ($units as $unit) {
            $dormantDays = $unit->dormant_days;

            // Trouver le seuil correspondant
            $threshold = null;
            foreach (self::THRESHOLDS as $t) {
                if ($dormantDays >= $t) {
                    $threshold = $t;
                }
            }

            if (! $threshold) continue;

            $alertType = "dormant_{$threshold}";

            // Éviter les doublons d'alertes récentes (7 jours)
            $existingAlert = Alert::where('shop_id', $shop->id)
                ->where('product_unit_id', $unit->id)
                ->where('type', $alertType)
                ->where('created_at', '>=', now()->subDays(7))
                ->exists();

            if ($existingAlert) continue;

            // Créer l'alerte
            Alert::create([
                'shop_id'         => $shop->id,
                'product_unit_id' => $unit->id,
                'type'            => $alertType,
                'triggered_at'    => now(),
                'meta'            => [
                    'dormant_days'   => $dormantDays,
                    'stock_qty'      => $unit->stock_qty,
                    'last_sold_at'   => $unit->last_sold_at?->toDateString(),
                    'product_name'   => $unit->product->name,
                    'unit_label'     => $unit->label,
                ],
            ]);

            // Créer suggestion de prix si pas déjà une en attente
            $existingSuggestion = PriceSuggestion::where('shop_id', $shop->id)
                ->where('product_unit_id', $unit->id)
                ->where('status', 'pending')
                ->exists();

            if (! $existingSuggestion && $unit->price_wholesale > 0) {
                $rate = self::REDUCTION_RATES[$threshold];

                PriceSuggestion::create([
                    'shop_id'                  => $shop->id,
                    'product_unit_id'          => $unit->id,
                    'current_price_wholesale'  => $unit->price_wholesale,
                    'suggested_price_wholesale'=> round($unit->price_wholesale * (1 - $rate), 0),
                    'current_price_extra'      => $unit->price_extra,
                    'suggested_price_extra'    => round($unit->price_extra * (1 - $rate), 0),
                    'dormant_days'             => $dormantDays,
                    'estimated_margin'         => $unit->margin_percent,
                    'status'                   => 'pending',
                ]);
            }

            $processed++;
        }

        if ($processed > 0) {
            Log::info("CheckDormantProducts — Boutique {$shop->id} : {$processed} alertes créées.");
        }
    }

    public function failed(\Throwable $e): void
    {
        Log::error("Job CheckDormantProducts échoué : {$e->getMessage()}");
    }
}
