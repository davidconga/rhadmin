<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\TenantService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class TenantCreate extends Command
{
    protected $signature = 'tenant:create
        {name : Nome da empresa}
        {--slug= : Slug/subdomínio (gerado a partir do nome se omitido)}
        {--admin-email= : Email do utilizador admin inicial}
        {--admin-password= : Password do admin inicial}
        {--demo : Semear empresa e funcionários de exemplo}';

    protected $description = 'Cria um novo tenant (BD SQLite isolada + migrações) e um utilizador admin';

    public function handle(TenantService $tenants): int
    {
        $name = $this->argument('name');
        $slug = $this->option('slug');

        $tenant = $tenants->create($name, $slug);
        $this->info("Tenant criado: {$tenant->name} (slug: {$tenant->slug})");
        $this->line("BD: {$tenant->database_path}");

        $email = $this->option('admin-email');
        $password = $this->option('admin-password');

        if ($email && $password) {
            $tenants->makeCurrent($tenant);
            User::create([
                'name' => 'Administrador',
                'email' => $email,
                'password' => Hash::make($password),
                'role' => 'admin',
                'active' => true,
            ]);
            $this->info("Admin criado: {$email}");
        }

        if ($this->option('demo')) {
            $tenants->makeCurrent($tenant);
            (new \Database\Seeders\DemoDataSeeder())->run();
            $this->info('Dados demo semeados (empresa + 6 funcionários).');
        }

        return self::SUCCESS;
    }
}
