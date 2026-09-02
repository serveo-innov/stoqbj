<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryItem extends Model
{
    protected $fillable = [
        'inventory_id',
        'product_unit_id',
        'theoretical_qty',
        'physical_qty',
        'gap',
    ];

    public function inventory()
    {
        return $this->belongsTo(Inventory::class);
    }

    public function productUnit()
    {
        return $this->belongsTo(ProductUnit::class);
    }
}
