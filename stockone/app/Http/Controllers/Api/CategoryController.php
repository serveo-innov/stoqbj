<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Catalogue', description: 'Produits et Categories')]
class CategoryController extends Controller
{
    use ResolvesShopId;

    #[OA\Get(
        path: '/categories',
        summary: 'Liste des categories',
        security: [['bearerAuth' => []]],
        tags: ['Catalogue'],
        responses: [
            new OA\Response(response: 200, description: 'Liste retournee'),
            new OA\Response(response: 401, description: 'Non authentifie'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $shopId = $this->requireShopId($request);

        $categories = Category::forShop($shopId)
            ->withCount('products')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $categories]);
    }

    #[OA\Post(
        path: '/categories',
        summary: 'Creer une categorie',
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name'],
                properties: [
                    new OA\Property(property: 'name',  type: 'string',  example: 'Cahiers'),
                    new OA\Property(property: 'color', type: 'string',  example: '#6366f1'),
                    new OA\Property(property: 'icon',  type: 'string',  example: 'book'),
                ]
            )
        ),
        tags: ['Catalogue'],
        responses: [
            new OA\Response(response: 201, description: 'Categorie creee'),
            new OA\Response(response: 422, description: 'Donnees invalides'),
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $shopId = $this->requireShopId($request);

        $validated = $request->validate([
            'name'  => ['required', 'string', 'max:100',
                        Rule::unique('categories')->where('shop_id', $shopId)],
            'color' => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'icon'  => ['nullable', 'string', 'max:50'],
        ]);

        $category = Category::create([...$validated, 'shop_id' => $shopId]);

        return response()->json(['data' => $category, 'message' => 'Categorie creee.'], 201);
    }

    #[OA\Get(
        path: '/categories/{id}',
        summary: 'Detail categorie',
        security: [['bearerAuth' => []]],
        tags: ['Catalogue'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'OK')]
    )]
    public function show(Request $request, int $id): JsonResponse
    {
        $category = Category::forShop($this->requireShopId($request))
            ->withCount('products')
            ->findOrFail($id);

        return response()->json(['data' => $category]);
    }

    #[OA\Put(
        path: '/categories/{id}',
        summary: 'Modifier une categorie',
        security: [['bearerAuth' => []]],
        tags: ['Catalogue'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'OK')]
    )]
    public function update(Request $request, int $id): JsonResponse
    {
        $shopId   = $this->requireShopId($request);
        $category = Category::forShop($shopId)->findOrFail($id);

        $validated = $request->validate([
            'name'      => ['sometimes', 'string', 'max:100',
                            Rule::unique('categories')->where('shop_id', $shopId)->ignore($id)],
            'color'     => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'icon'      => ['nullable', 'string', 'max:50'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $category->update($validated);

        return response()->json(['data' => $category, 'message' => 'Categorie modifiee.']);
    }

    #[OA\Delete(
        path: '/categories/{id}',
        summary: 'Supprimer une categorie',
        security: [['bearerAuth' => []]],
        tags: ['Catalogue'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'Supprimee'),
            new OA\Response(response: 409, description: 'Categorie utilisee'),
        ]
    )]
    public function destroy(Request $request, int $id): JsonResponse
    {
        $category = Category::forShop($this->requireShopId($request))
            ->withCount('products')
            ->findOrFail($id);

        if ($category->products_count > 0) {
            return response()->json([
                'message' => "Impossible : {$category->products_count} produit(s) utilisent cette categorie.",
            ], 409);
        }

        $category->delete();

        return response()->json(['message' => 'Categorie supprimee.']);
    }
}
