<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Client extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'shop_id',
        'name',
        'firstname',
        'phone',
        'address',
        'is_extra_buyer',
    ];

    protected function casts(): array
    {
        return [
            'is_extra_buyer' => 'boolean',
        ];
    }

    public function scopeForShop($query, int $shopId)
    {
        return $query->where('shop_id', $shopId);
    }

    public function shop()
    {
        return $this->belongsTo(StationeryShop::class, 'shop_id');
    }

    public function sales()
    {
        return $this->hasMany(Sale::class);
    }

    public function creditSales()
    {
        return $this->hasMany(CreditSale::class);
    }

    public function getFullNameAttribute(): string
    {
        return trim("{$this->firstname} {$this->name}");
    }

    public function getTotalDebtAttribute(): float
    {
        return $this->creditSales()
            ->whereIn('status', ['pending', 'partial', 'overdue'])
            ->sum('amount_remaining');
    }
}
