<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// TRACABILITE DES ANNULATIONS DE VENTE
// Avant : annuler une vente ne laissait aucune trace de QUI l'avait
// annulee, QUAND, ni POURQUOI — seul le statut passait a "cancelled".
// L'annulation de vente etant un vecteur de fraude classique en caisse
// (vendre, encaisser, puis annuler pour effacer l'ecart), l'absence de
// tracabilite rendait tout controle a posteriori impossible.
//
// Choix assume : on ne BLOQUE pas l'annulation par role (beaucoup de
// petites boutiques tournent avec un seul employe, sans gerant present),
// on la rend TRACABLE et ATTRIBUABLE. Le motif devient obligatoire.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->foreignId('cancelled_by')->nullable()->after('status')
                  ->constrained('users')->nullOnDelete();
            $table->timestamp('cancelled_at')->nullable()->after('cancelled_by');
            $table->text('cancel_reason')->nullable()->after('cancelled_at');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cancelled_by');
            $table->dropColumn(['cancelled_at', 'cancel_reason']);
        });
    }
};
