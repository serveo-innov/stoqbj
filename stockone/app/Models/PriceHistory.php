<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PriceHistory extends Model
{
    protected $fillable = [
        'product_unit_id',
        'changed_by',
        'old_price_wholesale',
        'new_price_wholesale',
        'old_price_extra',
        'new_price_extra',
        'old_cost_price',
        'new_cost_price',
        'reason',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'old_price_wholesale' => 'decimal:2',
            'new_price_wholesale' => 'decimal:2',
            'old_price_extra'     => 'decimal:2',
            'new_price_extra'     => 'decimal:2',
            'old_cost_price'      => 'decimal:2',
            'new_cost_price'      => 'decimal:2',
        ];
    }

    public function productUnit()
    {
        return $this->belongsTo(ProductUnit::class);
    }

    public function changedBy()
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
