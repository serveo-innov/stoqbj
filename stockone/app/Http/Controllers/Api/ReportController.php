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
        // CORRECTIF : "cancelled" (nouveau statut introduit aujourd'hui)
        // n'était pas exclu ici, contrairement à tous les autres endroits
        // du module Crédit — un client dont l'unique crédit était annulé
        // restait compté dans "nb_debtors", et un crédit annulé dont
        // l'échéance d'origine était passée comptait comme "en retard".
        $credits = CreditSale::forShop($shopId)->whereNotIn('status', ['paid', 'cancelled']);

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

        // CORRECTIF (credits_accordes) : Sale.amount_due DIMINUE a chaque
        // paiement recu sur le credit (cf. CreditController::addPayment),
        // ce n'est donc PAS un fait historique fiable pour repondre a
        // "combien de credit ai-je accorde aujourd'hui ?" — un rapport du
        // jour J consulte plus tard, apres que des paiements soient
        // arrives, afficherait un montant plus petit que ce qui a
        // reellement ete accorde ce jour-la. CreditSale.amount_due, lui,
        // n'est JAMAIS modifie apres creation (verifie : addPayment ne
        // touche que amount_paid/amount_remaining/status) — c'est la
        // bonne source, immuable, pour ce chiffre.
        $creditsAccordesToday = CreditSale::forShop($shopId)
            ->whereHas('sale', fn($q) => $q->completed()->today())
            ->sum('amount_due');

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
                'credits_accordes'=> $creditsAccordesToday,
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
                DB::raw('SUM(amount_paid) as encaissements')
            )
            ->groupBy('period')
            ->orderBy('period')
            ->get();

        // CORRECTIF (credits_accordes) : Sale.amount_due diminue a chaque
        // paiement recu (cf. CreditController::addPayment), donc SUM(sale.
        // amount_due) sur une periode passee sous-estime ce qui a ete
        // reellement accorde si des paiements sont arrives depuis.
        // CreditSale.amount_due n'est lui jamais modifie apres creation —
        // c'est la source fiable pour ce chiffre, calculee separement ici
        // et rattachee a chaque periode.
        $creditsAccordesByPeriod = CreditSale::query()
            ->join('sales', 'credit_sales.sale_id', '=', 'sales.id')
            ->where('sales.shop_id', $shopId)
            ->where('sales.status', 'completed')
            ->whereBetween('sales.sold_at', [$validated['from'], $validated['to'] . ' 23:59:59'])
            ->select(
                DB::raw("DATE_FORMAT(sales.sold_at, '{$groupFormat}') as period"),
                DB::raw('SUM(credit_sales.amount_due) as credits_accordes')
            )
            ->groupBy('period')
            ->pluck('credits_accordes', 'period');

        $sales = $sales->map(function ($row) use ($creditsAccordesByPeriod) {
            $row->credits_accordes = (float) ($creditsAccordesByPeriod[$row->period] ?? 0);
            return $row;
        });

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
                    'credits_accordes' => $creditsAccordesByPeriod->sum(),
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

        // CORRECTIF (credits_accordes) : meme raison que dashboard()/
        // period() — Sale.amount_due diminue avec les paiements recus,
        // CreditSale.amount_due reste le fait historique fiable. Ce
        // rapport quotidien est en plus SAUVEGARDE en base
        // (DailyReport::updateOrCreate) : un mauvais calcul ici fige une
        // donnee fausse de façon definitive, contrairement aux endpoints
        // calcules a la volee — raison de plus pour que ce soit exact.
        $creditsAccordesJour = CreditSale::forShop($shopId)
            ->whereHas('sale', fn($q) => $q->completed()->whereDate('sold_at', $date))
            ->sum('amount_due');

        return DailyReport::updateOrCreate(
            ['shop_id' => $shopId, 'report_date' => $date->toDateString()],
            [
                'ca_gros'          => $sales->flatMap->items->where('sale_type', 'gros')->sum('total_price'),
                'ca_detail'        => $sales->flatMap->items->where('sale_type', 'detail')->sum('total_price'),
                'ca_extra'         => $sales->flatMap->items->where('sale_type', 'extra')->sum('total_price'),
                'ca_total'         => $sales->sum('net_amount'),
                'encaissements'    => $sales->sum('amount_paid'),
                'credits_accordes' => $creditsAccordesJour,
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
