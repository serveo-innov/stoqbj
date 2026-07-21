<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'shop_id',
        'name',
        'firstname',
        'email',
        'phone',
        'password',
        'role',
        'is_active',
        'totp_secret',
        'totp_enabled',
        'last_login_at',
        'last_login_ip',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'totp_secret',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at'     => 'datetime',
            'password'          => 'hashed',
            'is_active'         => 'boolean',
            'totp_enabled'      => 'boolean',
        ];
    }

    // ──────────────────────────────────────────
    // Relations
    // ──────────────────────────────────────────

    public function shop()
    {
        return $this->belongsTo(StationeryShop::class, 'shop_id');
    }

    // ──────────────────────────────────────────
    // Helpers rôles
    // ──────────────────────────────────────────

    public function isSuperAdmin(): bool
    {
        return $this->role === 'super_admin';
    }

    public function isAdminShop(): bool
    {
        return $this->role === 'admin_shop';
    }

    public function isGerant(): bool
    {
        return $this->role === 'gerant';
    }

    public function isCaissier(): bool
    {
        return $this->role === 'caissier';
    }

    public function hasRole(string|array $roles): bool
    {
        return in_array($this->role, (array) $roles);
    }

    // Peut gérer le catalogue produits
    public function canManageCatalogue(): bool
    {
        return $this->hasRole(['super_admin', 'admin_shop', 'gerant']);
    }

    // Peut voir les rapports complets
    public function canViewFullReports(): bool
    {
        return $this->hasRole(['super_admin', 'admin_shop', 'gerant']);
    }

    // Peut modifier les prix
    public function canAdjustPrices(): bool
    {
        return $this->hasRole(['super_admin', 'admin_shop', 'gerant']);
    }

    // Peut gérer les utilisateurs
    public function canManageUsers(): bool
    {
        return $this->hasRole(['super_admin', 'admin_shop']);
    }

    // Peut accéder aux paramètres boutique
    public function canManageShopSettings(): bool
    {
        return $this->hasRole(['super_admin', 'admin_shop']);
    }

    // Peut valider les ajustements de stock
    public function canValidateStockAdjustments(): bool
    {
        return $this->hasRole(['super_admin', 'admin_shop', 'gerant']);
    }

    // Peut gérer les papeteries (Super Admin uniquement)
    public function canManageShops(): bool
    {
        return $this->isSuperAdmin();
    }
}
