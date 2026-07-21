<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class StationeryShop extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'stationery_shops';

    protected $fillable = [
        'shop_name',
        'legal_form',
        'owner_name',
        'owner_firstname',
        'owner_phone',
        'owner_phone_secondary',
        'owner_email',
        'owner_id_scan_path',
        'address',
        'neighborhood',
        'city',
        'country',
        'gps_lat',
        'gps_lng',
        'ifu_number',
        'rccm_number',
        'commercial_name',
        'logo_path',
        'slogan',
        'brand_color',
        'subscription_start',
        'subscription_end',
        'status',
        'trial_days',
        'default_credit_days',
    ];

    protected function casts(): array
    {
        return [
            'subscription_start' => 'date',
            'subscription_end'   => 'date',
            'gps_lat'            => 'float',
            'gps_lng'            => 'float',
        ];
    }

    // ──────────────────────────────────────────
    // Relations
    // ──────────────────────────────────────────

    public function users()
    {
        return $this->hasMany(User::class, 'shop_id');
    }

    // ──────────────────────────────────────────
    // Helpers statut abonnement
    // ──────────────────────────────────────────

    public function isActive(): bool
    {
        return $this->status === 'active'
            && $this->subscription_end
            && $this->subscription_end->isFuture();
    }

    public function isInTrial(): bool
    {
        return $this->status === 'trial';
    }

    public function isSuspended(): bool
    {
        return $this->status === 'suspended';
    }

    public function daysUntilExpiry(): int
    {
        if (! $this->subscription_end) return 0;
        return max(0, now()->diffInDays($this->subscription_end, false));
    }
}
