<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Inventory extends Model
{
    protected $fillable = [
        'shop_id',
        'created_by',
        'validated_by',
        'status',
        'notes',
        'validated_at',
    ];

    protected function casts(): array
    {
        return [
            'validated_at' => 'datetime',
        ];
    }

    public function shop()
    {
        return $this->belongsTo(StationeryShop::class, 'shop_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function validatedBy()
    {
        return $this->belongsTo(User::class, 'validated_by');
    }

    public function items()
    {
        return $this->hasMany(InventoryItem::class);
    }

    public function stockMovements()
    {
        return $this->hasMany(StockMovement::class);
    }
}
