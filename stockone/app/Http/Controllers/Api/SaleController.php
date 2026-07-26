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
                    new OA\Property(property: 'client_id',       type: 'integer', example: 1,       description: 'Optionnel'),
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
            new OA\Response(response: 422, description: 'Stock insuffisant ou données invalides'),
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

        // Verifier stock disponible pour chaque item (stock_qty est deja
        // le stock reel converti a ce niveau, quel que soit le niveau vendu)
        foreach ($validated['items'] as $item) {
            $unit = ProductUnit::whereHas('product', fn($q) => $q->where('shop_id', $shopId))
                ->findOrFail($item['product_unit_id']);

            if ($unit->stock_qty < $item['quantity']) {
                return response()->json([
                    'message' => "Stock insuffisant pour {$unit->label} ({$unit->product->name}). Stock : {$unit->stock_qty}, demandé : {$item['quantity']}.",
                ], 422);
            }
        }

        DB::beginTransaction();
        try {
            $totalAmount    = collect($validated['items'])->sum(fn($i) => $i['unit_price'] * $i['quantity']);
            $discountAmount = $validated['discount_amount'] ?? 0;
            $netAmount      = $totalAmount - $discountAmount;
            $amountPaid     = $validated['amount_paid'] ?? ($validated['payment_mode'] === 'cash' ? $netAmount : 0);
            $amountDue      = max(0, $netAmount - $amountPaid);

            $sale = Sale::create([
                'shop_id'         => $shopId,
                'user_id'         => $user->id,
                'client_id'       => $validated['client_id'] ?? null,
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

            $sale->update(['invoice_number' => $sale->generateInvoiceNumber()]);

            foreach ($validated['items'] as $item) {
                $unit = ProductUnit::find($item['product_unit_id']);

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
                $result = $unit->applyStockDelta(-$item['quantity'], allowNegative: true);
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

            if ($amountDue > 0 && in_array($validated['payment_mode'], ['credit', 'mixed'])) {
                $shop       = $user->shop ?? $sale->shop;
                $creditDays = $shop->default_credit_days ?? 7;

                $clientId = $validated['client_id'] ?? null;
                if (! $clientId && ! empty($validated['extra_identity'])) {
                    $client = Client::firstOrCreate(
                        ['shop_id' => $shopId, 'phone' => $validated['extra_identity']['phone']],
                        [
                            'name'      => $validated['extra_identity']['name'],
                            'firstname' => $validated['extra_identity']['firstname'],
                        ]
                    );
                    $clientId = $client->id;
                    $sale->update(['client_id' => $clientId]);
                }

                if ($clientId) {
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
            }

            DB::commit();

            return response()->json([
                'message' => 'Vente enregistrée.',
                'data'    => $sale->load(['items.productUnit.product', 'client', 'extraIdentity', 'creditSale']),
            ], 201);

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
                $sale->creditSale->update(['status' => 'paid']);
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
