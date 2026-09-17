<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Refund extends Model
{
    protected $fillable = [
        'shop_id',
        'sale_id',
        'credit_sale_id',
        'processed_by',
        'amount',
        'method',
        'notes',
        'refunded_at',
    ];

    protected function casts(): array
    {
        return [
            'amount'      => 'decimal:2',
            'refunded_at' => 'datetime',
        ];
    }

    public function sale()
    {
        return $this->belongsTo(Sale::class);
    }

    public function creditSale()
    {
        return $this->belongsTo(CreditSale::class);
    }

    public function processedBy()
    {
        return $this->belongsTo(User::class, 'processed_by');
    }
}
