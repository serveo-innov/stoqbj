<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Ventes', description: 'POS et Caisse')]
class ClientController extends Controller
{
    use ResolvesShopId;

    #[OA\Get(
        path: '/clients',
        summary: 'Liste des clients',
        security: [['bearerAuth' => []]],
        tags: ['Ventes'],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', schema: new OA\Schema(type: 'string')),
        ],
        responses: [new OA\Response(response: 200, description: 'Liste retournée')]
    )]
    public function index(Request $request): JsonResponse
    {
        $shopId = $this->requireShopId($request);

        $query = Client::forShop($shopId)->orderBy('name');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('firstname', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        return response()->json(['data' => $query->get()]);
    }

    #[OA\Post(
        path: '/clients',
        summary: 'Créer un client',
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name', 'phone'],
                properties: [
                    new OA\Property(property: 'name',           type: 'string',  example: 'Gbedo'),
                    new OA\Property(property: 'firstname',      type: 'string',  example: 'Francois'),
                    new OA\Property(property: 'phone',          type: 'string',  example: '+22997000002'),
                    new OA\Property(property: 'address',        type: 'string'),
                    new OA\Property(property: 'is_extra_buyer', type: 'boolean', example: false),
                ]
            )
        ),
        tags: ['Ventes'],
        responses: [new OA\Response(response: 201, description: 'Client créé')]
    )]
    public function store(Request $request): JsonResponse
    {
        $shopId = $this->requireShopId($request);

        $validated = $request->validate([
            'name'           => ['required', 'string', 'max:100'],
            'firstname'      => ['nullable', 'string', 'max:100'],
            'phone'          => ['required', 'string', 'max:20'],
            'address'        => ['nullable', 'string'],
            'is_extra_buyer' => ['sometimes', 'boolean'],
        ]);

        $client = Client::create([...$validated, 'shop_id' => $shopId]);

        return response()->json(['data' => $client, 'message' => 'Client créé.'], 201);
    }

    #[OA\Get(
        path: '/clients/{id}',
        summary: 'Détail client avec historique',
        security: [['bearerAuth' => []]],
        tags: ['Ventes'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'OK')]
    )]
    public function show(Request $request, int $id): JsonResponse
    {
        $shopId = $this->requireShopId($request);

        $client = Client::forShop($shopId)
            ->with(['sales' => fn($q) => $q->latest()->limit(10), 'creditSales'])
            ->findOrFail($id);

        return response()->json([
            'data' => array_merge($client->toArray(), [
                'total_debt' => $client->total_debt,
            ]),
        ]);
    }

    #[OA\Put(
        path: '/clients/{id}',
        summary: 'Modifier un client',
        security: [['bearerAuth' => []]],
        tags: ['Ventes'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'OK')]
    )]
    public function update(Request $request, int $id): JsonResponse
    {
        $client    = Client::forShop($this->requireShopId($request))->findOrFail($id);
        $validated = $request->validate([
            'name'           => ['sometimes', 'string', 'max:100'],
            'firstname'      => ['nullable', 'string', 'max:100'],
            'phone'          => ['sometimes', 'string', 'max:20'],
            'address'        => ['nullable', 'string'],
            'is_extra_buyer' => ['sometimes', 'boolean'],
        ]);
        $client->update($validated);
        return response()->json(['data' => $client, 'message' => 'Client modifié.']);
    }
}
