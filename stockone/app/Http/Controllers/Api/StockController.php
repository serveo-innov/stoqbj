<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductUnit;
use App\Models\StockMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Stock', description: 'Mouvements de stock')]
class StockController extends Controller
{
    #[OA\Post(
        path: '/stock/entry',
        summary: 'Entree de stock',
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['product_unit_id', 'quantity'],
                properties: [
                    new OA\Property(property: 'product_unit_id', type: 'integer', example: 1),
                    new OA\Property(property: 'quantity',        type: 'integer', example: 10),
                    new OA\Property(property: 'supplier_id',     type: 'integer', example: 1),
                    new OA\Property(property: 'unit_cost',       type: 'number',  example: 10000),
                    new OA\Property(property: 'reference',       type: 'string',  example: 'BON-2025-001'),
                    new OA\Property(property: 'reason',          type: 'string',  example: 'Livraison fournisseur'),
                ]
            )
        ),
        tags: ['Stock'],
        responses: [
            new OA\Response(response: 200, description: 'Stock mis a jour'),
            new OA\Response(response: 404, description: 'Unite introuvable'),
        ]
    )]
    public function entry(Request $request): JsonResponse
    {
        $shopId = $request->user()->shop_id;

        $validated = $request->validate([
            'product_unit_id' => ['required', 'integer', 'exists:product_units,id'],
            'quantity'        => ['required', 'integer', 'min:1'],
            'supplier_id'     => ['nullable', 'integer', 'exists:suppliers,id'],
            'unit_cost'       => ['nullable', 'numeric', 'min:0'],
            'reference'       => ['nullable', 'string', 'max:100'],
            'reason'          => ['nullable', 'string'],
        ]);

        $unit = ProductUnit::whereHas('product', fn($q) => $q->where('shop_id', $shopId))
            ->findOrFail($validated['product_unit_id']);

        DB::beginTransaction();
        try {
            $stockBefore = $unit->stock_qty;
            $stockAfter  = $stockBefore + $validated['quantity'];

            $unit->update(['stock_qty' => $stockAfter]);

            StockMovement::create([
                'shop_id'         => $shopId,
                'product_unit_id' => $unit->id,
                'user_id'         => $request->user()->id,
                'supplier_id'     => $validated['supplier_id'] ?? null,
                'type'            => 'entry',
                'quantity'        => $validated['quantity'],
                'stock_before'    => $stockBefore,
                'stock_after'     => $stockAfter,
                'unit_cost'       => $validated['unit_cost'] ?? null,
                'reference'       => $validated['reference'] ?? null,
                'reason'          => $validated['reason'] ?? 'Reapprovisionnement',
                'moved_at'        => now(),
            ]);

            DB::commit();
            return response()->json([
                'message'      => "Stock mis a jour : {$stockBefore} => {$stockAfter}",
                'stock_before' => $stockBefore,
                'stock_after'  => $stockAfter,
                'unit'         => $unit->fresh(),
            ]);

        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    #[OA\Post(
        path: '/stock/adjustment',
        summary: 'Ajustement de stock',
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['product_unit_id', 'quantity', 'type', 'reason'],
                properties: [
                    new OA\Property(property: 'product_unit_id', type: 'integer', example: 1),
                    new OA\Property(property: 'quantity',        type: 'integer', example: -3),
                    new OA\Property(property: 'type',            type: 'string',  enum: ['adjustment', 'return', 'loss', 'internal_use', 'inventory']),
                    new OA\Property(property: 'reason',          type: 'string',  example: 'Produits endommages'),
                ]
            )
        ),
        tags: ['Stock'],
        responses: [
            new OA\Response(response: 200, description: 'Ajustement effectue'),
            new OA\Response(response: 422, description: 'Stock insuffisant'),
        ]
    )]
    public function adjustment(Request $request): JsonResponse
    {
        $shopId = $request->user()->shop_id;

        $validated = $request->validate([
            'product_unit_id' => ['required', 'integer', 'exists:product_units,id'],
            'quantity'        => ['required', 'integer', 'not_in:0'],
            'type'            => ['required', 'in:adjustment,return,loss,internal_use,inventory'],
            'reason'          => ['required', 'string', 'max:255'],
        ]);

        $unit = ProductUnit::whereHas('product', fn($q) => $q->where('shop_id', $shopId))
            ->findOrFail($validated['product_unit_id']);

        $stockBefore = $unit->stock_qty;
        $stockAfter  = $stockBefore + $validated['quantity'];

        if ($stockAfter < 0) {
            return response()->json([
                'message' => "Stock insuffisant. Stock actuel : {$stockBefore}, ajustement : {$validated['quantity']}.",
            ], 422);
        }

        DB::beginTransaction();
        try {
            $unit->update(['stock_qty' => $stockAfter]);

            StockMovement::create([
                'shop_id'         => $shopId,
                'product_unit_id' => $unit->id,
                'user_id'         => $request->user()->id,
                'type'            => $validated['type'],
                'quantity'        => $validated['quantity'],
                'stock_before'    => $stockBefore,
                'stock_after'     => $stockAfter,
                'reason'          => $validated['reason'],
                'moved_at'        => now(),
            ]);

            DB::commit();
            return response()->json([
                'message'      => "Ajustement effectue : {$stockBefore} => {$stockAfter}",
                'stock_before' => $stockBefore,
                'stock_after'  => $stockAfter,
                'unit'         => $unit->fresh(),
            ]);

        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    #[OA\Get(
        path: '/stock/movements',
        summary: 'Historique des mouvements',
        security: [['bearerAuth' => []]],
        tags: ['Stock'],
        parameters: [
            new OA\Parameter(name: 'product_unit_id', in: 'query', schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'type',            in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'from',            in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to',              in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
        ],
        responses: [new OA\Response(response: 200, description: 'Historique retourne')]
    )]
    public function movements(Request $request): JsonResponse
    {
        $shopId = $request->user()->shop_id;

        $query = StockMovement::where('shop_id', $shopId)
            ->with(['productUnit.product', 'user', 'supplier'])
            ->orderByDesc('moved_at');

        if ($request->filled('product_unit_id')) $query->where('product_unit_id', $request->product_unit_id);
        if ($request->filled('type'))            $query->where('type', $request->type);
        if ($request->filled('from'))            $query->whereDate('moved_at', '>=', $request->from);
        if ($request->filled('to'))              $query->whereDate('moved_at', '<=', $request->to);

        return response()->json($query->paginate(50));
    }

    #[OA\Get(
        path: '/stock/alerts',
        summary: 'Produits en alerte de stock',
        security: [['bearerAuth' => []]],
        tags: ['Stock'],
        responses: [new OA\Response(response: 200, description: 'Alertes retournees')]
    )]
    public function alerts(Request $request): JsonResponse
    {
        $shopId = $request->user()->shop_id;

        $units = ProductUnit::whereHas('product', fn($q) => $q->where('shop_id', $shopId)->where('is_active', true))
            ->with('product.category')
            ->where('stock_qty', '<=', DB::raw('stock_alert_threshold'))
            ->get()
            ->map(fn($unit) => [
                'product_unit_id'       => $unit->id,
                'product_name'          => $unit->product->name,
                'unit_label'            => $unit->label,
                'category'              => $unit->product->category?->name,
                'stock_qty'             => $unit->stock_qty,
                'stock_alert_threshold' => $unit->stock_alert_threshold,
                'status'                => $unit->isOutOfStock() ? 'out_of_stock' : 'low_stock',
            ]);

        return response()->json(['data' => $units, 'count' => $units->count()]);
    }
}
