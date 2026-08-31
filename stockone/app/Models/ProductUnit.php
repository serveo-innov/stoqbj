<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
class ProductUnit extends Model
{
    use HasFactory;
    protected $fillable = [
        'product_id',
        'parent_unit_id',
        'level',
        'label',
        'qty_in_parent',
        'price_wholesale',
        'price_detail',
        'price_extra',
        'cost_price',
        'is_divisible',
        'is_sellable',
        'stock_qty',
        'stock_alert_threshold',
        'last_sold_at',
    ];

    protected $appends = [
        'margin_wholesale_percent',
        'margin_detail_percent',
        'margin_extra_percent',
    ];
    protected function casts(): array
    {
        return [
            'is_divisible'          => 'boolean',
            'is_sellable'           => 'boolean',
            'price_wholesale'       => 'decimal:2',
            'price_detail'          => 'decimal:2',
            'price_extra'           => 'decimal:2',
            'cost_price'            => 'decimal:2',
            'last_sold_at'          => 'datetime',
        ];
    }
    // ──────────────────────────────────────────
    // Relations
    // ──────────────────────────────────────────
    public function product()
    {
        return $this->belongsTo(Product::class);
    }
    public function parentUnit()
    {
        return $this->belongsTo(ProductUnit::class, 'parent_unit_id');
    }
    public function childUnits()
    {
        return $this->hasMany(ProductUnit::class, 'parent_unit_id')->orderBy('level');
    }
    public function priceHistory()
    {
        return $this->hasMany(PriceHistory::class);
    }
    public function stockMovements()
    {
        return $this->hasMany(StockMovement::class);
    }
    // ──────────────────────────────────────────
    // Conversion vers l'unite de base (Niveau 1)
    // ──────────────────────────────────────────

    /**
     * Remonte la chaine parent_unit_id jusqu'a trouver l'unite de Niveau 1
     * (unite de base, seule source de verite pour le stock reel).
     */
    public function baseUnit(): ?self
    {
        $unit = $this;
        while ($unit && $unit->level !== 1) {
            $unit = $unit->parentUnit;
        }
        return $unit;
    }

    /**
     * Facteur multiplicatif pour convertir 1 unite de ce niveau
     * en equivalent Niveau 1 (ex: 1 Carton = 5 Paquets x 10 Pieces = 50).
     */
    public function cumulativeQtyToBase(): int
    {
        $unit   = $this;
        $factor = 1;
        while ($unit && $unit->level !== 1) {
            $factor *= $unit->qty_in_parent;
            $unit = $unit->parentUnit;
        }
        return max(1, $factor);
    }

    /**
     * Applique un delta de stock exprime dans l'unite COURANTE (ex: -1
     * si on vend 1 Carton, +10 si on receptionne 10 Pieces), en le
     * convertissant et en le persistant sur le stock reel de l'unite
     * de base (seule colonne stock_qty jamais ecrite directement).
     * Retourne stock avant/apres exprime dans les termes de CETTE unite
     * (pour affichage/logs), ainsi qu'en base.
     *
     * @throws \RuntimeException si le stock de base deviendrait negatif
     *                           et que $allowNegative est false.
     */
    public function applyStockDelta(int $deltaInThisUnit, bool $allowNegative = false): array
    {
        $base   = $this->baseUnit() ?? $this;
        $factor = $this->cumulativeQtyToBase();

        $baseBefore = (int) $base->getRawOriginal('stock_qty');
        $baseDelta  = $deltaInThisUnit * $factor;
        $baseAfter  = $baseBefore + $baseDelta;

        if (! $allowNegative && $baseAfter < 0) {
            throw new \RuntimeException('Stock insuffisant.');
        }

        $base->update(['stock_qty' => $baseAfter]);

        return [
            'unit_before' => intdiv($baseBefore, $factor),
            'unit_after'  => intdiv($baseAfter, $factor),
            'base_before' => $baseBefore,
            'base_after'  => $baseAfter,
        ];
    }

    /**
     * Stock reel : pour le Niveau 1, la colonne stock_qty est la source
     * de verite. Pour les niveaux superieurs, le stock est TOUJOURS
     * calcule a partir du stock de base (jamais saisi/stocke separement),
     * pour eviter toute incoherence entre niveaux.
     */
    protected function stockQty(): Attribute
    {
        return Attribute::make(
            get: function ($value) {
                if ((int) $this->level === 1) {
                    return (int) $value;
                }
                $base = $this->baseUnit();
                if (! $base || $base->id === $this->id) {
                    return (int) $value;
                }
                $factor = $this->cumulativeQtyToBase();
                return intdiv((int) $base->getRawOriginal('stock_qty'), $factor);
            },
        );
    }

    // ──────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────
    public function isOutOfStock(): bool
    {
        return $this->stock_qty <= 0;
    }
    public function isLowStock(): bool
    {
        return $this->stock_qty > 0 && $this->stock_qty <= $this->stock_alert_threshold;
    }
    public function isCriticalStock(): bool
    {
        return $this->stock_qty <= ($this->stock_alert_threshold / 2);
    }
    public function getMarginWholesalePercentAttribute(): float
    {
        if ($this->cost_price <= 0) return 0;
        return round((($this->price_wholesale - $this->cost_price) / $this->cost_price) * 100, 2);
    }
    public function getMarginDetailPercentAttribute(): float
    {
        if ($this->cost_price <= 0) return 0;
        return round((($this->price_detail - $this->cost_price) / $this->cost_price) * 100, 2);
    }
    public function getMarginExtraPercentAttribute(): float
    {
        if ($this->cost_price <= 0) return 0;
        return round((($this->price_extra - $this->cost_price) / $this->cost_price) * 100, 2);
    }
    public function getDormantDaysAttribute(): int
    {
        if (! $this->last_sold_at) return 999;
        return (int) $this->last_sold_at->diffInDays(now());
    }
}
