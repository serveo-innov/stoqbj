<?php

namespace App\Jobs;

use App\Mail\SubscriptionReminderMail;
use App\Models\Alert;
use App\Models\StationeryShop;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class CheckSubscriptionsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries   = 2;
    public int $timeout = 60;

    public function handle(): void
    {
        // Abonnements payes expirant dans 30, 15, 7, 3, 1 jours.
        $this->warnShops(StationeryShop::where('status', 'active'), [30, 15, 7, 3, 1], isTrial: false);

        // CORRECTIF : les boutiques en essai gratuit ne recevaient AUCUN
        // avertissement avant d'etre coupees par SuspendExpiredTrials —
        // calendrier plus resserre, l'essai ne dure que 7 jours au total.
        $this->warnShops(StationeryShop::where('status', 'trial'), [3, 1], isTrial: true);

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

    /**
     * Cree l'alerte (comme avant) ET envoie un email a chaque palier —
     * avant, seul un enregistrement passif existait, invisible tant que
     * personne n'allait le chercher manuellement dans "Analyse produits".
     */
    private function warnShops($query, array $warningDays, bool $isTrial): void
    {
        foreach ($warningDays as $days) {
            $shops = (clone $query)
                ->whereDate('subscription_end', now()->addDays($days)->toDateString())
                ->get();

            foreach ($shops as $shop) {
                Alert::create([
                    'shop_id'      => $shop->id,
                    'type'         => 'subscription_expiry',
                    'triggered_at' => now(),
                    'meta'         => [
                        'days_remaining'    => $days,
                        'is_trial'          => $isTrial,
                        'subscription_end'  => $shop->subscription_end->toDateString(),
                        'shop_name'         => $shop->shop_name,
                        'owner_phone'       => $shop->owner_phone,
                        'owner_email'       => $shop->owner_email,
                    ],
                ]);

                if ($shop->owner_email) {
                    try {
                        $frontendUrl = rtrim(config('app.frontend_url'), '/');
                        Mail::to($shop->owner_email)->send(new SubscriptionReminderMail(
                            shopName: $shop->shop_name,
                            daysRemaining: $days,
                            isTrial: $isTrial,
                            subscriptionUrl: "{$frontendUrl}/abonnement",
                        ));
                    } catch (\Throwable $e) {
                        // Un email qui echoue ne doit jamais faire planter
                        // tout le job ni empecher les boutiques suivantes
                        // d'etre traitees.
                        Log::error("Email de relance abonnement echoue pour la boutique {$shop->id}: {$e->getMessage()}");
                    }
                }

                $label = $isTrial ? 'essai' : 'abonnement';
                Log::info("Alerte {$label} : boutique {$shop->id} expire dans {$days} jour(s).");
            }
        }
    }

    public function failed(\Throwable $e): void
    {
        Log::error("Job CheckSubscriptions échoué : {$e->getMessage()}");
    }
}
