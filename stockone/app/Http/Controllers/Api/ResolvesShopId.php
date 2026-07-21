<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;

trait ResolvesShopId
{
    /**
     * Retourne le shop_id selon le rôle :
     * - Super Admin : doit fournir shop_id dans la requête
     * - Autres rôles : shop_id de l'utilisateur connecté
     */
    protected function resolveShopId(Request $request): ?int
    {
        $user = $request->user();

        if ($user->isSuperAdmin()) {
            return $request->input('shop_id')
                ? (int) $request->input('shop_id')
                : null;
        }

        return $user->shop_id;
    }

    protected function requireShopId(Request $request): int
    {
        $shopId = $this->resolveShopId($request);

        if (! $shopId) {
            abort(response()->json([
                'message' => 'shop_id requis pour le Super Admin.',
            ], 422));
        }

        return $shopId;
    }
}
