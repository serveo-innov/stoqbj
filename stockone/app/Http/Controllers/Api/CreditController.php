<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CreditPayment;
use App\Models\CreditSale;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Credits', description: 'Ventes a credit et recouvrement')]
class CreditController extends Controller
{
    use ResolvesShopId;

    /**
     * Liste des crédits avec filtres
     */
    #[OA\Get(
        path: '/credits',
        summary: 'Liste des credits',
        security: [['bearerAuth' => []]],
        tags: ['Credits'],
        parameters: [
            new OA\Parameter(name: 'status',    in: 'query', schema: new OA\Schema(type: 'string', enum: ['pending', 'partial', 'paid', 'overdue', 'doubtful'])),
            new OA\Parameter(name: 'client_id', in: 'query', schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'overdue',   in: 'query', schema: new OA\Schema(type: 'boolean')),
            new OA\Parameter(name: 'from',      in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to',        in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
        ],
        responses: [new OA\Response(response: 200, description: 'Liste retournee')]
    )]
    public function index(Request $request): JsonResponse
    {
        $shopId = $this->requireShopId($request);

        $query = CreditSale::forShop($shopId)
            ->with(['client', 'sale', 'payments'])
            ->orderByDesc('created_at');

        if ($request->filled('status'))    $query->where('status', $request->status);
        if ($request->filled('client_id')) $query->where('client_id', $request->client_id);
        if ($request->boolean('overdue'))  $query->where('due_date', '<', now())->whereNotIn('status', ['paid']);
        if ($request->filled('from'))      $query->whereDate('created_at', '>=', $request->from);
        if ($request->filled('to'))        $query->whereDate('created_at', '<=', $request->to);

        $credits = $query->paginate(50);

        // Statistiques globales
        $stats = [
            'total_due'       => CreditSale::forShop($shopId)->whereNotIn('status', ['paid'])->sum('amount_remaining'),
            'total_overdue'   => CreditSale::forShop($shopId)->where('due_date', '<', now())->whereNotIn('status', ['paid'])->sum('amount_remaining'),
            'nb_debtors'      => CreditSale::forShop($shopId)->whereNotIn('status', ['paid'])->distinct('client_id')->count('client_id'),
        ];

        return response()->json([
            'stats' => $stats,
            'data'  => $credits,
        ]);
    }

    /**
     * Détail d'un crédit
     */
    #[OA\Get(
        path: '/credits/{id}',
        summary: 'Detail d\'un credit',
        security: [['bearerAuth' => []]],
        tags: ['Credits'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'OK')]
    )]
    public function show(Request $request, int $id): JsonResponse
    {
        $credit = CreditSale::forShop($this->requireShopId($request))
            ->with(['client', 'sale.items.productUnit.product', 'payments.receivedBy'])
            ->findOrFail($id);

        return response()->json(['data' => $credit]);
    }

    /**
     * Enregistrer un paiement sur un crédit
     *
     * CORRECTIF (point 3) : la ligne credit_sales est désormais verrouillée
     * (lockForUpdate) DANS la transaction, et le montant restant est relu
     * après verrouillage avant validation. Ça empêche deux requêtes
     * quasi simultanées (double-clic, double soumission réseau) de valider
     * toutes les deux contre le même amount_remaining de départ et de
     * faire passer amount_remaining sous zéro.
     */
    #[OA\Post(
        path: '/credits/{id}/payments',
        summary: 'Encaisser un paiement sur un credit',
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['amount', 'payment_method'],
                properties: [
                    new OA\Property(property: 'amount',         type: 'number', example: 2000),
                    new OA\Property(property: 'payment_method', type: 'string', enum: ['cash', 'mobile_money', 'virement'], example: 'cash'),
                    new OA\Property(property: 'notes',          type: 'string'),
                ]
            )
        ),
        tags: ['Credits'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'Paiement enregistre'),
            new OA\Response(response: 422, description: 'Montant invalide'),
        ]
    )]
    public function addPayment(Request $request, int $id): JsonResponse
    {
        // Validation "légère" en amont uniquement pour les champs qui ne
        // dépendent pas de l'état concurrent (payment_method, notes).
        $request->validate([
            'amount'         => ['required', 'numeric', 'min:1'],
            'payment_method' => ['required', 'in:cash,mobile_money,virement'],
            'notes'          => ['nullable', 'string'],
        ]);

        DB::beginTransaction();
        try {
            // Verrou de ligne : toute autre requête concurrente sur ce
            // credit_sale attend ici que la transaction se termine.
            $credit = CreditSale::forShop($this->requireShopId($request))
                ->lockForUpdate()
                ->findOrFail($id);

            if ($credit->status === 'paid') {
                DB::rollBack();
                return response()->json(['message' => 'Ce credit est deja solde.'], 422);
            }

            $amount = (float) $request->input('amount');

            // Revalidation du montant max APRES verrouillage, contre l'état
            // réel et à jour de amount_remaining (et non celui lu avant le lock).
            if ($amount > (float) $credit->amount_remaining) {
                DB::rollBack();
                return response()->json([
                    'message' => "Le montant ne peut pas depasser le reste du ({$credit->amount_remaining} FCFA).",
                    'errors'  => ['amount' => ["Le montant ne peut pas depasser le reste du ({$credit->amount_remaining} FCFA)."]],
                ], 422);
            }

            CreditPayment::create([
                'credit_sale_id' => $credit->id,
                'received_by'    => $request->user()->id,
                'amount'         => $amount,
                'payment_method' => $request->input('payment_method'),
                'notes'          => $request->input('notes'),
                'paid_at'        => now(),
            ]);

            $newAmountPaid      = $credit->amount_paid + $amount;
            $newAmountRemaining = $credit->amount_remaining - $amount;

            $status = 'partial';
            if ($newAmountRemaining <= 0) {
                $status = 'paid';
            } elseif ($credit->due_date->isPast()) {
                $status = 'overdue';
            }

            $credit->update([
                'amount_paid'      => $newAmountPaid,
                'amount_remaining' => max(0, $newAmountRemaining),
                'status'           => $status,
            ]);

            // Mettre à jour la vente parente
            $credit->sale->update([
                'amount_paid' => $credit->sale->amount_paid + $amount,
                'amount_due'  => max(0, $credit->sale->amount_due - $amount),
            ]);

            DB::commit();

            return response()->json([
                'message'          => 'Paiement enregistre.',
                'amount_paid'      => $newAmountPaid,
                'amount_remaining' => max(0, $newAmountRemaining),
                'status'           => $status,
                'credit'           => $credit->fresh()->load(['client', 'payments']),
            ]);

        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Marquer un crédit comme douteux
     */
    #[OA\Post(
        path: '/credits/{id}/doubtful',
        summary: 'Marquer comme creance douteuse',
        security: [['bearerAuth' => []]],
        tags: ['Credits'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Statut mis a jour')]
    )]
    public function markDoubtful(Request $request, int $id): JsonResponse
    {
        $credit = CreditSale::forShop($this->requireShopId($request))
            ->whereNotIn('status', ['paid'])
            ->findOrFail($id);

        $credit->update(['status' => 'doubtful']);

        return response()->json(['message' => 'Credit marque comme creance douteuse.', 'data' => $credit]);
    }

    /**
     * Prolonger la date d'échéance
     *
     * CORRECTIFS :
     * (point 2) Un crédit "doubtful" est désormais exclu — il ne peut plus
     * être prolongé tant qu'il n'a pas été traité autrement (paiement).
     * Décision produit : option A (restrictive), à revoir si besoin d'un
     * parcours de "réhabilitation" explicite plus tard.
     *
     * (point 1) Le nouveau statut est maintenant recalculé par rapport à la
     * NOUVELLE échéance réelle (comparée à now()), et non plus uniquement
     * par rapport à amount_paid. Avant : un crédit en retard prolongé de
     * quelques jours insuffisants repassait à tort en "partial"/"pending"
     * alors que la nouvelle échéance restait dans le passé — créant une
     * incohérence entre le badge de statut, le texte "Xj de retard" affiché
     * en dessous (calculé en direct depuis due_date), et le KPI "Montant en
     * retard" (calculé lui aussi en direct depuis due_date, indépendamment
     * du statut stocké).
     */
    #[OA\Post(
        path: '/credits/{id}/extend',
        summary: 'Prolonger l\'echeance',
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['days'],
                properties: [
                    new OA\Property(property: 'days',  type: 'integer', example: 7, description: 'Nombre de jours supplementaires'),
                    new OA\Property(property: 'notes', type: 'string'),
                ]
            )
        ),
        tags: ['Credits'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'Echeance prolongee'),
            new OA\Response(response: 422, description: 'Credit douteux : prolongation refusee'),
        ]
    )]
    public function extend(Request $request, int $id): JsonResponse
    {
        $credit = CreditSale::forShop($this->requireShopId($request))
            ->whereNotIn('status', ['paid'])
            ->findOrFail($id);

        if ($credit->status === 'doubtful') {
            return response()->json([
                'message' => "Ce credit est marque comme creance douteuse : l'echeance ne peut pas etre prolongee tant qu'il n'a pas ete regularise par un paiement.",
            ], 422);
        }

        $validated = $request->validate([
            'days'  => ['required', 'integer', 'min:1', 'max:90'],
            'notes' => ['nullable', 'string'],
        ]);

        $newDueDate = $credit->due_date->addDays($validated['days']);

        // Statut recalculé par rapport à la NOUVELLE échéance réelle,
        // pas uniquement par rapport à amount_paid.
        if ($newDueDate->isPast()) {
            $status = 'overdue';
        } elseif ($credit->amount_paid > 0) {
            $status = 'partial';
        } else {
            $status = 'pending';
        }

        $credit->update([
            'due_date' => $newDueDate,
            'status'   => $status,
            'notes'    => $validated['notes'] ?? $credit->notes,
        ]);

        return response()->json([
            'message'      => "Echeance prolongee de {$validated['days']} jours.",
            'new_due_date' => $newDueDate->toDateString(),
            'data'         => $credit,
        ]);
    }

    /**
     * Tableau de bord des débiteurs
     */
    #[OA\Get(
        path: '/credits/debtors',
        summary: 'Tableau des debiteurs',
        security: [['bearerAuth' => []]],
        tags: ['Credits'],
        responses: [new OA\Response(response: 200, description: 'Debiteurs retournes')]
    )]
    public function debtors(Request $request): JsonResponse
    {
        $shopId = $this->requireShopId($request);

        $debtors = CreditSale::forShop($shopId)
            ->whereNotIn('status', ['paid'])
            ->with('client')
            ->get()
            ->groupBy('client_id')
            ->map(function ($credits) {
                $client = $credits->first()->client;
                return [
                    'client_id'        => $client->id,
                    'client_name'      => $client->full_name,
                    'client_phone'     => $client->phone,
                    'nb_credits'       => $credits->count(),
                    'total_remaining'  => $credits->sum('amount_remaining'),
                    'oldest_due_date'  => $credits->min('due_date'),
                    'has_overdue'      => $credits->contains(fn($c) => $c->due_date->isPast()),
                    'has_doubtful'     => $credits->contains(fn($c) => $c->status === 'doubtful'),
                ];
            })
            ->sortByDesc('total_remaining')
            ->values();

        return response()->json(['data' => $debtors]);
    }
}
