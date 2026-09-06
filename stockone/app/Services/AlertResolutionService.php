<?php

namespace App\Services;

use App\Models\Alert;
use App\Models\ProductUnit;

class AlertResolutionService
{
    /**
     * Resout (is_resolved = true) les alertes de stock (stock_out/stock_low/
     * stock_critical) ouvertes pour l'unite de base d'un produit, si son
     * stock est repasse au-dessus du seuil d'alerte. Les alertes ne sont
     * creees que sur l'unite de base (niveau 1) : on remonte donc toujours
     * a cette unite avant de verifier, quel que soit le niveau modifie.
     */
    public function resolveStockAlerts(int $shopId, ProductUnit $unit): void
    {
        $base = $unit->baseUnit() ?? $unit;

        if ($base->stock_qty > $base->stock_alert_threshold) {
            Alert::where('shop_id', $shopId)
                ->where('product_unit_id', $base->id)
                ->whereIn('type', ['stock_out', 'stock_low', 'stock_critical'])
                ->where('is_resolved', false)
                ->update(['is_resolved' => true]);
        }
    }

    /**
     * Resout (is_resolved = true) l'alerte de marge negative ouverte pour
     * une unite precise, si aucune de ses 3 marges (Gros/Detail/Extra)
     * n'est plus negative avec les prix actuels. Verifie sur l'unite
     * exacte (pas l'unite de base) car le prix d'achat et les prix de
     * vente sont geres independamment par niveau.
     */
    public function resolveMarginAlerts(int $shopId, ProductUnit $unit): void
    {
        $cost = (float) $unit->cost_price;
        if ($cost <= 0) {
            return;
        }

        $margins = [
            ((float) $unit->price_wholesale - $cost) / $cost * 100,
            ((float) $unit->price_detail    - $cost) / $cost * 100,
            ((float) $unit->price_extra     - $cost) / $cost * 100,
        ];

        $stillNegative = collect($margins)->contains(fn ($m) => $m < 0);

        if (! $stillNegative) {
            Alert::where('shop_id', $shopId)
                ->where('product_unit_id', $unit->id)
                ->where('type', 'margin_negative')
                ->where('is_resolved', false)
                ->update(['is_resolved' => true]);
        }
    }
}
