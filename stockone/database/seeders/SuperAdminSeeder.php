<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class SuperAdminSeeder extends Seeder
{
    /**
     * CORRECTIF DE SECURITE.
     *
     * Avant : le mot de passe etait ecrit en clair dans ce fichier (depot
     * public) et chaque execution du seeder le REMETTAIT a cette valeur,
     * meme pour un compte existant.
     *
     * Maintenant :
     *  - un compte Super Admin existant n'a JAMAIS son mot de passe modifie ;
     *  - a la creation, le mot de passe vient de SUPERADMIN_PASSWORD (.env)
     *    ou, a defaut, est genere au hasard et affiche UNE seule fois ;
     *  - l'adresse peut etre choisie via SUPERADMIN_EMAIL (.env).
     */
    public function run(): void
    {
        $email = env('SUPERADMIN_EMAIL', 'superadmin@stoq.bj');

        $existing = User::where('email', $email)->first();

        if ($existing) {
            $existing->update([
                'shop_id'   => null,
                'role'      => 'super_admin',
                'is_active' => true,
            ]);

            $this->command->info("Super Admin deja present ({$email}) : mot de passe INCHANGE.");
            return;
        }

        $fromEnv  = env('SUPERADMIN_PASSWORD');
        $password = $fromEnv ?: Str::password(20);

        User::create([
            'shop_id'   => null,
            'name'      => 'Admin',
            'firstname' => 'Super',
            'email'     => $email,
            'password'  => Hash::make($password),
            'role'      => 'super_admin',
            'is_active' => true,
        ]);

        $this->command->info("Super Admin cree : {$email}");

        if (! $fromEnv) {
            $this->command->warn('Mot de passe genere (affiche une seule fois, a noter maintenant) :');
            $this->command->line('  ' . $password);
        }
    }
}
