<?php

namespace App\Services;

use App\Models\Tenant;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TenantService
{
    /**
     * The tenant resolved for the current request, if any.
     */
    protected ?Tenant $current = null;

    /**
     * Point the 'tenant' connection at the given tenant's SQLite file and make
     * it the default connection so all tenant-scoped models (User, Employee,
     * SalarySlip, Sanctum tokens, ...) resolve against the right database.
     */
    public function makeCurrent(Tenant $tenant): void
    {
        $this->current = $tenant;

        Config::set('database.connections.tenant.database', $tenant->database_path);

        DB::purge('tenant');
        DB::setDefaultConnection('tenant');
        DB::reconnect('tenant');
    }

    public function current(): ?Tenant
    {
        return $this->current;
    }

    public function forget(): void
    {
        $this->current = null;
        DB::setDefaultConnection('central');
    }

    public function databasePathFor(string $slug): string
    {
        return storage_path("databases/{$slug}.sqlite");
    }

    /**
     * Create a brand-new tenant: registry row + SQLite file + migrations.
     */
    public function create(string $name, ?string $slug = null): Tenant
    {
        $slug = $slug ?: Str::slug($name);
        $path = $this->databasePathFor($slug);

        if (! is_dir(dirname($path))) {
            mkdir(dirname($path), 0755, true);
        }
        if (! file_exists($path)) {
            touch($path);
        }

        $tenant = Tenant::create([
            'name' => $name,
            'slug' => $slug,
            'subdomain' => $slug,
            'database_path' => $path,
            'active' => true,
        ]);

        $this->migrate($tenant);

        return $tenant;
    }

    /**
     * Run the tenant migration set against the tenant's database file.
     */
    public function migrate(Tenant $tenant, bool $fresh = false): void
    {
        Config::set('database.connections.tenant.database', $tenant->database_path);
        DB::purge('tenant');

        Artisan::call($fresh ? 'migrate:fresh' : 'migrate', [
            '--database' => 'tenant',
            '--path' => 'database/migrations/tenant',
            '--realpath' => false,
            '--force' => true,
        ]);
    }
}
