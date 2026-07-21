<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StationeryShop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Parametres', description: 'Parametres de sa propre boutique (self-service)')]
class ShopSettingsController extends Controller
{
    /**
     * Résoudre le shop_id du user connecté (self-service, pas de shop_id en paramètre).
     */
    private function resolveOwnShopId(Request $request): int
    {
        $shopId = $request->user()->shop_id;

        if (! $shopId) {
            abort(response()->json([
                'message' => "Vous n'etes rattache a aucune boutique.",
            ], 422));
        }

        return $shopId;
    }

    /**
     * Voir les paramètres de sa propre boutique
     */
    #[OA\Get(
        path: '/settings',
        summary: 'Voir les parametres de sa boutique',
        security: [['bearerAuth' => []]],
        tags: ['Parametres'],
        responses: [
            new OA\Response(response: 200, description: 'Parametres retournes'),
            new OA\Response(response: 422, description: 'Aucune boutique rattachee'),
        ]
    )]
    public function show(Request $request): JsonResponse
    {
        $shopId = $this->resolveOwnShopId($request);
        $shop   = StationeryShop::findOrFail($shopId);

        return response()->json(['data' => $shop]);
    }

    /**
     * Modifier les paramètres de sa propre boutique
     */
    #[OA\Put(
        path: '/settings',
        summary: 'Modifier les parametres de sa boutique',
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'commercial_name',       type: 'string'),
                    new OA\Property(property: 'owner_phone',           type: 'string'),
                    new OA\Property(property: 'owner_phone_secondary', type: 'string'),
                    new OA\Property(property: 'address',               type: 'string'),
                    new OA\Property(property: 'city',                  type: 'string'),
                    new OA\Property(property: 'neighborhood',          type: 'string'),
                    new OA\Property(property: 'ifu_number',            type: 'string'),
                    new OA\Property(property: 'rccm_number',           type: 'string'),
                    new OA\Property(property: 'brand_color',           type: 'string', example: '#F97316'),
                    new OA\Property(property: 'slogan',                type: 'string'),
                    new OA\Property(property: 'default_credit_days',   type: 'integer'),
                ]
            )
        ),
        tags: ['Parametres'],
        responses: [
            new OA\Response(response: 200, description: 'Parametres modifies'),
            new OA\Response(response: 422, description: 'Donnees invalides ou aucune boutique rattachee'),
        ]
    )]
    public function update(Request $request): JsonResponse
    {
        $shopId = $this->resolveOwnShopId($request);
        $shop   = StationeryShop::findOrFail($shopId);

        // Champs volontairement exclus du self-service : shop_name (nom légal),
        // status, subscription_start/end, trial_days — réservés au Super Admin
        // via /admin/shops/{id} pour éviter tout contournement de la facturation.
        $validated = $request->validate([
            'commercial_name'       => ['nullable', 'string', 'max:150'],
            'owner_phone'           => ['sometimes', 'string', 'max:20'],
            'owner_phone_secondary' => ['nullable', 'string', 'max:20'],
            'address'               => ['sometimes', 'string'],
            'city'                  => ['sometimes', 'string', 'max:80'],
            'neighborhood'          => ['nullable', 'string', 'max:100'],
            'ifu_number'            => ['nullable', 'string', 'max:30'],
            'rccm_number'           => ['nullable', 'string', 'max:30'],
            'brand_color'           => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'slogan'                => ['nullable', 'string', 'max:255'],
            'default_credit_days'   => ['sometimes', 'integer', 'min:1', 'max:365'],
        ]);

        $shop->update($validated);

        return response()->json(['data' => $shop->fresh(), 'message' => 'Parametres mis a jour.']);
    }
}
