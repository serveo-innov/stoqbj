<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\InventoryItem;
use App\Models\ProductUnit;
use App\Models\StationeryShop;
use App\Services\StockAdjustmentService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Inventaire', description: 'Sessions de comptage physique et ajustements associes')]
class InventoryController extends Controller
{
    use ResolvesShopId;

    /**
     * Enregistrer une session d'inventaire : cree la session, chaque ligne
     * comptee, et applique les ajustements de stock necessaires via le
     * StockAdjustmentService (lien inventory_id conserve pour tracabilite).
     */
    #[OA\Post(
        path: '/inventory',
        summary: 'Valider une session d\'inventaire',
        security: [['bearerAuth' => []]],
        tags: ['Inventaire'],
        responses: [new OA\Response(response: 200, description: 'Session enregistree')]
    )]
    public function store(Request $request, StockAdjustmentService $service): JsonResponse
    {
        $shopId = $this->requireShopId($request);

        $validated = $request->validate([
            'notes'                       => ['nullable', 'string', 'max:1000'],
            'items'                       => ['required', 'array', 'min:1'],
            'items.*.product_unit_id'     => ['required', 'integer', 'exists:product_units,id'],
            'items.*.theoretical_qty'     => ['required', 'integer'],
            'items.*.physical_qty'        => ['required', 'integer', 'min:0'],
        ]);

        $inventory = Inventory::create([
            'shop_id'      => $shopId,
            'created_by'   => $request->user()->id,
            'validated_by' => $request->user()->id,
            'status'       => 'validated',
            'notes'        => $validated['notes'] ?? null,
            'validated_at' => now(),
        ]);

        $results = [];

        foreach ($validated['items'] as $row) {
            $gap = $row['physical_qty'] - $row['theoretical_qty'];

            InventoryItem::create([
                'inventory_id'    => $inventory->id,
                'product_unit_id' => $row['product_unit_id'],
                'theoretical_qty' => $row['theoretical_qty'],
                'physical_qty'    => $row['physical_qty'],
                'gap'             => $gap,
            ]);

            $unit = ProductUnit::with('product')->find($row['product_unit_id']);

            $entry = [
                'product_unit_id' => $row['product_unit_id'],
                'product_name'    => $unit?->product?->name,
                'unit_label'      => $unit?->label,
                'delta'           => $gap,
                'status'          => 'success',
            ];

            if ($gap !== 0) {
                try {
                    $service->apply(
                        shopId: $shopId,
                        productUnitId: $row['product_unit_id'],
                        quantity: $gap,
                        type: 'inventory',
                        reason: "Inventaire physique #{$inventory->id}",
                        userId: $request->user()->id,
                        inventoryId: $inventory->id,
                    );
                } catch (\RuntimeException $e) {
                    $entry['status']  = 'error';
                    $entry['message'] = 'Stock insuffisant pour cet ajustement.';
                }
            }

            $results[] = $entry;
        }

        return response()->json([
            'inventory_id' => $inventory->id,
            'results'      => $results,
        ]);
    }

    /**
     * Historique des sessions d'inventaire passees (pour re-telechargement).
     */
    #[OA\Get(
        path: '/inventory/history',
        summary: 'Historique des sessions d\'inventaire',
        security: [['bearerAuth' => []]],
        tags: ['Inventaire'],
        responses: [new OA\Response(response: 200, description: 'Liste retournee')]
    )]
    public function history(Request $request): JsonResponse
    {
        $shopId = $this->requireShopId($request);

        $inventories = Inventory::where('shop_id', $shopId)
            ->withCount('items')
            ->with('createdBy')
            ->orderByDesc('created_at')
            ->paginate(20);

        $inventories->getCollection()->transform(function (Inventory $inv) {
            $discrepancies = $inv->items()->where('gap', '!=', 0)->count();
            return [
                'id'               => $inv->id,
                'created_at'       => $inv->created_at,
                'created_by'       => trim(($inv->createdBy->firstname ?? '') . ' ' . ($inv->createdBy->name ?? '')),
                'items_count'      => $inv->items_count,
                'discrepancies'    => $discrepancies,
                'notes'            => $inv->notes,
            ];
        });

        return response()->json($inventories);
    }

    /**
     * Telecharger le rapport PDF branded d'une session d'inventaire.
     */
    #[OA\Get(
        path: '/inventory/{id}/pdf',
        summary: 'Telecharger le rapport PDF d\'une session d\'inventaire',
        security: [['bearerAuth' => []]],
        tags: ['Inventaire'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [new OA\Response(response: 200, description: 'PDF retourne')]
    )]
    public function pdf(Request $request, int $id): Response
    {
        $shopId = $this->requireShopId($request);

        $inventory = Inventory::where('shop_id', $shopId)
            ->with(['items.productUnit.product', 'createdBy'])
            ->findOrFail($id);

        $shop = StationeryShop::findOrFail($shopId);

        $totalValueImpact = $inventory->items->sum(function (InventoryItem $item) {
            $costPrice = (float) ($item->productUnit->cost_price ?? 0);
            return $item->gap * $costPrice;
        });

        $pdf = Pdf::loadView('pdf.inventory-report', compact('inventory', 'shop', 'totalValueImpact'))
            ->setPaper('a4', 'portrait')
            ->setOptions([
                'defaultFont'          => 'DejaVu Sans',
                'isRemoteEnabled'      => false,
                'isHtml5ParserEnabled' => true,
            ]);

        $filename = "inventaire-{$inventory->id}-" . $inventory->created_at->format('Y-m-d') . '.pdf';

        return $pdf->download($filename);
    }
}
