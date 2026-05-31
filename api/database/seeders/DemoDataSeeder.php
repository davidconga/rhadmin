<?php

namespace Database\Seeders;

use App\Models\Bank;
use App\Models\Company;
use App\Models\Department;
use App\Models\Employee;
use Illuminate\Database\Seeder;

/**
 * Popula o tenant ATUAL (já selecionado via TenantService) com uma empresa de
 * exemplo e alguns funcionários. Deve ser chamado depois de makeCurrent().
 */
class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedBanks();
        $this->seedDepartments();

        $company = Company::firstOrCreate(['name' => 'Matombe Desenvolvedor (su) Lda'], [
            'nif' => '5000123456',
            'address' => 'Rua da Missão, Luanda',
            'phone' => '+244 923 000 000',
            'email' => 'geral@matombe.ao',
            'bank_name' => 'Banco BAI',
            'account_number' => '000123456789',
            'iban' => 'AO06 0040 0000 1234 5678 9012 3',
            'default_debit_account' => '000123456789',
            'currency' => 'AOA',
            'active' => true,
        ]);

        $employees = [
            ['Ana Domingos', 'Diretora Financeira', 'Financeiro', 650000, 30000, 25000],
            ['Carlos Mateus', 'Programador Sénior', 'TI', 420000, 25000, 20000],
            ['Beatriz Santos', 'Contabilista', 'Financeiro', 280000, 20000, 15000],
            ['Domingos Paulo', 'Técnico de Suporte', 'TI', 145000, 18000, 15000],
            ['Esperança João', 'Recepcionista', 'Administração', 85000, 15000, 12000],
            ['Filipe Nunes', 'Gestor de Projetos', 'TI', 510000, 30000, 25000],
        ];

        foreach ($employees as $i => [$name, $position, $dept, $base, $food, $transport]) {
            Employee::firstOrCreate(
                ['full_name' => $name],
                [
                    'company_id' => $company->id,
                    'bi_nif' => '00'.(1000000 + $i).'LA0'.($i + 30),
                    'position' => $position,
                    'department' => $dept,
                    'bank_name' => 'Banco BAI',
                    'account_number' => '0001'.str_pad((string) ($i + 1), 8, '0', STR_PAD_LEFT),
                    'iban' => 'AO06 0040 0000 '.str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT).' 5678 9012 3',
                    'base_salary' => $base,
                    'food_allowance' => $food,
                    'transport_allowance' => $transport,
                    'social_security_rate' => 3,
                    'active' => true,
                ]
            );
        }
    }

    private function seedDepartments(): void
    {
        $departments = [
            ['Financeiro',     'FIN', 'Gestão financeira, contabilidade e tesouraria'],
            ['Recursos Humanos', 'RH', 'Recrutamento, folha de salários e bem-estar'],
            ['TI',             'TI',  'Tecnologias de informação e suporte técnico'],
            ['Administração',  'ADM', 'Serviços administrativos e secretariado'],
            ['Comercial',      'COM', 'Vendas, marketing e relações com clientes'],
            ['Operações',      'OPE', 'Logística e operações gerais'],
        ];

        foreach ($departments as [$name, $code, $description]) {
            Department::firstOrCreate(
                ['name' => $name],
                ['code' => $code, 'description' => $description, 'active' => true]
            );
        }
    }

    private function seedBanks(): void
    {
        $banks = [
            ['Banco BAI', '0040', 'BAIPAOLU'],
            ['Banco BFA', '0006', 'BFMXAOLU'],
            ['Banco BIC', '0051', 'BMAIAOLU'],
            ['Banco Millennium Atlântico', '0055', 'BCOMAOLU'],
            ['Banco Sol', '0044', 'BSOLAOLU'],
            ['Standard Bank Angola', '0070', 'SBICAOLX'],
            ['Banco de Poupança e Crédito (BPC)', '0010', 'PALCAOLU'],
            ['Banco Económico', '0072', 'BCEAAOLU'],
        ];

        foreach ($banks as [$name, $code, $bic]) {
            Bank::firstOrCreate(['name' => $name], ['code' => $code, 'bic' => $bic, 'active' => true]);
        }
    }
}
