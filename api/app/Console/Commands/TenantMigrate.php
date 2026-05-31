<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Services\TenantService;
use Illuminate\Console\Command;

class TenantMigrate extends Command
{
    protected $signature = 'tenant:migrate {--slug= : Migrar apenas este tenant}';

    protected $description = 'Corre as migrações tenant em todos os tenants (ou num específico)';

    public function handle(TenantService $tenants): int
    {
        $query = Tenant::query();
        if ($slug = $this->option('slug')) {
            $query->where('slug', $slug);
        }

        foreach ($query->get() as $tenant) {
            $this->info("Migrando: {$tenant->slug}");
            $tenants->migrate($tenant);
        }

        $this->info('Concluído.');

        return self::SUCCESS;
    }
}
