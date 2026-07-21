<?php

namespace App\Jobs;

use App\Models\Alert;
use App\Models\CreditReminder;
use App\Models\CreditSale;
use App\Models\StationeryShop;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessCreditRemindersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries   = 2;
    public int $timeout = 120;

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
        // Crédits en retard non soldés
        $overdueCredits = CreditSale::where('shop_id', $shop->id)
            ->whereNotIn('status', ['paid', 'doubtful'])
            ->where('due_date', '<', now())
            ->with(['client', 'sale'])
            ->get();

        foreach ($overdueCredits as $credit) {
            // Mettre à jour le statut
            if ($credit->status !== 'overdue') {
                $credit->update(['status' => 'overdue']);
            }

            // Créer alerte plateforme si pas de relance dans les 3 derniers jours
            $recentReminder = CreditReminder::where('credit_sale_id', $credit->id)
                ->where('created_at', '>=', now()->subDays(3))
                ->exists();

            if ($recentReminder) continue;

            $daysOverdue = now()->diffInDays($credit->due_date);
            $client      = $credit->client;

            if (! $client) continue;

            // Message de relance
            $message = $this->buildReminderMessage($credit, $daysOverdue, $shop);

            // Relance plateforme (notification interne)
            CreditReminder::create([
                'credit_sale_id' => $credit->id,
                'channel'        => 'platform',
                'phone'          => $client->phone,
                'message'        => $message,
                'status'         => 'sent',
                'sent_at'        => now(),
            ]);

            // Alerte interne
            Alert::firstOrCreate(
                [
                    'shop_id'         => $shop->id,
                    'product_unit_id' => null,
                    'type'            => 'credit_overdue',
                ],
                [
                    'triggered_at' => now(),
                    'meta'         => [
                        'credit_sale_id'  => $credit->id,
                        'client_name'     => $client->full_name,
                        'client_phone'    => $client->phone,
                        'amount_remaining'=> $credit->amount_remaining,
                        'days_overdue'    => $daysOverdue,
                        'due_date'        => $credit->due_date->toDateString(),
                    ],
                ]
            );

            // SMS via Africa's Talking (si configuré en production)
            if (config('app.at_env') !== 'sandbox' && config('services.africas_talking.key')) {
                SendSmsJob::dispatch($client->phone, $message, $credit->id);
            }

            Log::info("Relance crédit #{$credit->id} — {$client->full_name} — {$credit->amount_remaining} FCFA — {$daysOverdue}j de retard");
        }

        // Crédits qui arrivent à échéance dans 1 jour (rappel préventif)
        $expiringTomorrow = CreditSale::where('shop_id', $shop->id)
            ->whereIn('status', ['pending', 'partial'])
            ->whereDate('due_date', now()->addDay()->toDateString())
            ->with('client')
            ->get();

        foreach ($expiringTomorrow as $credit) {
            if (! $credit->client) continue;

            $shopName = $shop->commercial_name ?? $shop->shop_name;
            $message = "Rappel {$shopName} : votre créance de " .
                number_format($credit->amount_remaining, 0, ',', ' ') .
                " FCFA arrive à échéance demain. Merci de vous acquitter. Réf: {$credit->sale->invoice_number}";

            CreditReminder::create([
                'credit_sale_id' => $credit->id,
                'channel'        => 'platform',
                'phone'          => $credit->client->phone,
                'message'        => $message,
                'status'         => 'sent',
                'sent_at'        => now(),
            ]);
        }
    }

    private function buildReminderMessage(CreditSale $credit, int $daysOverdue, StationeryShop $shop): string
    {
        $shopName   = $shop->commercial_name ?? $shop->shop_name;
        $amount     = number_format($credit->amount_remaining, 0, ',', ' ');
        $invoiceRef = $credit->sale->invoice_number ?? '';
        $dueDate    = $credit->due_date->format('d/m/Y');

        if ($daysOverdue <= 3) {
            return "{$shopName} : Votre créance de {$amount} FCFA (Réf: {$invoiceRef}) était due le {$dueDate}. Merci de régulariser rapidement.";
        } elseif ($daysOverdue <= 7) {
            return "{$shopName} : RAPPEL - Créance de {$amount} FCFA en retard de {$daysOverdue} jours (Réf: {$invoiceRef}). Passez nous voir ou appelez le {$shop->owner_phone}.";
        } else {
            return "{$shopName} : URGENT - Votre créance de {$amount} FCFA (Réf: {$invoiceRef}) est en retard de {$daysOverdue} jours. Contactez-nous immédiatement au {$shop->owner_phone}.";
        }
    }

    public function failed(\Throwable $e): void
    {
        Log::error("Job ProcessCreditReminders échoué : {$e->getMessage()}");
    }
}
