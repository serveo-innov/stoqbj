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
                // CORRECTIF : on laisse passer uniquement les routes de
                // paiement self-service (statut + initiation/confirmation
                // PayDunya), et seulement pour admin_shop (seul role
                // encore autorise a se connecter suspendu, voir
                // AuthController::login()). Tout le reste reste bloque.
                $isPaymentRoute = $request->is(
                    'api/v1/subscription',
                    'api/v1/subscription/paydunya/*'
                );

                if (! ($isPaymentRoute && $user->role === 'admin_shop')) {
                    return response()->json([
                        'message' => "Votre boutique est suspendue. Rendez-vous sur la page Abonnement pour la reactiver.",
                        'status'  => 'suspended',
                    ], 403);
                }
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
