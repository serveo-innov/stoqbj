<?php

namespace App\Services;

use App\Models\ProductUnit;
use App\Models\StockMovement;
use Illuminate\Support\Facades\DB;

class StockAdjustmentService
{
    /**
     * Applique un ajustement de stock (ajout ou retrait) sur une unite de
     * produit, et enregistre le mouvement correspondant. Centralise ici
     * pour eviter la duplication entre StockController::adjustment() et
     * les futurs flux (Inventaire, etc.) qui doivent produire exactement
     * le meme comportement.
     *
     * @param  int         $shopId
     * @param  int         $productUnitId
     * @param  int         $quantity      Delta signe (negatif = retrait)
     * @param  string      $type          adjustment|return|loss|internal_use|inventory
     * @param  string      $reason
     * @param  int         $userId
     * @param  int|null    $inventoryId   Session d'inventaire liee, si applicable
     * @return array{unit_before:int, unit_after:int, base_before:int, base_after:int, unit: ProductUnit}
     *
     * @throws \RuntimeException si le stock de base deviendrait negatif
     */
    public function apply(
        int $shopId,
        int $productUnitId,
        int $quantity,
        string $type,
        string $reason,
        int $userId,
        ?int $inventoryId = null
    ): array {
        $unit = ProductUnit::whereHas('product', fn ($q) => $q->where('shop_id', $shopId))
            ->findOrFail($productUnitId);

        return DB::transaction(function () use ($unit, $quantity, $type, $reason, $shopId, $userId, $inventoryId) {
            $result = $unit->applyStockDelta($quantity, allowNegative: false);

            StockMovement::create([
                'shop_id'         => $shopId,
                'product_unit_id' => $unit->id,
                'user_id'         => $userId,
                'inventory_id'    => $inventoryId,
                'type'            => $type,
                'quantity'        => $quantity,
                'stock_before'    => $result['unit_before'],
                'stock_after'     => $result['unit_after'],
                'reason'          => $reason,
                'moved_at'        => now(),
            ]);

            return [
                'unit_before' => $result['unit_before'],
                'unit_after'  => $result['unit_after'],
                'base_before' => $result['base_before'],
                'base_after'  => $result['base_after'],
                'unit'        => $unit->fresh(),
            ];
        });
    }
}
