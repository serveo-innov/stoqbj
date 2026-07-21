<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Catalogue', description: 'Produits et Categories')]
class SupplierController extends Controller
{
    use ResolvesShopId;

    #[OA\Get(
        path: '/suppliers',
        summary: 'Liste des fournisseurs',
        security: [['bearerAuth' => []]],
        tags: ['Catalogue'],
        responses: [new OA\Response(response: 200, description: 'Liste retournee')]
    )]
    public function index(Request $request): JsonResponse
    {
        $suppliers = Supplier::forShop($this->requireShopId($request))->orderBy('name')->get();
        return response()->json(['data' => $suppliers]);
    }

    #[OA\Post(
        path: '/suppliers',
        summary: 'Creer un fournisseur',
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name'],
                properties: [
                    new OA\Property(property: 'name',    type: 'string', example: 'Editions Hachette'),
                    new OA\Property(property: 'phone',   type: 'string', example: '+22961000000'),
                    new OA\Property(property: 'email',   type: 'string', example: 'contact@hachette.bj'),
                    new OA\Property(property: 'address', type: 'string'),
                    new OA\Property(property: 'city',    type: 'string', example: 'Cotonou'),
                    new OA\Property(property: 'notes',   type: 'string'),
                ]
            )
        ),
        tags: ['Catalogue'],
        responses: [new OA\Response(response: 201, description: 'Fournisseur cree')]
    )]
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'    => ['required', 'string', 'max:150'],
            'phone'   => ['nullable', 'string', 'max:20'],
            'email'   => ['nullable', 'email', 'max:150'],
            'address' => ['nullable', 'string'],
            'city'    => ['nullable', 'string', 'max:80'],
            'notes'   => ['nullable', 'string'],
        ]);

        $supplier = Supplier::create([...$validated, 'shop_id' => $this->requireShopId($request)]);
        return response()->json(['data' => $supplier, 'message' => 'Fournisseur cree.'], 201);
    }

    #[OA\Get(
        path: '/suppliers/{id}',
        summary: 'Detail fournisseur',
        security: [['bearerAuth' => []]],
        tags: ['Catalogue'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'OK')]
    )]
    public function show(Request $request, int $id): JsonResponse
    {
        $supplier = Supplier::forShop($this->requireShopId($request))->findOrFail($id);
        return response()->json(['data' => $supplier]);
    }

    #[OA\Put(
        path: '/suppliers/{id}',
        summary: 'Modifier un fournisseur',
        security: [['bearerAuth' => []]],
        tags: ['Catalogue'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'OK')]
    )]
    public function update(Request $request, int $id): JsonResponse
    {
        $supplier  = Supplier::forShop($this->requireShopId($request))->findOrFail($id);
        $validated = $request->validate([
            'name'      => ['sometimes', 'string', 'max:150'],
            'phone'     => ['nullable', 'string', 'max:20'],
            'email'     => ['nullable', 'email', 'max:150'],
            'address'   => ['nullable', 'string'],
            'city'      => ['nullable', 'string', 'max:80'],
            'is_active' => ['sometimes', 'boolean'],
            'notes'     => ['nullable', 'string'],
        ]);
        $supplier->update($validated);
        return response()->json(['data' => $supplier, 'message' => 'Fournisseur modifie.']);
    }

    #[OA\Delete(
        path: '/suppliers/{id}',
        summary: 'Supprimer un fournisseur',
        security: [['bearerAuth' => []]],
        tags: ['Catalogue'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Supprime')]
    )]
    public function destroy(Request $request, int $id): JsonResponse
    {
        $supplier = Supplier::forShop($this->requireShopId($request))->findOrFail($id);
        $supplier->delete();
        return response()->json(['message' => 'Fournisseur supprime.']);
    }
}
