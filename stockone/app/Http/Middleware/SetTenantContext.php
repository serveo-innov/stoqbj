<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\Response;

class SetTenantContext
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->isSuperAdmin()) {
            App::instance('current_shop_id', $user->shop_id);

            $shop = $user->shop;

            if (! $shop) {
                return response()->json([
                    'message' => 'Boutique introuvable ou supprimée.',
                ], 403);
            }

            if ($shop->isSuspended()) {
                return response()->json([
                    'message' => "Votre boutique est suspendue. Contactez l'administrateur.",
                    'status'  => 'suspended',
                ], 403);
            }

            if ($shop->status === 'closed') {
                return response()->json([
                    'message' => 'Cette boutique est fermée.',
                    'status'  => 'closed',
                ], 403);
            }

            $daysLeft = $shop->daysUntilExpiry();
            if ($shop->isActive() && $daysLeft <= 7) {
                $request->headers->set('X-Subscription-Warning', "Abonnement expire dans {$daysLeft} jour(s).");
            }
        } else {
            App::instance('current_shop_id', null);
        }

        return $next($request);
    }
}
