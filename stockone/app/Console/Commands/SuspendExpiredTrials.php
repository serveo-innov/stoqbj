<?php

namespace App\Console\Commands;

use App\Models\StationeryShop;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SuspendExpiredTrials extends Command
{
    /**
     * Suspend automatiquement toute boutique encore en statut "trial" dont la
     * periode d'essai (subscription_end) est depassee. Reproduit exactement
     * le comportement de ShopController::suspend() (suspension manuelle par
     * le Super Admin) pour rester coherent entre les deux chemins.
     */
    protected $signature = 'shops:suspend-expired-trials';

    protected $description = "Suspend les boutiques dont la periode d'essai gratuite est terminee";

    public function handle(): int
    {
        $expiredTrials = StationeryShop::where('status', 'trial')
            ->whereNotNull('subscription_end')
            ->where('subscription_end', '<', now())
            ->get();

        if ($expiredTrials->isEmpty()) {
            $this->info('Aucune boutique en essai expire a suspendre.');
            return self::SUCCESS;
        }

        foreach ($expiredTrials as $shop) {
            $shop->update(['status' => 'suspended']);

            // Revoquer tous les tokens actifs des utilisateurs de cette boutique
            User::where('shop_id', $shop->id)->each(fn ($u) => $u->tokens()->delete());

            Log::info('Boutique suspendue automatiquement (essai expire).', [
                'shop_id'   => $shop->id,
                'shop_name' => $shop->shop_name,
                'expired_at'=> $shop->subscription_end,
            ]);

            $this->line("Suspendue : #{$shop->id} — {$shop->shop_name}");
        }

        $this->info("{$expiredTrials->count()} boutique(s) suspendue(s) pour essai expire.");

        return self::SUCCESS;
    }
}
