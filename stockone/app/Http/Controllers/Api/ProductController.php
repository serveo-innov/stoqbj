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

        $query = Product::forShop($shopId)->with(['category', 'units']);

        $status = $request->get('status', 'active');
        if ($status === 'active') {
            $query->active();
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

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
                        description: 'Le stock initial (stock_qty) n\'est pris en compte QUE pour le niveau 1 (unite de base). Pour les niveaux 2/3, il est ignore : leur stock est toujours calcule a partir du niveau 1.',
                        items: new OA\Items(
                            properties: [
                                new OA\Property(property: 'level',                 type: 'integer', example: 1),
                                new OA\Property(property: 'label',                 type: 'string',  example: 'Gros Carton'),
                                new OA\Property(property: 'qty_in_parent',         type: 'integer', example: 1),
                                new OA\Property(property: 'price_wholesale',       type: 'number',  example: 12000),
                                new OA\Property(property: 'price_extra',           type: 'number',  example: 14000),
                                new OA\Property(property: 'cost_price',            type: 'number',  example: 10000),
                                new OA\Property(property: 'stock_qty',             type: 'integer', example: 0, description: 'Ignore si level != 1'),
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
            'units.*.price_detail'          => ['required', 'numeric', 'min:0'],
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

                // Le stock initial saisi n'est retenu QUE pour le niveau 1
                // (unite de base) : c'est la seule colonne stock_qty jamais
                // ecrite directement. Les niveaux 2/3 demarrent a 0 en base,
                // leur stock affiche etant calcule depuis le niveau 1.
                $initialStock = $unitData['level'] === 1 ? ($unitData['stock_qty'] ?? 0) : 0;

                $unit = ProductUnit::create([
                    'product_id'            => $product->id,
                    'parent_unit_id'        => $parentId,
                    'level'                 => $unitData['level'],
                    'label'                 => $unitData['label'],
                    'qty_in_parent'         => $unitData['qty_in_parent'],
                    'price_wholesale'       => $unitData['price_wholesale'],
                    'price_detail'          => $unitData['price_detail'],
                    'price_extra'           => $unitData['price_extra'],
                    'cost_price'            => $unitData['cost_price'],
                    'stock_qty'             => $initialStock,
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

    public function forceDestroy(Request $request, int $id): JsonResponse
    {
        $product = Product::forShop($this->requireShopId($request))->withTrashed()->findOrFail($id);
        try {
            $product->forceDelete();
        } catch (\Illuminate\Database\QueryException $e) {
            return response()->json([
                'message' => 'Ce produit a un historique de ventes ou de mouvements de stock : il ne peut pas etre supprime definitivement. Vous pouvez seulement l\'archiver.',
            ], 409);
        }
        return response()->json(['message' => 'Produit supprime definitivement.']);
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
            'price_detail'    => ['sometimes', 'numeric', 'min:0'],
            'price_extra'     => ['sometimes', 'numeric', 'min:0'],
            'cost_price'      => ['sometimes', 'numeric', 'min:0'],
            'reason'          => ['sometimes', 'in:manual,promotion,correction'],
            'notes'           => ['nullable', 'string'],
        ]);

        PriceHistory::create([
            'product_unit_id'     => $unit->id,
            'changed_by'          => $request->user()->id,
            'old_price_wholesale' => $unit->price_wholesale,
            'old_price_detail'    => $unit->price_detail,
            'new_price_wholesale' => $validated['price_wholesale'] ?? $unit->price_wholesale,
            'new_price_detail'    => $validated['price_detail'] ?? $unit->price_detail,
            'old_price_extra'     => $unit->price_extra,
            'new_price_extra'     => $validated['price_extra'] ?? $unit->price_extra,
            'old_cost_price'      => $unit->cost_price,
            'new_cost_price'      => $validated['cost_price'] ?? $unit->cost_price,
            'reason'              => $validated['reason'] ?? 'manual',
            'notes'               => $validated['notes'] ?? null,
        ]);

        $unit->update([
            'price_wholesale' => $validated['price_wholesale'] ?? $unit->price_wholesale,
            'price_detail'    => $validated['price_detail'] ?? $unit->price_detail,
            'price_extra'     => $validated['price_extra'] ?? $unit->price_extra,
            'cost_price'      => $validated['cost_price'] ?? $unit->cost_price,
        ]);

        return response()->json(['data' => $unit, 'message' => 'Prix mis a jour.']);
    }

    #[OA\Post(
        path: '/products/{id}/units',
        summary: 'Ajouter un niveau d\'unite a un produit existant',
        security: [['bearerAuth' => []]],
        tags: ['Catalogue'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 201, description: 'Niveau ajoute'),
            new OA\Response(response: 422, description: 'Niveau deja existant ou limite atteinte'),
        ]
    )]
    public function addUnit(Request $request, int $id): JsonResponse
    {
        $product = Product::forShop($this->requireShopId($request))->with('units')->findOrFail($id);

        if ($product->units->count() >= 3) {
            return response()->json(['message' => 'Ce produit a deja le maximum de 3 niveaux.'], 422);
        }

        $validated = $request->validate([
            'level'                 => ['required', 'integer', 'in:1,2,3'],
            'label'                 => ['required', 'string', 'max:100'],
            'qty_in_parent'         => ['required', 'integer', 'min:1'],
            'price_wholesale'       => ['required', 'numeric', 'min:0'],
            'price_detail'          => ['required', 'numeric', 'min:0'],
            'price_extra'           => ['required', 'numeric', 'min:0'],
            'cost_price'            => ['required', 'numeric', 'min:0'],
            'stock_alert_threshold' => ['sometimes', 'integer', 'min:0'],
            'is_divisible'          => ['sometimes', 'boolean'],
            'is_sellable'           => ['sometimes', 'boolean'],
        ]);

        if ($product->units->firstWhere('level', $validated['level'])) {
            return response()->json(['message' => "Le niveau {$validated['level']} existe deja pour ce produit."], 422);
        }

        $parent = $product->units->firstWhere('level', $validated['level'] - 1);
        if ($validated['level'] > 1 && ! $parent) {
            return response()->json(['message' => "Le niveau {$validated['level']} necessite d'abord le niveau " . ($validated['level'] - 1) . "."], 422);
        }

        $unit = ProductUnit::create([
            'product_id'            => $product->id,
            'parent_unit_id'        => $parent?->id,
            'level'                 => $validated['level'],
            'label'                 => $validated['label'],
            'qty_in_parent'         => $validated['qty_in_parent'],
            'price_wholesale'       => $validated['price_wholesale'],
            'price_detail'          => $validated['price_detail'],
            'price_extra'           => $validated['price_extra'],
            'cost_price'            => $validated['cost_price'],
            'stock_qty'             => 0,
            'stock_alert_threshold' => $validated['stock_alert_threshold'] ?? 5,
            'is_divisible'          => $validated['is_divisible'] ?? true,
            'is_sellable'           => $validated['is_sellable'] ?? true,
        ]);

        return response()->json(['data' => $unit, 'message' => 'Niveau ajoute.'], 201);
    }

    #[OA\Put(
        path: '/products/{id}/units/{unitId}',
        summary: 'Modifier un niveau d\'unite (hors prix, hors stock)',
        security: [['bearerAuth' => []]],
        tags: ['Catalogue'],
        parameters: [
            new OA\Parameter(name: 'id',     in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'unitId', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [new OA\Response(response: 200, description: 'Niveau modifie')]
    )]
    public function updateUnit(Request $request, int $id, int $unitId): JsonResponse
    {
        $product = Product::forShop($this->requireShopId($request))->findOrFail($id);
        $unit    = ProductUnit::where('product_id', $product->id)->findOrFail($unitId);

        $validated = $request->validate([
            'label'                 => ['sometimes', 'string', 'max:100'],
            'qty_in_parent'         => ['sometimes', 'integer', 'min:1'],
            'stock_alert_threshold' => ['sometimes', 'integer', 'min:0'],
            'is_divisible'          => ['sometimes', 'boolean'],
            'is_sellable'           => ['sometimes', 'boolean'],
        ]);

        $unit->update($validated);
        return response()->json(['data' => $unit->fresh(), 'message' => 'Niveau modifie.']);
    }

    #[OA\Delete(
        path: '/products/{id}/units/{unitId}',
        summary: 'Supprimer un niveau d\'unite',
        security: [['bearerAuth' => []]],
        tags: ['Catalogue'],
        parameters: [
            new OA\Parameter(name: 'id',     in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'unitId', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Niveau supprime'),
            new OA\Response(response: 409, description: 'Suppression impossible : historique existant'),
            new OA\Response(response: 422, description: 'Suppression impossible : niveau intermediaire avec enfant'),
        ]
    )]
    public function deleteUnit(Request $request, int $id, int $unitId): JsonResponse
    {
        $product = Product::forShop($this->requireShopId($request))->findOrFail($id);
        $unit    = ProductUnit::where('product_id', $product->id)->findOrFail($unitId);

        if ($product->units()->count() <= 1) {
            return response()->json(['message' => 'Impossible de supprimer le dernier niveau restant d\'un produit.'], 422);
        }

        if (ProductUnit::where('parent_unit_id', $unit->id)->exists()) {
            return response()->json(['message' => 'Impossible : un niveau superieur depend encore de celui-ci. Supprimez-le d\'abord.'], 422);
        }

        $hasHistory = $unit->stockMovements()->exists() || $unit->priceHistory()->exists()
            || \App\Models\SaleItem::where('product_unit_id', $unit->id)->exists();

        if ($hasHistory) {
            return response()->json([
                'message' => 'Ce niveau a deja un historique de mouvements/ventes : suppression impossible. Vous pouvez le desactiver a la place.',
            ], 409);
        }

        $unit->delete();
        return response()->json(['message' => 'Niveau supprime.']);
    }
}
