<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Remplace KkiapayPaymentIntent (supprime ce fichier apres deploiement,
 * voir table 'payment_intents' renommee par la migration associee).
 */
class PaymentIntent extends Model
{
    protected $table = 'payment_intents';

    protected $fillable = [
        'shop_id',
        'created_by',
        'reference',
        'status',
        'consumed_transaction_ref',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
        ];
    }

    public function shop()
    {
        return $this->belongsTo(StationeryShop::class, 'shop_id');
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    public function isUsable(): bool
    {
        return $this->status === 'pending' && ! $this->isExpired();
    }
}
