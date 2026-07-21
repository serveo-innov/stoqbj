<?php

namespace Database\Seeders;

use App\Models\StationeryShop;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class TestShopSeeder extends Seeder
{
    public function run(): void
    {
        // Boutique de test
        $shop = StationeryShop::create([
            'shop_name'       => 'Papeterie Centrale Cotonou',
            'commercial_name' => 'PCC',
            'owner_name'      => 'Azonwakin',
            'owner_firstname' => 'Rodrigue',
            'owner_phone'     => '+22997000001',
            'owner_email'     => 'admin@pcc.bj',
            'address'         => 'Rue des Librairies, Ganhi',
            'city'            => 'Cotonou',
            'country'         => 'Benin',
            'status'          => 'active',
            'subscription_start' => now(),
            'subscription_end'   => now()->addYear(),
            'brand_color'     => '#1a73e8',
        ]);

        // Admin Shop
        User::create([
            'shop_id'   => $shop->id,
            'name'      => 'Azonwakin',
            'firstname' => 'Rodrigue',
            'email'     => 'admin@pcc.bj',
            'password'  => Hash::make('Pcc@2025'),
            'role'      => 'admin_shop',
            'is_active' => true,
        ]);

        // Gerant
        User::create([
            'shop_id'   => $shop->id,
            'name'      => 'Hounkonnou',
            'firstname' => 'Martial',
            'email'     => 'gerant@pcc.bj',
            'password'  => Hash::make('Pcc@2025'),
            'role'      => 'gerant',
            'is_active' => true,
        ]);

        // Caissier
        User::create([
            'shop_id'   => $shop->id,
            'name'      => 'Dossou',
            'firstname' => 'Aime',
            'email'     => 'caissier@pcc.bj',
            'password'  => Hash::make('Pcc@2025'),
            'role'      => 'caissier',
            'is_active' => true,
        ]);

        $this->command->info('Boutique de test creee :');
        $this->command->info("  Shop ID  : {$shop->id}");
        $this->command->info('  Admin    : admin@pcc.bj / Pcc@2025');
        $this->command->info('  Gerant   : gerant@pcc.bj / Pcc@2025');
        $this->command->info('  Caissier : caissier@pcc.bj / Pcc@2025');
    }
}
