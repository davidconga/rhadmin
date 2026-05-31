<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8">
<style>
* { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #1f2937; margin: 0; padding: 0; }
body { padding: 40px 50px; }
.header { border-bottom: 3px solid #085041; padding-bottom: 14px; margin-bottom: 20px; }
.header table { width: 100%; }
.company-name { font-size: 16px; font-weight: bold; color: #085041; }
.company-sub { font-size: 9px; color: #6b7280; margin-top: 2px; }
.doc-badge { background: #085041; color: white; padding: 6px 16px; border-radius: 4px; font-size: 13px; font-weight: bold; text-align: center; }
.doc-number { font-size: 10px; color: #fff; text-align: center; margin-top: 2px; }
.section { margin: 16px 0; }
.section-title { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 6px; }
.parties { width: 100%; border-collapse: collapse; }
.parties td { vertical-align: top; padding: 0 8px 0 0; width: 50%; }
.box { border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px 12px; }
.box .label { font-size: 9px; color: #6b7280; }
.box .value { font-weight: bold; color: #1f2937; margin-top: 1px; }
.box .sub { font-size: 10px; color: #374151; margin-top: 2px; }
table.lines { width: 100%; border-collapse: collapse; margin-top: 10px; }
table.lines th { background: #085041; color: #fff; padding: 7px 10px; text-align: left; font-size: 10px; }
table.lines th.r { text-align: right; }
table.lines td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; }
table.lines td.r { text-align: right; }
.total-row td { font-weight: bold; background: #f9fafb; border-top: 2px solid #085041; }
.total-value { font-size: 14px; color: #085041; font-weight: bold; }
.footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9ca3af; text-align: center; }
.badge-valid { display: inline-block; background: #ecfdf5; color: #065f46; border: 1px solid #6ee7b7; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: bold; margin-bottom: 8px; }
</style>
</head>
<body>

  {{-- Cabeçalho --}}
  <div class="header">
    <table>
      <tr>
        <td style="width:65%">
          <div class="company-name">{{ $issuer['name'] }}</div>
          <div class="company-sub">
            @if($issuer['nif']) NIF: {{ $issuer['nif'] }} &nbsp;·&nbsp; @endif
            {{ $issuer['address'] }}
          </div>
          @if($issuer['email'])
          <div class="company-sub">{{ $issuer['email'] }}</div>
          @endif
        </td>
        <td style="text-align:right; width:35%">
          <div class="doc-badge">FACTURA-RECIBO</div>
          <div class="doc-number" style="color:#085041; font-weight:bold; margin-top:4px;">Nº {{ $frNumber }}</div>
          <div style="font-size:9px; color:#6b7280; margin-top:2px;">{{ $issuedAt }}</div>
        </td>
      </tr>
    </table>
  </div>

  {{-- Emitente / Cliente --}}
  <div class="section">
    <table class="parties">
      <tr>
        <td>
          <div class="section-title">Emitente</div>
          <div class="box">
            <div class="value">{{ $issuer['name'] }}</div>
            @if($issuer['nif']) <div class="sub">NIF: {{ $issuer['nif'] }}</div> @endif
            <div class="sub">{{ $issuer['address'] }}</div>
          </div>
        </td>
        <td>
          <div class="section-title">Cliente</div>
          <div class="box">
            <div class="value">{{ $client['name'] }}</div>
            @if($client['nif']) <div class="sub">NIF: {{ $client['nif'] }}</div> @endif
            @if($client['address']) <div class="sub">{{ $client['address'] }}</div> @endif
            @if($client['email']) <div class="sub">{{ $client['email'] }}</div> @endif
          </div>
        </td>
      </tr>
    </table>
  </div>

  {{-- Tabela de serviços --}}
  <div class="section">
    <div class="section-title">Descrição dos serviços</div>
    <table class="lines">
      <thead>
        <tr>
          <th>Descrição</th>
          <th class="r" style="width:80px">Qtd</th>
          <th class="r" style="width:120px">Preço Unit.</th>
          <th class="r" style="width:120px">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            Subscrição mensal — <strong>{{ $planName }}</strong><br>
            <span style="font-size:9px; color:#6b7280;">Ref. pagamento: {{ $reference }} &nbsp;·&nbsp; Período: {{ $period }}</span>
          </td>
          <td class="r">1</td>
          <td class="r">{{ $fmt($amount) }} AOA</td>
          <td class="r">{{ $fmt($amount) }} AOA</td>
        </tr>
        <tr class="total-row">
          <td colspan="3" style="text-align:right; padding-right:12px; font-size:10px;">Total a pagar:</td>
          <td class="r total-value">{{ $fmt($amount) }} AOA</td>
        </tr>
      </tbody>
    </table>
  </div>

  {{-- Estado --}}
  <div style="margin-top:12px; text-align:center">
    <span class="badge-valid">✓ PAGO — {{ $paidAt }}</span>
  </div>

  <div class="footer">
    Documento processado por sistema informático &nbsp;·&nbsp;
    {{ $issuer['name'] }} &nbsp;·&nbsp; {{ $issuedAt }}
  </div>

</body>
</html>
