<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// CORRECTIF (Test 3 - annulation de vente à crédit) : avant, un crédit
// annulé était force au statut "paid" (aucun autre statut disponible),
// alors que amount_due (montant initial) restait inchange — un credit
// annule affichait "Solde" avec Paye:0 / Restant:0 mais Total toujours
// non nul, incoherent visuellement et ambigu ("Solde" = vraiment regle,
// ou juste annule ?). Ajout d'un statut distinct "cancelled".
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE credit_sales MODIFY COLUMN status ENUM(
            'pending',
            'partial',
            'paid',
            'overdue',
            'doubtful',
            'cancelled'
        ) DEFAULT 'pending'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE credit_sales MODIFY COLUMN status ENUM(
            'pending',
            'partial',
            'paid',
            'overdue',
            'doubtful'
        ) DEFAULT 'pending'");
    }
};
