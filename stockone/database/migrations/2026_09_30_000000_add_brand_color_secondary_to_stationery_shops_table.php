<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Deuxieme couleur personnalisable par boutique, pour les PDF
     * (factures, tickets, rapports). brand_color reste la couleur
     * principale ; brand_color_secondary est l'accent (ex: "Reste du",
     * alertes). Si une boutique ne personnalise pas, les templates PDF
     * retombent sur les couleurs du systeme Stoq.bj (#F97316 / #EA580C),
     * jamais sur cette colonne vide.
     */
    public function up(): void
    {
        Schema::table('stationery_shops', function (Blueprint $table) {
            $table->string('brand_color_secondary', 7)->nullable()->after('brand_color');
        });
    }

    public function down(): void
    {
        Schema::table('stationery_shops', function (Blueprint $table) {
            $table->dropColumn('brand_color_secondary');
        });
    }
};
