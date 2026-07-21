<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CreditSale;
use App\Models\ProductUnit;
use App\Models\Sale;
use App\Models\SaleItem;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Export', description: 'Export Excel et CSV')]
class ExportController extends Controller
{
    use ResolvesShopId;

    /**
     * Export ventes CSV
     */
    #[OA\Get(
        path: '/exports/sales',
        summary: 'Exporter les ventes en CSV',
        security: [['bearerAuth' => []]],
        tags: ['Export'],
        parameters: [
            new OA\Parameter(name: 'from',   in: 'query', required: true,  schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to',     in: 'query', required: true,  schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'format', in: 'query', schema: new OA\Schema(type: 'string', enum: ['csv', 'excel'], default: 'csv')),
        ],
        responses: [new OA\Response(response: 200, description: 'Fichier telecharge')]
    )]
    public function sales(Request $request): Response
    {
        $shopId = $this->requireShopId($request);

        $validated = $request->validate([
            'from'   => ['required', 'date'],
            'to'     => ['required', 'date', 'after_or_equal:from'],
            'format' => ['sometimes', 'in:csv,excel'],
        ]);

        $sales = Sale::where('shop_id', $shopId)
            ->completed()
            ->whereBetween('sold_at', [$validated['from'], $validated['to'] . ' 23:59:59'])
            ->with(['user', 'client', 'items.productUnit.product'])
            ->orderBy('sold_at')
            ->get();

        $rows   = [];
        $rows[] = ['N° Facture', 'Date', 'Heure', 'Caissier', 'Client', 'Telephone', 'Mode Paiement', 'Total HT', 'Remise', 'Net', 'Paye', 'Reste Du', 'Statut'];

        foreach ($sales as $sale) {
            $rows[] = [
                $sale->invoice_number,
                $sale->sold_at->format('d/m/Y'),
                $sale->sold_at->format('H:i'),
                $sale->user->firstname . ' ' . $sale->user->name,
                $sale->client ? $sale->client->firstname . ' ' . $sale->client->name : 'Client anonyme',
                $sale->client?->phone ?? '',
                $sale->payment_mode,
                $sale->total_amount,
                $sale->discount_amount,
                $sale->net_amount,
                $sale->amount_paid,
                $sale->amount_due,
                $sale->status,
            ];
        }

        $filename = "ventes_{$validated['from']}_{$validated['to']}.csv";
        return $this->streamCsv($rows, $filename);
    }

    /**
     * Export lignes de ventes détaillées CSV
     */
    #[OA\Get(
        path: '/exports/sales/details',
        summary: 'Exporter le detail des ventes en CSV',
        security: [['bearerAuth' => []]],
        tags: ['Export'],
        parameters: [
            new OA\Parameter(name: 'from', in: 'query', required: true, schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to',   in: 'query', required: true, schema: new OA\Schema(type: 'string', format: 'date')),
        ],
        responses: [new OA\Response(response: 200, description: 'Fichier telecharge')]
    )]
    public function salesDetails(Request $request): Response
    {
        $shopId = $this->requireShopId($request);

        $validated = $request->validate([
            'from' => ['required', 'date'],
            'to'   => ['required', 'date', 'after_or_equal:from'],
        ]);

        $items = SaleItem::whereHas('sale', fn($q) =>
            $q->where('shop_id', $shopId)
              ->completed()
              ->whereBetween('sold_at', [$validated['from'], $validated['to'] . ' 23:59:59'])
        )
        ->with(['sale.user', 'sale.client', 'productUnit.product.category'])
        ->orderBy('created_at')
        ->get();

        $rows   = [];
        $rows[] = ['N° Facture', 'Date', 'Caissier', 'Client', 'Categorie', 'Produit', 'Unite', 'Type Vente', 'Quantite', 'Prix Unitaire', 'Total', 'Prix Achat', 'Marge'];

        foreach ($items as $item) {
            $unit     = $item->productUnit;
            $product  = $unit->product;
            $margin   = $unit->cost_price > 0
                ? round((($item->unit_price - $unit->cost_price) / $unit->cost_price) * 100, 1)
                : 0;

            $rows[] = [
                $item->sale->invoice_number,
                $item->sale->sold_at->format('d/m/Y H:i'),
                $item->sale->user->firstname . ' ' . $item->sale->user->name,
                $item->sale->client ? $item->sale->client->firstname . ' ' . $item->sale->client->name : 'Anonyme',
                $product->category?->name ?? 'Sans categorie',
                $product->name,
                $unit->label,
                $item->sale_type,
                $item->quantity,
                $item->unit_price,
                $item->total_price,
                $unit->cost_price,
                $margin . '%',
            ];
        }

        $filename = "detail_ventes_{$validated['from']}_{$validated['to']}.csv";
        return $this->streamCsv($rows, $filename);
    }

    /**
     * Export stock CSV
     */
    #[OA\Get(
        path: '/exports/stock',
        summary: 'Exporter l\'etat du stock en CSV',
        security: [['bearerAuth' => []]],
        tags: ['Export'],
        responses: [new OA\Response(response: 200, description: 'Fichier telecharge')]
    )]
    public function stock(Request $request): Response
    {
        $shopId = $this->requireShopId($request);

        $units = ProductUnit::whereHas('product', fn($q) =>
            $q->where('shop_id', $shopId)->where('is_active', true)
        )
        ->with('product.category')
        ->orderBy('product_id')
        ->get();

        $rows   = [];
        $rows[] = ['Categorie', 'Produit', 'Reference', 'Unite', 'Niveau', 'Stock', 'Seuil Alerte', 'Statut Stock', 'Prix Gros', 'Prix Extra', 'Prix Achat', 'Marge %', 'Valeur Stock', 'Derniere Vente'];

        foreach ($units as $unit) {
            $product    = $unit->product;
            $stockValue = $unit->stock_qty * $unit->cost_price;
            $status     = $unit->isOutOfStock() ? 'Rupture' : ($unit->isLowStock() ? 'Bas' : 'Normal');

            $rows[] = [
                $product->category?->name ?? 'Sans categorie',
                $product->name,
                $product->reference ?? '',
                $unit->label,
                $unit->level,
                $unit->stock_qty,
                $unit->stock_alert_threshold,
                $status,
                $unit->price_wholesale,
                $unit->price_extra,
                $unit->cost_price,
                $unit->margin_percent . '%',
                round($stockValue, 0),
                $unit->last_sold_at?->format('d/m/Y') ?? 'Jamais',
            ];
        }

        $filename = "stock_" . now()->format('Y-m-d') . ".csv";
        return $this->streamCsv($rows, $filename);
    }

    /**
     * Export crédits CSV
     */
    #[OA\Get(
        path: '/exports/credits',
        summary: 'Exporter les credits en CSV',
        security: [['bearerAuth' => []]],
        tags: ['Export'],
        parameters: [
            new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['all', 'pending', 'partial', 'overdue', 'doubtful'], default: 'all')),
        ],
        responses: [new OA\Response(response: 200, description: 'Fichier telecharge')]
    )]
    public function credits(Request $request): Response
    {
        $shopId = $this->requireShopId($request);

        $query = CreditSale::where('shop_id', $shopId)
            ->with(['client', 'sale', 'payments'])
            ->orderBy('due_date');

        $status = $request->get('status', 'all');
        if ($status !== 'all') {
            $query->where('status', $status);
        } else {
            $query->whereNotIn('status', ['paid']);
        }

        $credits = $query->get();

        $rows   = [];
        $rows[] = ['N° Facture', 'Date Vente', 'Client', 'Telephone', 'Montant Total', 'Montant Paye', 'Reste Du', 'Date Echeance', 'Jours Retard', 'Statut', 'Nb Paiements'];

        foreach ($credits as $credit) {
            $daysOverdue = $credit->due_date->isPast()
                ? now()->diffInDays($credit->due_date)
                : 0;

            $rows[] = [
                $credit->sale->invoice_number ?? '',
                $credit->sale->sold_at->format('d/m/Y'),
                $credit->client->firstname . ' ' . $credit->client->name,
                $credit->client->phone,
                $credit->amount_due,
                $credit->amount_paid,
                $credit->amount_remaining,
                $credit->due_date->format('d/m/Y'),
                $daysOverdue,
                $credit->status,
                $credit->payments->count(),
            ];
        }

        $filename = "credits_" . now()->format('Y-m-d') . ".csv";
        return $this->streamCsv($rows, $filename);
    }

    /**
     * Export mouvements de stock CSV
     */
    #[OA\Get(
        path: '/exports/stock/movements',
        summary: 'Exporter les mouvements de stock en CSV',
        security: [['bearerAuth' => []]],
        tags: ['Export'],
        parameters: [
            new OA\Parameter(name: 'from', in: 'query', required: true, schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to',   in: 'query', required: true, schema: new OA\Schema(type: 'string', format: 'date')),
        ],
        responses: [new OA\Response(response: 200, description: 'Fichier telecharge')]
    )]
    public function stockMovements(Request $request): Response
    {
        $shopId = $this->requireShopId($request);

        $validated = $request->validate([
            'from' => ['required', 'date'],
            'to'   => ['required', 'date', 'after_or_equal:from'],
        ]);

        $movements = \App\Models\StockMovement::where('shop_id', $shopId)
            ->whereBetween('moved_at', [$validated['from'], $validated['to'] . ' 23:59:59'])
            ->with(['productUnit.product', 'user', 'supplier'])
            ->orderBy('moved_at')
            ->get();

        $rows   = [];
        $rows[] = ['Date', 'Produit', 'Unite', 'Type', 'Quantite', 'Stock Avant', 'Stock Apres', 'Cout Unitaire', 'Utilisateur', 'Fournisseur', 'Reference', 'Raison'];

        foreach ($movements as $mv) {
            $rows[] = [
                $mv->moved_at->format('d/m/Y H:i'),
                $mv->productUnit->product->name,
                $mv->productUnit->label,
                $mv->type,
                $mv->quantity,
                $mv->stock_before,
                $mv->stock_after,
                $mv->unit_cost ?? '',
                $mv->user->firstname . ' ' . $mv->user->name,
                $mv->supplier?->name ?? '',
                $mv->reference ?? '',
                $mv->reason ?? '',
            ];
        }

        $filename = "mouvements_stock_{$validated['from']}_{$validated['to']}.csv";
        return $this->streamCsv($rows, $filename);
    }

    // ──────────────────────────────────────────
    // Helper
    // ──────────────────────────────────────────

    private function streamCsv(array $rows, string $filename): Response
    {
        $output = fopen('php://temp', 'r+');

        // BOM UTF-8 pour Excel
        fwrite($output, "\xEF\xBB\xBF");

        foreach ($rows as $row) {
            fputcsv($output, $row, ';');
        }

        rewind($output);
        $content = stream_get_contents($output);
        fclose($output);

        return response($content, 200, [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control'       => 'no-cache, no-store, must-revalidate',
        ]);
    }
}
