<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="utf-8">
    <style>
        * { font-family: DejaVu Sans, sans-serif; }
        body { color: #1f2937; font-size: 12px; }
        .header { border-bottom: 3px solid #085041; padding-bottom: 10px; margin-bottom: 18px; }
        .header table { width: 100%; }
        .logo { width: 90px; }
        .company-name { font-size: 18px; font-weight: bold; color: #085041; }
        .muted { color: #6b7280; font-size: 10px; }
        h1 { font-size: 15px; color: #085041; margin: 0 0 4px; }
        .meta { margin: 12px 0; }
        .meta td { padding: 2px 6px; }
        table.lines { width: 100%; border-collapse: collapse; margin-top: 10px; }
        table.lines th { background: #085041; color: #fff; text-align: left; padding: 6px 8px; font-size: 11px; }
        table.lines td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
        .amount { text-align: right; }
        .section-title { background: #eef2f6; font-weight: bold; color: #085041; }
        .total-row td { font-weight: bold; border-top: 2px solid #085041; }
        .net { font-size: 14px; color: #085041; }
        .footer { margin-top: 40px; font-size: 10px; color: #6b7280; }
        .sign { margin-top: 50px; }
        .sign td { width: 50%; text-align: center; vertical-align: bottom; }
        .sign .line { border-top: 1px solid #1f2937; margin: 0 30px; padding-top: 4px; font-size: 11px; }
        .sign .sig-img { max-height: 48px; margin-bottom: 4px; }
        .sign .sig-name { font-size: 10px; color: #6b7280; margin-bottom: 4px; }
    </style>
</head>
<body>
    <div class="header">
        <table>
            <tr>
                <td>
                    @if($logoData)
                        <img class="logo" src="{{ $logoData }}" alt="logo">
                    @endif
                    <div class="company-name">{{ $company->name }}</div>
                    <div class="muted">
                        {{ $company->nif ? 'NIF: '.$company->nif : '' }}
                        {{ $company->address ? ' · '.$company->address : '' }}
                    </div>
                </td>
                <td style="text-align:right;">
                    <h1>RECIBO DE SALÁRIO</h1>
                    <div class="muted">Referência: {{ $slip->id }}/{{ $slip->year }}</div>
                </td>
            </tr>
        </table>
    </div>

    <table class="meta">
        <tr>
            <td><strong>Funcionário:</strong> {{ $employee->full_name }}</td>
            <td><strong>Função:</strong> {{ $employee->position ?: '—' }}</td>
        </tr>
        <tr>
            <td><strong>BI/NIF:</strong> {{ $employee->bi_nif ?: '—' }}</td>
            <td><strong>Departamento:</strong> {{ $employee->department ?: '—' }}</td>
        </tr>
        <tr>
            <td><strong>Período:</strong> {{ $monthName }} / {{ $slip->year }}</td>
            <td><strong>IBAN:</strong> {{ $employee->iban ?: '—' }}</td>
        </tr>
    </table>

    <table class="lines">
        <thead>
            <tr><th>Descrição</th><th class="amount">Valor ({{ $currency }})</th></tr>
        </thead>
        <tbody>
            <tr><td class="section-title" colspan="2">Rendimentos</td></tr>
            <tr><td>Salário base</td><td class="amount">{{ $fmt($slip->base_salary) }}</td></tr>
            <tr><td>Subsídio de alimentação</td><td class="amount">{{ $fmt($slip->food_allowance) }}</td></tr>
            <tr><td>Subsídio de transporte</td><td class="amount">{{ $fmt($slip->transport_allowance) }}</td></tr>
            <tr><td>Horas extra{{ $slip->overtime_hours > 0 ? ' ('.(float)$slip->overtime_hours.'h)' : '' }}</td><td class="amount">{{ $fmt($slip->overtime) }}</td></tr>
            <tr><td>Outros rendimentos</td><td class="amount">{{ $fmt($slip->other_income) }}</td></tr>
            <tr class="total-row"><td>Salário bruto</td><td class="amount">{{ $fmt($slip->gross_salary) }}</td></tr>

            <tr><td class="section-title" colspan="2">Descontos</td></tr>
            <tr><td>IRT</td><td class="amount">{{ $fmt($slip->irt_tax) }}</td></tr>
            <tr><td>Segurança Social (INSS)</td><td class="amount">{{ $fmt($slip->social_security) }}</td></tr>
            <tr><td>Outros descontos{{ $slip->absence_days > 0 ? ' (faltas: '.$slip->absence_days.' dia'.($slip->absence_days > 1 ? 's' : '').')' : '' }}</td><td class="amount">{{ $fmt($slip->other_deductions) }}</td></tr>
            <tr class="total-row"><td>Total de descontos</td><td class="amount">{{ $fmt($slip->total_deductions) }}</td></tr>

            <tr class="total-row net"><td>SALÁRIO LÍQUIDO</td><td class="amount">{{ $fmt($slip->net_salary) }}</td></tr>
        </tbody>
    </table>

    <table class="sign">
        <tr>
            <td>
                @if(!empty($companySignatureData))
                    <div style="margin-bottom:4px;">
                        <img src="{{ $companySignatureData }}" class="sig-img" alt="assinatura empresa">
                    </div>
                @endif
                <div class="line">
                    A Entidade Empregadora
                    @if(!empty($issuedByName))
                        <br><span style="font-size:10px;color:#6b7280;">{{ $issuedByName }}</span>
                    @endif
                    @if(!empty($issuedAt))
                        <br><span style="font-size:10px;color:#6b7280;">{{ $issuedAt }}</span>
                    @endif
                </div>
            </td>
            <td>
                @if(!empty($receiptSignatureData))
                    <div style="margin-bottom:4px;">
                        <img src="{{ $receiptSignatureData }}" class="sig-img" alt="assinatura">
                    </div>
                @endif
                <div class="line">
                    O Funcionário
                    @if(!empty($receiptConfirmedAt))
                        <br><span style="font-size:10px;color:#6b7280;">Confirmado em {{ $receiptConfirmedAt }}</span>
                    @endif
                </div>
            </td>
        </tr>
    </table>

    <div class="footer">
        Documento gerado por RHadmin em {{ $generatedAt }}.
    </div>
</body>
</html>
