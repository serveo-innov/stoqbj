<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Sale extends Model
{
    use HasFactory;

    protected $fillable = [
        'shop_id',
        'user_id',
        'client_id',
        'invoice_number',
        'total_amount',
        'discount_amount',
        'net_amount',
        'payment_mode',
        'amount_paid',
        'amount_due',
        'status',
        'invoice_printed',
        'notes',
        'sold_at',
    ];

    protected function casts(): array
    {
        return [
            'sold_at'         => 'datetime',
            'invoice_printed' => 'boolean',
            'total_amount'    => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'net_amount'      => 'decimal:2',
            'amount_paid'     => 'decimal:2',
            'amount_due'      => 'decimal:2',
        ];
    }

    // ──────────────────────────────────────────
    // Scopes
    // ──────────────────────────────────────────

    public function scopeForShop($query, int $shopId)
    {
        return $query->where('shop_id', $shopId);
    }

    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    public function scopeToday($query)
    {
        return $query->whereDate('sold_at', today());
    }

    // ──────────────────────────────────────────
    // Relations
    // ──────────────────────────────────────────

    public function shop()
    {
        return $this->belongsTo(StationeryShop::class, 'shop_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function client()
    {
        return $this->belongsTo(Client::class);
    }

    public function items()
    {
        return $this->hasMany(SaleItem::class);
    }

    public function extraIdentity()
    {
        return $this->hasOne(ExtraSaleIdentity::class);
    }

    public function creditSale()
    {
        return $this->hasOne(CreditSale::class);
    }

    // ──────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────

    public function generateInvoiceNumber(): string
    {
        $year  = now()->format('Y');
        $count = Sale::where('shop_id', $this->shop_id)
                     ->whereYear('sold_at', $year)
                     ->count();
        return "FAC-{$year}-" . str_pad($count, 5, '0', STR_PAD_LEFT);
    }
}
