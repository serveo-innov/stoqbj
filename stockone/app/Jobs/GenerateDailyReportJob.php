<?php

namespace App\Jobs;

use App\Http\Controllers\Api\ReportController;
use App\Models\StationeryShop;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class GenerateDailyReportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries   = 3;
    public int $timeout = 120;

    public function __construct(
        public readonly int $shopId,
        public readonly string $date
    ) {}

    public function handle(): void
    {
        $shop = StationeryShop::find($this->shopId);

        if (! $shop || $shop->status === 'closed') {
            Log::info("GenerateDailyReport : boutique {$this->shopId} ignorée (inexistante ou fermée).");
            return;
        }

        try {
            $controller = new ReportController();
            $report = $controller->generateDailyReportPublic(
                $this->shopId,
                \Carbon\Carbon::parse($this->date)
            );

            Log::info("Rapport quotidien généré pour boutique {$this->shopId} — {$this->date} | CA: {$report->ca_total} FCFA");

        } catch (\Throwable $e) {
            Log::error("Erreur génération rapport boutique {$this->shopId} : {$e->getMessage()}");
            throw $e;
        }
    }

    public function failed(\Throwable $e): void
    {
        Log::error("Job GenerateDailyReport échoué pour boutique {$this->shopId} : {$e->getMessage()}");
    }
}
