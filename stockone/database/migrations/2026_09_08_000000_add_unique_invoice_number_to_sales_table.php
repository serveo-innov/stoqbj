<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// CORRECTIF (numeros de facture dupliques) : filet de securite en base,
// en complement du verrou applicatif ajoute dans SaleController::store().
// Unique par (shop_id, invoice_number) et non globalement, car deux
// boutiques differentes peuvent legitimement generer le meme numero
// FAC-YYYY-XXXXX (la numerotation repart de 1 par boutique et par annee).
//
// IMPORTANT avant de migrer : si le bug de collision s'est deja produit
// en production, des doublons existants feraient echouer cette migration.
// Verifier AVANT avec :
//   SELECT shop_id, invoice_number, COUNT(*) c
//   FROM sales
//   WHERE invoice_number IS NOT NULL
//   GROUP BY shop_id, invoice_number
//   HAVING c > 1;
// S'il y a des resultats, il faut d'abord renumeroter manuellement les
// doublons avant de lancer "php artisan migrate".
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->unique(['shop_id', 'invoice_number'], 'sales_shop_invoice_unique');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropUnique('sales_shop_invoice_unique');
        });
    }
};
