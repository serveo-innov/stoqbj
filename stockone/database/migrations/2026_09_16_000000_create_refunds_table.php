<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// REMBOURSEMENTS
// Avant : annuler une vente a credit deja partiellement payee etait
// purement et simplement BLOQUE (409 "Impossible : un paiement partiel a
// deja ete recu"), sans aucune porte de sortie. Un vrai cas legitime
// (client insatisfait qu'il faut rembourser puis annuler) n'avait aucun
// chemin possible dans l'app.
//
// Cette table documente chaque remboursement effectue lors d'une
// annulation : combien, par quel moyen, par qui, quand. On ne modifie
// jamais amount_paid (fait historique : "ce montant a ete recu a
// l'origine") — le remboursement est un evenement SEPARE et trace, pas
// une correction retroactive du passe.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('stationery_shops')->cascadeOnDelete();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->foreignId('credit_sale_id')->nullable()->constrained('credit_sales')->nullOnDelete();
            $table->foreignId('processed_by')->constrained('users');
            $table->decimal('amount', 12, 2);
            $table->enum('method', ['cash', 'mobile_money', 'virement'])->default('cash');
            $table->text('notes')->nullable();
            $table->timestamp('refunded_at');
            $table->timestamps();

            $table->index('shop_id');
            $table->index('sale_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refunds');
    }
};
