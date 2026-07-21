<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CreditSale extends Model
{
    protected $fillable = [
        'shop_id',
        'sale_id',
        'client_id',
        'amount_due',
        'amount_paid',
        'amount_remaining',
        'due_date',
        'credit_days',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'due_date'         => 'date',
            'amount_due'       => 'decimal:2',
            'amount_paid'      => 'decimal:2',
            'amount_remaining' => 'decimal:2',
        ];
    }

    public function scopeForShop($query, int $shopId)
    {
        return $query->where('shop_id', $shopId);
    }

    public function sale()
    {
        return $this->belongsTo(Sale::class);
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function payments()
    {
        return $this->hasMany(CreditPayment::class);
    }

    public function isOverdue(): bool
    {
        return $this->due_date->isPast() && $this->status !== 'paid';
    }
}
