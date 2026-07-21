<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\PriceSuggestion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Alertes', description: 'Alertes et suggestions IA')]
class AlertController extends Controller
{
    use ResolvesShopId;

    /**
     * Liste des alertes non lues
     */
    #[OA\Get(
        path: '/alerts',
        summary: 'Liste des alertes',
        security: [['bearerAuth' => []]],
        tags: ['Alertes'],
        parameters: [
            new OA\Parameter(name: 'type',        in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'unread_only', in: 'query', schema: new OA\Schema(type: 'boolean')),
        ],
        responses: [new OA\Response(response: 200, description: 'Alertes retournees')]
    )]
    public function index(Request $request): JsonResponse
    {
        $shopId = $this->requireShopId($request);

        $query = Alert::forShop($shopId)
            ->with('productUnit.product')
            ->orderByDesc('triggered_at');

        if ($request->filled('type'))         $query->where('type', $request->type);
        if ($request->boolean('unread_only')) $query->unread();

        $alerts = $query->paginate(50);

        $counts = [
            'total_unread'   => Alert::forShop($shopId)->unread()->count(),
            'stock_alerts'   => Alert::forShop($shopId)->unread()->whereIn('type', ['stock_out', 'stock_low', 'stock_critical'])->count(),
            'credit_alerts'  => Alert::forShop($shopId)->unread()->where('type', 'credit_overdue')->count(),
            'dormant_alerts' => Alert::forShop($shopId)->unread()->where('type', 'like', 'dormant_%')->count(),
            'sub_alerts'     => Alert::forShop($shopId)->unread()->where('type', 'subscription_expiry')->count(),
        ];

        return response()->json(['counts' => $counts, 'data' => $alerts]);
    }

    /**
     * Marquer une alerte comme lue
     */
    #[OA\Post(
        path: '/alerts/{id}/read',
        summary: 'Marquer une alerte comme lue',
        security: [['bearerAuth' => []]],
        tags: ['Alertes'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'OK')]
    )]
    public function markRead(Request $request, int $id): JsonResponse
    {
        $alert = Alert::forShop($this->requireShopId($request))->findOrFail($id);
        $alert->update(['is_read' => true]);
        return response()->json(['message' => 'Alerte marquee comme lue.']);
    }

    /**
     * Marquer toutes les alertes comme lues
     */
    #[OA\Post(
        path: '/alerts/read-all',
        summary: 'Marquer toutes les alertes comme lues',
        security: [['bearerAuth' => []]],
        tags: ['Alertes'],
        responses: [new OA\Response(response: 200, description: 'OK')]
    )]
    public function markAllRead(Request $request): JsonResponse
    {
        $count = Alert::forShop($this->requireShopId($request))
            ->unread()
            ->update(['is_read' => true]);

        return response()->json(['message' => "{$count} alertes marquees comme lues."]);
    }

    /**
     * Suggestions de prix IA
     */
    #[OA\Get(
        path: '/alerts/price-suggestions',
        summary: 'Suggestions de reajustement de prix',
        security: [['bearerAuth' => []]],
        tags: ['Alertes'],
        responses: [new OA\Response(response: 200, description: 'Suggestions retournees')]
    )]
    public function priceSuggestions(Request $request): JsonResponse
    {
        $shopId = $this->requireShopId($request);

        $suggestions = PriceSuggestion::forShop($shopId)
            ->where('status', 'pending')
            ->with('productUnit.product')
            ->orderByDesc('dormant_days')
            ->get();

        return response()->json(['data' => $suggestions]);
    }

    /**
     * Accepter une suggestion de prix
     */
    #[OA\Post(
        path: '/alerts/price-suggestions/{id}/accept',
        summary: 'Accepter une suggestion de prix',
        security: [['bearerAuth' => []]],
        tags: ['Alertes'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Prix mis a jour')]
    )]
    public function acceptSuggestion(Request $request, int $id): JsonResponse
    {
        $shopId     = $this->requireShopId($request);
        $suggestion = PriceSuggestion::forShop($shopId)->where('status', 'pending')->findOrFail($id);
        $unit       = $suggestion->productUnit;

        // Appliquer les nouveaux prix
        $unit->update([
            'price_wholesale' => $suggestion->suggested_price_wholesale,
            'price_extra'     => $suggestion->suggested_price_extra,
        ]);

        // Historique
        \App\Models\PriceHistory::create([
            'product_unit_id'     => $unit->id,
            'changed_by'          => $request->user()->id,
            'old_price_wholesale' => $suggestion->current_price_wholesale,
            'new_price_wholesale' => $suggestion->suggested_price_wholesale,
            'old_price_extra'     => $suggestion->current_price_extra,
            'new_price_extra'     => $suggestion->suggested_price_extra,
            'old_cost_price'      => $unit->cost_price,
            'new_cost_price'      => $unit->cost_price,
            'reason'              => 'ai_suggestion',
            'notes'               => "Suggestion IA acceptée — {$suggestion->dormant_days} jours sans vente",
        ]);

        $suggestion->update([
            'status'      => 'accepted',
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        return response()->json(['message' => 'Prix mis a jour selon la suggestion.', 'unit' => $unit->fresh()]);
    }

    /**
     * Rejeter une suggestion de prix
     */
    #[OA\Post(
        path: '/alerts/price-suggestions/{id}/reject',
        summary: 'Rejeter une suggestion de prix',
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [new OA\Property(property: 'reason', type: 'string')]
            )
        ),
        tags: ['Alertes'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Suggestion rejetee')]
    )]
    public function rejectSuggestion(Request $request, int $id): JsonResponse
    {
        $shopId     = $this->requireShopId($request);
        $suggestion = PriceSuggestion::forShop($shopId)->where('status', 'pending')->findOrFail($id);

        $suggestion->update([
            'status'           => 'rejected',
            'reviewed_by'      => $request->user()->id,
            'reviewed_at'      => now(),
            'rejection_reason' => $request->reason,
        ]);

        return response()->json(['message' => 'Suggestion rejetee.']);
    }
}
