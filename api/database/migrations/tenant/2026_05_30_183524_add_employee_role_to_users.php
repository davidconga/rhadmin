<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Verifica se o role 'employee' já existe antes de recriar a tabela
        $hasEmployee = DB::table('users')->where('role', 'employee')->exists()
            || str_contains(DB::select("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")[0]->sql ?? '', "'employee'");
        if ($hasEmployee) return;

        // SQLite não suporta ALTER COLUMN — recria a tabela com o novo CHECK constraint
        DB::statement('PRAGMA foreign_keys = OFF');

        DB::statement('
            CREATE TABLE users_new (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NULLABLE,
                name       TEXT NOT NULL,
                email      TEXT NOT NULL UNIQUE,
                email_verified_at TEXT,
                password   TEXT NOT NULL,
                role       TEXT NOT NULL DEFAULT \'viewer\'
                           CHECK (role IN (\'admin\',\'manager\',\'viewer\',\'employee\')),
                active     INTEGER NOT NULL DEFAULT 1,
                last_login_at TEXT,
                remember_token TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        ');

        DB::statement('INSERT INTO users_new SELECT * FROM users');
        DB::statement('DROP TABLE users');
        DB::statement('ALTER TABLE users_new RENAME TO users');

        DB::statement('PRAGMA foreign_keys = ON');
    }

    public function down(): void
    {
        DB::statement('PRAGMA foreign_keys = OFF');

        DB::statement('
            CREATE TABLE users_new (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NULLABLE,
                name       TEXT NOT NULL,
                email      TEXT NOT NULL UNIQUE,
                email_verified_at TEXT,
                password   TEXT NOT NULL,
                role       TEXT NOT NULL DEFAULT \'viewer\'
                           CHECK (role IN (\'admin\',\'manager\',\'viewer\')),
                active     INTEGER NOT NULL DEFAULT 1,
                last_login_at TEXT,
                remember_token TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        ');

        DB::statement('INSERT INTO users_new SELECT * FROM users WHERE role != \'employee\'');
        DB::statement('DROP TABLE users');
        DB::statement('ALTER TABLE users_new RENAME TO users');

        DB::statement('PRAGMA foreign_keys = ON');
    }
};
