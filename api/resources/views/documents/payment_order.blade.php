<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="utf-8">
    <style>
        * { font-family: DejaVu Sans, sans-serif; }
        body { color: #1f2937; font-size: 11px; }
        .header { border-bottom: 3px solid #085041; padding-bottom: 10px; margin-bottom: 16px; }
        .header table { width: 100%; }
        .logo { width: 80px; }
        .company-name { font-size: 17px; font-weight: bold; color: #085041; }
        .muted { color: #6b7280; font-size: 9px; }
        h1 { font-size: 14px; color: #085041; margin: 0 0 4px; }
        .meta td { padding: 2px 6px; font-size: 11px; }
        table.lines { width: 100%; border-collapse: collapse; margin-top: 12px; }
        table.lines th { background: #085041; color: #fff; text-align: left; padding: 6px 8px; font-size: 10px; }
        table.lines td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }
        .amount { text-align: right; }
        .total-row td { font-weight: bold; border-top: 2px solid #085041; font-size: 12px; color: #085041; }
        .footer { margin-top: 30px; font-size: 9px; color: #6b7280; }
        .sign { margin-top: 40px; width: 100%; }
        .sign td { width: 33%; text-align: center; font-size: 10px; padding-top: 30px; }
        .sign .line { border-top: 1px solid #1f2937; margin: 0 15px; padding-top: 4px; }
        .status { display:inline-block; padding:2px 8px; border-radius:10px; font-size:9px; background:#eef2f6; color:#085041; }
    </style>
</head>
<body>
    <div class="header">
        <table>
            <tr>
                <td>
                    @if($logoData)<img class="logo" src="{{ $logoData }}">@endif
                    <div class="company-name">{{ $company->name }}</div>
                    <div class="muted">{{ $company->nif ? 'NIF: '.$company->nif : '' }}{{ $company->address ? ' · '.$company->address : '' }}</div>
                </td>
                <td style="text-align:right;">
                    <h1>ORDEM DE PAGAMENTO / TRANSFERÊNCIA</h1>
                    <div class="muted">Ref.: {{ $order->reference_number }}</div>
                    <div class="status">{{ $statusLabel }}</div>
                </td>
            </tr>
        </table>
    </div>

    <p style="font-size:11px;">
        Ao <strong>{{ $bankName }}</strong>,<br>
        Solicitamos a V. Exas. que procedam à transferência dos montantes abaixo
        discriminados, referentes a <strong>{{ $monthName }} / {{ $order->year }}</strong>,
        por débito da conta <strong>{{ $order->debit_account ?: '—' }}</strong>.
    </p>

    <table class="lines">
        <thead>
            <tr>
                <th style="width:30px;">#</th>
                <th>Beneficiário</th>
                <th>IBAN</th>
                <th>Banco</th>
                <th class="amount">Montante ({{ $currency }})</th>
            </tr>
        </thead>
        <tbody>
            @foreach($order->items as $i => $item)
            <tr>
                <td>{{ $i + 1 }}</td>
                <td>{{ $item->beneficiary }}</td>
                <td>{{ $item->iban ?: '—' }}</td>
                <td>{{ $item->bank ?: '—' }}</td>
                <td class="amount">{{ $fmt($item->amount) }}</td>
            </tr>
            @endforeach
            <tr class="total-row">
                <td colspan="4">TOTAL ({{ count($order->items) }} beneficiários)</td>
                <td class="amount">{{ $fmt($order->total_amount) }}</td>
            </tr>
        </tbody>
    </table>

    @if($order->notes)
        <p style="margin-top:12px; font-size:10px;"><strong>Observações:</strong> {{ $order->notes }}</p>
    @endif

    <table class="sign">
        <tr>
            <td><div class="line">Elaborado por</div></td>
            <td><div class="line">Aprovado por</div></td>
            <td><div class="line">Autorizado por</div></td>
        </tr>
    </table>

    <div class="footer">Documento gerado por RHadmin em {{ $generatedAt }}.</div>
</body>
</html>
