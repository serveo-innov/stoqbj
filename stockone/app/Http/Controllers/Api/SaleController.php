<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\CreditSale;
use App\Models\ExtraSaleIdentity;
use App\Models\ProductUnit;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StockMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Ventes', description: 'POS et Caisse')]
class SaleController extends Controller
{
    use ResolvesShopId;

    #[OA\Post(
        path: '/sales',
        summary: 'Créer une vente (POS)',
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['items', 'payment_mode'],
                properties: [
                    new OA\Property(property: 'client_id',       type: 'integer', example: 1,       description: 'Optionnel sauf si un reste a payer existe'),
                    new OA\Property(property: 'payment_mode',    type: 'string',  enum: ['cash', 'credit', 'mobile_money', 'mixed'], example: 'cash'),
                    new OA\Property(property: 'amount_paid',     type: 'number',  example: 5000),
                    new OA\Property(property: 'discount_amount', type: 'number',  example: 0),
                    new OA\Property(property: 'notes',           type: 'string'),
                    new OA\Property(
                        property: 'items',
                        type: 'array',
                        items: new OA\Items(
                            properties: [
                                new OA\Property(property: 'product_unit_id', type: 'integer', example: 1),
                                new OA\Property(property: 'sale_type',       type: 'string',  enum: ['gros', 'detail', 'extra'], example: 'detail'),
                                new OA\Property(property: 'quantity',        type: 'integer', example: 3),
                                new OA\Property(property: 'unit_price',      type: 'number',  example: 500),
                            ]
                        )
                    ),
                    new OA\Property(
                        property: 'extra_identity',
                        description: 'Requis si sale_type=extra',
                        properties: [
                            new OA\Property(property: 'name',      type: 'string', example: 'Kossou'),
                            new OA\Property(property: 'firstname', type: 'string', example: 'Jean'),
                            new OA\Property(property: 'phone',     type: 'string', example: '+22990000001'),
                            new OA\Property(property: 'remarks',   type: 'string'),
                        ],
                        type: 'object'
                    ),
                ]
            )
        ),
        tags: ['Ventes'],
        responses: [
            new OA\Response(response: 201, description: 'Vente enregistrée'),
            new OA\Response(response: 422, description: 'Stock insuffisant, remise invalide, ou client requis pour un reste a payer'),
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $shopId = $this->requireShopId($request);
        $user   = $request->user();

        $validated = $request->validate([
            'client_id'              => ['nullable', 'integer', 'exists:clients,id'],
            'payment_mode'           => ['required', 'in:cash,credit,mobile_money,mixed'],
            'amount_paid'            => ['nullable', 'numeric', 'min:0'],
            'discount_amount'        => ['nullable', 'numeric', 'min:0'],
            'notes'                  => ['nullable', 'string'],
            'items'                  => ['required', 'array', 'min:1'],
            'items.*.product_unit_id'=> ['required', 'integer', 'exists:product_units,id'],
            'items.*.sale_type'      => ['required', 'in:gros,detail,extra'],
            'items.*.quantity'       => ['required', 'integer', 'min:1'],
            'items.*.unit_price'     => ['required', 'numeric', 'min:0'],
            'extra_identity'         => ['nullable', 'array'],
            'extra_identity.name'    => ['required_with:extra_identity', 'string', 'max:100'],
            'extra_identity.firstname'=> ['required_with:extra_identity', 'string', 'max:100'],
            'extra_identity.phone'   => ['required_with:extra_identity', 'string', 'max:20'],
            'extra_identity.remarks' => ['nullable', 'string'],
        ]);

        // Montants calcules en amont (avant transaction) pour pouvoir
        // valider client/remise avant de toucher a la base.
        $totalAmount    = collect($validated['items'])->sum(fn($i) => $i['unit_price'] * $i['quantity']);

        // CORRECTIF (point 3) : la remise ne peut plus depasser le total de
        // la vente. Avant, net_amount pouvait devenir negatif en base alors
        // que le frontend affichait toujours max(0, ...) a l'ecran, creant
        // une incoherence entre ce que le caissier voit et ce qui est stocke.
        $discountAmount = $validated['discount_amount'] ?? 0;
        if ($discountAmount > $totalAmount) {
            return response()->json([
                'message' => "La remise ({$discountAmount} FCFA) ne peut pas depasser le total de la vente ({$totalAmount} FCFA).",
                'errors'  => ['discount_amount' => ['La remise ne peut pas depasser le total de la vente.']],
            ], 422);
        }

        $netAmount  = $totalAmount - $discountAmount;
        $amountPaid = $validated['amount_paid'] ?? ($validated['payment_mode'] === 'cash' ? $netAmount : 0);

        // CORRECTIF (montant payé > net à payer) : rien ne plafonnait
        // amount_paid par rapport au montant réellement dû. Un mode non-
        // especes (mobile_money, credit, mixed) laissant taper un montant
        // superieur au net a payer se traduisait par un amount_paid stocke
        // au-dela du necessaire, gonflant a tort le KPI "Encaissements" du
        // resume du jour (qui fait un simple sum(amount_paid)) sans que
        // cet exces ne corresponde a un vrai encaissement supplementaire.
        // Le mode "cash" n'est pas concerne : le champ y est deja verrouille
        // sur le montant net cote frontend (pas de gestion de rendu de
        // monnaie pour l'instant, hors scope de ce correctif).
        if ($amountPaid > $netAmount) {
            return response()->json([
                'message' => "Le montant paye ({$amountPaid} FCFA) ne peut pas depasser le net a payer ({$netAmount} FCFA).",
                'errors'  => ['amount_paid' => ['Le montant paye ne peut pas depasser le net a payer.']],
            ], 422);
        }

        $amountDue  = max(0, $netAmount - $amountPaid);

        // CORRECTIFS (points 1 et 2) : des qu'un reste a payer existe, il
        // FAUT un client identifiable (selectionne ou cree via l'identite
        // Extra) — quel que soit le payment_mode declare. Avant, une vente
        // "Mobile Money" avec un montant paye oublie (0 par defaut) ou une
        // vente "Credit"/"Mixte" sans client cree un amount_due > 0 qui ne
        // devenait JAMAIS un CreditSale : la dette existait sur la vente
        // mais restait invisible partout ailleurs (jamais sur l'ecran
        // Credits, jamais relancee, jamais encaissable).
        $clientId = $validated['client_id'] ?? null;
        if ($amountDue > 0 && ! $clientId && empty($validated['extra_identity'])) {
            return response()->json([
                'message' => "Un reste a payer de {$amountDue} FCFA existe sur cette vente : un client (ou une identite acheteur) est requis pour pouvoir suivre cette creance.",
                'errors'  => ['client_id' => ["Client requis des qu'il reste un montant a payer."]],
            ], 422);
        }

        // CORRECTIF (survente multi-niveaux Piece/Paquet/Carton) : le stock
        // reel n'existe JAMAIS qu'au niveau de l'unite de base (cf.
        // ProductUnit::applyStockDelta/stockQty). L'ancien controle agregait
        // la demande par product_unit_id exact (le niveau vendu), pas par
        // unite de base — deux lignes de panier vendant des NIVEAUX
        // DIFFERENTS du meme produit (ex. 2 Cartons + 5 Paquets) passaient
        // chacune le controle independamment contre le stock total, sans
        // jamais additionner leur consommation reelle du meme stock
        // partage. Resultat possible : survente au-dela du stock physique,
        // meme en une seule transaction, sans concurrence necessaire.
        // On resout maintenant chaque ligne vers son unite de BASE et on
        // agrege/verrouille a ce niveau-la.
        $soldUnitIds = collect($validated['items'])->pluck('product_unit_id')->unique();
        $soldUnits   = ProductUnit::whereHas('product', fn($q) => $q->where('shop_id', $shopId))
            ->whereIn('id', $soldUnitIds)
            ->with('product')
            ->get()
            ->keyBy('id');

        if ($soldUnits->count() !== $soldUnitIds->count()) {
            return response()->json(['message' => 'Un ou plusieurs produits sont introuvables.'], 422);
        }

        $baseDemand = [];  // [base_unit_id => quantite requise en unite de base]
        $baseLabel  = [];  // [base_unit_id => libelle pour message d'erreur]
        foreach ($validated['items'] as $item) {
            $unit   = $soldUnits[$item['product_unit_id']];
            $base   = $unit->baseUnit() ?? $unit;
            $factor = $unit->cumulativeQtyToBase();

            $baseDemand[$base->id] = ($baseDemand[$base->id] ?? 0) + ($item['quantity'] * $factor);
            $baseLabel[$base->id]  = "{$unit->product->name} ({$base->label})";
        }

        DB::beginTransaction();
        try {
            // Verrouillage (lockForUpdate) sur l'unite de BASE de chaque
            // produit concerne — et non plus sur l'unite vendue — pour que
            // deux ventes simultanees touchant des niveaux differents du
            // meme produit (une en Carton, une en Paquet) se serialisent
            // correctement sur la ressource reellement partagee.
            foreach ($baseDemand as $baseId => $qtyNeededBase) {
                $baseUnit = ProductUnit::whereHas('product', fn($q) => $q->where('shop_id', $shopId))
                    ->lockForUpdate()
                    ->findOrFail($baseId);

                $available = (int) $baseUnit->getRawOriginal('stock_qty');
                if ($available < $qtyNeededBase) {
                    DB::rollBack();
                    return response()->json([
                        'message' => "Stock insuffisant pour {$baseLabel[$baseId]}. Stock disponible : {$available}, demandé (converti en {$baseUnit->label}) : {$qtyNeededBase}.",
                    ], 422);
                }
            }

            // CORRECTIF (numeros de facture dupliques) : l'ancienne
            // generation (Sale::generateInvoiceNumber) faisait un simple
            // COUNT() sans verrou, execute APRES la creation de la vente.
            // Deux ventes concurrentes pouvaient lire le meme compte avant
            // que l'une des deux ne valide, et se voir attribuer le MEME
            // numero de facture (aucune contrainte unique n'existait non
            // plus en base pour l'empecher). Le compte est desormais fait
            // sous verrou (lockForUpdate), AVANT la creation de la vente,
            // dans la meme transaction — ce qui serialise correctement la
            // numerotation entre ventes concurrentes.
            $invoiceYear  = now()->format('Y');
            $invoiceCount = Sale::forShop($shopId)->whereYear('sold_at', $invoiceYear)->lockForUpdate()->count();
            $invoiceNumber = "FAC-{$invoiceYear}-" . str_pad($invoiceCount + 1, 5, '0', STR_PAD_LEFT);

            $sale = Sale::create([
                'shop_id'         => $shopId,
                'user_id'         => $user->id,
                'client_id'       => $clientId,
                'invoice_number'  => $invoiceNumber,
                'total_amount'    => $totalAmount,
                'discount_amount' => $discountAmount,
                'net_amount'      => $netAmount,
                'payment_mode'    => $validated['payment_mode'],
                'amount_paid'     => $amountPaid,
                'amount_due'      => $amountDue,
                'status'          => 'completed',
                'notes'           => $validated['notes'] ?? null,
                'sold_at'         => now(),
            ]);

            foreach ($validated['items'] as $item) {
                $unit = $soldUnits[$item['product_unit_id']];

                SaleItem::create([
                    'sale_id'         => $sale->id,
                    'product_unit_id' => $unit->id,
                    'sale_type'       => $item['sale_type'],
                    'quantity'        => $item['quantity'],
                    'unit_price'      => $item['unit_price'],
                    'total_price'     => $item['unit_price'] * $item['quantity'],
                ]);

                // Deduire le stock : converti et applique sur l'unite de
                // base, quel que soit le niveau vendu (Piece/Paquet/Carton).
                // CORRECTIF (point 4) : allowNegative desormais a false
                // (comportement par defaut) — le stock ne peut plus passer
                // sous zero suite a une vente. Le controle agrege ci-dessus
                // rend ce cas normalement impossible ; ce false est un
                // filet de securite qui declenche un rollback complet
                // plutot qu'une vente partiellement enregistree si jamais
                // le pre-controle etait contourne.
                $result = $unit->applyStockDelta(-$item['quantity']);
                $unit->update(['last_sold_at' => now()]);

                StockMovement::create([
                    'shop_id'         => $shopId,
                    'product_unit_id' => $unit->id,
                    'user_id'         => $user->id,
                    'sale_id'         => $sale->id,
                    'type'            => 'sale',
                    'quantity'        => -$item['quantity'],
                    'stock_before'    => $result['unit_before'],
                    'stock_after'     => $result['unit_after'],
                    'moved_at'        => now(),
                ]);
            }

            if (! empty($validated['extra_identity'])) {
                ExtraSaleIdentity::create([
                    'sale_id'   => $sale->id,
                    'name'      => $validated['extra_identity']['name'],
                    'firstname' => $validated['extra_identity']['firstname'],
                    'phone'     => $validated['extra_identity']['phone'],
                    'remarks'   => $validated['extra_identity']['remarks'] ?? null,
                ]);
            }

            // CORRECTIF (points 1 et 2) : la creance est desormais creee des
            // que amount_due > 0 ET qu'un client est identifiable — quel
            // que soit le payment_mode declare (avant : limite a
            // ['credit','mixed'], ce qui laissait passer un amount_due > 0
            // "orphelin" pour tout autre mode, ex. mobile_money sans
            // montant saisi).
            if ($amountDue > 0) {
                $shop       = $user->shop ?? $sale->shop;
                $creditDays = $shop->default_credit_days ?? 7;

                if (! $clientId && ! empty($validated['extra_identity'])) {
                    // CORRECTIF (doublons clients par telephone) : on
                    // cherche d'abord un client existant par telephone
                    // normalise (cf. Client::normalizePhone) avant d'en
                    // creer un nouveau — l'ancien firstOrCreate() exigeait
                    // une egalite EXACTE sur le telephone brut, ce qui
                    // creait une fiche client distincte a chaque variation
                    // de format (+229..., 229..., ou juste le numero local)
                    // pour la meme personne.
                    $client = Client::findByNormalizedPhone($shopId, $validated['extra_identity']['phone']);
                    if (! $client) {
                        $client = Client::create([
                            'shop_id'   => $shopId,
                            'phone'     => $validated['extra_identity']['phone'],
                            'name'      => $validated['extra_identity']['name'],
                            'firstname' => $validated['extra_identity']['firstname'],
                        ]);
                    }
                    $clientId = $client->id;
                    $sale->update(['client_id' => $clientId]);
                }

                // $clientId est garanti non-null ici grace a la validation
                // faite plus haut (avant le debut de la transaction).
                CreditSale::create([
                    'shop_id'          => $shopId,
                    'sale_id'          => $sale->id,
                    'client_id'        => $clientId,
                    'amount_due'       => $netAmount,
                    'amount_paid'      => $amountPaid,
                    'amount_remaining' => $amountDue,
                    'due_date'         => now()->addDays($creditDays),
                    'credit_days'      => $creditDays,
                    'status'           => $amountPaid > 0 ? 'partial' : 'pending',
                ]);
            }

            DB::commit();

            return response()->json([
                'message' => 'Vente enregistrée.',
                'data'    => $sale->load(['items.productUnit.product', 'client', 'extraIdentity', 'creditSale']),
            ], 201);

        } catch (\Illuminate\Database\QueryException $e) {
            // Filet de securite (defense en profondeur) pour le correctif
            // "numeros de facture dupliques" : si jamais une collision
            // survient malgre le verrou (ex. contrainte unique ajoutee en
            // base et violee dans un scenario imprevu), on renvoie un
            // message clair invitant a reessayer plutot qu'un 500 brut.
            DB::rollBack();
            if (str_contains($e->getMessage(), 'invoice_number')) {
                return response()->json([
                    'message' => "Conflit de numerotation de facture, veuillez reessayer.",
                ], 409);
            }
            throw $e;
        } catch (\RuntimeException $e) {
            // Filet de securite du point 4 (applyStockDelta refuse un
            // stock negatif) : on renvoie une erreur 422 propre plutot
            // qu'un 500 generique.
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    #[OA\Get(
        path: '/sales',
        summary: 'Liste des ventes',
        security: [['bearerAuth' => []]],
        tags: ['Ventes'],
        parameters: [
            new OA\Parameter(name: 'date',         in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'user_id',       in: 'query', schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'payment_mode',  in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'status',        in: 'query', schema: new OA\Schema(type: 'string')),
        ],
        responses: [new OA\Response(response: 200, description: 'Liste retournée')]
    )]
    public function index(Request $request): JsonResponse
    {
        $shopId = $this->requireShopId($request);
        $user   = $request->user();

        $query = Sale::forShop($shopId)
            ->with(['user', 'client', 'items'])
            ->orderByDesc('sold_at');

        if ($user->isCaissier()) {
            $query->where('user_id', $user->id)->today();
        }

        if ($request->filled('date'))        $query->whereDate('sold_at', $request->date);
        if ($request->filled('user_id'))     $query->where('user_id', $request->user_id);
        if ($request->filled('payment_mode'))$query->where('payment_mode', $request->payment_mode);
        if ($request->filled('status'))      $query->where('status', $request->status);

        return response()->json($query->paginate(50));
    }

    #[OA\Get(
        path: '/sales/{id}',
        summary: 'Détail d\'une vente',
        security: [['bearerAuth' => []]],
        tags: ['Ventes'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'OK')]
    )]
    public function show(Request $request, int $id): JsonResponse
    {
        $shopId = $this->requireShopId($request);

        $sale = Sale::forShop($shopId)
            ->with(['items.productUnit.product', 'user', 'client', 'extraIdentity', 'creditSale.payments'])
            ->findOrFail($id);

        return response()->json(['data' => $sale]);
    }

    #[OA\Post(
        path: '/sales/{id}/hold',
        summary: 'Mettre en attente',
        security: [['bearerAuth' => []]],
        tags: ['Ventes'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Vente mise en attente')]
    )]
    public function hold(Request $request, int $id): JsonResponse
    {
        $sale = Sale::forShop($this->requireShopId($request))
            ->where('status', 'completed')
            ->findOrFail($id);

        $sale->update(['status' => 'on_hold']);

        return response()->json(['message' => 'Vente mise en attente.', 'data' => $sale]);
    }

    #[OA\Post(
        path: '/sales/{id}/cancel',
        summary: 'Annuler une vente',
        security: [['bearerAuth' => []]],
        tags: ['Ventes'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'Vente annulée'),
            new OA\Response(response: 409, description: 'Annulation impossible'),
        ]
    )]
    public function cancel(Request $request, int $id): JsonResponse
    {
        $shopId = $this->requireShopId($request);
        $sale   = Sale::forShop($shopId)->with('items')->findOrFail($id);

        if ($sale->status === 'cancelled') {
            return response()->json(['message' => 'Cette vente est déjà annulée.'], 409);
        }

        if ($sale->creditSale && $sale->creditSale->amount_paid > 0) {
            return response()->json(['message' => 'Impossible : un paiement partiel a déjà été reçu sur ce crédit.'], 409);
        }

        DB::beginTransaction();
        try {
            foreach ($sale->items as $item) {
                $unit   = $item->productUnit;
                $result = $unit->applyStockDelta($item->quantity, allowNegative: true);

                StockMovement::create([
                    'shop_id'         => $shopId,
                    'product_unit_id' => $unit->id,
                    'user_id'         => $request->user()->id,
                    'sale_id'         => $sale->id,
                    'type'            => 'return',
                    'quantity'        => $item->quantity,
                    'stock_before'    => $result['unit_before'],
                    'stock_after'     => $result['unit_after'],
                    'reason'          => 'Annulation vente #' . $sale->invoice_number,
                    'moved_at'        => now(),
                ]);
            }

            $sale->update(['status' => 'cancelled']);
            if ($sale->creditSale) {
                // CORRECTIF (point 5, revu) : statut dedie "cancelled" au
                // lieu de reutiliser "paid" — un credit annule n'est pas
                // "regle", c'est un etat different. amount_due (montant
                // initial) reste volontairement inchange : c'est un fait
                // historique reel (la vente valait bien ce montant a
                // l'origine), on ne l'efface pas. amount_remaining passe a
                // 0 puisqu'il n'y a plus rien a recouvrer sur une vente
                // annulee. (amount_paid est deja garanti a 0 ici, cf. le
                // blocage 409 ci-dessus qui empeche l'annulation d'un
                // credit deja partiellement paye.)
                $sale->creditSale->update([
                    'status'           => 'cancelled',
                    'amount_remaining' => 0,
                ]);
            }

            DB::commit();
            return response()->json(['message' => 'Vente annulée et stock restauré.']);

        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    #[OA\Get(
        path: '/sales/summary/today',
        summary: 'Résumé des ventes du jour',
        security: [['bearerAuth' => []]],
        tags: ['Ventes'],
        responses: [new OA\Response(response: 200, description: 'Résumé retourné')]
    )]
    public function todaySummary(Request $request): JsonResponse
    {
        $shopId = $this->requireShopId($request);
        $user   = $request->user();

        $query = Sale::forShop($shopId)->completed()->today();

        if ($user->isCaissier()) {
            $query->where('user_id', $user->id);
        }

        $sales = $query->with('items')->get();

        $summary = [
            'date'              => today()->toDateString(),
            'nb_transactions'   => $sales->count(),
            'ca_total'          => $sales->sum('net_amount'),
            'ca_gros'           => $sales->flatMap->items->where('sale_type', 'gros')->sum('total_price'),
            'ca_detail'         => $sales->flatMap->items->where('sale_type', 'detail')->sum('total_price'),
            'ca_extra'          => $sales->flatMap->items->where('sale_type', 'extra')->sum('total_price'),
            'encaissements'     => $sales->sum('amount_paid'),
            'credits_accordes'  => $sales->where('payment_mode', 'credit')->sum('amount_due'),
            'nb_credits'        => $sales->whereIn('payment_mode', ['credit', 'mixed'])->count(),
        ];

        return response()->json(['data' => $summary]);
    }
}
