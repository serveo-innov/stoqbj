<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PriceSuggestion extends Model
{
    protected $table = 'price_suggestions';

    protected $fillable = [
        'shop_id',
        'product_unit_id',
        'reviewed_by',
        'current_price_wholesale',
        'suggested_price_wholesale',
        'current_price_extra',
        'suggested_price_extra',
        'dormant_days',
        'estimated_margin',
        'status',
        'rejection_reason',
        'reviewed_at',
        'sales_after_15days',
    ];

    protected function casts(): array
    {
        return [
            'reviewed_at'               => 'datetime',
            'current_price_wholesale'   => 'decimal:2',
            'suggested_price_wholesale' => 'decimal:2',
            'current_price_extra'       => 'decimal:2',
            'suggested_price_extra'     => 'decimal:2',
            'estimated_margin'          => 'decimal:2',
        ];
    }

    public function scopeForShop($query, int $shopId)
    {
        return $query->where('shop_id', $shopId);
    }

    public function productUnit()
    {
        return $this->belongsTo(ProductUnit::class);
    }

    public function reviewedBy()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
