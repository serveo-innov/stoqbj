<?php

namespace App\Models;

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
        'price_extra',
        'cost_price',
        'is_divisible',
        'is_sellable',
        'stock_qty',
        'stock_alert_threshold',
        'last_sold_at',
    ];

    protected function casts(): array
    {
        return [
            'is_divisible'          => 'boolean',
            'is_sellable'           => 'boolean',
            'price_wholesale'       => 'decimal:2',
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

    public function getMarginPercentAttribute(): float
    {
        if ($this->cost_price <= 0) return 0;
        return round((($this->price_wholesale - $this->cost_price) / $this->cost_price) * 100, 2);
    }

    public function getDormantDaysAttribute(): int
    {
        if (! $this->last_sold_at) return 999;
        return (int) $this->last_sold_at->diffInDays(now());
    }
}
