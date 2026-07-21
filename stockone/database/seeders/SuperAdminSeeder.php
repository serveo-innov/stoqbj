<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'superadmin@stoq.bj'],
            [
                'shop_id'   => null,
                'name'      => 'Admin',
                'firstname' => 'Super',
                'email'     => 'superadmin@stoq.bj',
                'password'  => Hash::make('StockOne@2025'),
                'role'      => 'super_admin',
                'is_active' => true,
            ]
        );

        $this->command->info('Super Admin créé :');
        $this->command->info('  Email    : superadmin@stoq.bj');
        $this->command->info('  Password : StockOne@2025');
        $this->command->warn('  ⚠️  Changez ce mot de passe en production !');
    }
}
