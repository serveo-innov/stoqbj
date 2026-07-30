<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CreditSale;
use App\Models\DailyReport;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StockMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Rapports', description: 'Rapports et Statistiques')]
class ReportController extends Controller
{
    use ResolvesShopId;

    /**
     * Dashboard KPIs temps réel
     */
    #[OA\Get(
        path: '/reports/dashboard',
        summary: 'KPIs temps reel du dashboard',
        security: [['bearerAuth' => []]],
        tags: ['Rapports'],
        responses: [new OA\Response(response: 200, description: 'KPIs retournes')]
    )]
    public function dashboard(Request $request): JsonResponse
    {
        $shopId = $this->requireShopId($request);
        $today  = today();

        // Ventes du jour
        $todaySales = Sale::forShop($shopId)->completed()->today()->with('items')->get();

        // Ventes hier
        $yesterdaySales = Sale::forShop($shopId)->completed()
            ->whereDate('sold_at', $today->copy()->subDay())
            ->get();

        // Crédits en cours
        $credits = CreditSale::forShop($shopId)->whereNotIn('status', ['paid']);

        // Top 5 produits du jour
        $topProducts = SaleItem::whereHas('sale', fn($q) =>
            $q->where('shop_id', $shopId)->completed()->today()
        )
        ->with('productUnit.product')
        ->select('product_unit_id', DB::raw('SUM(quantity) as total_qty'), DB::raw('SUM(total_price) as total_ca'))
        ->groupBy('product_unit_id')
        ->orderByDesc('total_ca')
        ->limit(5)
        ->get()
        ->map(fn($item) => [
            'product_name' => $item->productUnit->product->name,
            'unit_label'   => $item->productUnit->label,
            'total_qty'    => $item->total_qty,
            'total_ca'     => $item->total_ca,
        ]);

        $caToday     = $todaySales->sum('net_amount');
        $caYesterday = $yesterdaySales->sum('net_amount');
        $evolution   = $caYesterday > 0 ? round((($caToday - $caYesterday) / $caYesterday) * 100, 1) : null;

        return response()->json([
            'data' => [
                'date'            => $today->toDateString(),
                'ca_today'        => $caToday,
                'ca_yesterday'    => $caYesterday,
                'evolution_pct'   => $evolution,
                'ca_gros'         => $todaySales->flatMap->items->where('sale_type', 'gros')->sum('total_price'),
                'ca_detail'       => $todaySales->flatMap->items->where('sale_type', 'detail')->sum('total_price'),
                'ca_extra'        => $todaySales->flatMap->items->where('sale_type', 'extra')->sum('total_price'),
                'nb_transactions' => $todaySales->count(),
                'encaissements'   => $todaySales->sum('amount_paid'),
                'credits_accordes'=> $todaySales->whereIn('payment_mode', ['credit', 'mixed'])->sum('amount_due'),
                'credits_en_cours'=> [
                    'total_remaining' => (clone $credits)->sum('amount_remaining'),
                    'nb_debtors'      => (clone $credits)->distinct('client_id')->count('client_id'),
                    'nb_overdue'      => (clone $credits)->where('due_date', '<', now())->count(),
                    'total_overdue'   => (clone $credits)->where('due_date', '<', now())->sum('amount_remaining'),
                ],
                'top_products'    => $topProducts,
            ],
        ]);
    }

    /**
     * Rapport par période (jour / semaine / mois)
     */
    #[OA\Get(
        path: '/reports/period',
        summary: 'Rapport par periode',
        security: [['bearerAuth' => []]],
        tags: ['Rapports'],
        parameters: [
            new OA\Parameter(name: 'from',  in: 'query', required: true, schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to',    in: 'query', required: true, schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'group', in: 'query', schema: new OA\Schema(type: 'string', enum: ['day', 'week', 'month'], default: 'day')),
        ],
        responses: [new OA\Response(response: 200, description: 'Rapport retourne')]
    )]
    public function period(Request $request): JsonResponse
    {
        $shopId = $this->requireShopId($request);

        $validated = $request->validate([
            'from'  => ['required', 'date'],
            'to'    => ['required', 'date', 'after_or_equal:from'],
            'group' => ['sometimes', 'in:day,week,month'],
        ]);

        $group = $validated['group'] ?? 'day';

        $groupFormat = match($group) {
            'week'  => '%Y-%u',
            'month' => '%Y-%m',
            default => '%Y-%m-%d',
        };

        $sales = Sale::forShop($shopId)
            ->completed()
            ->whereBetween('sold_at', [$validated['from'], $validated['to'] . ' 23:59:59'])
            ->with('items')
            ->select(
                DB::raw("DATE_FORMAT(sold_at, '{$groupFormat}') as period"),
                DB::raw('COUNT(*) as nb_transactions'),
                DB::raw('SUM(net_amount) as ca_total'),
                DB::raw('SUM(amount_paid) as encaissements'),
                DB::raw('SUM(amount_due) as credits_accordes')
            )
            ->groupBy('period')
            ->orderBy('period')
            ->get();

        // Top produits sur la période
        $topProducts = SaleItem::whereHas('sale', fn($q) =>
            $q->where('shop_id', $shopId)
              ->completed()
              ->whereBetween('sold_at', [$validated['from'], $validated['to'] . ' 23:59:59'])
        )
        ->with('productUnit.product')
        ->select('product_unit_id', DB::raw('SUM(quantity) as total_qty'), DB::raw('SUM(total_price) as total_ca'))
        ->groupBy('product_unit_id')
        ->orderByDesc('total_ca')
        ->limit(10)
        ->get()
        ->map(fn($item) => [
            'product_name' => $item->productUnit->product->name,
            'unit_label'   => $item->productUnit->label,
            'total_qty'    => $item->total_qty,
            'total_ca'     => $item->total_ca,
        ]);

        // Totaux globaux
        $allSales = Sale::forShop($shopId)
            ->completed()
            ->whereBetween('sold_at', [$validated['from'], $validated['to'] . ' 23:59:59'])
            ->with('items')
            ->get();

        return response()->json([
            'data' => [
                'from'            => $validated['from'],
                'to'              => $validated['to'],
                'totals' => [
                    'ca_total'         => $allSales->sum('net_amount'),
                    'ca_gros'          => $allSales->flatMap->items->where('sale_type', 'gros')->sum('total_price'),
                    'ca_detail'        => $allSales->flatMap->items->where('sale_type', 'detail')->sum('total_price'),
                    'ca_extra'         => $allSales->flatMap->items->where('sale_type', 'extra')->sum('total_price'),
                    'encaissements'    => $allSales->sum('amount_paid'),
                    'credits_accordes' => $allSales->whereIn('payment_mode', ['credit', 'mixed'])->sum('amount_due'),
                    'nb_transactions'  => $allSales->count(),
                ],
                'timeline'        => $sales,
                'top_products'    => $topProducts,
            ],
        ]);
    }

    /**
     * Rapport quotidien (générer ou récupérer)
     */
    #[OA\Get(
        path: '/reports/daily',
        summary: 'Rapport quotidien',
        security: [['bearerAuth' => []]],
        tags: ['Rapports'],
        parameters: [
            new OA\Parameter(name: 'date', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
        ],
        responses: [new OA\Response(response: 200, description: 'Rapport retourne')]
    )]
    public function daily(Request $request): JsonResponse
    {
        $shopId = $this->requireShopId($request);
        $date   = $request->date ? \Carbon\Carbon::parse($request->date) : today();

        // Chercher rapport existant
        $report = DailyReport::where('shop_id', $shopId)
            ->where('report_date', $date->toDateString())
            ->first();

        if (! $report) {
            // Générer à la volée
            $report = $this->generateDailyReport($shopId, $date);
        }

        return response()->json(['data' => $report]);
    }

    /**
     * Historique des rapports quotidiens
     */
    #[OA\Get(
        path: '/reports/daily/history',
        summary: 'Historique des rapports quotidiens',
        security: [['bearerAuth' => []]],
        tags: ['Rapports'],
        parameters: [
            new OA\Parameter(name: 'months', in: 'query', schema: new OA\Schema(type: 'integer', default: 3)),
        ],
        responses: [new OA\Response(response: 200, description: 'Historique retourne')]
    )]
    public function dailyHistory(Request $request): JsonResponse
    {
        $shopId = $this->requireShopId($request);
        $months = $request->integer('months', 3);

        $reports = DailyReport::where('shop_id', $shopId)
            ->where('report_date', '>=', now()->subMonths($months))
            ->orderByDesc('report_date')
            ->get();

        return response()->json(['data' => $reports]);
    }

    /**
     * Rapport des stocks
     */
    #[OA\Get(
        path: '/reports/stock',
        summary: 'Rapport des stocks',
        security: [['bearerAuth' => []]],
        tags: ['Rapports'],
        responses: [new OA\Response(response: 200, description: 'Rapport stock retourne')]
    )]
    public function stock(Request $request): JsonResponse
    {
        $shopId = $this->requireShopId($request);

        $units = \App\Models\ProductUnit::whereHas('product', fn($q) =>
            $q->where('shop_id', $shopId)->where('is_active', true)
        )
        ->with('product.category')
        ->get();

        $stockValue = $units->sum(fn($u) => $u->stock_qty * $u->cost_price);
        $stockRetail = $units->sum(fn($u) => $u->stock_qty * $u->price_wholesale);

        return response()->json([
            'data' => [
                'total_units'         => $units->count(),
                'stock_value_cost'    => round($stockValue, 2),
                'stock_value_retail'  => round($stockRetail, 2),
                'potential_margin'    => round($stockRetail - $stockValue, 2),
                'out_of_stock'        => $units->filter(fn($u) => $u->isOutOfStock())->count(),
                'low_stock'           => $units->filter(fn($u) => $u->isLowStock())->count(),
                'by_category'         => $units->groupBy('product.category.name')
                    ->map(fn($group, $cat) => [
                        'category'    => $cat ?? 'Sans categorie',
                        'nb_products' => $group->count(),
                        'stock_value' => round($group->sum(fn($u) => $u->stock_qty * $u->cost_price), 2),
                    ])->values(),
            ],
        ]);
    }

    /**
     * Génère et sauvegarde le rapport quotidien
     */
    public function generateDailyReportPublic(int $shopId, \Carbon\Carbon $date): DailyReport
    {
        $sales = Sale::forShop($shopId)
            ->completed()
            ->whereDate('sold_at', $date)
            ->with('items')
            ->get();

        $topProducts = SaleItem::whereHas('sale', fn($q) =>
            $q->where('shop_id', $shopId)->completed()->whereDate('sold_at', $date)
        )
        ->with('productUnit.product')
        ->select('product_unit_id', DB::raw('SUM(quantity) as qty'), DB::raw('SUM(total_price) as ca'))
        ->groupBy('product_unit_id')
        ->orderByDesc('ca')
        ->limit(5)
        ->get()
        ->map(fn($i) => [
            'name' => $i->productUnit->product->name,
            'qty'  => $i->qty,
            'ca'   => $i->ca,
        ]);

        $stockAlerts = \App\Models\ProductUnit::whereHas('product', fn($q) =>
            $q->where('shop_id', $shopId)
        )
        ->with('product')
        ->get()->filter(fn($u) => $u->stock_qty <= $u->stock_alert_threshold)
        ->map(fn($u) => ['name' => $u->product->name, 'stock' => $u->stock_qty])
        ->toArray();

        $creditsPercus = \App\Models\CreditPayment::whereHas('creditSale', fn($q) =>
            $q->where('shop_id', $shopId)
        )
        ->whereDate('paid_at', $date)
        ->sum('amount');

        return DailyReport::updateOrCreate(
            ['shop_id' => $shopId, 'report_date' => $date->toDateString()],
            [
                'ca_gros'          => $sales->flatMap->items->where('sale_type', 'gros')->sum('total_price'),
                'ca_detail'        => $sales->flatMap->items->where('sale_type', 'detail')->sum('total_price'),
                'ca_extra'         => $sales->flatMap->items->where('sale_type', 'extra')->sum('total_price'),
                'ca_total'         => $sales->sum('net_amount'),
                'encaissements'    => $sales->sum('amount_paid'),
                'credits_accordes' => $sales->whereIn('payment_mode', ['credit', 'mixed'])->sum('amount_due'),
                'credits_percus'   => $creditsPercus,
                'nb_transactions'  => $sales->count(),
                'nb_new_credits'   => $sales->whereIn('payment_mode', ['credit', 'mixed'])->count(),
                'top_products'     => $topProducts,
                'stock_alerts'     => $stockAlerts,
                'generated_at'     => now(),
            ]
        );
    }
}
