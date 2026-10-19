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
     * "Encaissements" d'un jour/periode = argent recu AU MOMENT DE LA VENTE,
     * hors remboursements de credit recus plus tard (ceux-la sont comptes
     * a part, dans creditsPercus(), au jour ou ils sont RECUS — pas au
     * jour de la vente d'origine).
     *
     * Sale.amount_paid est mutable : CreditController::addPayment y
     * ajoute chaque remboursement recu, sans distinguer "verse a la
     * vente" de "rembourse plus tard". On isole donc le versement
     * initial : amount_paid actuel moins la somme des CreditPayment
     * deja recues pour ce credit (chaque CreditPayment incremente
     * amount_paid du meme montant qu'elle enregistre — voir addPayment).
     * Necessite que $sales soit charge avec 'creditSale.payments'.
     */
    private function encaissementsDuJour($sales): float
    {
        return (float) $sales->sum(function ($sale) {
            if (! $sale->creditSale) {
                return $sale->amount_paid;
            }
            $dejaRembourse = $sale->creditSale->payments->sum('amount');
            return max(0, $sale->amount_paid - $dejaRembourse);
        });
    }

    /**
     * "Credits percus" = remboursements de credit reellement RECUS dans la
     * periode donnee, quelle que soit la date de la vente d'origine.
     */
    private function creditsPercus(int $shopId, $from, $to, ?int $userId = null): float
    {
        $query = \App\Models\CreditPayment::whereHas('creditSale', fn($q) => $q->where('shop_id', $shopId))
            ->whereBetween('paid_at', [$from, $to]);
        if ($userId) {
            $query->where('received_by', $userId);
        }
        return (float) $query->sum('amount');
    }

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
        $todaySales = Sale::forShop($shopId)->completed()->today()->with('items', 'creditSale.payments')->get();

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

        // Sous-ensemble utilise pour "en retard" : on exclut aussi
        // "doubtful" ici (choix par defaut - voir commentaire ci-dessus),
        // sans le retirer de nb_debtors / total_remaining, qui doivent
        // rester "tout ce qui n'est ni paye ni annule".
        $creditsRelancables = (clone $credits)->where('status', '!=', 'doubtful');

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
                // Gros+Detail+Extra sont avant remise (SaleItem.total_price) ;
                // ca_total est apres remise (net_amount). La remise est un
                // montant global par vente (Sale.discount_amount), jamais
                // reparti par categorie : on l'affiche a part plutot que de
                // fabriquer une repartition qui n'existe pas en base.
                'remises'         => $todaySales->sum('discount_amount'),
                'nb_transactions' => $todaySales->count(),
                'encaissements'   => $this->encaissementsDuJour($todaySales),
                'credits_percus'  => $this->creditsPercus($shopId, $today->copy()->startOfDay(), $today->copy()->endOfDay()),
                'credits_accordes'=> $creditsAccordesToday,
                'credits_en_cours'=> [
                    'total_remaining' => (clone $credits)->sum('amount_remaining'),
                    'nb_debtors'      => (clone $credits)->distinct('client_id')->count('client_id'),
                    'nb_overdue'      => (clone $creditsRelancables)->where('due_date', '<', now())->count(),
                    'total_overdue'   => (clone $creditsRelancables)->where('due_date', '<', now())->sum('amount_remaining'),
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
            'week'  => '%x-%v', // ISO annee-semaine : %Y-%u se coupe mal en fin d'annee (semaine 1 rattachee a la mauvaise annee)
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
                DB::raw('SUM(net_amount) as ca_total')
            )
            ->groupBy('period')
            ->orderBy('period')
            ->get();

        // CORRECTIF (encaissements) : SUM(amount_paid) en SQL a le meme
        // defaut que dashboard()/todaySummary() — un remboursement de
        // credit recu plus tard gonfle la periode de la vente d'origine.
        // On recalcule par periode via encaissementsDuJour(), qui isole
        // le versement initial grace a creditSale.payments.
        $salesForEncaissements = Sale::forShop($shopId)
            ->completed()
            ->whereBetween('sold_at', [$validated['from'], $validated['to'] . ' 23:59:59'])
            ->with('creditSale.payments')
            ->select('id', 'sold_at', 'amount_paid')
            ->get()
            ->groupBy(fn($sale) => $sale->sold_at->format(match($group) {
                'week'  => 'o-W',
                'month' => 'Y-m',
                default => 'Y-m-d',
            }));

        $encaissementsByPeriod = $salesForEncaissements->map(fn($group) => $this->encaissementsDuJour($group));

        // "Credits percus" par periode : remboursements RECUS dans la
        // periode, quelle que soit la date de la vente d'origine.
        $creditsPercusByPeriod = \App\Models\CreditPayment::whereHas('creditSale', fn($q) => $q->where('shop_id', $shopId))
            ->whereBetween('paid_at', [$validated['from'], $validated['to'] . ' 23:59:59'])
            ->select(
                DB::raw("DATE_FORMAT(paid_at, '{$groupFormat}') as period"),
                DB::raw('SUM(amount) as total')
            )
            ->groupBy('period')
            ->pluck('total', 'period');

        $sales = $sales->map(function ($row) use ($encaissementsByPeriod, $creditsPercusByPeriod) {
            $row->encaissements   = (float) ($encaissementsByPeriod[$row->period] ?? 0);
            $row->credits_percus  = (float) ($creditsPercusByPeriod[$row->period] ?? 0);
            return $row;
        });

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
            ->with('items', 'creditSale.payments')
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
                    'remises'          => $allSales->sum('discount_amount'),
                    'encaissements'    => $this->encaissementsDuJour($allSales),
                    'credits_percus'   => $this->creditsPercus($shopId, $validated['from'], $validated['to'] . ' 23:59:59'),
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

        // CORRECTIF : date invalide ou future -> 422 propre (avant : 500,
        // ou creation d'un rapport vide fige pour un jour futur).
        $request->validate(['date' => ['sometimes', 'date', 'before_or_equal:today']]);

        $date   = $request->date ? \Carbon\Carbon::parse($request->date) : today();

        // Chercher rapport existant
        $report = DailyReport::where('shop_id', $shopId)
            ->where('report_date', $date->toDateString())
            ->first();

        // CORRECTIF : un rapport n'est definitif que s'il a ete genere
        // APRES la fin de sa journee. Sinon (absent, ou genere en cours de
        // journee) on le recalcule : sans ca, le premier affichage du jour
        // figeait le rapport a cette heure-la (ventes, paiements de credit
        // et annulations suivants jamais pris en compte).
        $isFinal = $report && $report->generated_at
            && $report->generated_at->gte($date->copy()->endOfDay());

        if (! $isFinal) {
            $report = $this->generateDailyReportPublic($shopId, $date);
        }

        // 'remises' n'a pas de colonne dans daily_reports (pas de migration
        // pour ce correctif). Sale.discount_amount est stable, jamais
        // modifie apres la vente : on peut le recalculer a la volee, meme
        // pour un rapport deja fige, sans risque d'incoherence.
        $report->remises = (float) Sale::forShop($shopId)
            ->completed()
            ->whereDate('sold_at', $date)
            ->sum('discount_amount');

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

        // CORRECTIF : niveau 1 uniquement. Le stock des niveaux Paquet/Carton
        // est derive du stock de base (cf. ProductUnit::stockQty) : les
        // sommer comptait le meme stock physique 2 a 3 fois.
        $units = \App\Models\ProductUnit::whereHas('product', fn($q) =>
            $q->where('shop_id', $shopId)->where('is_active', true)
        )
        ->where('level', 1)
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
            ->with('items', 'creditSale.payments')
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

        // CORRECTIF : niveau 1 + produits actifs uniquement (meme raison
        // que stock() : stock derive aux niveaux superieurs).
        $stockAlerts = \App\Models\ProductUnit::whereHas('product', fn($q) =>
            $q->where('shop_id', $shopId)->where('is_active', true)
        )
        ->where('level', 1)
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
        $creditsDuJourQuery = CreditSale::forShop($shopId)
            ->whereHas('sale', fn($q) => $q->completed()->whereDate('sold_at', $date));
        $creditsAccordesJour = (clone $creditsDuJourQuery)->sum('amount_due');
        // CORRECTIF : on compte les creances reellement creees (et non
        // payment_mode credit/mixed : une vente Mobile Money partielle
        // cree aussi un CreditSale depuis le correctif 5.4).
        $nbNewCredits = (clone $creditsDuJourQuery)->count();

        return DailyReport::updateOrCreate(
            ['shop_id' => $shopId, 'report_date' => $date->toDateString()],
            [
                'ca_gros'          => $sales->flatMap->items->where('sale_type', 'gros')->sum('total_price'),
                'ca_detail'        => $sales->flatMap->items->where('sale_type', 'detail')->sum('total_price'),
                'ca_extra'         => $sales->flatMap->items->where('sale_type', 'extra')->sum('total_price'),
                'ca_total'         => $sales->sum('net_amount'),
                'encaissements'    => $this->encaissementsDuJour($sales),
                'credits_accordes' => $creditsAccordesJour,
                'credits_percus'   => $creditsPercus,
                'nb_transactions'  => $sales->count(),
                'nb_new_credits'   => $nbNewCredits,
                'top_products'     => $topProducts,
                'stock_alerts'     => $stockAlerts,
                'generated_at'     => now(),
            ]
        );
    }
}
