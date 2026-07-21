<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubscriptionPayment extends Model
{
    protected $fillable = [
        'shop_id',
        'validated_by',
        'amount',
        'payment_method',
        'transaction_ref',
        'proof_path',
        'payment_date',
        'period_start',
        'period_end',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'payment_date' => 'date',
            'period_start' => 'date',
            'period_end'   => 'date',
            'amount'       => 'decimal:2',
        ];
    }

    public function shop()
    {
        return $this->belongsTo(StationeryShop::class, 'shop_id');
    }

    public function validatedBy()
    {
        return $this->belongsTo(User::class, 'validated_by');
    }
}
