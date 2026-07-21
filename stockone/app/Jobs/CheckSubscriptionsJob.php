<?php

namespace App\Jobs;

use App\Models\Alert;
use App\Models\StationeryShop;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class CheckSubscriptionsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries   = 2;
    public int $timeout = 60;

    public function handle(): void
    {
        // Abonnements expirant dans 30, 15, 7, 3, 1 jours
        $warningDays = [30, 15, 7, 3, 1];

        foreach ($warningDays as $days) {
            $shops = StationeryShop::where('status', 'active')
                ->whereDate('subscription_end', now()->addDays($days)->toDateString())
                ->get();

            foreach ($shops as $shop) {
                Alert::create([
                    'shop_id'      => $shop->id,
                    'type'         => 'subscription_expiry',
                    'triggered_at' => now(),
                    'meta'         => [
                        'days_remaining'    => $days,
                        'subscription_end'  => $shop->subscription_end->toDateString(),
                        'shop_name'         => $shop->shop_name,
                        'owner_phone'       => $shop->owner_phone,
                        'owner_email'       => $shop->owner_email,
                    ],
                ]);

                Log::info("Alerte abonnement : boutique {$shop->id} expire dans {$days} jour(s).");
            }
        }

        // Suspendre automatiquement les abonnements expirés depuis plus de 7 jours (grace period)
        $graceDays = (int) config('app.subscription_grace_days', 7);

        $expiredShops = StationeryShop::where('status', 'active')
            ->where('subscription_end', '<', now()->subDays($graceDays))
            ->get();

        foreach ($expiredShops as $shop) {
            $shop->update(['status' => 'suspended']);

            // Révoquer tous les tokens
            User::where('shop_id', $shop->id)->each(fn($u) => $u->tokens()->delete());

            Log::warning("Boutique {$shop->id} suspendue automatiquement — abonnement expiré depuis >{$graceDays} jours.");
        }
    }

    public function failed(\Throwable $e): void
    {
        Log::error("Job CheckSubscriptions échoué : {$e->getMessage()}");
    }
}
