<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Alert extends Model
{
    protected $table = 'alerts';

    protected $fillable = [
        'shop_id',
        'product_unit_id',
        'type',
        'is_read',
        'is_resolved',
        'meta',
        'triggered_at',
    ];

    protected function casts(): array
    {
        return [
            'triggered_at' => 'datetime',
            'is_read'      => 'boolean',
            'is_resolved'  => 'boolean',
            'meta'         => 'array',
        ];
    }

    public function scopeForShop($query, int $shopId)
    {
        return $query->where('shop_id', $shopId);
    }

    public function scopeUnread($query)
    {
        return $query->where('is_read', false);
    }

    public function shop()
    {
        return $this->belongsTo(StationeryShop::class, 'shop_id');
    }

    public function productUnit()
    {
        return $this->belongsTo(ProductUnit::class);
    }
}
