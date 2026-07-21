<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PriceHistory;
use App\Models\Product;
use App\Models\ProductUnit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Catalogue', description: 'Produits et Categories')]
class ProductController extends Controller
{
    use ResolvesShopId;

    #[OA\Get(
        path: '/products',
        summary: 'Liste des produits',
        security: [['bearerAuth' => []]],
        tags: ['Catalogue'],
        parameters: [
            new OA\Parameter(name: 'search',      in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'category_id', in: 'query', schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'low_stock',   in: 'query', schema: new OA\Schema(type: 'boolean')),
        ],
        responses: [new OA\Response(response: 200, description: 'Liste retournee')]
    )]
    public function index(Request $request): JsonResponse
    {
        $shopId = $this->requireShopId($request);

        $query = Product::forShop($shopId)->with(['category', 'units'])->active();

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('reference', 'like', "%{$search}%")
                  ->orWhere('barcode', 'like', "%{$search}%");
            });
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        $products = $query->orderBy('name')->get();

        if ($request->boolean('low_stock')) {
            $products = $products->filter(fn($p) => $p->hasLowStock())->values();
        }

        return response()->json(['data' => $products]);
    }

    #[OA\Post(
        path: '/products',
        summary: 'Creer un produit avec ses unites',
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name', 'units'],
                properties: [
                    new OA\Property(property: 'name',        type: 'string',  example: 'Stylo Bic Cristal Bleu'),
                    new OA\Property(property: 'category_id', type: 'integer', example: 1),
                    new OA\Property(property: 'reference',   type: 'string',  example: 'STY-BIC-001'),
                    new OA\Property(property: 'barcode',     type: 'string',  example: '3086123456789'),
                    new OA\Property(property: 'description', type: 'string'),
                    new OA\Property(
                        property: 'units',
                        type: 'array',
                        items: new OA\Items(
                            properties: [
                                new OA\Property(property: 'level',                 type: 'integer', example: 1),
                                new OA\Property(property: 'label',                 type: 'string',  example: 'Gros Carton'),
                                new OA\Property(property: 'qty_in_parent',         type: 'integer', example: 1),
                                new OA\Property(property: 'price_wholesale',       type: 'number',  example: 12000),
                                new OA\Property(property: 'price_extra',           type: 'number',  example: 14000),
                                new OA\Property(property: 'cost_price',            type: 'number',  example: 10000),
                                new OA\Property(property: 'stock_qty',             type: 'integer', example: 0),
                                new OA\Property(property: 'stock_alert_threshold', type: 'integer', example: 2),
                                new OA\Property(property: 'is_divisible',          type: 'boolean', example: true),
                                new OA\Property(property: 'is_sellable',           type: 'boolean', example: true),
                            ]
                        )
                    ),
                ]
            )
        ),
        tags: ['Catalogue'],
        responses: [
            new OA\Response(response: 201, description: 'Produit cree'),
            new OA\Response(response: 422, description: 'Donnees invalides'),
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $shopId = $this->requireShopId($request);

        $validated = $request->validate([
            'name'                          => ['required', 'string', 'max:200'],
            'category_id'                   => ['nullable', 'integer', 'exists:categories,id'],
            'reference'                     => ['nullable', 'string', 'max:50'],
            'barcode'                       => ['nullable', 'string', 'max:50'],
            'description'                   => ['nullable', 'string'],
            'units'                         => ['required', 'array', 'min:1', 'max:3'],
            'units.*.level'                 => ['required', 'integer', 'in:1,2,3'],
            'units.*.label'                 => ['required', 'string', 'max:100'],
            'units.*.qty_in_parent'         => ['required', 'integer', 'min:1'],
            'units.*.price_wholesale'       => ['required', 'numeric', 'min:0'],
            'units.*.price_extra'           => ['required', 'numeric', 'min:0'],
            'units.*.cost_price'            => ['required', 'numeric', 'min:0'],
            'units.*.stock_qty'             => ['sometimes', 'integer', 'min:0'],
            'units.*.stock_alert_threshold' => ['sometimes', 'integer', 'min:0'],
            'units.*.is_divisible'          => ['sometimes', 'boolean'],
            'units.*.is_sellable'           => ['sometimes', 'boolean'],
        ]);

        DB::beginTransaction();
        try {
            $product = Product::create([
                'shop_id'     => $shopId,
                'category_id' => $validated['category_id'] ?? null,
                'name'        => $validated['name'],
                'reference'   => $validated['reference'] ?? null,
                'barcode'     => $validated['barcode'] ?? null,
                'description' => $validated['description'] ?? null,
            ]);

            $units        = collect($validated['units'])->sortBy('level');
            $createdUnits = [];

            foreach ($units as $unitData) {
                $parentId = null;
                if ($unitData['level'] > 1 && isset($createdUnits[$unitData['level'] - 1])) {
                    $parentId = $createdUnits[$unitData['level'] - 1]->id;
                }

                $unit = ProductUnit::create([
                    'product_id'            => $product->id,
                    'parent_unit_id'        => $parentId,
                    'level'                 => $unitData['level'],
                    'label'                 => $unitData['label'],
                    'qty_in_parent'         => $unitData['qty_in_parent'],
                    'price_wholesale'       => $unitData['price_wholesale'],
                    'price_extra'           => $unitData['price_extra'],
                    'cost_price'            => $unitData['cost_price'],
                    'stock_qty'             => $unitData['stock_qty'] ?? 0,
                    'stock_alert_threshold' => $unitData['stock_alert_threshold'] ?? 5,
                    'is_divisible'          => $unitData['is_divisible'] ?? true,
                    'is_sellable'           => $unitData['is_sellable'] ?? true,
                ]);

                $createdUnits[$unitData['level']] = $unit;
            }

            DB::commit();
            return response()->json(['data' => $product->load(['category', 'units']), 'message' => 'Produit cree.'], 201);

        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }
    }

    #[OA\Get(
        path: '/products/{id}',
        summary: 'Detail produit',
        security: [['bearerAuth' => []]],
        tags: ['Catalogue'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'OK')]
    )]
    public function show(Request $request, int $id): JsonResponse
    {
        $product = Product::forShop($this->requireShopId($request))
            ->with(['category', 'units'])
            ->findOrFail($id);

        return response()->json(['data' => $product]);
    }

    #[OA\Put(
        path: '/products/{id}',
        summary: 'Modifier un produit',
        security: [['bearerAuth' => []]],
        tags: ['Catalogue'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'OK')]
    )]
    public function update(Request $request, int $id): JsonResponse
    {
        $product   = Product::forShop($this->requireShopId($request))->findOrFail($id);
        $validated = $request->validate([
            'name'        => ['sometimes', 'string', 'max:200'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'reference'   => ['nullable', 'string', 'max:50'],
            'barcode'     => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string'],
            'is_active'   => ['sometimes', 'boolean'],
        ]);

        $product->update($validated);
        return response()->json(['data' => $product->load(['category', 'units']), 'message' => 'Produit modifie.']);
    }

    #[OA\Delete(
        path: '/products/{id}',
        summary: 'Archiver un produit',
        security: [['bearerAuth' => []]],
        tags: ['Catalogue'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Archive')]
    )]
    public function destroy(Request $request, int $id): JsonResponse
    {
        $product = Product::forShop($this->requireShopId($request))->findOrFail($id);
        $product->delete();
        return response()->json(['message' => 'Produit archive.']);
    }

    #[OA\Put(
        path: '/products/{id}/units/{unitId}/price',
        summary: 'Modifier les prix d\'une unite',
        security: [['bearerAuth' => []]],
        tags: ['Catalogue'],
        parameters: [
            new OA\Parameter(name: 'id',     in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'unitId', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'price_wholesale', type: 'number', example: 13000),
                    new OA\Property(property: 'price_extra',     type: 'number', example: 15000),
                    new OA\Property(property: 'cost_price',      type: 'number', example: 11000),
                    new OA\Property(property: 'reason',          type: 'string', enum: ['manual', 'promotion', 'correction']),
                    new OA\Property(property: 'notes',           type: 'string'),
                ]
            )
        ),
        responses: [new OA\Response(response: 200, description: 'Prix mis a jour')]
    )]
    public function updatePrice(Request $request, int $id, int $unitId): JsonResponse
    {
        $product = Product::forShop($this->requireShopId($request))->findOrFail($id);
        $unit    = ProductUnit::where('product_id', $product->id)->findOrFail($unitId);

        $validated = $request->validate([
            'price_wholesale' => ['sometimes', 'numeric', 'min:0'],
            'price_extra'     => ['sometimes', 'numeric', 'min:0'],
            'cost_price'      => ['sometimes', 'numeric', 'min:0'],
            'reason'          => ['sometimes', 'in:manual,promotion,correction'],
            'notes'           => ['nullable', 'string'],
        ]);

        PriceHistory::create([
            'product_unit_id'     => $unit->id,
            'changed_by'          => $request->user()->id,
            'old_price_wholesale' => $unit->price_wholesale,
            'new_price_wholesale' => $validated['price_wholesale'] ?? $unit->price_wholesale,
            'old_price_extra'     => $unit->price_extra,
            'new_price_extra'     => $validated['price_extra'] ?? $unit->price_extra,
            'old_cost_price'      => $unit->cost_price,
            'new_cost_price'      => $validated['cost_price'] ?? $unit->cost_price,
            'reason'              => $validated['reason'] ?? 'manual',
            'notes'               => $validated['notes'] ?? null,
        ]);

        $unit->update([
            'price_wholesale' => $validated['price_wholesale'] ?? $unit->price_wholesale,
            'price_extra'     => $validated['price_extra'] ?? $unit->price_extra,
            'cost_price'      => $validated['cost_price'] ?? $unit->cost_price,
        ]);

        return response()->json(['data' => $unit, 'message' => 'Prix mis a jour.']);
    }
}
