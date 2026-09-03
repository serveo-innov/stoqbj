<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StockMovement extends Model
{
    use HasFactory;

    protected $fillable = [
        'shop_id',
        'product_unit_id',
        'user_id',
        'sale_id',
        'supplier_id',
        'inventory_id',
        'type',
        'quantity',
        'stock_before',
        'stock_after',
        'unit_cost',
        'reference',
        'reason',
        'moved_at',
    ];

    protected function casts(): array
    {
        return [
            'moved_at'   => 'datetime',
            'unit_cost'  => 'decimal:2',
        ];
    }

    public function productUnit()
    {
        return $this->belongsTo(ProductUnit::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }
}
