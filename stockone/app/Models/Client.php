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

    // CORRECTIF (KPI dette client incoherent) : cette methode excluait les
    // credits "doubtful", alors que le KPI "Total restant du" de l'ecran
    // Credits (CreditController::index) les INCLUT (whereNotIn(['paid'])).
    // Un meme montant douteux comptait dans un total et pas dans l'autre.
    // Alignement sur la meme definition (tout sauf "paid").
    public function getTotalDebtAttribute(): float
    {
        return $this->creditSales()
            ->whereNotIn('status', ['paid'])
            ->sum('amount_remaining');
    }

    // CORRECTIF (doublons clients par telephone) : le rapprochement de
    // clients (flux "Extra" en caisse, creation inline) se faisait par
    // egalite EXACTE sur le telephone. "+22990000001", "22990000001" et
    // "90000001" (le meme numero, trois formats differents) ne matchaient
    // jamais entre eux et creaient 3 fiches distinctes pour la meme
    // personne au fil du temps — dette et historique eclates.
    //
    // On normalise en ne gardant que les chiffres, et en comparant les 8
    // derniers chiffres (longueur d'un numero mobile local au Benin, une
    // fois l'indicatif +229 retire), quel que soit le prefixe utilise.
    public static function normalizePhone(string $raw): string
    {
        $digits = preg_replace('/\D+/', '', $raw) ?? '';
        return substr($digits, -8) ?: $digits;
    }

    /**
     * Cherche un client existant de la boutique dont le telephone
     * correspond (une fois normalise) a $rawPhone. Retourne null si
     * aucune correspondance.
     */
    public static function findByNormalizedPhone(int $shopId, string $rawPhone): ?self
    {
        $normalized = self::normalizePhone($rawPhone);
        if ($normalized === '') return null;

        return self::forShop($shopId)
            ->get()
            ->first(fn($c) => self::normalizePhone($c->phone) === $normalized);
    }
}
